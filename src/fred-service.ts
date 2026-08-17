import { cached } from "./cache.js";
import { config } from "./config.js";
import type { CountySite } from "./types.js";

type FredObservationResponse = {
  observations?: Array<{
    date?: string;
    value?: string;
  }>;
  error_code?: number;
  error_message?: string;
};

export type FredCountyMetricKey =
  | "unemployment-rate"
  | "median-household-income"
  | "per-capita-personal-income"
  | "gross-domestic-product"
  | "real-gross-domestic-product";

export type FredCountyMetric = {
  key: FredCountyMetricKey;
  label: string;
  description: string;
  seriesId: string;
  seriesUrl: string;
  units: string;
  frequency: "Annual";
  valueKind: "percent" | "currency" | "currency-thousands";
  source: string;
  latest: FredObservation;
  previous?: FredObservation;
  change?: {
    absolute: number;
    percent?: number;
  };
  observations: FredObservation[];
};

export type FredCountyResponse = {
  county: {
    name: string;
    displayName: string;
    slug: string;
    fips: string;
    stateName: string;
    stateSlug: string;
    stateAbbr: string;
  };
  metrics: FredCountyMetric[];
  meta: {
    source: "FRED";
    sourceName: "Federal Reserve Bank of St. Louis";
    sourceUrl: "https://fred.stlouisfed.org/";
    fetchedAt: string;
    latestObservationDate?: string;
    cacheTtlSeconds: number;
  };
};

type FredObservation = {
  date: string;
  value: number;
};

type FredMetricDefinition = Pick<
  FredCountyMetric,
  "key" | "label" | "description" | "seriesId" | "units" | "frequency" | "valueKind" | "source"
>;

export class FredServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function getCountyFredData(county: CountySite): Promise<FredCountyResponse> {
  if (!config.fredApiKey) {
    throw new FredServiceError(503, "County economic data is not configured.");
  }
  if (!county.fips) {
    throw new FredServiceError(404, "County economic data is unavailable for this county.");
  }

  const fips = county.fips.padStart(5, "0");
  return cached(`fred:county:${fips}`, config.fredCacheTtlSeconds, async () => {
    const definitions = countyMetricDefinitions(fips, county.state.abbr);
    const results = await Promise.allSettled(definitions.map(fetchFredMetric));
    const metrics = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(
          JSON.stringify({
            event: "fred.county.metric_failed",
            fips,
            seriesId: definitions[index].seriesId,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          }),
        );
      }
    });

    if (!metrics.length) {
      throw new FredServiceError(502, "FRED county economic data is temporarily unavailable.");
    }

    return {
      county: {
        name: county.name,
        displayName: county.displayName,
        slug: county.slug,
        fips,
        stateName: county.state.name,
        stateSlug: county.state.slug,
        stateAbbr: county.state.abbr,
      },
      metrics,
      meta: {
        source: "FRED",
        sourceName: "Federal Reserve Bank of St. Louis",
        sourceUrl: "https://fred.stlouisfed.org/",
        fetchedAt: new Date().toISOString(),
        latestObservationDate: newestDate(metrics.map((metric) => metric.latest.date)),
        cacheTtlSeconds: config.fredCacheTtlSeconds,
      },
    };
  });
}

function countyMetricDefinitions(fips: string, stateAbbr: string): FredMetricDefinition[] {
  return [
    {
      key: "unemployment-rate",
      label: "Unemployment rate",
      description: "Annual share of the county labor force that was unemployed.",
      seriesId: `LAUCN${fips}0000000003A`,
      units: "Percent",
      frequency: "Annual",
      valueKind: "percent",
      source: "U.S. Bureau of Labor Statistics",
    },
    {
      key: "median-household-income",
      label: "Median household income",
      description: "Estimated annual household income at the midpoint of county households.",
      seriesId: `MHI${stateAbbr.toUpperCase()}${fips}A052NCEN`,
      units: "Dollars",
      frequency: "Annual",
      valueKind: "currency",
      source: "U.S. Census Bureau",
    },
    {
      key: "per-capita-personal-income",
      label: "Per capita personal income",
      description: "Total personal income divided by the county population.",
      seriesId: `PCPI${fips}`,
      units: "Dollars",
      frequency: "Annual",
      valueKind: "currency",
      source: "U.S. Bureau of Economic Analysis",
    },
    {
      key: "gross-domestic-product",
      label: "County GDP",
      description: "Market value of goods and services produced in the county, in current dollars.",
      seriesId: `GDPALL${fips}`,
      units: "Thousands of U.S. Dollars",
      frequency: "Annual",
      valueKind: "currency-thousands",
      source: "U.S. Bureau of Economic Analysis",
    },
    {
      key: "real-gross-domestic-product",
      label: "Real county GDP",
      description: "Inflation-adjusted value of goods and services produced in the county.",
      seriesId: `REALGDPALL${fips}`,
      units: "Thousands of Chained 2017 U.S. Dollars",
      frequency: "Annual",
      valueKind: "currency-thousands",
      source: "U.S. Bureau of Economic Analysis",
    },
  ];
}

async function fetchFredMetric(definition: FredMetricDefinition): Promise<FredCountyMetric> {
  const url = new URL(`${config.fredApiUrl}/series/observations`);
  url.searchParams.set("series_id", definition.seriesId);
  url.searchParams.set("api_key", config.fredApiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "12");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "county-post-news-api/1.0",
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  const data = (await response.json().catch(() => ({}))) as FredObservationResponse;
  if (!response.ok) {
    throw new Error(data.error_message || `FRED series ${definition.seriesId} returned ${response.status}.`);
  }

  const observations = (data.observations || [])
    .flatMap((observation) => {
      const value = Number(observation.value);
      return observation.date && Number.isFinite(value) ? [{ date: observation.date, value }] : [];
    })
    .reverse();
  const latest = observations.at(-1);
  if (!latest) {
    throw new Error(`FRED series ${definition.seriesId} returned no observations.`);
  }

  const previous = observations.at(-2);
  const absolute = previous ? latest.value - previous.value : undefined;
  const percent = previous && previous.value !== 0 ? (absolute! / previous.value) * 100 : undefined;

  return {
    ...definition,
    seriesUrl: `https://fred.stlouisfed.org/series/${definition.seriesId}`,
    latest,
    previous,
    change:
      absolute === undefined
        ? undefined
        : {
            absolute: round(absolute),
            percent: percent === undefined ? undefined : round(percent),
          },
    observations,
  };
}

function newestDate(values: string[]) {
  return [...values].sort().at(-1);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
