import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { buildFeedPlan } from "../src/feed-builders.js";
import { filterItems } from "../src/filter.js";
import { getCounty, getCountyMarketCities } from "../src/geo.js";
import { handleRequest } from "../src/http.js";

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <guid>1</guid>
      <title>Randall County business development opens in Amarillo</title>
      <link>https://example.com/story?utm_source=test</link>
      <source>Example Daily</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Randall County Texas business development story.</description>
    </item>
    <item>
      <guid>2</guid>
      <title>Randall County football score</title>
      <link>https://example.com/sports</link>
      <source>Example Sports</source>
      <pubDate>Mon, 29 Jun 2026 13:00:00 GMT</pubDate>
      <description>High school sports in Amarillo.</description>
    </item>
  </channel>
</rss>`;

const rssWithOldArticle = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <guid>old</guid>
      <title>Randall County business development from last year</title>
      <link>https://example.com/old</link>
      <source>Example Archive</source>
      <pubDate>Mon, 01 Jan 2025 12:00:00 GMT</pubDate>
      <description>Randall County Texas business development story.</description>
    </item>
    <item>
      <guid>fresh</guid>
      <title>Randall County business development opens this week</title>
      <link>https://example.com/fresh</link>
      <source>Example Daily</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Randall County Texas business development story.</description>
    </item>
  </channel>
</rss>`;

const emptyRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty News</title>
  </channel>
</rss>`;

const arkansasRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Arkansas News</title>
    <item>
      <guid>ark-1</guid>
      <title>Arkansas launches new rural broadband program</title>
      <link>https://example.com/arkansas-rural-broadband</link>
      <source>Arkansas Daily</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Arkansas officials announced a rural broadband expansion.</description>
    </item>
  </channel>
</rss>`;

const bingRedirectRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bing News</title>
    <item>
      <guid>bing-1</guid>
      <title>Arkansas launches new highway safety campaign</title>
      <link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3A%2F%2Fpublisher.example%2Farkansas-highway-safety&amp;c=1</link>
      <source>Bing News</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Arkansas transportation officials announced the campaign.</description>
    </item>
    <item>
      <guid>bing-2</guid>
      <title>Arkansas expands local school grant program</title>
      <link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3A%2F%2Fpublisher.example%2Farkansas-school-grants&amp;c=2</link>
      <source>Bing News</source>
      <pubDate>Mon, 29 Jun 2026 13:00:00 GMT</pubDate>
      <description>Arkansas schools will receive new local grants.</description>
    </item>
  </channel>
