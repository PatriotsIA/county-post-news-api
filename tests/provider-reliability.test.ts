import { afterEach, expect, it, vi } from "vitest";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { getCounty } from "../src/geo.js";
import { getCountyFredData } from "../src/fred-service.js";
import { getCattleTicker } from "../src/markets-service.js";
import { handleRequest } from "../src/http.js";

const original = { fredApiKey: config.fredApiKey, usdaMarsApiKey: config.usdaMarsApiKey };
afterEach(() => { clearCache(); Object.assign(config, original); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

function objectStore() {
  const objects = new Map<string, string>();
  vi.stubEnv("FEED_CACHE_BUCKET", "test-cache");
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof GetObjectCommand) {
      const body = objects.get(command.input.Key!);
      if (!body) throw new Error("NoSuchKey");
      return { Body: { transformToString: async () => body } } as never;
    }
    if (command instanceof PutObjectCommand) objects.set(command.input.Key!, String(command.input.Body));
    return {} as never;
  });
  return objects;
}

it("reuses FRED across cold instances and serves a dated fallback on total provider failure", async () => {
  vi.useFakeTimers(); const objects = objectStore(); config.fredApiKey = "test-only";
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ observations: [{ date: "2024-01-01", value: "4.2" }] })));
  vi.stubGlobal("fetch", fetcher);
  const county = getCounty("texas", "potter")!;
  const first = await getCountyFredData(county);
  expect(first.metrics).toHaveLength(5);
  clearCache();
  expect(await getCountyFredData(county)).toEqual(first);
  expect(fetcher).toHaveBeenCalledTimes(5);
  expect([...objects.keys()]).toEqual(["provider-cache/fred%3Acounty%3A48375.json"]);
  // Two months on, FRED is down: the stored copy is still served, marked stale.
  vi.advanceTimersByTime(60 * 86400 * 1000); clearCache();
  fetcher.mockRejectedValue(new DOMException("deadline", "TimeoutError"));
  const fallback = await getCountyFredData(county);
  expect(fallback.meta.stale).toBe(true);
  expect(fallback.meta.fetchedAt).toBe(first.meta.fetchedAt);
  expect(fallback.metrics).toEqual(first.metrics);
});

it("keeps partial FRED successes and retries them after a short TTL", async () => {
  vi.useFakeTimers(); objectStore(); config.fredApiKey = "test-only";
  const fetcher = vi.fn(async (url: string | URL) => {
    if (!String(url).includes("MHI")) throw new DOMException("deadline", "TimeoutError");
    return new Response(JSON.stringify({ observations: [{ date: "2024-01-01", value: "52100" }] }));
  });
  vi.stubGlobal("fetch", fetcher);
  const county = getCounty("texas", "potter")!;
  expect((await getCountyFredData(county)).metrics).toHaveLength(1);
  vi.advanceTimersByTime(301_000); clearCache();
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ observations: [{ date: "2024-01-01", value: "100" }] })));
  expect((await getCountyFredData(county)).metrics).toHaveLength(5);
});

it("renews a fresh FRED copy on schedule and keeps it, logging why, when FRED serves its maintenance page", async () => {
  vi.useFakeTimers(); objectStore(); config.fredApiKey = "test-only";
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ observations: [{ date: "2024-01-01", value: "4.2" }] })));
  vi.stubGlobal("fetch", fetcher);
  const county = getCounty("texas", "potter")!;
  await getCountyFredData(county);
  vi.advanceTimersByTime(86400 * 1000); clearCache();
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ observations: [{ date: "2025-01-01", value: "3.9" }] })));
  const renewed = await getCountyFredData(county, { rebuild: true });
  expect(fetcher).toHaveBeenCalledTimes(10);
  expect(renewed.metrics[0].latest).toEqual({ date: "2025-01-01", value: 3.9 });

  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  fetcher.mockImplementation(async () => new Response("<html>Site Maintenance</html>", { headers: { "content-type": "text/html" } }));
  const kept = await getCountyFredData(county, { rebuild: true });
  expect(kept.meta.stale).toBe(true);
  expect(kept.metrics).toEqual(renewed.metrics);
  expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)).reason)).toContain("not-json");
});

it("still serves FRED copies stored under the feed prefix by the previous release", async () => {
  vi.useFakeTimers(); const objects = objectStore(); config.fredApiKey = "test-only";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ observations: [{ date: "2024-01-01", value: "4.2" }] }))));
  const county = getCounty("texas", "potter")!;
  const first = await getCountyFredData(county);
  const [key, body] = [...objects.entries()][0];
  objects.delete(key);
  objects.set(key.replace("provider-cache/", "feed-cache/"), body);
  vi.advanceTimersByTime((config.fredCacheTtlSeconds + 1) * 1000); clearCache();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const fallback = await getCountyFredData(county);
  expect(fallback.meta.stale).toBe(true);
  expect(fallback.metrics).toEqual(first.metrics);
});

it("counts a FRED failure with no stored copy as a provider failure rather than an API fault", async () => {
  objectStore(); config.fredApiKey = "test-only";
  vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "news-api");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await handleRequest({ method: "GET", path: "/v1/counties/texas/potter/economic-data", query: new URLSearchParams() });
  expect(result.statusCode).toBe(502);
  const metric = JSON.parse(stdout.mock.calls.map(([line]) => String(line)).find(line => line.includes('"_aws"'))!);
  expect(metric).toMatchObject({ Provider: "fred", Source: "reader", ProviderFailures: 1 });
  expect(metric._aws.CloudWatchMetrics[0]).toMatchObject({ Namespace: "CountyNewsApi", Dimensions: [["Provider", "Source"]] });
  expect(JSON.parse(String(error.mock.calls.at(-1)?.[0]))).toMatchObject({ event: "api.request", statusCode: 502, provider: "fred" });
});

it("retains both cattle reports across a cold-instance provider outage without redating them", async () => {
  vi.useFakeTimers(); objectStore(); config.usdaMarsApiKey = "test-only";
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [{ avg_price: 100, head_count: 5, report_date: "09/22/2026" }] })));
  vi.stubGlobal("fetch", fetcher);
  const first = await getCattleTicker();
  expect(first.items).toHaveLength(2);
  vi.advanceTimersByTime((config.metalsCacheTtlSeconds + 1) * 1000); clearCache();
  fetcher.mockRejectedValue(new DOMException("deadline", "TimeoutError"));
  expect(await getCattleTicker()).toEqual({ ...first, stale: true });
  const result = await handleRequest({ method: "GET", path: "/v1/markets/cattle", query: new URLSearchParams() });
  expect(result.headers["cache-control"]).toBe("public, max-age=60, s-maxage=60");
});

it("never long-caches provider failures when no prior snapshot exists", async () => {
  config.usdaMarsApiKey = "test-only";
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
  const result = await handleRequest({ method: "GET", path: "/v1/markets/cattle", query: new URLSearchParams() });
  expect(result.statusCode).toBe(502);
  expect(result.headers["cache-control"]).toBe("no-store");
});
