import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SQSEvent } from "aws-lambda";
import { handler } from "../src/refresh-worker.js";
import { getFeed } from "../src/news-service.js";
vi.mock("../src/news-service.js", () => ({ getFeed: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const event = { Records: [{ messageId: "one", body: JSON.stringify({ level: "national", topic: "general" }) }] } as SQSEvent;

it("rebuilds internally and primes exact browser URLs without a public refresh header", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("FEED_EDGE_URL", "https://edge.example");
  vi.mocked(getFeed).mockResolvedValue({ items: [], meta: { count: 0, fetchedAt: new Date().toISOString(), sourcesUsed: [], cacheTtlSeconds: 300 }, scope: {}, topic: "general" });
  const fetcher = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  expect(await handler(event)).toEqual({ batchItemFailures: [] });
  expect(getFeed).toHaveBeenCalledWith({ level: "national" }, "general", 120, 0, true);
  expect(fetcher.mock.calls.map(args => String((args as unknown[])[0]))).toContain("https://edge.example/v1/pages/national?sections=general&limit=32");
});

it.each([
  [{ level: "national", topic: "general" }, ["/v1/feeds/national/general?limit=16", "/v1/pages/national?sections=general&limit=32"]],
  [{ level: "county", state: "texas", county: "potter", topic: "general" }, ["/v1/feeds/counties/texas/potter/general?limit=16", "/v1/pages/counties/texas/potter?sections=localNews&limit=50"]],
  [{ level: "national", topic: "sports" }, ["/v1/feeds/national/sports?limit=12"]],
])("primes only County Post's browser variants with the deployment configuration: %j", async (target, paths) => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  const template = readFileSync(new URL("../template.yaml", import.meta.url), "utf8");
  const origins = template.match(/^\s+FEED_EDGE_ORIGINS: "([^"]+)"$/m)?.[1];
  expect(origins).toBe("https://thecountypost.com");
  vi.stubEnv("FEED_EDGE_URL", "https://edge.example");
  vi.stubEnv("FEED_EDGE_ORIGINS", origins!);
  vi.mocked(getFeed).mockResolvedValue({ items: [], meta: { count: 0, fetchedAt: new Date().toISOString(), sourcesUsed: [], cacheTtlSeconds: 300 }, scope: {}, topic: "general" });
  const fetcher = vi.fn(async (_url: URL, _options?: RequestInit) => new Response("{}"));
  vi.stubGlobal("fetch", fetcher);

  expect(await handler({ Records: [{ messageId: "one", body: JSON.stringify(target) }] } as SQSEvent)).toEqual({ batchItemFailures: [] });
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(paths.map(path => `https://edge.example${path}`));
  for (const [, options] of fetcher.mock.calls) expect(options?.headers).toEqual({ origin: "https://thecountypost.com" });
});

it("preserves explicitly configured additional origins", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("FEED_EDGE_URL", "https://edge.example");
  vi.stubEnv("FEED_EDGE_ORIGINS", "https://thecountypost.com,https://www.thecountypost.com");
  vi.mocked(getFeed).mockResolvedValue({ items: [], meta: { count: 0, fetchedAt: new Date().toISOString(), sourcesUsed: [], cacheTtlSeconds: 300 }, scope: {}, topic: "general" });
  const fetcher = vi.fn(async (_url: URL, _options?: RequestInit) => new Response("{}"));
  vi.stubGlobal("fetch", fetcher);

  expect(await handler(event)).toEqual({ batchItemFailures: [] });
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls.map(([, options]) => options?.headers)).toEqual([
    { origin: "https://thecountypost.com" }, { origin: "https://thecountypost.com" },
    { origin: "https://www.thecountypost.com" }, { origin: "https://www.thecountypost.com" },
  ]);
});

it("returns failed messages for queue retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getFeed).mockRejectedValue(new Error("provider outage"));
  expect(await handler(event)).toEqual({ batchItemFailures: [{ itemIdentifier: "one" }] });
});
