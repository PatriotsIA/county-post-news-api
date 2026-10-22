import { afterEach, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { handler, scheduledCounties } from "../src/fred-refresh.js";
import { getCounty } from "../src/geo.js";

const original = { fredApiKey: config.fredApiKey };
afterEach(() => { clearCache(); Object.assign(config, original); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("renews every county within six days of five-minute runs", () => {
  const seen = new Set<string>();
  const passes = Math.ceil(3143 / 2);
  expect(passes * 5 * 60).toBeLessThan(6 * 86400);
  for (let pass = 0; pass < passes; pass++) {
    for (const target of scheduledCounties(pass)) {
      expect(getCounty(target.state, target.county)?.fips).toBeTruthy();
      seen.add(`${target.state}/${target.county}`);
    }
  }
  expect(seen.size).toBe(3143);
});

it("reports counties it could not renew as FRED refresh failures without failing the run", async () => {
  config.fredApiKey = "test-only";
  vi.stubEnv("FEED_CACHE_BUCKET", "");
  vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "fred-refresh");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  expect(await handler()).toEqual({ refreshed: 0, failed: 2 });
  const metric = JSON.parse(stdout.mock.calls.map(([line]) => String(line)).find(line => line.includes('"_aws"'))!);
  expect(metric).toMatchObject({ Provider: "fred", Source: "refresh", ProviderFailures: 2 });
});
