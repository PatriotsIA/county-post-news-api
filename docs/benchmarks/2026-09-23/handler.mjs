import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
const base = process.env.BENCH_VARIANT === "baseline" ? "./baseline/src/" : "./dist/src/";
const { getFeed } = await import(base + "news-service.js");
const { getCounty, getState } = await import(base + "geo.js");
const { clearCache, cachedShared } = await import(base + "cache.js");
const client = new S3Client({});
const Bucket = process.env.BENCH_BUCKET;
const Key = "benchmarks/news-efficiency-20260923/fixtures.json";
const liveFetch = globalThis.fetch;
const cases = [
  ["national", { level: "national" }, "general"],
  ["state", { level: "state", state: getState("texas") }, "politics"],
  ["county", { level: "county", state: getState("texas"), county: getCounty("texas", "potter") }, "general"],
  ["neighbor", { level: "county", state: getState("texas"), county: getCounty("texas", "randall") }, "general"],
  ["specialty", { level: "county", state: getState("texas"), county: getCounty("texas", "harris") }, "markets-investing"],
];
let fixture;
export async function handler(event) {
  clearCache();
  let requests = 0, misses = 0;
  const pending = new Set();
  if (event.mode === "capture") fixture = { sources: {}, feeds: {} };
  else if (!fixture) {
    const object = await client.send(new GetObjectCommand({ Bucket, Key }));
    fixture = JSON.parse(await object.Body.transformToString());
  }
  globalThis.fetch = (input, options) => {
    const task = (async () => {
      const url = String(input); requests++;
      if (event.mode === "capture") {
        const start = performance.now();
        try {
          const response = await liveFetch(input, options);
          const body = await response.text();
          fixture.sources[url] ??= { status: response.status, body, headers: Object.fromEntries(["content-type", "cache-control", "etag", "last-modified"].flatMap(h => response.headers.get(h) ? [[h,response.headers.get(h)]] : [])), ms: performance.now()-start };
          return new Response(body, { status: response.status, headers: response.headers });
        } catch (error) { fixture.sources[url] ??= { error: error.name, ms: performance.now()-start }; throw error; }
      }
      const recorded = fixture.sources[url];
      if (!recorded) { misses++; throw new Error("Unrecorded benchmark URL"); }
      await new Promise(resolve => setTimeout(resolve, recorded.ms));
      if (recorded.error) throw new DOMException("Recorded upstream failure", recorded.error);
      return new Response(recorded.body, { status: recorded.status, headers: recorded.headers });
    })();
    pending.add(task);
    task.finally(() => pending.delete(task)).catch(() => {});
    return task;
  };
  const results = [];
  for (const [name, scope, topic] of cases) {
    const start = performance.now(), before = requests;
    const feed = await getFeed(scope, topic, 120, 0, true);
    const ms = performance.now()-start;
    const shape = feed.items.map(({ id, title, link, source, publishedAt }) => ({ id, title, link, source, publishedAt }));
    const signature = createHash("sha256").update(JSON.stringify(shape)).digest("hex");
    results.push({ name, ms, requests: requests-before, items: feed.items.length, signature });
    if (event.mode === "capture") fixture.feeds[name] = feed;
    const warmStart = performance.now();
    const hit = await getFeed(scope, topic, 120);
    results.push({ name: name + ":memory-hit", ms: performance.now()-warmStart, items: hit.items.length });
  }
  await Promise.allSettled([...pending]);
  globalThis.fetch = liveFetch;
  if (event.mode === "capture") {
    await client.send(new PutObjectCommand({ Bucket, Key, Body: JSON.stringify(fixture), ContentType: "application/json" }));
    for (const [name, value] of Object.entries(fixture.feeds)) await client.send(new PutObjectCommand({ Bucket, Key: "feed-cache/" + encodeURIComponent("bench:20260923:" + name) + ".json", Body: JSON.stringify({ storedAt: Date.now(), value }) }));
  } else {
    process.env.FEED_CACHE_BUCKET = Bucket;
    for (const [name] of cases) {
      const start = performance.now();
      const value = await cachedShared("bench:20260923:" + name, 300, async () => { throw new Error("Missing benchmark snapshot"); });
      results.push({ name: name + ":shared-hit", ms: performance.now()-start, items: value.items.length });
    }
    delete process.env.FEED_CACHE_BUCKET;
  }
  return { variant: process.env.BENCH_VARIANT, memory: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE, requests, misses, results };
}
