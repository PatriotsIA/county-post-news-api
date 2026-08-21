import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { buildFeedPlan } from "../src/feed-builders.js";
import { filterItems } from "../src/filter.js";
import { getCounty } from "../src/geo.js";
import { handleRequest } from "../src/http.js";

const defaults = {
  countyFallbackMinItems: config.countyFallbackMinItems,
  nwsApiBase: config.nwsApiBase,
  nwsUserAgent: config.nwsUserAgent,
  weatherTimeoutMs: config.weatherTimeoutMs,
};

describe("county weather", () => {
  afterEach(() => {
    clearCache();
    config.countyFallbackMinItems = defaults.countyFallbackMinItems;
    config.nwsApiBase = defaults.nwsApiBase;
    config.nwsUserAgent = defaults.nwsUserAgent;
    config.weatherTimeoutMs = defaults.weatherTimeoutMs;
    vi.restoreAllMocks();
  });

  it("returns compact converted NWS weather with deduplicated severity-sorted point and zone alerts", async () => {
    const fetchMock = createNwsFetch();
    vi.stubGlobal("fetch", fetchMock);

    const first = await weatherRequest();
    const second = await weatherRequest();
    const body = JSON.parse(first.body);

    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toContain("max-age=180");
    expect(body.county).toMatchObject({
      displayName: "Polk County",
      fips: "05113",
      stateName: "Arkansas",
      stateAbbr: "AR",
    });
    expect(body.location).toMatchObject({
      city: "Mena",
      state: "AR",
      gridOffice: "LZK",
      gridX: 12,
      gridY: 34,
      timeZone: "America/Chicago",
    });
    expect(body.currentObservation).toMatchObject({
      stationId: "KMEZ",
      temperature: { value: 50, unit: "F", source: { value: 10, unitCode: "wmoUnit:degC" } },
      windSpeed: { value: 10, unit: "mph" },
      relativeHumidity: { value: 55, unit: "percent" },
    });
    expect(body.forecast).toHaveLength(1);
    expect(body.forecast[0]).toMatchObject({
      temperature: { value: 68, unit: "F" },
      windSpeed: { value: 9.9, unit: "mph", source: { rawValue: "16 km/h" } },
      precipitationProbability: { value: 40, unit: "percent" },
    });
    expect(body.hourly).toHaveLength(1);
    expect(body.hourly[0].name).toBe("Hourly forecast");
    expect(body.alerts.map((alert: { id: string }) => alert.id)).toEqual([
      "https://api.weather.gov/alerts/severe",
      "https://api.weather.gov/alerts/moderate",
    ]);
    expect(body.warnings).toEqual([]);
    expect(body.meta.partial).toBe(false);
    expect(body.meta.source.links.alerts).toHaveLength(3);
    expect(second.statusCode).toBe(200);

    const pointsCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/points/"));
    expect(pointsCalls).toHaveLength(1);
    for (const [url, init] of fetchMock.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("user-agent")).toBe(config.nwsUserAgent);
      if (new URL(String(url)).hostname === "api.weather.gov") {
        expect(headers.get("accept")).toContain("application/geo+json");
      }
    }
  });

  it("reports weekly drought conditions separately from active NWS alerts", async () => {
    vi.stubGlobal("fetch", createNwsFetch({
      noAlerts: true,
      droughtRows: [{
        mapDate: "2026-08-11T00:00:00",
        fips: "48375",
        county: "Potter County",
        state: "TX",
        none: 0,
        d0: 100,
        d1: 100,
        d2: 100,
        d3: 68.51,
        d4: 0,
        validStart: "2026-08-11T00:00:00",
        validEnd: "2026-08-17T23:59:59",
      }],
    }));

    const response = await weatherRequest("texas", "potter");
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.alerts).toHaveLength(0);
    expect(body.droughtCondition).toMatchObject({
      category: "D3",
      label: "Extreme Drought",
      areaPercent: 68.51,
      totalDroughtPercent: 100,
      categories: { d1: 100, d2: 100, d3: 68.51, d4: 0 },
      source: {
        name: "U.S. Drought Monitor",
        agency: "National Drought Mitigation Center, NOAA, and USDA",
      },
    });
    expect(body.droughtCondition.source.countyUrl).toBe(
      "https://www.drought.gov/states/Texas/county/Potter",
    );
  });

  it("removes semantically identical alerts returned with different NWS identifiers", async () => {
    vi.stubGlobal("fetch", createNwsFetch({ duplicateModerateAlert: true }));

    const response = await weatherRequest();
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.alerts.map((alert: { id: string }) => alert.id)).toEqual([
      "https://api.weather.gov/alerts/severe",
      "https://api.weather.gov/alerts/moderate",
    ]);
  });

  it("returns successful subresources with warnings when one NWS resource fails", async () => {
    vi.stubGlobal("fetch", createNwsFetch({ failHourly: true }));

    const response = await weatherRequest();
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.forecast).toHaveLength(1);
    expect(body.hourly).toEqual([]);
    expect(body.currentObservation.temperature.value).toBe(50);
    expect(body.meta.partial).toBe(true);
    expect(body.warnings).toContain("Hourly forecast is temporarily unavailable.");
  });

  it("requires the point mapping and returns 502 when all meaningful resources fail", async () => {
    const allResourcesResponse = await withNwsFetch(
      createNwsFetch({ failAllResources: true }),
      weatherRequest,
    );
    expect(allResourcesResponse.statusCode).toBe(502);
    expect(JSON.parse(allResourcesResponse.body).error).toBe(
      "National Weather Service weather resources are unavailable",
    );

    clearCache();
    const pointResponse = await withNwsFetch(createNwsFetch({ failPoints: true }), weatherRequest);
    expect(pointResponse.statusCode).toBe(502);
    expect(JSON.parse(pointResponse.body).error).toBe(
      "National Weather Service point lookup failed",
    );
  });

  it("returns 404 for an unknown county without calling NWS", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handleRequest({
      method: "GET",
      path: "/v1/counties/arkansas/not-a-county/weather",
      query: new URLSearchParams(),
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error).toBe("Unknown county");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("weather news topic", () => {
  afterEach(() => {
    clearCache();
    config.countyFallbackMinItems = defaults.countyFallbackMinItems;
    vi.restoreAllMocks();
  });

  it("plans and filters provider-backed county weather stories", async () => {
    const county = getCounty("arkansas", "polk");
    expect(county).toBeDefined();
    const scope = { level: "county" as const, state: county!.state, county: county! };
    const plan = buildFeedPlan(scope, "weather");
    expect(plan.articleQueries.every((query) => query.includes("Polk County") && query.includes("Arkansas"))).toBe(true);
    expect(decodeURIComponent(plan.rssUrls[0])).toMatch(/weather|forecast|storm/u);

    const filtered = filterItems(
      [
        {
          id: "weather",
          title: "Polk County Arkansas under severe thunderstorm warning",
          description: "The weather alert remains in effect this evening.",
          link: "https://publisher.example/weather",
          publishedAt: new Date().toISOString(),
        },
        {
          id: "business",
          title: "Polk County Arkansas business opens a new factory",
          link: "https://publisher.example/business",
          publishedAt: new Date().toISOString(),
        },
      ],
      "weather",
      scope,
    );
    expect(filtered.map((item) => item.id)).toEqual(["weather"]);

    config.countyFallbackMinItems = 1;
    const publishedAt = new Date().toUTCString();
    const weatherRss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Local News</title><item>
      <guid>weather-story</guid>
      <title>Polk County Arkansas prepares for severe storms</title>
      <link>https://publisher.example/weather-story</link>
      <source>Example Weather Desk</source>
      <pubDate>${publishedAt}</pubDate>
      <description>Polk County Arkansas weather forecast calls for severe thunderstorms.</description>
    </item></channel></rss>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) =>
        String(url).includes("api.gdeltproject.org")
          ? new Response(JSON.stringify({ articles: [] }), { status: 200 })
          : new Response(weatherRss, { status: 200, headers: { "content-type": "application/rss+xml" } }),
      ),
    );

    const response = await handleRequest({
      method: "GET",
      path: "/v1/feeds/counties/arkansas/polk/weather",
      query: new URLSearchParams("limit=10"),
    });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.topic).toBe("weather");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].link).toBe("https://publisher.example/weather-story");
  });
});

