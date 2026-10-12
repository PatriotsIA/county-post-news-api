import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MarketServiceError } from "./market-error.js";

const metals = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" } as const;
type Metal = keyof typeof metals;
export type MetalsTickerResponse = {
  currency: "USD";
  unit: "troy oz";
  priceType: "spot";
  updatedAt: string;
  fetchedAt: string;
  nextRefreshAt: string;
  provider: { name: string; url: string };
  stale: boolean;
  items: Array<{
    key: Metal; label: string; price: number; quotedAt: string;
    previousPrice?: number; previousQuotedAt?: string;
  }>;
};

type State = { nextAttemptAt: number; failures: number; ticker?: MetalsTickerResponse };
type Stored = { state: State; etag: string };
export type MetalsStore = {
  read(): Promise<Stored | undefined>;
  write(state: State, etag?: string): Promise<string>;
};
const MIN_REFRESH_MS = 60_000;
const LEASE_MS = 120_000;
const STALE_QUOTE_MS = 15 * 60_000;
const MAX_QUOTE_AGE_MS = 4 * 24 * 60 * 60_000;
const KEY = "feed-cache/markets-gold-api-v1.json";
const s3 = new S3Client({ maxAttempts: 1 });
let local: Stored | undefined;
let revision = 0;

function bucket() {
  const value = process.env.FEED_CACHE_BUCKET;
  // Hosted instances must coordinate. An S3 failure must never become an
  // unthrottled, per-instance provider fallback.
  if (!value && (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production" || process.env.DYNO)) {
    throw new Error("Shared metals cache is required.");
  }
  return value;
}

const store: MetalsStore = {
  async read() {
    const Bucket = bucket();
    if (!Bucket) return local;
    try {
      const result = await s3.send(new GetObjectCommand({ Bucket, Key: KEY }), { abortSignal: AbortSignal.timeout(2500) });
      const state = JSON.parse(await result.Body!.transformToString()) as State;
      if (!result.ETag || !Number.isFinite(state.nextAttemptAt) || !Number.isInteger(state.failures) || state.failures < 0) {
        throw new Error("Invalid shared metals cache.");
      }
      return { state, etag: result.ETag };
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return undefined;
      throw error;
    }
  },
  async write(state, etag) {
    const Bucket = bucket();
    if (!Bucket) {
      if (local?.etag !== etag) throw new Error("Metals cache changed.");
      local = { state, etag: String(++revision) };
      return local.etag;
    }
    const result = await s3.send(new PutObjectCommand({
      Bucket, Key: KEY, Body: JSON.stringify(state), ContentType: "application/json",
      ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
    }), { abortSignal: AbortSignal.timeout(2500) });
    if (!result.ETag) throw new Error("Missing metals cache version.");
    return result.ETag;
  },
};

class ProviderError extends Error {
  constructor(message: string, readonly retryAt = 0) { super(message); }
}

function retryAt(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  const time = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function usable(ticker: MetalsTickerResponse | undefined) {
  return ticker?.priceType === "spot" && ticker.items.length === 4 &&
    ticker.items.every(item => Number.isFinite(item.price) && item.price > 0 &&
      Number.isFinite(Date.parse(item.quotedAt)) && Date.now() - Date.parse(item.quotedAt) <= MAX_QUOTE_AGE_MS);
}

function result(state?: State): MetalsTickerResponse {
  const ticker = state?.ticker;
  if (!usable(ticker)) throw new MarketServiceError(503, "Metal spot prices are temporarily unavailable. Please try again shortly.");
  return {
    ...ticker!,
    nextRefreshAt: new Date(state!.nextAttemptAt).toISOString(),
    stale: state!.failures > 0 || Date.now() - Date.parse(ticker!.fetchedAt) > 2 * MIN_REFRESH_MS ||
      ticker!.items.some(item => Date.now() - Date.parse(item.quotedAt) > STALE_QUOTE_MS),
  };
}

async function fetchPrices(previous: MetalsTickerResponse | undefined, leaseUntil: number) {
  const items: MetalsTickerResponse["items"] = [];
  let cacheUntil = 0;
  for (const [key, symbol] of Object.entries(metals) as Array<[Metal, string]>) {
    // Sequential calls, separated by over a second, including after errors
    // (which abort this batch). No automatic HTTP retries.
    if (items.length) await new Promise(resolve => setTimeout(resolve, 1100));
    const remaining = leaseUntil - Date.now() - 5000;
    if (remaining <= 0) throw new ProviderError("Metals refresh lease expired.");
    const response = await fetch(`https://api.gold-api.com/price/${symbol}`, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(Math.min(5000, remaining)),
    });
    if (!response.ok) throw new ProviderError(`Gold API HTTP ${response.status}`, retryAt(response));
    const cacheSeconds = Number(response.headers.get("cache-control")?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] || 0);
    cacheUntil = Math.max(cacheUntil, Date.now() + cacheSeconds * 1000);
    const data = await response.json() as { symbol?: string; currency?: string; price?: number; updatedAt?: string };
    const timestamp = Date.parse(data.updatedAt || "");
    if (data.symbol !== symbol || data.currency !== "USD" || typeof data.price !== "number" ||
        !Number.isFinite(data.price) || data.price <= 0 || !Number.isFinite(timestamp) ||
        timestamp > Date.now() + 60_000 || Date.now() - timestamp > MAX_QUOTE_AGE_MS) {
      throw new ProviderError("Gold API returned invalid or outdated prices.");
    }
    const before = previous?.items.find(item => item.key === key);
    if (before && timestamp < Date.parse(before.quotedAt)) throw new ProviderError("Gold API quote time moved backwards.");
    items.push({
      key, label: key[0].toUpperCase() + key.slice(1), price: data.price, quotedAt: new Date(timestamp).toISOString(),
      ...(before && timestamp > Date.parse(before.quotedAt)
        ? { previousPrice: before.price, previousQuotedAt: before.quotedAt }
        : before?.previousPrice ? { previousPrice: before.previousPrice, previousQuotedAt: before.previousQuotedAt } : {}),
    });
  }
  const nextAttemptAt = Math.max(Date.now() + MIN_REFRESH_MS, cacheUntil);
  return {
    nextAttemptAt,
    failures: 0,
    ticker: {
      currency: "USD", unit: "troy oz", priceType: "spot",
      updatedAt: new Date(Math.min(...items.map(item => Date.parse(item.quotedAt)))).toISOString(),
      fetchedAt: new Date().toISOString(), nextRefreshAt: new Date(nextAttemptAt).toISOString(),
      provider: { name: "Gold-API.com", url: "https://gold-api.com" }, stale: false, items,
    },
  } satisfies State;
}

