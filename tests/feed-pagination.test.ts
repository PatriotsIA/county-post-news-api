import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { resolveTarget } from "../src/feed-refresh.js";
import { getFeed } from "../src/news-service.js";
import type { FeedResponse, NewsFeedItem } from "../src/types.js";

const scope = resolveTarget({ level: "county", state: "texas", county: "potter", topic: "general" });
const originalConfig = { ...config };
const fetchedAt = "2026-09-22T12:00:00Z";

beforeEach(() => {
  clearCache();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(fetchedAt));
  vi.stubEnv("FEED_CACHE_BUCKET", "test-feed-cache");
  config.countyPublisherBalanceEnabled = true;
  config.countySinglePublisherMax = 90;
  config.countyOtherSourcesTarget = 90;
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Pagination must reuse the stored feed"); }));
});
afterEach(() => {
  clearCache();
  Object.assign(config, originalConfig);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stories(publisher: string, count: number, offset = 0): NewsFeedItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${publisher}-${index}`, title: `${publisher} story ${index}`, source: publisher,
    link: `https://${publisher}.example/${index}`,
    publishedAt: new Date(Date.now() - (offset + index) * 60_000).toISOString(),
  }));
}

function storedFeed(items: NewsFeedItem[]) {
  const snapshot: FeedResponse = {
    scope: { level: "county", stateSlug: "texas", countySlug: "potter", places: ["Amarillo"] },
    topic: "general", items,
    meta: { count: items.length, sourcesUsed: ["local:potter"], fetchedAt, cacheTtlSeconds: config.cacheTtlSeconds },
  };
  return vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input.Key).toBe("feed-cache/feed%3Acounty%3Atexas%3Apotter%3Ageneral.json");
    return { Body: { transformToString: async () => JSON.stringify({ storedAt: Date.now(), value: snapshot }) } } as never;
  });
}

it.each([true, false])("reports all remaining county stories when publisher balancing is enabled=%s", async enabled => {
  config.countyPublisherBalanceEnabled = enabled;
  const items = stories("local", 30);
  const s3 = storedFeed(items);
  const pages: FeedResponse[] = [];
  for (const offset of [0, 12, 24, 36]) {
    const page = await getFeed(scope, "general", 12, offset);
    pages.push(page);
    expect(page.items).toEqual(items.slice(offset, offset + 12));
    expect(page.meta).toMatchObject({
      count: Math.max(0, Math.min(12, items.length - offset)), offset,
      totalAvailable: 30, hasMore: offset + 12 < 30, fetchedAt,
    });
  }
  expect(pages.flatMap(page => page.items)).toEqual(items);
  const expanded = await getFeed(scope, "general", 24);
  expect(expanded.items).toEqual(items.slice(0, 24));
  expect(expanded.items.slice(0, 12)).toEqual(pages[0].items);
  expect(expanded.meta).toMatchObject({ totalAvailable: 30, hasMore: true, fetchedAt });
  expect(s3).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps the first-page publisher mix while larger limits reveal the full eligible inventory", async () => {
  config.countySinglePublisherMax = 6;
  config.countyOtherSourcesTarget = 6;
  const dominant = stories("dominant", 10);
  const alternatives = stories("alternative", 8, 10);
  const s3 = storedFeed([...dominant, ...alternatives]);
  const first = await getFeed(scope, "general", 4);
  expect(first.items).toEqual([...dominant.slice(0, 2), ...alternatives.slice(0, 2)]);
  expect(first.meta).toMatchObject({ count: 4, totalAvailable: 12, hasMore: true, fetchedAt });
  expect(first.meta.sourcesUsed).toContain("county:publisher-balanced");

  const expanded = await getFeed(scope, "general", 8);
  expect(expanded.items).toEqual([...dominant.slice(0, 4), ...alternatives.slice(0, 4)]);
  expect(expanded.items).toEqual(expect.arrayContaining(first.items));
  expect(expanded.meta).toMatchObject({ count: 8, totalAvailable: 12, hasMore: true, fetchedAt });

  const complete = await getFeed(scope, "general", 20);
  expect(complete.items).toEqual([...dominant.slice(0, 6), ...alternatives.slice(0, 6)]);
  expect(complete.items).toEqual(expect.arrayContaining(expanded.items));
  expect(complete.meta).toMatchObject({ count: 12, totalAvailable: 12, hasMore: false, fetchedAt });
  expect(s3).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it("does not advertise stories excluded by the existing single-publisher cap", async () => {
  config.countySinglePublisherMax = 6;
  storedFeed(stories("dominant", 20));
  const first = await getFeed(scope, "general", 4);
  expect(first.meta).toMatchObject({ count: 4, totalAvailable: 6, hasMore: true });
  const complete = await getFeed(scope, "general", 12);
  expect(complete.items.slice(0, 4)).toEqual(first.items);
  expect(complete.meta).toMatchObject({ count: 6, totalAvailable: 6, hasMore: false, fetchedAt });
  expect(fetch).not.toHaveBeenCalled();
});

it("counts all eligible alternatives when publisher allowances are unequal", async () => {
  config.countySinglePublisherMax = 2;
  config.countyOtherSourcesTarget = 8;
  const dominant = stories("dominant", 3);
  const alternatives = Array.from({ length: 4 }, (_, index) => stories(`alternative-${index}`, 2, 3 + index * 2)).flat();
  storedFeed([...dominant, ...alternatives]);
  const first = await getFeed(scope, "general", 4);
  expect(first.meta).toMatchObject({ count: 4, totalAvailable: 10, hasMore: true });
  const complete = await getFeed(scope, "general", 20);
  expect(complete.items).toEqual([...dominant.slice(0, 2), ...alternatives]);
  expect(complete.meta).toMatchObject({ count: 10, totalAvailable: 10, hasMore: false, fetchedAt });
  expect(fetch).not.toHaveBeenCalled();
});

it("does not advertise alternatives beyond the largest supported balanced request", async () => {
  config.maxLimit = 6;
  config.countySinglePublisherMax = 2;
  config.countyOtherSourcesTarget = 8;
  const dominant = stories("dominant", 3);
  const alternatives = Array.from({ length: 4 }, (_, index) => stories(`alternative-${index}`, 2, 3 + index * 2)).flat();
  storedFeed([...dominant, ...alternatives]);
  const first = await getFeed(scope, "general", 4);
  expect(first.meta).toMatchObject({ count: 4, totalAvailable: 5, hasMore: true });
  const complete = await getFeed(scope, "general", 20);
  expect(complete.items).toEqual([...dominant.slice(0, 2), ...alternatives.slice(0, 3)]);
  expect(complete.meta).toMatchObject({ count: 5, totalAvailable: 5, hasMore: false, fetchedAt });
  expect(fetch).not.toHaveBeenCalled();
});
