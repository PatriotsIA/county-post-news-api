import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRssItems } from "../src/rss.js";

const bingFeed = readFileSync(join(__dirname, "fixtures/bing-news-rss.xml"), "utf8");

function stubFetch(body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "application/rss+xml" } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Bing News RSS attribution", () => {
  it("takes the publisher from News:Source, not the channel title", async () => {
    stubFetch(bingFeed);
    const items = await fetchRssItems("https://www.bing.com/news/search?q=test&format=rss");

    expect(items).toHaveLength(3);
    expect(items.map((item: { source?: string }) => item.source)).toEqual([
      "MyHighPlains on MSN",
      "NewsChannel 10 on MSN",
      "Amarillo Globe-News",
    ]);

    // The channel title is the search query. It must never become a byline.
    for (const item of items) {
      expect(item.source).not.toContain("BingNews");
      expect(item.source).not.toContain("local news OR community news");
      expect(item.source).not.toMatch(/["()]/);
    }
  });

  it("unwraps the Bing click-tracking redirect to the publisher's own URL", async () => {
    stubFetch(bingFeed);
    const items = await fetchRssItems("https://www.bing.com/news/search?q=test&format=rss");

    for (const item of items) {
      expect(item.link).not.toContain("bing.com");
      expect(item.link).toMatch(/^https:\/\//);
    }
    expect(items[0].link).toContain("msn.com");
    expect(items[2].link).toContain("amarillo.com");
  });

  it("uses the News:Image thumbnail, upgraded to https", async () => {
    stubFetch(bingFeed);
    const items = await fetchRssItems("https://www.bing.com/news/search?q=test&format=rss");

    // Bing publishes thumbnails over plain http; served on an https page they
    // would be blocked as mixed content and never render.
    expect(items[0].imageUrl).toMatch(/^https:\/\//);
    expect(items[1].imageUrl).toMatch(/^https:\/\//);
    for (const item of items) expect(item.imageUrl).not.toMatch(/^http:\/\//);

    // The third item carries no image in the feed; empty is correct there.
    expect(items[2].imageUrl).toBe("");
  });

  it("returns an empty source rather than passing a search query through", async () => {
    // A feed shaped like Bing's but with no News:Source: the only candidate left
    // is the channel title, which is the query. Empty lets the client fall back
    // to the article's hostname; the query would be printed as the publisher.
    const withoutSource = bingFeed.replace(/<News:Source>.*?<\/News:Source>/g, "");
    stubFetch(withoutSource);
    const items = await fetchRssItems("https://www.bing.com/news/search?q=test&format=rss");

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.source).toBe("");
  });

  it("keeps a legitimate publisher name from a plain <source> element", async () => {
    const plainFeed = `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0"><channel><title>Some Aggregator - BingNews</title>
        <item>
          <title>County commissioners approve budget</title>
          <link>https://www.amarillo.com/story/news/2026/09/03/budget/</link>
          <source>Amarillo Globe-News</source>
          <pubDate>Wed, 03 Sep 2026 12:00:00 GMT</pubDate>
          <description>The vote was 4-1.</description>
        </item>
      </channel></rss>`;
    stubFetch(plainFeed);
    const items = await fetchRssItems("https://example.com/feed.xml");

    expect(items[0].source).toBe("Amarillo Globe-News");
    expect(items[0].link).toBe("https://www.amarillo.com/story/news/2026/09/03/budget/");
  });
});
