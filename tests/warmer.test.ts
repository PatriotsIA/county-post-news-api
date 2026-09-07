import { afterEach, expect, it, vi } from "vitest";
import { handler } from "../src/warmer.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("rotates through every county and both state desks with bounded passes", async () => {
  vi.useFakeTimers();
  vi.stubEnv("WARM_BASE_URL", "https://news.example");
  vi.stubEnv("WARM_STATES", "all");
  vi.stubEnv("WARM_MAX_PER_PASS", "50");
  vi.stubEnv("WARM_CONCURRENCY", "3");
  vi.spyOn(console, "info").mockImplementation(() => {});
  const seen = new Set<string>();
  let active = 0;
  let peak = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    active++;
    peak = Math.max(peak, active);
    expect(seen.has(url)).toBe(false);
    seen.add(url);
    expect(options.headers).toMatchObject({ "x-warm-refresh": "1" });
    await Promise.resolve();
    active--;
    return new Response("{}");
  }));
  for (let shard = 0; shard < 65; shard++) {
    vi.setSystemTime(shard * 5 * 60_000);
    const result = await handler();
    expect(result.failed).toBe(0);
    expect(result.warmed).toBeLessThanOrEqual(50);
  }
  expect(seen.size).toBe(3245);
  expect([...seen].filter(url => url.includes("/states/")).length).toBe(102);
  expect(peak).toBeLessThanOrEqual(3);
});

it("backs off throttled requests before continuing the shard", async () => {
  vi.useFakeTimers();
  vi.stubEnv("WARM_BASE_URL", "https://news.example");
  vi.stubEnv("WARM_STATES", "district-of-columbia");
  vi.stubEnv("WARM_CONCURRENCY", "1");
  vi.spyOn(console, "info").mockImplementation(() => {});
  const fetcher = vi.fn(async () => new Response("{}"));
  fetcher.mockResolvedValueOnce(new Response("Too many requests", { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  const pending = handler();
  await vi.runAllTimersAsync();
  const result = await pending;
  expect(result).toMatchObject({ warmed: 3, failed: 0 });
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(result.ms).toBeGreaterThanOrEqual(2_000);
});
