import { afterEach, expect, it, vi } from "vitest";
import { handler, scheduledTargets } from "../src/warmer.js";
import { targetPath } from "../src/feed-refresh.js";

vi.mock("../src/feed-refresh.js", async (original) => ({ ...await original<typeof import("../src/feed-refresh.js")>(), enqueueRefresh: vi.fn(async () => true) }));
import { enqueueRefresh } from "../src/feed-refresh.js";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("rotates every supported geography and topic within a fifty-job budget", () => {
  const seen = new Set<string>();
  // Slowest tier: 3,143 counties * 17 specialist topics / 8 per pass.
  for (let pass = 0; pass < Math.ceil(3143 * 17 / 8); pass++) {
    const targets = scheduledTargets(pass);
    expect(targets.length).toBe(50);
    const paths = targets.map(targetPath);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) seen.add(path);
  }
  expect(seen.size).toBe((3143 + 51 + 1) * 18);
  expect(seen.has("/v1/feeds/counties/virginia/richmond-city/general")).toBe(true);
  expect(seen.has("/v1/feeds/counties/louisiana/west-carroll/weather")).toBe(true);
});

it("refreshes core national desks each pass and every national topic within five passes", () => {
  const seen = new Set<string>();
  for (let pass = 0; pass < 5; pass++) {
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
  expect(await handler()).toMatchObject({ queued: 50, failed: 0 });
  vi.mocked(enqueueRefresh).mockRejectedValueOnce(new Error("queue unavailable"));
  await expect(handler()).rejects.toThrow("1 feed refresh jobs");
});
