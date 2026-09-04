type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

  const value = load().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + ttlSeconds * 1000, value });
  return value;
}

export function clearCache() {
  cache.clear();
}

/* -------------------------------------------------------------------------- */
/* Shared cache                                                               */
/* -------------------------------------------------------------------------- */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let s3: S3Client | undefined;

function s3Cache() {
  return (s3 ??= new S3Client({}));
}

function sharedBucket() {
  return process.env.FEED_CACHE_BUCKET || "";
}

type SharedEntry<T> = { storedAt: number; value: T };

export type SharedCacheOptions = {
  /**
   * Rebuild even when a cached copy exists. The warmer sets this: readers are
   * always served whatever is stored, and the scheduled pass is what keeps it
   * current — the same division of labour a CDN's stale-while-revalidate has,
   * without needing anything to run after a Lambda response is sent.
   */
  forceFresh?: boolean;
  /** How old a stored copy may be and still be served. */
  staleTtlSeconds?: number;
};

const DEFAULT_STALE_TTL_SECONDS = 24 * 60 * 60;
const STALE_MEMORY_HOLD_MS = 60 * 1000;

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
  options: SharedCacheOptions = {},
): Promise<T> {
  const now = Date.now();
  const staleTtlMs = (options.staleTtlSeconds ?? DEFAULT_STALE_TTL_SECONDS) * 1000;

  if (!options.forceFresh) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

    const bucket = sharedBucket();
    if (bucket) {
      try {
        const object = await s3Cache().send(new GetObjectCommand({ Bucket: bucket, Key: sharedKey(key) }));
        const entry = JSON.parse((await object.Body?.transformToString()) || "") as SharedEntry<T>;
        const age = now - entry.storedAt;
        if (Number.isFinite(age) && age >= 0 && age < staleTtlMs) {
          // Hold it in memory briefly — long enough to spare S3 a read per
          // request, short enough that the warmer's next refresh is picked up.
          const remainingFreshMs = ttlSeconds * 1000 - age;
          const holdMs = Math.max(remainingFreshMs, 0) || STALE_MEMORY_HOLD_MS;
          const value = Promise.resolve(entry.value);
          cache.set(key, { expiresAt: now + Math.min(holdMs, staleTtlMs - age), value });
          return entry.value;
        }
      } catch {
        // No stored copy, or S3 unavailable: build inline as before.
      }
    }
  }

  const value = load().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + ttlSeconds * 1000, value });

  const resolved = await value;
  const bucket = sharedBucket();
  if (bucket) {
    try {
      // Awaited deliberately: work started after a Lambda response is sent is
      // frozen with the sandbox, so a fire-and-forget write here would be lost.
      await s3Cache().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: sharedKey(key),
          Body: JSON.stringify({ storedAt: Date.now(), value: resolved } satisfies SharedEntry<T>),
          ContentType: "application/json",
        }),
      );
    } catch {
      // A failed write costs the next reader a rebuild, nothing more.
    }
  }
  return resolved;
}

function sharedKey(key: string) {
  return `feed-cache/${encodeURIComponent(key)}.json`;
}
