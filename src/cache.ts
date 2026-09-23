type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};
import { clearRssSourceCache } from "./rss-source-cache.js";

const cache = new Map<string, CacheEntry<unknown>>();
const MAX_MEMORY_ENTRIES = 256;

function remember<T>(key: string, entry: CacheEntry<T>) {
  cache.delete(key);
  while (cache.size >= MAX_MEMORY_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
}

export function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

  const value = Promise.resolve().then(load).catch((error) => {
    if (cache.get(key)?.value === value) cache.delete(key);
    throw error;
  });
  remember(key, { expiresAt: now + ttlSeconds * 1000, value });
  return value;
}

export function clearCache() {
  cache.clear();
  sharedLoads.clear();
  sharedSnapshots.clear();
  clearRssSourceCache();
}

/* -------------------------------------------------------------------------- */
/* Shared cache                                                               */
/* -------------------------------------------------------------------------- */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let s3: S3Client | undefined;

function s3Cache() {
  return (s3 ??= new S3Client({ maxAttempts: 2 }));
}

function sharedBucket() {
  return process.env.FEED_CACHE_BUCKET || "";
}

type SharedEntry<T> = { storedAt: number; value: T; freshForSeconds?: number };

export type SharedCacheOptions<T = unknown> = {
  /** Worker refresh: reuse only fresh shared data; rebuild stale or absent data. */
  forceFresh?: boolean;
  /** Provider data: refresh expired snapshots inline, with optional bounded fallback. */
  revalidate?: boolean;
  /** How old a stored copy may be and still be served. */
  staleTtlSeconds?: number;
  /** Enqueue refresh while serving stale data. Queue acceptance is awaited. */
  onStale?: () => Promise<unknown>;
  /** Preserve an existing bounded snapshot when a partial outage degrades a build. */
  shouldReplace?: (previous: unknown, next: unknown) => boolean;
  /** Mark an original snapshot when an attempted refresh fails or degrades it. */
  staleIfError?: (previous: T) => T;
  /** Partial provider results should be retried sooner than complete ones. */
  ttlForValue?: (value: T) => number;
};

const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;
const STALE_MEMORY_HOLD_MS = 60 * 1000;
const sharedLoads = new Map<string, Promise<unknown>>();
const sharedSnapshots = new Map<string, SharedEntry<unknown>>();

function rememberSnapshot<T>(key: string, entry: SharedEntry<T>) {
  sharedSnapshots.delete(key);
  while (sharedSnapshots.size >= MAX_MEMORY_ENTRIES) sharedSnapshots.delete(sharedSnapshots.keys().next().value!);
  sharedSnapshots.set(key, entry);
}

/**
 * Two-tier cache for the expensive feed builds.
 *
 * The in-memory map only helps the Lambda instance that populated it, and with
 * three thousand counties on a five-minute TTL nearly every reader was a cold
 * hit paying the full upstream fan-out. Entries are therefore also written to
 * S3, which every instance shares: a reader is served the stored copy — fresh
 * or stale, instantly — and rebuilding is left to whoever asks for freshness,
 * normally the scheduled warmer. A county nobody has ever visited still builds
 * inline once, then stays warm for a day.
 */
export async function cachedShared<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  options: SharedCacheOptions<T> = {},
): Promise<T> {
  // Coalesce the S3 read and rebuild as well as the provider calls. A worker's
  // freshness requirement must never join a reader serving a stale snapshot.
  const flightKey = `${key}:${options.forceFresh ? "worker" : options.revalidate ? "provider" : "reader"}`;
  const pending = sharedLoads.get(flightKey);
  if (pending) return pending as Promise<T>;
  const promise = loadShared(key, ttlSeconds, load, options);
  sharedLoads.set(flightKey, promise);
  try { return await promise; }
  finally { if (sharedLoads.get(flightKey) === promise) sharedLoads.delete(flightKey); }
}

