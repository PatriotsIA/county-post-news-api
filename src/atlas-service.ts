import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { atlasDomains, atlasSources, getAtlasDomain } from "./atlas-registry.js";
import { cached } from "./cache.js";
import { config } from "./config.js";
import { getCounty } from "./geo.js";
import { getCountyFredData } from "./fred-service.js";
import type { FredCountyMetric } from "./fred-service.js";
import { COUNTY_POPULATION_ESTIMATE_VINTAGE, countyPopulationEstimates } from "./county-populations.js";
import { countyAtlasDomains } from "./types.js";
import type {
  CountyAtlasCounty,
  CountyAtlasDomain,
  CountyAtlasDomainDocument,
  CountyAtlasManifest,
  CountyAtlasMetric,
  CountyAtlasOverview,
  CountySite,
} from "./types.js";

type AtlasObjectReader = (bucket: string, key: string) => Promise<string>;

export class AtlasServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

let testObjectReader: AtlasObjectReader | undefined;
let s3Client: S3Client | undefined;

export function setAtlasObjectReaderForTests(reader?: AtlasObjectReader) {
  testObjectReader = reader;
}

export async function getCountyAtlasOverview(stateSlug: string, countySlug: string): Promise<CountyAtlasOverview> {
  const county = resolveCounty(stateSlug, countySlug);
  const cacheKey = `atlas:overview:${config.atlasDataBucket || "fallback"}:${normalizePrefix(config.atlasDataPrefix)}:${county.fips}`;
  return cached(cacheKey, config.atlasCacheTtlSeconds, async () => {
    if (config.atlasDataBucket) {
      try {
        const manifest = await loadManifest();
        const document = await readJson<CountyAtlasOverview>(
          `${manifest.activePrefix}/counties/${county.fips}/overview.json`,
        );
        return sanitizeOverview(document, county);
      } catch (error) {
        if (!isMissingObject(error)) throw toAtlasReadError(error);
        return fallbackOverview(county, "The published atlas snapshot is missing for this county.");
      }
    }
    return fallbackOverview(county, "Development fallback: no ATLAS_DATA_BUCKET is configured.");
  });
}

export async function getCountyAtlasDomain(
  stateSlug: string,
  countySlug: string,
  domainValue: string,
): Promise<CountyAtlasDomainDocument> {
  const domain = getAtlasDomain(domainValue);
  if (!domain) {
    throw new AtlasServiceError(400, `Unknown atlas domain. Use one of: ${countyAtlasDomains.join(", ")}`);
  }
  const county = resolveCounty(stateSlug, countySlug);
  const cacheKey = `atlas:domain:${config.atlasDataBucket || "fallback"}:${normalizePrefix(config.atlasDataPrefix)}:${county.fips}:${domain.slug}`;
  return cached(cacheKey, config.atlasCacheTtlSeconds, async () => {
    if (config.atlasDataBucket) {
      try {
        const manifest = await loadManifest();
        const document = await readJson<CountyAtlasDomainDocument>(
          `${manifest.activePrefix}/counties/${county.fips}/domains/${domain.slug}.json`,
        );
        return sanitizeDomain(document, county, domain.slug);
      } catch (error) {
        if (!isMissingObject(error)) throw toAtlasReadError(error);
        return fallbackDomain(county, domain.slug, "No published snapshot is available for this domain.");
      }
    }
    return fallbackDomain(county, domain.slug, "Development fallback: no ATLAS_DATA_BUCKET is configured.");
  });
}

async function loadManifest() {
  const cacheKey = `atlas:manifest:${config.atlasDataBucket}:${normalizePrefix(config.atlasDataPrefix)}`;
  return cached(cacheKey, config.atlasManifestCacheTtlSeconds, async () => {
    const manifest = await readJson<CountyAtlasManifest>("manifest/current.json");
    if (
      !manifest ||
      typeof manifest.version !== "string" ||
      typeof manifest.activePrefix !== "string" ||
      !Array.isArray(manifest.domains) ||
      !Number.isInteger(manifest.countyCount) ||
      !safeSnapshotPrefix(manifest.activePrefix)
    ) {
      throw new AtlasServiceError(502, "The atlas manifest is malformed.");
    }
    return manifest;
  });
}

async function readJson<T>(relativeKey: string): Promise<T> {
  const key = joinKey(config.atlasDataPrefix, relativeKey);
  try {
    const raw = await (testObjectReader || defaultObjectReader)(config.atlasDataBucket, key);
    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof SyntaxError) throw new AtlasServiceError(502, `Atlas object ${relativeKey} is not valid JSON.`);
    throw error;
  }
}

