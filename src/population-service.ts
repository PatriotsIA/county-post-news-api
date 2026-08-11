import { countyRateTierForPopulation } from "./ad-pricing.js";
import { COUNTY_POPULATION_ESTIMATE_VINTAGE, countyPopulationEstimates } from "./county-populations.js";
import { getCounty } from "./geo.js";

export class PopulationError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function getCountyPopulation(stateSlug: string, countySlug: string) {
  const county = getCounty(stateSlug, countySlug);
  if (!county) throw new PopulationError(404, "Unknown county");
  if (!county.fips) throw new PopulationError(503, "County population data is unavailable.");

  const population = countyPopulationEstimates[county.fips];
  if (population === undefined) throw new PopulationError(503, "County population data is unavailable.");

  return {
    county: county.displayName,
    countySlug: county.slug,
    state: county.state.name,
    stateSlug: county.state.slug,
    fips: county.fips,
    population,
    estimateVintage: COUNTY_POPULATION_ESTIMATE_VINTAGE,
    rateTier: countyRateTierForPopulation(population),
  };
}
