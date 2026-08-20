import { countyAtlasDomains } from "../../src/types.js";
import type { AtlasProviderResult } from "./types.js";

const plausibleRanges: Record<string, [number, number]> = {
  population: [1, 20_000_000],
  "median-age": [0, 100],
  households: [0, 10_000_000],
  "median-household-income": [0, 500_000],
  "poverty-rate": [0, 100],
  "per-capita-income": [0, 500_000],
  "gini-index": [0, 1],
  "unemployment-rate": [0, 100],
  "median-home-value": [0, 10_000_000],
  "median-gross-rent": [0, 25_000],
  "homeownership-rate": [0, 100],
  "vacancy-rate": [0, 100],
  "median-year-built": [1600, 2100],
  "occupied-housing-units": [0, 10_000_000],
  employment: [0, 20_000_000],
  "labor-force-participation": [0, 100],
  "mean-commute": [0, 180],
  "high-school-graduate-rate": [0, 100],
  "bachelors-rate": [0, 100],
  "school-enrollment": [0, 20_000_000],
  "disability-rate": [0, 100],
  "voting-age-population": [0, 20_000_000],
  "internet-subscription-rate": [0, 100],
  "no-vehicle-households-rate": [0, 100],
  "disaster-declarations-5y": [0, 10_000],
  "major-disaster-declarations-5y": [0, 10_000],
  "traffic-fatal-crashes": [0, 100_000],
  "traffic-deaths": [0, 100_000],
};

export function validateProviderResult(
  result: AtlasProviderResult,
  options: { minCountyCount: number; maxCountyCount: number },
) {
  if (result.counties.length < options.minCountyCount || result.counties.length > options.maxCountyCount) {
    throw new Error(
      `${result.providerId} returned ${result.counties.length} counties; expected ${options.minCountyCount}-${options.maxCountyCount}.`,
    );
  }
  if (!result.vintage || !result.geographyVintage || !isIsoDate(result.retrievedAt)) {
    throw new Error(`${result.providerId} did not provide complete vintage and retrieval metadata.`);
  }

  const fipsSeen = new Set<string>();
  for (const record of result.counties) {
    const { county } = record;
    if (!/^\d{5}$/.test(county.fips)) throw new Error(`Invalid normalized county FIPS: ${county.fips}.`);
    if (fipsSeen.has(county.fips)) throw new Error(`Duplicate county FIPS from ${result.providerId}: ${county.fips}.`);
    fipsSeen.add(county.fips);
    if (!county.name || !county.displayName || !county.stateSlug || !county.stateAbbr) {
      throw new Error(`${result.providerId} returned incomplete geography metadata for ${county.fips}.`);
    }

    const keysSeen = new Set<string>();
    for (const metric of record.metrics) {
      const identity = `${metric.domain}:${metric.key}`;
      if (keysSeen.has(identity)) throw new Error(`Duplicate metric ${identity} for county ${county.fips}.`);
      keysSeen.add(identity);
      if (!countyAtlasDomains.includes(metric.domain)) throw new Error(`Unknown atlas domain ${metric.domain}.`);
      if (!metric.source?.id || !metric.vintage || !metric.geographyVintage || !metric.retrievedAt || !isIsoDate(metric.retrievedAt)) {
        throw new Error(`Metric ${identity} for ${county.fips} is missing provenance.`);
      }
      if (metric.value === undefined && !metric.suppressed) {
        throw new Error(`Metric ${identity} for ${county.fips} has neither a value nor a suppression reason.`);
      }
      if (metric.suppressed && !metric.suppressionReason) {
        throw new Error(`Suppressed metric ${identity} for ${county.fips} has no reason.`);
      }
      if (metric.value !== undefined) {
        if (!Number.isFinite(metric.value)) throw new Error(`Metric ${identity} for ${county.fips} is not finite.`);
        const range = plausibleRanges[metric.key];
        if (range && (metric.value < range[0] || metric.value > range[1])) {
          throw new Error(`Metric ${identity} for ${county.fips} is outside plausible range ${range[0]}-${range[1]}.`);
        }
      }
      if (metric.marginOfError !== undefined && (!Number.isFinite(metric.marginOfError) || metric.marginOfError < 0)) {
        throw new Error(`Metric ${identity} for ${county.fips} has an invalid margin of error.`);
      }
      if (metric.coverageDenominator !== undefined && metric.coverageDenominator <= 0) {
        throw new Error(`Metric ${identity} for ${county.fips} has an invalid coverage denominator.`);
      }
    }

    const population = record.metrics.find((metric) => metric.key === "population");
    if (result.providerId === "census-acs" && (!population || population.value === undefined)) {
      throw new Error(`Census ACS county ${county.fips} has no usable population estimate.`);
    }
  }
}

function isIsoDate(value: string) {
  return Number.isFinite(Date.parse(value));
}
