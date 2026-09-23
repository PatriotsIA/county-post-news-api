import { deepStrictEqual } from "node:assert";
import { afterEach, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { fetchRssItems, getItemMaxAgeDays } from "../src/rss.js";

const xml = '<rss><channel><title>Publisher</title><item><title>County update</title><link>https://publisher.example/story</link></item></channel></rss>';
const url = "https://publisher.example/feed";
afterEach(() => { clearCache(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("coalesces exact URLs while preserving independent attribution, media and age options", async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const fetcher = vi.fn(async () => { await barrier; return new Response(xml); });
  vi.stubGlobal("fetch", fetcher);
  const first = fetchRssItems(url, { source: "First", mediaType: "video", maxAgeDays: 7 });
  const second = fetchRssItems(url, { source: "Second", maxAgeDays: 90 });
  release();
  const [a, b] = await Promise.all([first, second]);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(a[0]).toMatchObject({ source: "First", mediaType: "video" });
  expect(b[0].source).toBe("Second");
  expect(b[0].mediaType).toBeUndefined();
  expect(getItemMaxAgeDays(a[0])).toBe(7);
  expect(getItemMaxAgeDays(b[0])).toBe(90);
});

it("revalidates expired sources with ETag and Last-Modified and accepts 304", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(xml, { headers: { etag: '"v1"', "last-modified": "Wed, 23 Sep 2026 12:00:00 GMT" } }))
    .mockResolvedValueOnce(new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", fetcher);
  const original = await fetchRssItems(url);
  await fetchRssItems(url);
  expect(fetcher).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(Math.min(config.rssSourceCacheTtlSeconds, config.cacheTtlSeconds) * 1000 + 1);
  const refreshed = await fetchRssItems(url);
  deepStrictEqual(refreshed, original);
  expect(fetcher.mock.calls[1][1].headers).toMatchObject({ "if-none-match": '"v1"', "if-modified-since": "Wed, 23 Sep 2026 12:00:00 GMT" });
});

it.each(["no-store", "private", "no-cache", "max-age=0"])("honors upstream %s", async control => {
  const fetcher = vi.fn(async () => new Response(xml, { headers: { "cache-control": control } }));
  vi.stubGlobal("fetch", fetcher);
  await fetchRssItems(url); await fetchRssItems(url);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("deducts an upstream cache's Age from the remaining freshness", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => new Response(xml, { headers: { "cache-control": "max-age=60", age: "59" } }));
  vi.stubGlobal("fetch", fetcher);
  await fetchRssItems(url);
  vi.advanceTimersByTime(1001);
  await fetchRssItems(url);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not mix distinct source queries or cache invalid/provider-failure responses", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("outage", { status: 503 }))
    .mockResolvedValueOnce(new Response("<html>not a feed</html>"))
    .mockImplementation(async () => new Response(xml));
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchRssItems(url)).rejects.toThrow();
  await expect(fetchRssItems(url)).rejects.toThrow();
  expect(await fetchRssItems(url)).toHaveLength(1);
  await fetchRssItems(`${url}?county=different`);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
