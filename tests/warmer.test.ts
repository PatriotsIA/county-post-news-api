import { afterEach, expect, it, vi } from "vitest";
import { handler, scheduledTargets } from "../src/warmer.js";
import { targetPath } from "../src/feed-refresh.js";

vi.mock("../src/feed-refresh.js", async (original) => ({ ...await original<typeof import("../src/feed-refresh.js")>(), enqueueRefresh: vi.fn(async () => true) }));
import { enqueueRefresh } from "../src/feed-refresh.js";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("rotates every supported geography and topic within a thirty-job budget", () => {
  const seen = new Set<string>();
  // Slowest tier: 3,143 counties * 17 specialist topics / 6 per pass.
  for (let pass = 0; pass < Math.ceil(3143 * 17 / 6); pass++) {
    const targets = scheduledTargets(pass);
    expect(targets.length).toBe(30);
    expect(targets.filter(target => target.level === "county" && target.topic === "general")).toHaveLength(14);
    const paths = targets.map(targetPath);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) seen.add(path);
  }
  expect(seen.size).toBe((3143 + 51 + 1) * 18);
  expect(seen.has("/v1/feeds/counties/virginia/richmond-city/general")).toBe(true);
  expect(seen.has("/v1/feeds/counties/louisiana/west-carroll/weather")).toBe(true);
});

it("refreshes national general and politics each pass and every national topic within four passes", () => {
  const seen = new Set<string>();
  for (let pass = 0; pass < 4; pass++) {
    const national = scheduledTargets(pass).filter(target => target.level === "national");
    expect(national.some(target => target.topic === "general")).toBe(true);
    expect(national.some(target => target.topic === "politics")).toBe(true);
    national.forEach(target => seen.add(target.topic));
  }
  expect(seen.size).toBe(18);
});

it("queues bounded work and reports enqueue failures for EventBridge retry", async () => {
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", "https://sqs.example/news.fifo");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await handler()).toMatchObject({ queued: 30, deferred: 0, failed: 0 });
  expect(enqueueRefresh).toHaveBeenCalledWith(expect.anything(), "schedule");
  vi.mocked(enqueueRefresh).mockRejectedValueOnce(new Error("queue unavailable"));
  await expect(handler()).rejects.toThrow("1 feed refresh jobs");
});

it("reports pressure deferrals separately from accepted jobs and failures", async () => {
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", "https://sqs.example/news.fifo");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.mocked(enqueueRefresh).mockResolvedValueOnce(false).mockResolvedValueOnce(false);
  expect(await handler()).toMatchObject({ queued: 28, deferred: 2, failed: 0, targets: 30 });
});
