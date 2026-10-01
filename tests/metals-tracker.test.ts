import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
  return {
    updatedAt: "2026-10-01T16:20:00Z",
    metals: Object.fromEntries(["gold", "silver", "platinum", "palladium"].map(key => [key, {
      price: 100, previousPrice: 90, fixedAt: "2026-09-30T15:00:00Z",
      sourceLabel: "London PM Fix", currency: "USD", unit: "troy oz",
    }])),
  };
}

it("preserves previous values and individual fixing times separately from feed refresh time", async () => {
  const data = fixture();
  data.metals.silver.fixedAt = "2026-09-30T12:00:00Z";
  const fetcher = vi.fn(async () => Response.json(data));
  vi.stubGlobal("fetch", fetcher);
  const { getMetalsTicker } = await import("../src/markets-service.js");
  const ticker = await getMetalsTicker();
  expect(ticker.updatedAt).toBe(data.updatedAt);
  expect(ticker.items.find(item => item.key === "silver")).toMatchObject({ price: 100, previousPrice: 90, fixedAt: "2026-09-30T12:00:00Z", sourceLabel: "London PM Fix" });
  expect(await getMetalsTicker()).toEqual(ticker);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("keeps current prices usable when optional comparison metadata is absent or invalid", async () => {
  const data = fixture();
  data.metals.gold.previousPrice = 0;
  data.metals.gold.fixedAt = "not-a-date";
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(data)));
  const { getMetalsTicker } = await import("../src/markets-service.js");
  const gold = (await getMetalsTicker()).items[0];
  expect(gold.price).toBe(100);
  expect(gold.previousPrice).toBeUndefined();
  expect(gold.fixedAt).toBeUndefined();
});

it.each([
  { price: 0 }, { price: -1 }, { price: "100" }, { price: null },
  { currency: "EUR" }, { unit: "gram" },
])("rejects invalid or incompatible benchmark data: %j", async invalid => {
  const data = fixture();
  Object.assign(data.metals.gold, invalid);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(data)));
  const { getMetalsTicker } = await import("../src/markets-service.js");
  await expect(getMetalsTicker()).rejects.toMatchObject({ statusCode: 502 });
});

it("retains original fixing and feed dates during a provider outage", async () => {
  const fetcher = vi.fn(async () => Response.json(fixture()));
  vi.stubGlobal("fetch", fetcher);
  const { getMetalsTicker } = await import("../src/markets-service.js");
  const { clearCache } = await import("../src/cache.js");
  const first = await getMetalsTicker();
  clearCache();
  fetcher.mockRejectedValue(new Error("offline"));
  expect(await getMetalsTicker()).toEqual({ ...first, stale: true });
});
