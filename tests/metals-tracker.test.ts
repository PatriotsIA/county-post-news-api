import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMetalsService, type MetalsStore } from "../src/metals-service.js";
import { S3Client } from "@aws-sdk/client-s3";

type State = Parameters<MetalsStore["write"]>[0];
function sharedStore() {
  let value: { state: State; etag: string } | undefined;
  let revision = 0;
  return {
    read: vi.fn(async () => value && structuredClone(value)),
    write: vi.fn(async (state: State, etag?: string) => {
      if (value?.etag !== etag) throw new Error("PreconditionFailed");
      value = { state: structuredClone(state), etag: String(++revision) };
      return value.etag;
    }),
  };
}
let calls: number[];
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
  calls = [];
  fetcher = vi.fn(async (url: string) => {
    calls.push(Date.now());
    return Response.json({ symbol: url.split("/").pop(), currency: "USD", price: 100, updatedAt: new Date().toISOString() });
  });
  vi.stubGlobal("fetch", fetcher);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function complete<T>(pending: Promise<T>) { await vi.runAllTimersAsync(); return pending; }

it("spaces four no-key calls and coalesces simultaneous requests across cold instances", async () => {
  const storage = sharedStore();
  const first = createMetalsService(storage), second = createMetalsService(storage);
  const requests = Array.from({ length: 30 }, (_, i) => (i % 2 ? first : second)().catch(() => undefined));
  const results = await complete(Promise.all(requests));
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(calls.slice(1).every((time, i) => time - calls[i] >= 1100)).toBe(true);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["XAU", "XAG", "XPT", "XPD"].map(symbol => `https://api.gold-api.com/price/${symbol}`));
  const ticker = results.find(Boolean)!;
  expect(ticker).toMatchObject({ currency: "USD", unit: "troy oz", priceType: "spot", stale: false });
  expect(await createMetalsService(storage)()).toEqual(ticker);
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("refreshes at most once per minute regardless of browser refreshes or cold starts", async () => {
  const storage = sharedStore();
  const first = await complete(createMetalsService(storage)());
  vi.setSystemTime(Date.parse(first.nextRefreshAt) - 1);
  await Promise.all(Array.from({ length: 25 }, () => createMetalsService(storage)()));
  expect(fetcher).toHaveBeenCalledTimes(4);
  vi.setSystemTime(Date.parse(first.nextRefreshAt));
  const next = await complete(createMetalsService(storage)());
  expect(fetcher).toHaveBeenCalledTimes(8);
  expect(next.items[0]).toMatchObject({ previousPrice: 100, previousQuotedAt: first.items[0].quotedAt });
  expect(next.updatedAt).not.toBe(first.updatedAt);
});

it("honors longer upstream Cache-Control rather than polling every minute", async () => {
  fetcher.mockImplementation(async (url: string) => Response.json({
    symbol: url.split("/").pop(), currency: "USD", price: 100, updatedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "public, max-age=600" } }));
  const storage = sharedStore();
  const ticker = await complete(createMetalsService(storage)());
  expect(Date.parse(ticker.nextRefreshAt) - Date.parse(ticker.fetchedAt)).toBe(600_000);
  vi.setSystemTime(Date.parse(ticker.fetchedAt) + 120_000);
  await createMetalsService(storage)();
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it.each(["1800", "Mon, 12 Oct 2026 18:31:03 GMT"])("shares 429 Retry-After cooldown across instances: %s", async retry => {
  const storage = sharedStore();
  const first = await complete(createMetalsService(storage)());
  vi.setSystemTime(Date.parse(first.nextRefreshAt));
  fetcher.mockResolvedValue(new Response(null, { status: 429, headers: { "retry-after": retry } }));
  const fallback = await createMetalsService(storage)();
  expect(fallback.stale).toBe(true);
  expect(fallback.items).toEqual(first.items);
  expect(fallback.fetchedAt).toBe(first.fetchedAt);
  expect(Date.parse(fallback.nextRefreshAt) - Date.now()).toBeGreaterThanOrEqual(29 * 60_000);
  vi.setSystemTime(Date.now() + 10 * 60_000);
  expect((await createMetalsService(storage)()).stale).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(5);
});

it("backs off failed initial loads without a snapshot and stops the batch on the first error", async () => {
  const storage = sharedStore();
  fetcher.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  for (let i = 0; i < 10; i++) await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 300_000);
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  expect((await storage.read())!.state.nextAttemptAt - Date.now()).toBe(600_000);
});

it.each([
  { price: 0 }, { price: -1 }, { price: "100" }, { price: null }, { currency: "EUR" }, { symbol: "XAG" },
  { updatedAt: "invalid" }, { updatedAt: "2026-10-13T18:00:00Z" }, { updatedAt: "2026-10-01T18:00:00Z" },
])("rejects invalid provider data without publishing partial quotes: %j", async invalid => {
  fetcher.mockResolvedValue(Response.json({ symbol: "XAU", currency: "USD", price: 100, updatedAt: new Date().toISOString(), ...invalid }));
  const storage = sharedStore();
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  expect((await storage.read())!.state.ticker).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("fails closed if the shared cache or lease cannot be accessed", async () => {
  const storage = sharedStore();
  storage.read.mockRejectedValueOnce(new Error("S3 unavailable"));
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  storage.write.mockRejectedValueOnce(new Error("S3 write denied"));
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  expect(fetcher).not.toHaveBeenCalled();
});

it("does not retry after publication fails until the persisted lease expires", async () => {
  const storage = sharedStore();
  storage.write.mockImplementationOnce(storage.write.getMockImplementation()!).mockRejectedValueOnce(new Error("S3 outage"));
  expect(await complete(createMetalsService(storage)().catch(error => error))).toMatchObject({ statusCode: 503 });
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("marks old quotes and refuses to calculate from quotes older than four days", async () => {
  const storage = sharedStore();
  const first = await complete(createMetalsService(storage)());
  fetcher.mockRejectedValue(new Error("offline"));
  vi.setSystemTime(Date.parse(first.fetchedAt) + 2 * 86400_000);
  expect((await createMetalsService(storage)()).stale).toBe(true);
  vi.setSystemTime(Date.parse(first.fetchedAt) + 5 * 86400_000);
  await expect(createMetalsService(storage)()).rejects.toMatchObject({ statusCode: 503 });
});

it("uses S3 conditional writes for lease acquisition and publication", async () => {
  vi.stubEnv("FEED_CACHE_BUCKET", "test-cache");
  const send = vi.spyOn(S3Client.prototype, "send")
    .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NoSuchKey" }))
    .mockResolvedValueOnce({ ETag: "lease" } as never)
    .mockResolvedValueOnce({ ETag: "saved" } as never);
  await complete(createMetalsService()());
  expect(send.mock.calls[1][0].input).toMatchObject({ IfNoneMatch: "*", Key: "feed-cache/markets-gold-api-v1.json" });
  expect(send.mock.calls[2][0].input).toMatchObject({ IfMatch: "lease" });
});

it("does not treat an S3 permission error as a missing cache", async () => {
  vi.stubEnv("FEED_CACHE_BUCKET", "test-cache");
  vi.spyOn(S3Client.prototype, "send").mockRejectedValue(new Error("AccessDenied"));
  await expect(createMetalsService()()).rejects.toMatchObject({ statusCode: 503 });
  expect(fetcher).not.toHaveBeenCalled();
});