</rss>`;

const gdelt = {
  articles: [
    {
      url: "https://gdelt.example.com/story",
      title: "Randall County jobs expansion reported in Amarillo",
      seendate: "20260629131500",
      domain: "gdelt.example.com",
      socialimage: "https://gdelt.example.com/image.jpg",
    },
  ],
};

const defaultCorsOrigins = [...config.corsOrigins];

describe("handleRequest", () => {
  afterEach(() => {
    config.corsOrigins = [...defaultCorsOrigins];
    vi.restoreAllMocks();
  });

  it("returns health metadata", async () => {
    const response = await handleRequest({ method: "GET", path: "/health", query: new URLSearchParams() });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, service: "county-post-news-api" });
  });

  it("echoes an allowed CORS origin", async () => {
    config.corsOrigins = ["https://main.d2z6lt4e5q50in.amplifyapp.com", "https://thecountypost.com"];

    const response = await handleRequest({
      method: "GET",
      path: "/health",
      query: new URLSearchParams(),
      headers: { origin: "https://main.d2z6lt4e5q50in.amplifyapp.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://main.d2z6lt4e5q50in.amplifyapp.com");
    expect(response.headers.vary).toBe("Origin");
  });

  it("returns filtered county feed items", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/randall/economy",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.scope).toMatchObject({ level: "county", stateSlug: "texas", countySlug: "randall" });
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toContain("business development");
  });

  it("reuses cached feed aggregation across different limits", async () => {
    clearCache();
    const fetchMock = vi.fn(async () => new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/randall/economy",
      query: new URLSearchParams("limit=10"),
    });
    const fetchCount = fetchMock.mock.calls.length;
    const second = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/randall/economy",
      query: new URLSearchParams("limit=200"),
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(fetchCount);
  });

  it("does not collapse distinct Bing redirect stories during dedupe", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bingRedirectRss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/states/arkansas/general",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items.map((item: { title: string }) => item.title)).toEqual(
      expect.arrayContaining([
        "Arkansas launches new highway safety campaign",
        "Arkansas expands local school grant program",
      ]),
    );
  });

  it("fills sparse county feeds from state topic fallback", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const value = decodeURIComponent(String(url));
        return new Response(value.includes("Polk") ? emptyRss : arkansasRss, {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        });
      }),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/arkansas/polk/general",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items.map((item: { title: string }) => item.title)).toContain(
      "Arkansas launches new rural broadband program",
    );
    expect(body.meta.sourcesUsed).toContain("fallback:state");
  });

  it("returns a county page batch", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/pages/counties/texas/randall",
      query: new URLSearchParams("sections=localNews,localSports&limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body.sections)).toEqual(["localNews", "localSports"]);
  });

  it("excludes articles older than the recency window", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(rssWithOldArticle, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/randall/economy",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items.map((item: { link: string }) => item.link)).toEqual(["https://example.com/fresh"]);
  });

  it("includes GDELT articles alongside RSS items", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const value = String(url);
        if (value.includes("api.gdeltproject.org")) {
          return new Response(JSON.stringify(gdelt), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } });
      }),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/randall/economy",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items.some((item: { link: string }) => item.link === "https://gdelt.example.com/story")).toBe(true);
    expect(body.meta.sourcesUsed).toContain("provider:gdelt");
  });

  it("builds broad Potter County and Amarillo local query coverage", () => {
    const county = getCounty("texas", "potter");
    expect(county).toBeDefined();

    const plan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");
    const decodedUrls = plan.rssUrls.map((url) => decodeURIComponent(url).replace(/\+/g, " "));

    expect(plan.sourcesUsed).toContain("provider:bing-news-rss");
    expect(decodedUrls.some((url) => url.includes("Potter County") && url.includes("Amarillo"))).toBe(true);
    expect(decodedUrls.some((url) => url.includes("www.bing.com/news/search"))).toBe(true);
    expect(decodedUrls.some((url) => url.includes("Amarillo") && url.includes("local news"))).toBe(true);
    expect(decodedUrls.some((url) => url.includes("when:7d"))).toBe(true);
    expect(plan.rssUrls.length).toBeLessThanOrEqual(18);
    expect(plan.articleQueries.length).toBeLessThanOrEqual(6);
    expect(plan.articleQueries.some((query) => query.includes("Potter County") && query.includes("Amarillo"))).toBe(true);
    expect(plan.directSources.map((source) => source.name)).toEqual(
      expect.arrayContaining(["ABC7 Amarillo Local", "ABC7 Amarillo Video", "MyHighPlains Local News", "MyHighPlains Podcasts"]),
    );
  });

  it("rejects unknown counties instead of creating guessed county feeds", async () => {
    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/not-a-real-county/general",
      query: new URLSearchParams("limit=10"),
    });

    expect(response.statusCode).toBe(404);
  });

  it("does not apply Amarillo direct feeds to unrelated Texas counties", () => {
    const county = getCounty("texas", "harris");
    expect(county).toBeDefined();

    const plan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");

    expect(plan.directSources.some((source) => source.name.includes("Amarillo"))).toBe(false);
  });

  it("does not apply market-specific direct feeds to state fallback plans", () => {
    const texas = getCounty("texas", "wood")?.state;
    expect(texas).toBeDefined();

    const plan = buildFeedPlan({ level: "state", state: texas! }, "general");

    expect(plan.directSources.some((source) => source.markets?.length || source.counties?.length)).toBe(false);
    expect(plan.directSources.some((source) => source.name.includes("Amarillo"))).toBe(false);
    expect(plan.directSources.some((source) => source.name.includes("Tyler"))).toBe(false);
  });

  it("applies direct Denver feeds to Denver County", () => {
    const county = getCounty("colorado", "denver");
    expect(county).toBeDefined();

    const plan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");

    expect(plan.directSources.map((source) => source.name)).toEqual(
      expect.arrayContaining(["Denver7 Local News", "CBS Colorado", "Denverite", "Westword"]),
    );
  });

  it("uses nearest Tyler market and Tyler sources for Wood County Texas", () => {
    const county = getCounty("texas", "wood");
    expect(county).toBeDefined();

    const markets = getCountyMarketCities(county!, 3);
    const plan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");

    expect(markets[0]).toBe("Tyler");
    expect(markets).not.toContain("Amarillo");
    expect(plan.sourcesUsed).toContain("market:Tyler");
    expect(plan.sourcesUsed).not.toContain("market:Amarillo");
    expect(plan.directSources.some((source) => source.name.includes("Amarillo"))).toBe(false);
    expect(plan.directSources.map((source) => source.name)).toEqual(
      expect.arrayContaining(["KLTV East Texas News", "CBS19 Tyler News", "KETK Local News"]),
    );
  });

  it("filters Texas-only Panhandle stories out of Wood County local headlines", () => {
    const county = getCounty("texas", "wood");
    expect(county).toBeDefined();

    const items = filterItems(
      [
        {
          id: "amarillo-texas-only",
          title: "Texas awards nearly $30M grant to boost electric reliability in Panhandle",
          link: "https://abc7amarillo.com/example",
          source: "ABC7 Amarillo Local",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "tyler-local",
          title: "Tyler leaders approve new road work near Wood County",
          link: "https://www.cbs19.tv/example",
          source: "CBS19 Tyler News",
          publishedAt: new Date().toISOString(),
        },
      ],
      "general",
      { level: "county", state: county!.state, county: county! },
    );

    expect(items.map((item) => item.id)).toEqual(["tyler-local"]);
  });

  it("logs request success and failure metadata", async () => {
    const infoLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await handleRequest({
      method: "GET",
      path: "/health",
      query: new URLSearchParams(),
      headers: { origin: "http://localhost:5173", referer: "http://localhost:5173/texas/potter", "user-agent": "vitest" },
      remoteAddress: "127.0.0.1",
      requestId: "test-success",
    });
    await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/texas/not-a-real-county/general",
      query: new URLSearchParams("limit=10"),
      headers: { origin: "http://localhost:5173", "user-agent": "vitest" },
      requestId: "test-failure",
    });

    const successPayload = JSON.parse(infoLog.mock.calls.at(-1)?.[0] as string);
    const failurePayload = JSON.parse(errorLog.mock.calls.at(-1)?.[0] as string);

    expect(successPayload).toMatchObject({
      event: "api.request",
      ok: true,
      method: "GET",
      path: "/health",
      statusCode: 200,
      origin: "http://localhost:5173",
      referer: "http://localhost:5173/texas/potter",
      requestId: "test-success",
    });
    expect(failurePayload).toMatchObject({
      event: "api.request",
      ok: false,
      method: "GET",
      path: "/v1/feeds/counties/texas/not-a-real-county/general",
      query: "limit=10",
      statusCode: 404,
      error: "Unknown county",
      requestId: "test-failure",
    });
  });
});