function weatherRequest(stateSlug = "arkansas", countySlug = "polk") {
  return handleRequest({
    method: "GET",
    path: `/v1/counties/${stateSlug}/${countySlug}/weather`,
    query: new URLSearchParams(),
  });
}

function createNwsFetch(
  options: {
    droughtRows?: unknown[];
    failHourly?: boolean;
    failAllResources?: boolean;
    failPoints?: boolean;
    noAlerts?: boolean;
    duplicateModerateAlert?: boolean;
  } = {},
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/points/") && options.failPoints) {
      return jsonResponse({ title: "Unavailable" }, 503);
    }
    if (url.pathname.startsWith("/points/")) return jsonResponse(pointsFixture);
    if (options.failAllResources) return jsonResponse({ title: "Unavailable" }, 503);
    if (url.hostname === "usdmdataservices.unl.edu") return jsonResponse(options.droughtRows || []);
    if (url.pathname === "/gridpoints/LZK/12,34/forecast/hourly" && options.failHourly) {
      return jsonResponse({ title: "Unavailable" }, 503);
    }
    if (url.pathname === "/gridpoints/LZK/12,34/forecast/hourly") return jsonResponse(forecastFixture(""));
    if (url.pathname === "/gridpoints/LZK/12,34/forecast") return jsonResponse(forecastFixture("Tonight"));
    if (url.pathname === "/gridpoints/LZK/12,34/stations") return jsonResponse(stationsFixture);
    if (url.pathname === "/stations/KMEZ/observations/latest") return jsonResponse(observationFixture);
    if (url.pathname === "/alerts/active" && options.noAlerts) return jsonResponse(alertCollection([]));
    if (url.pathname === "/alerts/active" && url.searchParams.has("point")) {
      return jsonResponse(alertCollection([moderateAlert, severeAlert]));
    }
    if (url.pathname === "/alerts/active" && url.searchParams.get("zone") === "ARZ040") {
      return jsonResponse(alertCollection([
        moderateAlert,
        ...(options.duplicateModerateAlert ? [duplicateModerateAlert] : []),
      ]));
    }
    if (url.pathname === "/alerts/active" && url.searchParams.get("zone") === "ARC113") {
      return jsonResponse(alertCollection([]));
    }
    throw new Error(`Unexpected NWS URL: ${url.toString()} ${JSON.stringify(init)}`);
  });
}

