import { afterEach, expect, it, vi } from "vitest";
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

it("returns failed messages for queue retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getFeed).mockRejectedValue(new Error("provider outage"));
  expect(await handler(event)).toEqual({ batchItemFailures: [{ itemIdentifier: "one" }] });
});