async function defaultObjectReader(bucket: string, key: string) {
  s3Client ||= new S3Client({});
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new AtlasServiceError(502, `Atlas object ${key} has no body.`);
  return response.Body.transformToString("utf8");
}

function sanitizeOverview(document: CountyAtlasOverview, county: CountySite): CountyAtlasOverview {
  if (!document || !Array.isArray(document.domains) || !validMeta(document.meta)) {
    throw new AtlasServiceError(502, "The county atlas overview is malformed.");
  }
  let removedMetrics = 0;
  const publishedDomains = new Map(document.domains.map((entry) => [entry?.domain?.slug, entry]));
  const domains = countyAtlasDomains.map((domain) => {
    const entry = publishedDomains.get(domain);
    const registered = entry?.domain && getAtlasDomain(entry.domain.slug);
    if (!registered || !Array.isArray(entry.featuredMetrics) || !Array.isArray(entry.warnings)) {
      removedMetrics += 1;
      return {
        domain: atlasDomains[domain],
        featuredMetrics: [],
        available: false,
        warnings: [`No validated ${atlasDomains[domain].label} summary was published.`],
      };
    }
    const featuredMetrics = entry.featuredMetrics.filter((metric) => validMetric(metric, registered.slug));
    removedMetrics += entry.featuredMetrics.length - featuredMetrics.length;
    return {
      domain: registered,
      featuredMetrics,
      available: featuredMetrics.some((metric) => metric.value !== undefined),
      warnings: entry.warnings.map(String),
    };
  });
  return {
    ...document,
    county: atlasCounty(county),
    domains,
    meta: { ...document.meta, partial: document.meta.partial || removedMetrics > 0 },
  };
}

function sanitizeDomain(
  document: CountyAtlasDomainDocument,
  county: CountySite,
  expectedDomain: CountyAtlasDomain,
): CountyAtlasDomainDocument {
  if (
    !document ||
    document.domain?.slug !== expectedDomain ||
    !Array.isArray(document.metrics) ||
    !Array.isArray(document.warnings) ||
    !validMeta(document.meta)
  ) {
    throw new AtlasServiceError(502, "The county atlas domain document is malformed.");
  }
  const metrics = document.metrics.filter((metric) => validMetric(metric, expectedDomain));
  const removed = document.metrics.length - metrics.length;
  return {
    ...document,
    county: atlasCounty(county),
    domain: atlasDomains[expectedDomain],
    metrics,
    warnings: [
      ...document.warnings.map(String),
      ...(removed ? [`${removed} malformed metric${removed === 1 ? " was" : "s were"} omitted.`] : []),
    ],
    meta: { ...document.meta, partial: document.meta.partial || removed > 0 },
  };
}

async function fallbackOverview(county: CountySite, reason: string): Promise<CountyAtlasOverview> {
  const metrics = await fallbackMetrics(county, true);
  const generatedAt = new Date().toISOString();
  const domains = countyAtlasDomains.map((domain) => {
    const domainMetrics = metrics.filter((metric) => metric.domain === domain);
    return {
      domain: atlasDomains[domain],
      featuredMetrics: domainMetrics.slice(0, 3),
      available: domainMetrics.length > 0,
      warnings: domainMetrics.length ? [reason] : [reason, `No verified ${atlasDomains[domain].label} data is available.`],
    };
  });
  return {
    county: atlasCounty(county),
    domains,
    meta: {
      version: "development-fallback",
      generatedAt,
      retrievedAt: generatedAt,
      sources: uniqueSources(metrics),
      partial: true,
      cacheTtlSeconds: config.atlasCacheTtlSeconds,
    },
  };
}

async function fallbackDomain(
  county: CountySite,
  domain: CountyAtlasDomain,
  reason: string,
): Promise<CountyAtlasDomainDocument> {
  const metrics = (await fallbackMetrics(county, domain === "economy")).filter((metric) => metric.domain === domain);
  const generatedAt = new Date().toISOString();
  return {
    county: atlasCounty(county),
    domain: atlasDomains[domain],
    metrics,
    warnings: metrics.length ? [reason] : [reason, `No verified ${atlasDomains[domain].label} data is available.`],
    meta: {
      version: "development-fallback",
      generatedAt,
      retrievedAt: generatedAt,
      sources: uniqueSources(metrics),
      partial: true,
      cacheTtlSeconds: config.atlasCacheTtlSeconds,
    },
  };
}

