import { atlasDomains, getAtlasSources } from "../../src/atlas-registry.js";
import { countyAtlasDomains } from "../../src/types.js";
import type {
  CountyAtlasDomain,
  CountyAtlasDomainDocument,
  CountyAtlasMetric,
  CountyAtlasOverview,
} from "../../src/types.js";
import type { AtlasProviderResult, AtlasSnapshot } from "./types.js";

export function buildSnapshot(
  results: AtlasProviderResult[],
  options: { generatedAt: string; cacheTtlSeconds: number },
): AtlasSnapshot {
  if (!results.length) throw new Error("No implemented atlas providers were selected.");

  const version = versionFromDate(options.generatedAt);
  const activePrefix = `versions/${version}`;
  const counties = mergeCounties(results);
  const availableDomains = countyAtlasDomains.filter((domain) =>
    [...counties.values()].some((record) => record.metrics.some((metric) => metric.domain === domain && metric.value !== undefined)),
  );
  const retrievedAt = newestDate(results.map((result) => result.retrievedAt));
  const objects: AtlasSnapshot["objects"] = [];

  for (const { county, metrics } of counties.values()) {
    const domainDocuments = countyAtlasDomains.map((domain) =>
      buildDomainDocument(county, domain, metrics.filter((metric) => metric.domain === domain), {
        version,
        generatedAt: options.generatedAt,
        retrievedAt,
        cacheTtlSeconds: options.cacheTtlSeconds,
      }),
    );
    const overview: CountyAtlasOverview = {
      county,
      domains: domainDocuments.map((document) => ({
        domain: document.domain,
        featuredMetrics: featuredMetrics(document.domain.slug, document.metrics),
        available: document.metrics.some((metric) => metric.value !== undefined),
        warnings: document.warnings,
      })),
      meta: {
        version,
        generatedAt: options.generatedAt,
        retrievedAt,
        sources: uniqueSources(metrics),
        partial: domainDocuments.some((document) => document.meta.partial),
        cacheTtlSeconds: options.cacheTtlSeconds,
      },
    };

    objects.push({ key: `${activePrefix}/counties/${county.fips}/overview.json`, body: overview });
    for (const document of domainDocuments) {
      objects.push({
        key: `${activePrefix}/counties/${county.fips}/domains/${document.domain.slug}.json`,
        body: document,
      });
    }
  }

  const manifest = {
    version,
    generatedAt: options.generatedAt,
    geographyVintage: unique(results.map((result) => result.geographyVintage)).join("; "),
    activePrefix,
    domains: availableDomains,
    sources: results.map((result) => ({
      id: result.providerId,
      vintage: result.vintage,
      retrievedAt: result.retrievedAt,
      status: "current" as const,
    })),
    countyCount: counties.size,
  };
  objects.push({ key: `${activePrefix}/manifest.json`, body: manifest });
  return { manifest, objects };
}

function buildDomainDocument(
  county: CountyAtlasOverview["county"],
  domain: CountyAtlasDomain,
  metrics: CountyAtlasMetric[],
  meta: { version: string; generatedAt: string; retrievedAt: string; cacheTtlSeconds: number },
): CountyAtlasDomainDocument {
  const hasUsableMetric = metrics.some((metric) => metric.value !== undefined);
  const suppressedCount = metrics.filter((metric) => metric.suppressed).length;
  const warnings = [
    ...(!metrics.length ? [`No validated ${atlasDomains[domain].label} metrics were published in this snapshot.`] : []),
    ...(suppressedCount ? [`${suppressedCount} metric${suppressedCount === 1 ? " is" : "s are"} unavailable or suppressed.`] : []),
  ];
  return {
    county,
    domain: atlasDomains[domain],
    metrics,
    warnings,
    meta: {
      ...meta,
      sources: uniqueSources(metrics),
      partial: !hasUsableMetric || suppressedCount > 0,
    },
  };
}

function mergeCounties(results: AtlasProviderResult[]) {
  const counties = new Map<string, { county: CountyAtlasOverview["county"]; metrics: CountyAtlasMetric[] }>();
  for (const result of results) {
    for (const record of result.counties) {
      const existing = counties.get(record.county.fips);
      if (!existing) {
        counties.set(record.county.fips, { county: record.county, metrics: [...record.metrics] });
        continue;
      }
      const identities = new Set(existing.metrics.map((metric) => `${metric.domain}:${metric.key}`));
      for (const metric of record.metrics) {
        const identity = `${metric.domain}:${metric.key}`;
        if (identities.has(identity)) throw new Error(`Multiple providers produced ${identity} for ${record.county.fips}.`);
        identities.add(identity);
        existing.metrics.push(metric);
      }
    }
  }
  return counties;
}

function featuredMetrics(domain: CountyAtlasDomain, metrics: CountyAtlasMetric[]) {
  const priority = atlasDomains[domain].metricKeys;
  return [...metrics]
    .sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key))
    .filter((metric) => metric.value !== undefined)
    .slice(0, 3);
}

function uniqueSources(metrics: CountyAtlasMetric[]) {
  return getAtlasSources(unique(metrics.map((metric) => metric.source.id)));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function newestDate(values: string[]) {
  return [...values].sort().at(-1)!;
}

function versionFromDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid snapshot generation date: ${value}.`);
  return `atlas-${parsed.toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}`;
}
