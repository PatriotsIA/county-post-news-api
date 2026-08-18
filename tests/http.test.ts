import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { buildCountyMarketPlan, buildFeedPlan } from "../src/feed-builders.js";
import { filterItems, filterMarketItems } from "../src/filter.js";
import { getCounty, getCountyPlaceTerms, getNearbyCounties } from "../src/geo.js";
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

const duplicateTitleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Duplicate News</title>
    <item>
      <guid>duplicate-one</guid>
      <title>Polk County Arkansas approves new road project</title>
      <link>https://publisher-one.example/polk-road-project</link>
      <source>Publisher One</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Polk County Arkansas officials approved the project.</description>
    </item>
    <item>
      <guid>duplicate-two</guid>
      <title>Polk County Arkansas approves new road project</title>
      <link>https://publisher-two.example/polk-road-project</link>
      <source>Publisher Two</source>
      <pubDate>Mon, 29 Jun 2026 13:00:00 GMT</pubDate>
      <description>Polk County Arkansas officials approved the project.</description>
    </item>
  </channel>
</rss>`;

const nearDuplicateTitleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>DVIDS</title>
    <item>
      <guid>dvids-one</guid>
      <title>Polk County Arkansas approves road project after public hearing</title>
      <link>https://www.dvidshub.net/image/1001</link>
      <source>DVIDS</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Polk County Arkansas officials approved the road project after the public hearing.</description>
    </item>
    <item>
      <guid>dvids-two</guid>
      <title>Polk County Arkansas approves the road project after public hearing</title>
      <link>https://www.dvidshub.net/image/1002</link>
      <source>DVIDS</source>
      <pubDate>Mon, 29 Jun 2026 13:00:00 GMT</pubDate>
      <description>Polk County Arkansas officials approved the road project after the public hearing.</description>
    </item>
  </channel>
</rss>`;

const duplicateImageRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Arkansas Daily</title>
    <item>
      <guid>image-one</guid>
      <title>Polk County Arkansas road construction begins Monday</title>
      <link>https://publisher-one.example/road-construction</link>
      <source>Arkansas Daily</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Polk County Arkansas construction begins Monday.</description>
      <enclosure url="https://images.example.com/polk-road.jpg?width=1200" type="image/jpeg" />
    </item>
    <item>
      <guid>image-two</guid>
      <title>Polk County Arkansas commission schedules road work update</title>
      <link>https://publisher-two.example/road-work-update</link>
      <source>Arkansas Daily</source>
      <pubDate>Mon, 29 Jun 2026 13:00:00 GMT</pubDate>
      <description>Polk County Arkansas road work update.</description>
      <enclosure url="https://images.example.com/polk-road.jpg?width=600" type="image/jpeg" />
    </item>
  </channel>
