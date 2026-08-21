import { readFile } from "node:fs/promises";
import { atlasSources } from "../../../src/atlas-registry.js";
import type {
  CountyAtlasCounty,
  CountyAtlasDomain,
  CountyAtlasMetric,
  CountyAtlasValueKind,
} from "../../../src/types.js";
import type { AtlasProviderAdapter, AtlasProviderContext, AtlasProviderResult } from "../types.js";

type CensusRow = Record<string, string>;
type CensusRows = {
  counties: CensusRow[];
  states: Map<string, CensusRow>;
  nation?: CensusRow;
};
type ParsedEstimate = { value?: number; marginOfError?: number; suppressed?: boolean; suppressionReason?: string };
type MetricDefinition = {
  key: string;
  domain: CountyAtlasDomain;
  label: string;
  description: string;
  unit: string;
  valueKind: CountyAtlasValueKind;
  chart: CountyAtlasMetric["chart"];
  min: number;
  max: number;
};

const directVariables = [
  ["population", "B01003_001"],
  ["median-age", "B01002_001"],
  ["households", "B11001_001"],
  ["median-household-income", "B19013_001"],
  ["median-home-value", "B25077_001"],
  ["median-gross-rent", "B25064_001"],
] as const;

const supplementalDirectVariables = [
  ["per-capita-income", "B19301_001"],
  ["gini-index", "B19083_001"],
  ["employment", "B23025_004"],
  ["school-enrollment", "B14007_001"],
  ["median-year-built", "B25035_001"],
  ["occupied-housing-units", "B25002_002"],
  ["veterans", "B21001_002"],
  ["median-real-estate-taxes", "B25103_001"],
] as const;

const ratioVariables = [
  ["poverty-rate", "B17001_002", "B17001_001", 100],
  ["homeownership-rate", "B25003_002", "B25003_001", 100],
  ["vacancy-rate", "B25002_003", "B25002_001", 100],
  ["labor-force-participation", "B23025_003", "B23025_001", 100],
  ["mean-commute", "B08013_001", "B08012_001", 1],
] as const;

const supplementalRatioVariables = [
  ["unemployment-rate", "B23025_005", "B23025_003", 100],
  ["disability-rate", "B18101_002", "B18101_001", 100],
  ["internet-subscription-rate", "B28002_002", "B28002_001", 100],
  ["no-vehicle-households-rate", "B08201_002", "B08201_001", 100],
  ["work-from-home-rate", "B08301_021", "B08301_001", 100],
  ["drive-alone-commuter-rate", "B08301_003", "B08301_001", 100],
] as const;

const highSchoolVariables = variableRange("B15003", 17, 25);
const bachelorsVariables = variableRange("B15003", 22, 25);
const rentBurdenVariables = variableRange("B25070", 8, 10);
const uninsuredVariables = [5, 8, 11, 14, 17, 20, 23, 26, 29, 33, 36, 39, 42, 45, 48, 51, 54, 57]
  .map((value) => `B27001_${String(value).padStart(3, "0")}`);
const votingAgeMaleVariables = variableRange("B01001", 7, 25);
const votingAgeFemaleVariables = variableRange("B01001", 31, 49);
const votingAgeVariables = [...votingAgeMaleVariables, ...votingAgeFemaleVariables];
const baseVariables = unique([
  ...directVariables.flatMap(([, variable]) => estimateAndMoe(variable)),
  ...ratioVariables.flatMap(([, numerator, denominator]) => [
    ...estimateAndMoe(numerator),
    ...estimateAndMoe(denominator),
  ]),
]);
const supplementalVariables = unique([
  ...supplementalDirectVariables.flatMap(([, variable]) => estimateAndMoe(variable)),
  ...supplementalRatioVariables.flatMap(([, numerator, denominator]) => [
    ...estimateAndMoe(numerator),
    ...estimateAndMoe(denominator),
  ]),
]);
const healthAndHousingVariables = unique([
  ...rentBurdenVariables.flatMap(estimateAndMoe),
  ...estimateAndMoe("B25070_001"),
  ...uninsuredVariables.flatMap(estimateAndMoe),
  ...estimateAndMoe("B27001_001"),
]);
const profileDirectVariables = [
  ["agriculture-mining-employment", "DP03_0033"],
] as const;
const profileVariables = unique(profileDirectVariables.flatMap(([, variable]) => estimateAndMoe(variable)));
const votingAgeMaleMatrixVariables = votingAgeMaleVariables.flatMap(estimateAndMoe);
const votingAgeFemaleMatrixVariables = votingAgeFemaleVariables.flatMap(estimateAndMoe);
const educationVariables = unique([
  ...estimateAndMoe("B15003_001"),
  ...highSchoolVariables.flatMap(estimateAndMoe),
]);