async function loadShared<T>(key: string, ttlSeconds: number, load: () => Promise<T>, options: SharedCacheOptions<T>): Promise<T> {
  const now = Date.now();
  const staleTtlMs = (options.staleTtlSeconds ?? DEFAULT_STALE_TTL_SECONDS) * 1000;
  let previous = sharedSnapshots.get(key) as SharedEntry<T> | undefined;
  if (previous && (now < previous.storedAt || now - previous.storedAt >= staleTtlMs)) previous = undefined;

  {
    const hit = cache.get(key);
    if (!options.forceFresh && hit && hit.expiresAt > now) return hit.value as Promise<T>;

    const bucket = sharedBucket();
    if (bucket) {
      try {
        const object = await s3Cache().send(new GetObjectCommand({ Bucket: bucket, Key: sharedKey(key) }), { abortSignal: AbortSignal.timeout(2500) });
        const entry = JSON.parse((await object.Body?.transformToString()) || "") as SharedEntry<T>;
        const age = now - entry.storedAt;
        const freshTtlMs = Math.min(ttlSeconds, entry.freshForSeconds ?? ttlSeconds) * 1000;
        if (Number.isFinite(age) && age >= 0 && age < staleTtlMs) { previous = entry; rememberSnapshot(key, entry); }
        if (Number.isFinite(age) && age >= 0 && age < (options.forceFresh || options.revalidate ? freshTtlMs : staleTtlMs)) {
          if (age >= freshTtlMs && options.onStale) {
            try { await options.onStale(); }
            catch (error) { console.warn(JSON.stringify({ event: "feed.refresh_enqueue_failed", key, error: String(error) })); }
          }
          // Hold it in memory briefly — long enough to spare S3 a read per
          // request, short enough that the warmer's next refresh is picked up.
          const remainingFreshMs = freshTtlMs - age;
          const holdMs = Math.max(remainingFreshMs, 0) || STALE_MEMORY_HOLD_MS;
          const value = Promise.resolve(entry.value);
          remember(key, { expiresAt: now + Math.min(holdMs, staleTtlMs - age), value });
          return entry.value;
        }
      } catch {
        // No stored copy, or S3 unavailable: build inline as before.
      }
    }
  }

  let resolved: T;
  try { resolved = await load(); }
  catch (error) {
    cache.delete(key);
    if (previous && options.staleIfError && Date.now() - previous.storedAt < staleTtlMs) {
      console.warn(JSON.stringify({ event: "provider.cache_fallback", key, storedAt: previous.storedAt }));
      const fallback = options.staleIfError(previous.value);
      remember(key, { expiresAt: Math.min(Date.now() + STALE_MEMORY_HOLD_MS, previous.storedAt + staleTtlMs), value: Promise.resolve(fallback) });
      return fallback;
    }
    throw error;
  }
  if (previous && Date.now() - previous.storedAt < staleTtlMs && options.shouldReplace && !options.shouldReplace(previous.value, resolved)) {
    console.warn(JSON.stringify({ event: "feed.refresh_retained", key, storedAt: previous.storedAt }));
    const retained = options.staleIfError ? options.staleIfError(previous.value) : previous.value;
    remember(key, { expiresAt: Math.min(Date.now() + STALE_MEMORY_HOLD_MS, previous.storedAt + staleTtlMs), value: Promise.resolve(retained) });
    return retained;
  }
  const freshForSeconds = Math.max(0, Math.min(ttlSeconds, options.ttlForValue?.(resolved) ?? ttlSeconds));
  const snapshot = { storedAt: Date.now(), value: resolved, freshForSeconds };
  const bucket = sharedBucket();
  if (bucket) {
    try {
      // Awaited deliberately: work started after a Lambda response is sent is
      // frozen with the sandbox, so a fire-and-forget write here would be lost.
      await s3Cache().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: sharedKey(key),
          Body: JSON.stringify(snapshot),
          ContentType: "application/json",
        }), { abortSignal: AbortSignal.timeout(2500) },
      );
    } catch (error) {
      console.error(JSON.stringify({ event: "feed.cache_write_failed", key, error: String(error) }));
      // Queued refreshes retry; readers still receive their freshly built feed.
      if (options.forceFresh) { cache.delete(key); throw error; }
    }
  }
  rememberSnapshot(key, snapshot);
  remember(key, { expiresAt: snapshot.storedAt + freshForSeconds * 1000, value: Promise.resolve(resolved) });
  return resolved;
}

function sharedKey(key: string) {
  return `feed-cache/${encodeURIComponent(key)}.json`;
}