</rss>`;

const relatedStoryRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Arkansas Democrat-Gazette</title>
    <item>
      <guid>related-one</guid>
      <title>Polk County jail escapee taken back into custody - The Arkansas Democrat-Gazette</title>
      <link>https://publisher.example/jail-escapee-custody</link>
      <source>The Arkansas Democrat-Gazette</source>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <description>Polk County Arkansas jail escapee was taken back into custody.</description>
    </item>
    <item>
      <guid>related-two</guid>
      <title>Search begins for escaped Polk County inmate - Northwest Arkansas Democrat-Gazette</title>
      <link>https://publisher.example/escaped-polk-inmate</link>
      <source>Northwest Arkansas Democrat-Gazette</source>
      <pubDate>Mon, 29 Jun 2026 13:00:00 GMT</pubDate>
      <description>Search begins for an escaped Polk County Arkansas inmate.</description>
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
      title: "Randall County Texas jobs expansion reported in Amarillo",
      seendate: "20260629131500",
      domain: "gdelt.example.com",
      socialimage: "https://gdelt.example.com/image.jpg",
    },
  ],
};

const defaultCorsOrigins = [...config.corsOrigins];
const defaultMetalsProviderUrl = config.metalsProviderUrl;
const defaultUsdaMarsApiKey = config.usdaMarsApiKey;
const defaultFredApiKey = config.fredApiKey;
const defaultCountyMarketTierEnabled = config.countyMarketTierEnabled;
const defaultCountyPrimaryQueryLimit = config.countyPrimaryQueryLimit;
const defaultCountyMarketQueryLimit = config.countyMarketQueryLimit;
const defaultCountyNearbyLimit = config.countyNearbyLimit;

describe("handleRequest", () => {
  afterEach(() => {
    clearCache();
    config.corsOrigins = [...defaultCorsOrigins];
    config.metalsProviderUrl = defaultMetalsProviderUrl;
    config.usdaMarsApiKey = defaultUsdaMarsApiKey;
    config.fredApiKey = defaultFredApiKey;
    config.countyMarketTierEnabled = defaultCountyMarketTierEnabled;
    config.countyPrimaryQueryLimit = defaultCountyPrimaryQueryLimit;
    config.countyMarketQueryLimit = defaultCountyMarketQueryLimit;
    config.countyNearbyLimit = defaultCountyNearbyLimit;
    vi.restoreAllMocks();
  });

  it("returns health metadata", async () => {
    const response = await handleRequest({ method: "GET", path: "/health", query: new URLSearchParams() });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, service: "county-post-news-api" });
  });

  it("serves neutral editorial subcategory feeds through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(rss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/national/monetary-policy",
      query: new URLSearchParams("limit=10"),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).topic).toBe("monetary-policy");
  });

  it("returns cached no-key LBMA benchmark metal prices through the server-side provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            updatedAt: "2026-08-06T18:00:00.000Z",
            metals: {
              gold: { price: 3400.5, currency: "USD", unit: "troy oz" },
              silver: { price: 38.2, currency: "USD", unit: "troy oz" },
              platinum: { price: 1400, currency: "USD", unit: "troy oz" },
              palladium: { price: 1125, currency: "USD", unit: "troy oz" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const response = await handleRequest({ method: "GET", path: "/v1/markets/metals", query: new URLSearchParams() });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      currency: "USD",
      unit: "troy oz",
      provider: { name: "Minted Metal", url: "https://mintedmetal.com" },
      items: [
        { key: "gold", price: 3400.5 },
        { key: "silver", price: 38.2 },
        { key: "platinum", price: 1400 },
        { key: "palladium", price: 1125 },
      ],
    });
  });

  it("returns current cattle prices through USDA MARS", async () => {
    config.usdaMarsApiKey = "test-mars-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const value = String(url);
        const rows = value.includes("/1280")
          ? [
              {
                report_date: "08/03/2026",
                market_location_name: "Oklahoma National Stockyards Market",
                commodity: "Feeder Cattle",
                price_unit: "Per Cwt",
                head_count: 10,
                avg_price: 390,
              },
              {
                report_date: "08/03/2026",
                market_location_name: "Oklahoma National Stockyards Market",
                commodity: "Feeder Cattle",
                price_unit: "Per Cwt",
                head_count: 20,
                avg_price: 405,
              },
            ]
          : [
              {
                report_date: "08/06/2026",
                market_location_name: "Sheldon Livestock Auction",
                commodity: "Slaughter Cattle",
                price_unit: "Per Cwt",
                head_count: 5,
                avg_price: 244.98,
              },
            ];
        return new Response(JSON.stringify({ results: rows }), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );

    const response = await handleRequest({ method: "GET", path: "/v1/markets/cattle", query: new URLSearchParams() });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      updatedAt: "08/06/2026",
      items: [
        { key: "feeder-cattle", label: "Feeder cattle", price: 400, unit: "Per Cwt", sampleSize: 2 },
        { key: "slaughter-cattle", label: "Slaughter cattle", price: 244.98, unit: "Per Cwt", sampleSize: 1 },
      ],
    });
  });

  it("returns cached FRED economic data for a county", async () => {
    config.fredApiKey = "test-fred-key";
    const fetchMock = vi.fn(async (url: URL | string) => {
      const seriesId = new URL(String(url)).searchParams.get("series_id") || "";
      const latestValue = seriesId.includes("000000003A") ? "4.2" : seriesId.startsWith("MHI") ? "52100" : "64500";
      return new Response(
        JSON.stringify({
          observations: [
            { date: "2024-01-01", value: latestValue },
            { date: "2023-01-01", value: "4" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await handleRequest({
      method: "GET",
      path: "/v1/counties/arkansas/polk/economic-data",
      query: new URLSearchParams(),
    });
    const second = await handleRequest({
      method: "GET",
      path: "/v1/counties/arkansas/polk/economic-data",
      query: new URLSearchParams(),
    });
    const body = JSON.parse(first.body);

    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toContain("s-maxage=");
    expect(body.county).toMatchObject({ displayName: "Polk County", fips: "05113", stateAbbr: "AR" });
    expect(body.metrics).toHaveLength(5);
    expect(body.metrics[0]).toMatchObject({
      key: "unemployment-rate",
      seriesId: "LAUCN051130000000003A",
      latest: { date: "2024-01-01", value: 4.2 },
    });
    expect(body.meta.source).toBe("FRED");
    expect(second.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(5);
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

  it("fills sparse county feeds from the nearest same-state counties", async () => {
    clearCache();
    const polk = getCounty("arkansas", "polk");
    const nearbyCounty = getNearbyCounties(polk!, 1)[0];
    expect(nearbyCounty).toBeDefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const nearbyRss = arkansasRss.replaceAll("Arkansas", `${nearbyCounty.displayName} Arkansas`);
        return new Response(nearbyRss, {
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
      `${nearbyCounty.displayName} Arkansas launches new rural broadband program`,
    );
    expect(body.meta.sourcesUsed).toContain("county:fallback-nearby");
  });

  it("rejects same-name county stories from another state and requires a county state match", () => {
    const polk = getCounty("arkansas", "polk");
    expect(polk).toBeDefined();

    const items = filterItems(
      [
        {
          id: "polk-florida",
          title: "Polk County Florida opens emergency shelter",
          link: "https://example.com/polk-florida",
          source: "Florida Daily",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "polk-no-state",
          title: "Polk County opens emergency shelter",
          link: "https://example.com/polk-no-state",
          source: "Local Daily",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "polk-arkansas",
          title: "Polk County Arkansas opens emergency shelter",
          link: "https://example.com/polk-arkansas",
          source: "Arkansas Daily",
          publishedAt: new Date().toISOString(),
        },
      ],
      "general",
      { level: "county", state: polk!.state, county: polk! },
    );

    expect(items.map((item) => item.id)).toEqual(["polk-arkansas"]);
  });

  it("keeps only one story when publishers use the same title", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(duplicateTitleRss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/arkansas/polk/general",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Polk County Arkansas approves new road project");
  });

  it("keeps only one DVIDS item when image titles are near duplicates", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(nearDuplicateTitleRss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/arkansas/polk/general",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].link).toBe("https://www.dvidshub.net/image/1001");
  });

  it("keeps only one item when multiple records use the same article image", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(duplicateImageRss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/arkansas/polk/general",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].link).toBe("https://publisher-one.example/road-construction");
  });

  it("collapses related updates from the same publisher family", async () => {
    clearCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(relatedStoryRss, { status: 200, headers: { "content-type": "application/rss+xml" } })),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/arkansas/polk/general",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].link).toBe("https://publisher.example/jail-escapee-custody");
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

  it("merges sparse county coverage in primary then market order", async () => {
    clearCache();
    const primaryRss = rss.replaceAll("Randall County", "Polk County").replaceAll("Amarillo", "Arkansas").replaceAll("Texas", "Arkansas");
    const marketRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Mena News</title><item>
  <guid>mena</guid><title>Mena Arkansas opens a new community center</title>
  <link>https://example.com/mena-community</link><source>Mena News</source>
  <pubDate>Mon, 29 Jun 2026 14:00:00 GMT</pubDate>
  <description>Mena Arkansas local news and community updates.</description>
</item></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        const value = decodeURIComponent(String(url));
        if (value.includes("api.gdeltproject.org")) {
          return new Response(JSON.stringify({ articles: [] }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(value.includes("Mena") ? marketRss : primaryRss, {
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

    expect(body.items.map((item: { title: string }) => item.title)).toEqual(
      expect.arrayContaining(["Polk County business development opens in Arkansas", "Mena Arkansas opens a new community center"]),
    );
    expect(body.items[0].title).toBe("Polk County business development opens in Arkansas");
    expect(body.meta.sourcesUsed).toEqual(expect.arrayContaining(["county:primary", "county:market", "market:Mena"]));
  });

  it("accepts state-qualified local places and trusted market publishers only", () => {
    const wood = getCounty("texas", "wood");
    expect(wood).toBeDefined();
    const marketPlan = buildCountyMarketPlan(wood!, "general");
    const items = filterMarketItems(
      [
        {
          id: "trusted",
          title: "Texas officials announce regional transportation update",
          link: "https://www.cbs19.tv/trusted",
          source: "Regional Wire",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "place",
          title: "Tyler Texas opens a new regional service center",
          link: "https://example.com/place",
          source: "Regional Wire",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "wrong-state",
          title: "Tyler Florida opens a new regional service center",
          link: "https://example.com/wrong-state",
          source: "CBS19 Tyler News",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "untrusted",
          title: "Texas officials announce regional transportation update",
          link: "https://example.com/untrusted",
          source: "Regional Wire",
          publishedAt: new Date().toISOString(),
        },
      ],
      "general",
      { level: "county", state: wood!.state, county: wood! },
      getCountyPlaceTerms(wood!, config.countyMarketLimit),
      marketPlan.directSources,
    );

    expect(items.map((item) => item.id)).toEqual(["trusted", "place"]);
  });

  it("bounds primary and market county query plans with configurable budgets", () => {
    const county = getCounty("texas", "wood");
    expect(county).toBeDefined();
    config.countyPrimaryQueryLimit = 1;
    config.countyMarketQueryLimit = 1;

    const primaryPlan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");
    const marketPlan = buildCountyMarketPlan(county!, "general");

    expect(primaryPlan.articleQueries).toHaveLength(1);
    expect(marketPlan.articleQueries).toHaveLength(1);
    expect(primaryPlan.rssUrls.length).toBeLessThanOrEqual(config.maxRssUrlsPerFeed);
    expect(marketPlan.rssUrls.length).toBeLessThanOrEqual(config.maxRssUrlsPerFeed);
  });

  it("builds state-qualified primary county query coverage", () => {
    const county = getCounty("texas", "potter");
    expect(county).toBeDefined();

    const plan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");
    const decodedUrls = plan.rssUrls.map((url) => decodeURIComponent(url).replace(/\+/g, " "));

    expect(plan.sourcesUsed).toContain("provider:bing-news-rss");
    expect(plan.sourcesUsed).toContain("county:primary");
    expect(decodedUrls.every((url) => url.includes("Potter County") && url.includes("Texas"))).toBe(true);
    expect(decodedUrls.some((url) => url.includes("www.bing.com/news/search"))).toBe(true);
    expect(decodedUrls.some((url) => url.includes("when:7d"))).toBe(true);
    expect(plan.rssUrls.length).toBeLessThanOrEqual(18);
    expect(plan.articleQueries.length).toBeLessThanOrEqual(6);
    expect(plan.articleQueries.every((query) => query.includes("Potter County") && query.includes("Texas"))).toBe(true);
    expect(plan.directSources.some((source) => source.counties?.includes("texas/potter"))).toBe(true);
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

  it("does not use broad nearby-market sources in a primary county feed", () => {
    const county = getCounty("texas", "wood");
    expect(county).toBeDefined();

    const plan = buildFeedPlan({ level: "county", state: county!.state, county: county! }, "general");

    expect(plan.directSources.some((source) => source.name.includes("Amarillo"))).toBe(false);
    expect(plan.directSources.some((source) => source.name.includes("Tyler"))).toBe(false);
  });

  it("keeps a primary county feed limited to its explicitly named county", () => {
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

    expect(items).toEqual([]);
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