const definitions: Record<string, MetricDefinition> = {
  population: metric("population", "demographics", "Population", "Estimated county population.", "People", "number", "comparison", 1, 20_000_000),
  "median-age": metric("median-age", "demographics", "Median age", "Age at which half the population is older and half is younger.", "Years", "number", "comparison", 0, 100),
  households: metric("households", "demographics", "Households", "Estimated occupied household count.", "Households", "number", "comparison", 0, 10_000_000),
  "median-household-income": metric("median-household-income", "economy", "Median household income", "Estimated household income at the midpoint.", "Dollars", "currency", "comparison", 0, 500_000),
  "poverty-rate": metric("poverty-rate", "economy", "Poverty rate", "Population below the Census poverty threshold.", "Percent", "percent", "comparison", 0, 100),
  "per-capita-income": metric("per-capita-income", "economy", "Per-capita income", "Aggregate income divided by the population for whom income is determined.", "Dollars", "currency", "comparison", 0, 500_000),
  "gini-index": metric("gini-index", "economy", "Income inequality index", "Census Gini index of income inequality; zero indicates equal income and one indicates maximum inequality.", "Index", "index", "comparison", 0, 1),
  "unemployment-rate": metric("unemployment-rate", "economy", "Unemployment rate", "Unemployed residents as a share of the civilian labor force.", "Percent", "percent", "comparison", 0, 100),
  "median-home-value": metric("median-home-value", "housing", "Median home value", "Median value of owner-occupied housing units.", "Dollars", "currency", "comparison", 0, 10_000_000),
  "median-gross-rent": metric("median-gross-rent", "housing", "Median gross rent", "Median monthly gross rent for renter-occupied units.", "Dollars", "currency", "comparison", 0, 25_000),
  "homeownership-rate": metric("homeownership-rate", "housing", "Homeownership rate", "Owner-occupied units as a share of occupied housing units.", "Percent", "percent", "comparison", 0, 100),
  "vacancy-rate": metric("vacancy-rate", "housing", "Housing vacancy rate", "Vacant units as a share of all housing units.", "Percent", "percent", "comparison", 0, 100),
  "median-year-built": metric("median-year-built", "housing", "Median year built", "Median construction year for housing units.", "Year", "number", "comparison", 1600, 2100),
  "occupied-housing-units": metric("occupied-housing-units", "housing", "Occupied housing units", "Housing units occupied by usual residents.", "Housing units", "number", "comparison", 0, 10_000_000),
  "rent-cost-burden-rate": metric("rent-cost-burden-rate", "housing", "Rent cost burden", "Renter-occupied homes spending 35 percent or more of household income on rent.", "Percent", "percent", "comparison", 0, 100),
  "median-real-estate-taxes": metric("median-real-estate-taxes", "government-finance", "Median real-estate taxes", "Median annual real-estate taxes paid by owner-occupied homes; this is a household burden indicator, not county-government revenue.", "Dollars", "currency", "comparison", 0, 100_000),
  employment: metric("employment", "jobs-business", "Employment", "Civilian residents age 16 and older who are employed.", "People", "number", "comparison", 0, 20_000_000),
  "labor-force-participation": metric("labor-force-participation", "jobs-business", "Labor-force participation", "Civilian labor force as a share of the civilian population age 16 and older.", "Percent", "percent", "comparison", 0, 100),
  "mean-commute": metric("mean-commute", "jobs-business", "Mean commute", "Aggregate travel time divided by workers with a commute.", "Minutes", "duration", "comparison", 0, 180),
  "high-school-graduate-rate": metric("high-school-graduate-rate", "education", "High school graduate or higher", "Population age 25 and older with at least a high school credential.", "Percent", "percent", "comparison", 0, 100),
  "bachelors-rate": metric("bachelors-rate", "education", "Bachelor's degree or higher", "Population age 25 and older with a bachelor's, graduate, or professional degree.", "Percent", "percent", "comparison", 0, 100),
  "school-enrollment": metric("school-enrollment", "education", "Residents enrolled in school", "Residents age three and older enrolled in school.", "People", "number", "comparison", 0, 20_000_000),
  veterans: metric("veterans", "demographics", "Veterans", "Civilian residents age 18 and older who have served in the armed forces.", "People", "number", "comparison", 0, 20_000_000),
  "disability-rate": metric("disability-rate", "health", "Disability rate", "Civilian noninstitutionalized residents reporting a disability.", "Percent", "percent", "comparison", 0, 100),
  "uninsured-rate": metric("uninsured-rate", "health", "Uninsured rate", "Civilian noninstitutionalized residents without health insurance coverage.", "Percent", "percent", "comparison", 0, 100),
  "agriculture-mining-employment": metric("agriculture-mining-employment", "agriculture", "Agriculture & mining employment", "Civilian workers in agriculture, forestry, fishing, hunting, and mining. This is employment context, not a farm or production count.", "People", "number", "comparison", 0, 20_000_000),
  "voting-age-population": metric("voting-age-population", "civic-elections", "Voting-age population", "Residents age 18 and older; this is not a count of eligible or registered voters.", "People", "number", "comparison", 0, 20_000_000),
  "internet-subscription-rate": metric("internet-subscription-rate", "infrastructure", "Internet subscription", "Households with an internet subscription.", "Percent", "percent", "comparison", 0, 100),
  "no-vehicle-households-rate": metric("no-vehicle-households-rate", "infrastructure", "Households without a vehicle", "Households with no vehicle available.", "Percent", "percent", "comparison", 0, 100),
  "work-from-home-rate": metric("work-from-home-rate", "infrastructure", "Work from home", "Workers age 16 and older who worked from home.", "Percent", "percent", "comparison", 0, 100),
  "drive-alone-commuter-rate": metric("drive-alone-commuter-rate", "infrastructure", "Drive-alone commute", "Workers age 16 and older who commuted by driving alone.", "Percent", "percent", "comparison", 0, 100),
};

