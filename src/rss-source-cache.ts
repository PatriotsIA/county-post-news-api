import { config } from "./config.js";

type Entry = { value: unknown; bytes: number; freshUntil: number; etag?: string; modified?: string; control?: string };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 128;
const MAX_BYTES = 16 * 1024 * 1024;
let bytes = 0;

export function clearRssSourceCache() { entries.clear(); pending.clear(); bytes = 0; }

function remove(url: string) {
  const entry = entries.get(url);
  if (entry) bytes -= entry.bytes;
  entries.delete(url);
}

/** Cache only the exact URL's parsed source, before any geography, attribution,
 * media or age filtering. Never turn an upstream failure into a fresh feed. */
export async function cachedRssSource<T>(url: string, parse: (text: string) => T): Promise<T> {
  const previous = entries.get(url);
  if (previous && previous.freshUntil > Date.now()) return previous.value as T;
  const inflight = pending.get(url);
  if (inflight) return inflight as Promise<T>;
  const request = (async () => {
    const headers: Record<string, string> = { "user-agent": "county-post-news-api/1.0" };
    if (previous?.etag) headers["if-none-match"] = previous.etag;
    if (previous?.modified) headers["if-modified-since"] = previous.modified;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(config.requestTimeoutMs) });
    let value: T;
    let size: number;
    if (response.status === 304 && previous) { value = previous.value as T; size = previous.bytes; }
    else {
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
      const text = await response.text();
      value = parse(text);
      size = Buffer.byteLength(text);
    }
    const control = response.headers.get("cache-control") || (response.status === 304 ? previous?.control : "") || "";
    const maxAge = control.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
    const age = Number(response.headers.get("age") || 0);
    const remainingAge = maxAge === undefined ? Infinity : Math.max(0, Number(maxAge) - (Number.isFinite(age) ? Math.max(0, age) : 0));
    // At most a minute and never longer than the feed's own freshness target.
    let ttl = Math.max(0, Math.min(config.rssSourceCacheTtlSeconds, config.cacheTtlSeconds, remainingAge));
    if (/\bno-cache\b/i.test(control)) ttl = 0;
    remove(url);
    if (!/\b(?:no-store|private)\b/i.test(control) && size <= 2 * 1024 * 1024) {
      while (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) remove(entries.keys().next().value!);
      entries.set(url, { value, bytes: size, control, freshUntil: Date.now() + ttl * 1000,
        etag: response.headers.get("etag") || (response.status === 304 ? previous?.etag : undefined),
        modified: response.headers.get("last-modified") || (response.status === 304 ? previous?.modified : undefined) });
      bytes += size;
    }
    return value;
  })();
  pending.set(url, request);
  try { return await request; }
  finally { if (pending.get(url) === request) pending.delete(url); }
}