async function fallbackMetrics(county: CountySite, includeFred: boolean) {
  const metrics: CountyAtlasMetric[] = [];
  const retrievedAt = new Date().toISOString();
  const fips = county.fips?.padStart(5, "0");
  const population = fips ? countyPopulationEstimates[fips] : undefined;
  if (population !== undefined) {
    metrics.push({
      key: "population",
      domain: "demographics",
      label: "Population",
      description: "Latest bundled Census Population Estimates Program county estimate.",
      unit: "People",
      valueKind: "number",
      chart: "none",
      value: population,
      date: String(COUNTY_POPULATION_ESTIMATE_VINTAGE),
      vintage: `Vintage ${COUNTY_POPULATION_ESTIMATE_VINTAGE}`,
      retrievedAt,
      geographyVintage: `Vintage ${COUNTY_POPULATION_ESTIMATE_VINTAGE} county geography`,
      revisionStatus: "final",
      source: atlasSources["census-popest"],
    });
  }

  if (includeFred && config.fredApiKey) {
    try {
      const fred = await getCountyFredData(county);
      metrics.push(...fred.metrics.flatMap((metric) => mapFredMetric(metric, fred.meta.fetchedAt)));
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "atlas.fallback.fred_failed",
          fips,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  return metrics;
}

function mapFredMetric(metric: FredCountyMetric, retrievedAt: string): CountyAtlasMetric[] {
  const keyMap: Partial<Record<FredCountyMetric["key"], string>> = {
    "unemployment-rate": "unemployment-rate",
    "median-household-income": "median-household-income",
    "per-capita-personal-income": "per-capita-income",
    "real-gross-domestic-product": "real-gdp",
  };
  const key = keyMap[metric.key];
  if (!key) return [];
  return [
    {
      key,
      domain: "economy",
      label: metric.label,
      description: metric.description,
      unit: metric.units,
      valueKind: metric.valueKind === "percent" ? "percent" : "currency",
      chart: "trend",
      value: metric.latest.value,
      date: metric.latest.date,
      vintage: `FRED observation ${metric.latest.date}`,
      retrievedAt,
      geographyVintage: "Current FRED series geography",
      revisionStatus: "not-applicable",
      source: atlasSources.fred,
      observations: metric.observations,
    },
  ];
}

function resolveCounty(stateSlug: string, countySlug: string) {
  const county = getCounty(stateSlug, countySlug);
  if (!county) throw new AtlasServiceError(404, "Unknown county");
  if (!county.fips) throw new AtlasServiceError(503, "County atlas data is unavailable for this county.");
  return county;
}

function atlasCounty(county: CountySite): CountyAtlasCounty {
  return {
    name: county.name,
    displayName: county.displayName,
    slug: county.slug,
    fips: county.fips!.padStart(5, "0"),
    stateName: county.state.name,
    stateSlug: county.state.slug,
    stateAbbr: county.state.abbr,
  };
}

function validMetric(value: unknown, domain: CountyAtlasDomain): value is CountyAtlasMetric {
  if (!value || typeof value !== "object") return false;
  const metric = value as CountyAtlasMetric;
  return (
    metric.domain === domain &&
    typeof metric.key === "string" &&
    typeof metric.label === "string" &&
    typeof metric.description === "string" &&
    typeof metric.unit === "string" &&
    Boolean(metric.source?.id) &&
    (metric.value === undefined || Number.isFinite(metric.value)) &&
    (!metric.suppressed || Boolean(metric.suppressionReason))
  );
}

function validMeta(value: CountyAtlasOverview["meta"] | undefined) {
  return Boolean(
    value &&
      typeof value.version === "string" &&
      typeof value.generatedAt === "string" &&
      typeof value.retrievedAt === "string" &&
      Array.isArray(value.sources) &&
      typeof value.partial === "boolean",
  );
}

function uniqueSources(metrics: CountyAtlasMetric[]) {
  const seen = new Set<string>();
  return metrics.flatMap((metric) => {
    if (seen.has(metric.source.id)) return [];
    seen.add(metric.source.id);
    return [metric.source];
  });
}

function toAtlasReadError(error: unknown) {
  if (error instanceof AtlasServiceError) return error;
  console.error(
    JSON.stringify({
      event: "atlas.s3.read_failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return new AtlasServiceError(502, "County atlas data is temporarily unavailable.");
}

function isMissingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound" ||
    candidate.Code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function safeSnapshotPrefix(value: string) {
  return Boolean(value && !value.startsWith("/") && !value.includes("..") && /^[a-zA-Z0-9._/-]+$/.test(value));
}

function normalizePrefix(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinKey(prefix: string, key: string) {
  const normalizedPrefix = normalizePrefix(prefix);
  const normalizedKey = key.replace(/^\/+/g, "");
  return normalizedPrefix ? `${normalizedPrefix}/${normalizedKey}` : normalizedKey;
}