/** One shared compare-and-swap state holds the lease, cooldown and last good
 * snapshot together. Cold starts and refresh clicks cannot bypass it. */
export function createMetalsService(storage: MetalsStore = store) {
  let pending: Promise<MetalsTickerResponse> | undefined;
  let remembered: State | undefined;
  let checkAfter = 0;
  async function load() {
    if (remembered && Date.now() < checkAfter) return result(remembered);
    let current: Stored | undefined;
    try { current = await storage.read(); }
    catch {
      // Fail closed on cache trouble, retaining only a bounded, dated snapshot.
      if (remembered) return result({ ...remembered, failures: Math.max(1, remembered.failures) });
      throw new MarketServiceError(503, "Metal spot prices are temporarily unavailable.");
    }
    remembered = current?.state;
    if (current && current.state.nextAttemptAt > Date.now()) {
      checkAfter = Math.min(Date.now() + 5000, current.state.nextAttemptAt);
      return result(current.state);
    }
    const lease: State = { ...current?.state, failures: current?.state.failures || 0, nextAttemptAt: Date.now() + LEASE_MS };
    let leaseTag: string;
    try { leaseTag = await storage.write(lease, current?.etag); }
    catch {
      // Another instance won, or storage failed: no upstream request.
      return result(current?.state);
    }
    remembered = lease;
    let next: State;
    try {
      next = await fetchPrices(current?.state.ticker, lease.nextAttemptAt);
    } catch (error) {
      const failures = Math.min(16, lease.failures + 1);
      const delay = Math.min(60 * 60_000, 5 * 60_000 * 2 ** (failures - 1));
      next = {
        ...lease, failures,
        nextAttemptAt: Math.max(Date.now() + delay, error instanceof ProviderError ? error.retryAt : 0),
      };
      console.warn(JSON.stringify({ event: "metals.refresh_failed", failures, nextAttemptAt: next.nextAttemptAt, error: String(error) }));
    }
    try {
      await storage.write(next, leaseTag);
      remembered = next;
    } catch {
      // Keep the original lease on storage failure. Never issue another batch
      // before it expires or let an expired writer overwrite a newer lease.
      remembered = { ...lease, failures: Math.max(1, lease.failures) };
    }
    checkAfter = Math.min(Date.now() + 5000, remembered.nextAttemptAt);
    return result(remembered);
  }
  return () => {
    if (!pending) pending = load().finally(() => { pending = undefined; });
    return pending;
  };
}

export const getMetalsTicker = createMetalsService();