export class CensusAcsProvider implements AtlasProviderAdapter {
  readonly id = "census-acs";

  async ingest(context: AtlasProviderContext): Promise<AtlasProviderResult> {
    const rows = await loadRows(context);
    const nationMetrics = rows.nation ? buildMetrics(rows.nation, context) : [];
    const stateMetrics = new Map(
      [...rows.states.entries()].map(([stateFips, row]) => [stateFips, buildMetrics(row, context)]),
    );
    const counties = rows.counties.flatMap((row) => {
      const county = parseCounty(row);
      if (!county) return [];
      const metrics = buildMetrics(row, context).map((metric) =>
        attachBenchmarks(metric, stateMetrics.get(row.state.padStart(2, "0")) || [], nationMetrics, county.stateName),
      );
      return [{ county, metrics }];
    });

    return {
      providerId: this.id,
      vintage: `${context.censusYear} ACS 5-year`,
      geographyVintage: `${context.censusYear} ACS county geography`,
      retrievedAt: context.retrievedAt,
      counties,
    };
  }
}

async function loadRows(context: AtlasProviderContext): Promise<CensusRows> {
  if (context.fixturePath) {
    const fixture = JSON.parse(await readFile(context.fixturePath, "utf8")) as unknown;
    const countyMatrices = isFixtureBundle(fixture) ? fixture.responses : [fixture];
    const stateMatrices = isFixtureBundle(fixture) ? fixture.stateResponses || [] : [];
    const nationMatrices = isFixtureBundle(fixture) ? fixture.nationalResponses || [] : [];
    return {
      counties: mergeMatrices(countyMatrices.map((matrix) => parseMatrix(matrix, "county")), countyKey),
      states: new Map(
        mergeMatrices(stateMatrices.map((matrix) => parseMatrix(matrix, "state")), stateKey).map((row) => [
          stateKey(row),
          row,
        ]),
      ),
      nation: mergeMatrices(nationMatrices.map((matrix) => parseMatrix(matrix, "nation")), () => "us")[0],
    };
  }
  if (!context.censusApiKey) {
    throw new Error(
      "CENSUS_API_KEY is required for live Census Data API queries. Request a free key at https://api.census.gov/data/key_signup.html.",
    );
  }

  const [countyMatrices, stateMatrices, nationMatrices] = await Promise.all([
    Promise.all([
      fetchMatrix(context, baseVariables, "county"),
      fetchMatrix(context, educationVariables, "county"),
      fetchMatrix(context, supplementalVariables, "county"),
      fetchMatrix(context, healthAndHousingVariables, "county"),
      fetchMatrix(context, profileVariables, "county", "profile"),
      fetchMatrix(context, votingAgeMaleMatrixVariables, "county"),
      fetchMatrix(context, votingAgeFemaleMatrixVariables, "county"),
    ]),
    Promise.all([
      fetchMatrix(context, baseVariables, "state"),
      fetchMatrix(context, educationVariables, "state"),
      fetchMatrix(context, supplementalVariables, "state"),
      fetchMatrix(context, healthAndHousingVariables, "state"),
      fetchMatrix(context, profileVariables, "state", "profile"),
      fetchMatrix(context, votingAgeMaleMatrixVariables, "state"),
      fetchMatrix(context, votingAgeFemaleMatrixVariables, "state"),
    ]),
    Promise.all([
      fetchMatrix(context, baseVariables, "nation"),
      fetchMatrix(context, educationVariables, "nation"),
      fetchMatrix(context, supplementalVariables, "nation"),
      fetchMatrix(context, healthAndHousingVariables, "nation"),
      fetchMatrix(context, profileVariables, "nation", "profile"),
      fetchMatrix(context, votingAgeMaleMatrixVariables, "nation"),
      fetchMatrix(context, votingAgeFemaleMatrixVariables, "nation"),
    ]),
  ]);
  return {
    counties: mergeMatrices(countyMatrices.map((matrix) => parseMatrix(matrix, "county")), countyKey),
    states: new Map(
      mergeMatrices(stateMatrices.map((matrix) => parseMatrix(matrix, "state")), stateKey).map((row) => [
        stateKey(row),
        row,
      ]),
    ),
    nation: mergeMatrices(nationMatrices.map((matrix) => parseMatrix(matrix, "nation")), () => "us")[0],
  };
}

