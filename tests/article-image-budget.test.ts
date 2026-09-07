import { afterEach, expect, it, vi } from "vitest";
import { enrichArticleImages } from "../src/article-images.js";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";

const originalBudget = config.imageEnrichmentBudgetMs;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); config.imageEnrichmentBudgetMs = originalBudget; clearCache(); });

it("keeps images that finish inside one deadline even if another publisher stalls", async () => {
  vi.useFakeTimers(); config.imageEnrichmentBudgetMs = 100;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("slow")) return new Promise<Response>(() => {});
    return new Response('<html><meta property="og:image" content="https://publisher.example/photo.jpg"></html>', { headers: { "content-type": "text/html" } });
  }));
  const request = enrichArticleImages([
    { id: "fast", title: "Fast local story", link: "https://publisher.example/fast" },
    { id: "slow", title: "Slow local story", link: "https://publisher.example/slow" },
  ]);
  await vi.advanceTimersByTimeAsync(100);
  const items = await request;
  expect(items).toHaveLength(2);
  expect(items[0]?.imageUrl).toBe("https://publisher.example/photo.jpg");
  expect(items[1]?.imageUrl).toBeUndefined();
});

it("returns feed-supplied images immediately without any publisher request", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const items = [{ id: "feed-image", title: "Local", link: "https://publisher.example/story", imageUrl: "https://publisher.example/feed.jpg" }];
  expect(await enrichArticleImages(items)).toEqual(items);
  expect(fetcher).not.toHaveBeenCalled();
});