async function withNwsFetch<T>(fetchMock: ReturnType<typeof createNwsFetch>, action: () => Promise<T>) {
  vi.stubGlobal("fetch", fetchMock);
  return action();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/geo+json" },
  });
}

const pointsFixture = {
  properties: {
    gridId: "LZK",
    gridX: 12,
    gridY: 34,
    timeZone: "America/Chicago",
    forecast: "https://api.weather.gov/gridpoints/LZK/12,34/forecast",
    forecastHourly: "https://api.weather.gov/gridpoints/LZK/12,34/forecast/hourly",
    observationStations: "https://api.weather.gov/gridpoints/LZK/12,34/stations",
    forecastZone: "https://api.weather.gov/zones/forecast/ARZ040",
    county: "https://api.weather.gov/zones/county/ARC113",
    relativeLocation: { properties: { city: "Mena", state: "AR" } },
  },
};

function forecastFixture(name: string) {
  return {
    properties: {
      periods: [
        {
          number: 1,
          name,
          startTime: "2026-08-19T18:00:00-05:00",
          endTime: "2026-08-20T06:00:00-05:00",
          isDaytime: false,
          temperature: 20,
          temperatureUnit: "C",
          windSpeed: "16 km/h",
          windDirection: "S",
          probabilityOfPrecipitation: { value: 40, unitCode: "wmoUnit:percent" },
          shortForecast: "Severe storms",
          detailedForecast: "Test fixture forecast.",
          icon: "https://api.weather.gov/icons/land/night/tsra",
        },
      ],
    },
  };
}

const stationsFixture = {
  features: [
    {
      "@id": "https://api.weather.gov/stations/KMEZ",
      properties: { stationIdentifier: "KMEZ", name: "Mena Intermountain Municipal Airport" },
    },
  ],
};

const observationFixture = {
  properties: {
    timestamp: "2026-08-19T17:53:00-05:00",
    textDescription: "Thunderstorm",
    icon: "https://api.weather.gov/icons/land/night/tsra",
    temperature: { value: 10, unitCode: "wmoUnit:degC" },
    relativeHumidity: { value: 55, unitCode: "wmoUnit:percent" },
    windSpeed: { value: 16.0934, unitCode: "wmoUnit:km_h-1" },
    windGust: { value: null, unitCode: "wmoUnit:km_h-1" },
    windDirection: { value: 180, unitCode: "wmoUnit:degree_(angle)" },
    barometricPressure: { value: 101325, unitCode: "wmoUnit:Pa" },
  },
};

const moderateAlert = {
  id: "https://api.weather.gov/alerts/moderate",
  properties: {
    "@id": "https://api.weather.gov/alerts/moderate",
    event: "Flood Watch",
    headline: "Flood Watch issued for Polk County",
    description: "Fixture alert description.",
    instruction: "Avoid flooded roads.",
    severity: "Moderate",
    urgency: "Expected",
    certainty: "Likely",
    effective: "2026-08-19T17:00:00-05:00",
    expires: "2026-08-20T06:00:00-05:00",
  },
};

const severeAlert = {
  id: "https://api.weather.gov/alerts/severe",
  properties: {
    "@id": "https://api.weather.gov/alerts/severe",
    event: "Tornado Warning",
    headline: "Tornado Warning issued for Polk County",
    description: "Fixture alert description.",
    instruction: "Take shelter.",
    severity: "Severe",
    urgency: "Immediate",
    certainty: "Observed",
    effective: "2026-08-19T18:00:00-05:00",
    expires: "2026-08-19T19:00:00-05:00",
  },
};

const duplicateModerateAlert = {
  ...moderateAlert,
  id: "https://api.weather.gov/alerts/moderate-duplicate",
  properties: {
    ...moderateAlert.properties,
    "@id": "https://api.weather.gov/alerts/moderate-duplicate",
  },
};

function alertCollection(features: unknown[]) {
  return { features };
}