async function fetchMatrix(
  context: AtlasProviderContext,
  variables: string[],
  geography: "county" | "state" | "nation",
  dataset = "",
) {
  const url = new URL(`https://api.census.gov/data/${context.censusYear}/acs/acs5${dataset ? `/${dataset}` : ""}`);
  url.searchParams.set("get", ["NAME", ...variables].join(","));
  if (geography === "county") {
    url.searchParams.set("for", "county:*");
    url.searchParams.set("in", "state:*");
  } else if (geography === "state") {
    url.searchParams.set("for", "state:*");
  } else {
    url.searchParams.set("for", "us:1");
  }
  if (context.censusApiKey) url.searchParams.set("key", context.censusApiKey);
  return context.fetchJson(url);
}

function parseMatrix(value: unknown, geography: "county" | "state" | "nation"): CensusRow[] {
  if (!Array.isArray(value) || !value.length || !Array.isArray(value[0])) {
    throw new Error("Census ACS response is not a tabular array.");
  }
  const headers = value[0].map(String);
  const required =
    geography === "county" ? ["state", "county", "NAME"] : geography === "state" ? ["state", "NAME"] : ["us", "NAME"];
  if (required.some((column) => !headers.includes(column))) {
    throw new Error(`Census ACS response is missing ${geography} geography columns.`);
  }

  return value.slice(1).map((rawRow, index) => {
    if (!Array.isArray(rawRow) || rawRow.length !== headers.length) {
      throw new Error(`Census ACS row ${index + 1} does not match its header.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, String(rawRow[column] ?? "")]));
  });
}

function mergeMatrices(matrices: CensusRow[][], keyForRow: (row: CensusRow) => string) {
  const merged = new Map<string, CensusRow>();
  for (const rows of matrices) {
    for (const row of rows) {
      const key = keyForRow(row);
      merged.set(key, { ...(merged.get(key) || {}), ...row });
    }
  }
  return [...merged.values()];
}

function parseCounty(row: CensusRow): CountyAtlasCounty | undefined {
  const state = stateByFips[row.state.padStart(2, "0")];
  if (!state) return undefined;
  const fips = normalizeFips(row.state, row.county);
  const displayName = row.NAME.split(",")[0]?.trim();
  if (!displayName) throw new Error(`Census ACS county ${fips} has no name.`);
  const name = displayName.replace(/\s+(County|Parish|Borough|Census Area|Municipality)$/i, "");
  return {
    name,
    displayName,
    slug: slugify(name),
    fips,
    stateName: state.name,
    stateSlug: state.slug,
    stateAbbr: state.abbr,
  };
}

function buildMetrics(row: CensusRow, context: AtlasProviderContext): CountyAtlasMetric[] {
  const result = [...directVariables, ...supplementalDirectVariables, ...profileDirectVariables].map(([key, variable]) =>
    createMetric(definitions[key], parseEstimate(row, variable), context),
  );

  for (const [key, numerator, denominator, multiplier] of [...ratioVariables, ...supplementalRatioVariables]) {
    result.push(createMetric(definitions[key], ratioEstimate(row, numerator, denominator, multiplier), context));
  }

  result.push(
    createMetric(
      definitions["high-school-graduate-rate"],
      sumRatioEstimate(row, highSchoolVariables, "B15003_001", 100),
      context,
    ),
    createMetric(
      definitions["bachelors-rate"],
      sumRatioEstimate(row, bachelorsVariables, "B15003_001", 100),
      context,
    ),
    createMetric(
      definitions["voting-age-population"],
      sumEstimate(row, votingAgeVariables),
      context,
    ),
    createMetric(
      definitions["rent-cost-burden-rate"],
      sumRatioEstimate(row, rentBurdenVariables, "B25070_001", 100),
      context,
    ),
    createMetric(
      definitions["uninsured-rate"],
      sumRatioEstimate(row, uninsuredVariables, "B27001_001", 100),
      context,
    ),
  );
  return result;
}

function attachBenchmarks(
  metric: CountyAtlasMetric,
  stateMetrics: CountyAtlasMetric[],
  nationMetrics: CountyAtlasMetric[],
  stateName: string,
): CountyAtlasMetric {
  if (metric.chart !== "comparison" || metric.value === undefined) return metric;
  const stateMetric = stateMetrics.find((candidate) => candidate.domain === metric.domain && candidate.key === metric.key);
  const nationMetric = nationMetrics.find((candidate) => candidate.domain === metric.domain && candidate.key === metric.key);
  const benchmarks = [
    ...(stateMetric?.value === undefined
      ? []
      : [{ geography: "state" as const, label: stateName, value: stateMetric.value }]),
    ...(nationMetric?.value === undefined
      ? []
      : [{ geography: "nation" as const, label: "United States", value: nationMetric.value }]),
  ];
  return benchmarks.length ? { ...metric, benchmarks } : metric;
}

function parseEstimate(row: CensusRow, variable: string): ParsedEstimate {
  const estimate = parseCensusNumber(row[`${variable}E`]);
  const margin = parseCensusNumber(row[`${variable}M`]);
  if (estimate.reason) return { suppressed: true, suppressionReason: estimate.reason };
  return { value: estimate.value, marginOfError: margin.value };
}

function ratioEstimate(row: CensusRow, numeratorVariable: string, denominatorVariable: string, multiplier: number): ParsedEstimate & {
  coverageNumerator?: number;
  coverageDenominator?: number;
} {
  const numerator = parseEstimate(row, numeratorVariable);
  const denominator = parseEstimate(row, denominatorVariable);
  if (numerator.suppressed || denominator.suppressed || numerator.value === undefined || !denominator.value) {
    return {
      suppressed: true,
      suppressionReason: numerator.suppressionReason || denominator.suppressionReason || "Missing or zero denominator",
    };
  }
  const ratio = numerator.value / denominator.value;
  return {
    value: round(ratio * multiplier),
    marginOfError: ratioMarginOfError(
      numerator.marginOfError,
      denominator.marginOfError,
      numerator.value,
      denominator.value,
      multiplier,
    ),
    coverageNumerator: numerator.value,
    coverageDenominator: denominator.value,
  };
}

function sumRatioEstimate(row: CensusRow, numeratorVariables: string[], denominatorVariable: string, multiplier: number) {
  const estimates = numeratorVariables.map((variable) => parseEstimate(row, variable));
  const denominator = parseEstimate(row, denominatorVariable);
  const suppressed = estimates.find((estimate) => estimate.suppressed);
  if (suppressed || denominator.suppressed || estimates.some((estimate) => estimate.value === undefined) || !denominator.value) {
    return {
      suppressed: true,
      suppressionReason: suppressed?.suppressionReason || denominator.suppressionReason || "Missing or zero denominator",
    };
  }
  const numerator = estimates.reduce((total, estimate) => total + estimate.value!, 0);
  const numeratorMoe = rootSumSquares(estimates.map((estimate) => estimate.marginOfError));
  return {
    value: round((numerator / denominator.value) * multiplier),
    marginOfError: ratioMarginOfError(
      numeratorMoe,
      denominator.marginOfError,
      numerator,
      denominator.value,
      multiplier,
    ),
    coverageNumerator: numerator,
    coverageDenominator: denominator.value,
  };
}

function sumEstimate(row: CensusRow, variables: string[]): ParsedEstimate {
  const estimates = variables.map((variable) => parseEstimate(row, variable));
  const suppressed = estimates.find((estimate) => estimate.suppressed);
  if (suppressed || estimates.some((estimate) => estimate.value === undefined)) {
    return {
      suppressed: true,
      suppressionReason: suppressed?.suppressionReason || "Missing component estimate",
    };
  }
  return {
    value: estimates.reduce((total, estimate) => total + estimate.value!, 0),
    marginOfError: rootSumSquares(estimates.map((estimate) => estimate.marginOfError)),
  };
}

function createMetric(
  definition: MetricDefinition,
  estimate: ParsedEstimate & { coverageNumerator?: number; coverageDenominator?: number },
  context: AtlasProviderContext,
): CountyAtlasMetric {
  return {
    ...definition,
    value: estimate.value,
    date: `${context.censusYear}-12-31`,
    vintage: `${context.censusYear} ACS 5-year`,
    retrievedAt: context.retrievedAt,
    geographyVintage: `${context.censusYear} ACS county geography`,
    marginOfError: estimate.marginOfError,
    suppressed: estimate.suppressed,
    suppressionReason: estimate.suppressionReason,
    modeledEstimate: true,
    revisionStatus: "final",
    coveragePercent: estimate.coverageDenominator ? 100 : undefined,
    coverageNumerator: estimate.coverageNumerator,
    coverageDenominator: estimate.coverageDenominator,
    source: atlasSources["census-acs"],
  };
}

function parseCensusNumber(raw: string | undefined): { value?: number; reason?: string } {
  if (raw === undefined || raw.trim() === "" || raw.toLowerCase() === "null") return { reason: "Not reported" };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { reason: "Not numeric" };
  if (value <= -100_000_000) {
    const reasons: Record<number, string> = {
      [-666666666]: "Not available",
      [-888888888]: "Not applicable",
      [-999999999]: "Missing",
    };
    return { reason: reasons[value] || "Census suppression sentinel" };
  }
  return { value };
}

function ratioMarginOfError(
  numeratorMoe: number | undefined,
  denominatorMoe: number | undefined,
  numerator: number,
  denominator: number,
  multiplier: number,
) {
  if (numeratorMoe === undefined || denominatorMoe === undefined || denominator === 0) return undefined;
  const ratio = numerator / denominator;
  return round((Math.sqrt(numeratorMoe ** 2 + (ratio * denominatorMoe) ** 2) / denominator) * multiplier);
}

function rootSumSquares(values: Array<number | undefined>) {
  return values.every((value) => value !== undefined)
    ? Math.sqrt(values.reduce((sum, value) => sum + value! ** 2, 0))
    : undefined;
}

function normalizeFips(state: string, county: string) {
  if (!/^\d{1,2}$/.test(state) || !/^\d{1,3}$/.test(county)) {
    throw new Error(`Invalid Census county geography: state=${state}, county=${county}.`);
  }
  return `${state.padStart(2, "0")}${county.padStart(3, "0")}`;
}

function countyKey(row: CensusRow) {
  return normalizeFips(row.state, row.county);
}

function stateKey(row: CensusRow) {
  if (!/^\d{1,2}$/.test(row.state)) throw new Error(`Invalid Census state geography: ${row.state}.`);
  return row.state.padStart(2, "0");
}

function estimateAndMoe(variable: string) {
  return [`${variable}E`, `${variable}M`];
}

function variableRange(group: string, start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => `${group}_${String(start + index).padStart(3, "0")}`);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function metric(
  key: string,
  domain: CountyAtlasDomain,
  label: string,
  description: string,
  unit: string,
  valueKind: CountyAtlasValueKind,
  chart: CountyAtlasMetric["chart"],
  min: number,
  max: number,
): MetricDefinition {
  return { key, domain, label, description, unit, valueKind, chart, min, max };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function isFixtureBundle(value: unknown): value is {
  responses: unknown[];
  stateResponses?: unknown[];
  nationalResponses?: unknown[];
} {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { responses?: unknown[] }).responses));
}

const stateByFips: Record<string, { name: string; slug: string; abbr: string }> = {
  "01": { name: "Alabama", slug: "alabama", abbr: "AL" },
  "02": { name: "Alaska", slug: "alaska", abbr: "AK" },
  "04": { name: "Arizona", slug: "arizona", abbr: "AZ" },
  "05": { name: "Arkansas", slug: "arkansas", abbr: "AR" },
  "06": { name: "California", slug: "california", abbr: "CA" },
  "08": { name: "Colorado", slug: "colorado", abbr: "CO" },
  "09": { name: "Connecticut", slug: "connecticut", abbr: "CT" },
  "10": { name: "Delaware", slug: "delaware", abbr: "DE" },
  "11": { name: "District of Columbia", slug: "district-of-columbia", abbr: "DC" },
  "12": { name: "Florida", slug: "florida", abbr: "FL" },
  "13": { name: "Georgia", slug: "georgia", abbr: "GA" },
  "15": { name: "Hawaii", slug: "hawaii", abbr: "HI" },
  "16": { name: "Idaho", slug: "idaho", abbr: "ID" },
  "17": { name: "Illinois", slug: "illinois", abbr: "IL" },
  "18": { name: "Indiana", slug: "indiana", abbr: "IN" },
  "19": { name: "Iowa", slug: "iowa", abbr: "IA" },
  "20": { name: "Kansas", slug: "kansas", abbr: "KS" },
  "21": { name: "Kentucky", slug: "kentucky", abbr: "KY" },
  "22": { name: "Louisiana", slug: "louisiana", abbr: "LA" },
  "23": { name: "Maine", slug: "maine", abbr: "ME" },
  "24": { name: "Maryland", slug: "maryland", abbr: "MD" },
  "25": { name: "Massachusetts", slug: "massachusetts", abbr: "MA" },
  "26": { name: "Michigan", slug: "michigan", abbr: "MI" },
  "27": { name: "Minnesota", slug: "minnesota", abbr: "MN" },
  "28": { name: "Mississippi", slug: "mississippi", abbr: "MS" },
  "29": { name: "Missouri", slug: "missouri", abbr: "MO" },
  "30": { name: "Montana", slug: "montana", abbr: "MT" },
  "31": { name: "Nebraska", slug: "nebraska", abbr: "NE" },
  "32": { name: "Nevada", slug: "nevada", abbr: "NV" },
  "33": { name: "New Hampshire", slug: "new-hampshire", abbr: "NH" },
  "34": { name: "New Jersey", slug: "new-jersey", abbr: "NJ" },
  "35": { name: "New Mexico", slug: "new-mexico", abbr: "NM" },
  "36": { name: "New York", slug: "new-york", abbr: "NY" },
  "37": { name: "North Carolina", slug: "north-carolina", abbr: "NC" },
  "38": { name: "North Dakota", slug: "north-dakota", abbr: "ND" },
  "39": { name: "Ohio", slug: "ohio", abbr: "OH" },
  "40": { name: "Oklahoma", slug: "oklahoma", abbr: "OK" },
  "41": { name: "Oregon", slug: "oregon", abbr: "OR" },
  "42": { name: "Pennsylvania", slug: "pennsylvania", abbr: "PA" },
  "44": { name: "Rhode Island", slug: "rhode-island", abbr: "RI" },
  "45": { name: "South Carolina", slug: "south-carolina", abbr: "SC" },
  "46": { name: "South Dakota", slug: "south-dakota", abbr: "SD" },
  "47": { name: "Tennessee", slug: "tennessee", abbr: "TN" },
  "48": { name: "Texas", slug: "texas", abbr: "TX" },
  "49": { name: "Utah", slug: "utah", abbr: "UT" },
  "50": { name: "Vermont", slug: "vermont", abbr: "VT" },
  "51": { name: "Virginia", slug: "virginia", abbr: "VA" },
  "53": { name: "Washington", slug: "washington", abbr: "WA" },
  "54": { name: "West Virginia", slug: "west-virginia", abbr: "WV" },
  "55": { name: "Wisconsin", slug: "wisconsin", abbr: "WI" },
  "56": { name: "Wyoming", slug: "wyoming", abbr: "WY" },
};
