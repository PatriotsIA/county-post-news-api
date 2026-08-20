import { strFromU8, unzipSync } from "fflate";
import { atlasSources } from "../../../src/atlas-registry.js";
import type { CountyAtlasMetric } from "../../../src/types.js";
import type { AtlasProviderAdapter, AtlasProviderContext, AtlasProviderResult } from "../types.js";

type FarsAccident = {
  STATE?: string;
  COUNTY?: string;
  FATALS?: string;
};

export class NhtsaFarsProvider implements AtlasProviderAdapter {
  readonly id = "nhtsa-fars";

  async ingest(context: AtlasProviderContext): Promise<AtlasProviderResult> {
    if (!context.countyRoster?.length) {
      throw new Error("nhtsa-fars requires the Census ACS county roster.");
    }

    const year = context.farsYear || 2024;
    const rows = await loadAccidents(context, year);
    const byCounty = new Map<string, { crashes: number; deaths: number }>();
    for (const row of rows) {
      const fips = countyFips(row);
      if (!fips) continue;
      const fatalities = numberValue(row.FATALS);
      if (fatalities === undefined || fatalities < 1) continue;
      const current = byCounty.get(fips) || { crashes: 0, deaths: 0 };
      current.crashes += 1;
      current.deaths += fatalities;
      byCounty.set(fips, current);
    }

    return {
      providerId: this.id,
      vintage: `${year} NHTSA Fatality Analysis Reporting System`,
      geographyVintage: `${year} FARS crash-location county geography`,
      retrievedAt: context.retrievedAt,
      counties: context.countyRoster.map((county) => ({
        county,
        metrics: metricsForCounty(byCounty.get(county.fips) || { crashes: 0, deaths: 0 }, year, context),
      })),
    };
  }
}

async function loadAccidents(context: AtlasProviderContext, year: number) {
  const url = new URL(`https://static.nhtsa.gov/nhtsa/downloads/FARS/${year}/National/FARS${year}NationalCSV.zip`);
  const archive = unzipSync(await context.fetchBytes(url));
  const entry = Object.entries(archive).find(([name]) => /(^|\/)accident\.csv$/i.test(name));
  if (!entry) throw new Error(`NHTSA FARS ${year} archive does not contain accident.csv.`);
  const records = parseCsv(strFromU8(entry[1]));
  if (!records.length) throw new Error(`NHTSA FARS ${year} accident.csv is empty.`);
  return records as FarsAccident[];
}

function metricsForCounty(
  values: { crashes: number; deaths: number },
  year: number,
  context: AtlasProviderContext,
): CountyAtlasMetric[] {
  const base = {
    domain: "public-safety" as const,
    source: atlasSources["nhtsa-fars"],
    date: `${year}-12-31`,
    vintage: `${year} NHTSA FARS`,
    retrievedAt: context.retrievedAt,
    geographyVintage: `${year} FARS crash-location county geography`,
    preliminary: true,
    revisionStatus: "preliminary" as const,
  };
  return [
    {
      ...base,
      key: "traffic-fatal-crashes",
      label: "Fatal traffic crashes",
      description: "Motor-vehicle crashes involving at least one fatality, recorded at the crash-location county.",
      unit: "Crashes",
      valueKind: "number",
      chart: "none",
      value: values.crashes,
    },
    {
      ...base,
      key: "traffic-deaths",
      label: "Traffic deaths",
      description: "People killed in fatal motor-vehicle crashes recorded at the crash-location county.",
      unit: "People",
      valueKind: "number",
      chart: "none",
      value: values.deaths,
    },
  ];
}

function countyFips(row: FarsAccident) {
  const state = String(row.STATE || "").padStart(2, "0");
  const county = String(row.COUNTY || "").padStart(3, "0");
  if (!/^\d{2}$/.test(state) || !/^\d{3}$/.test(county) || county === "000" || county === "999") return undefined;
  return `${state}${county}`;
}

function numberValue(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCsv(input: string) {
  const rows: Record<string, string>[] = [];
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines.shift() || "");
  if (!headers.length) return rows;
  for (const line of lines) {
    const values = splitCsvLine(line);
    if (values.length !== headers.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header.trim().toUpperCase(), values[index].trim()])));
  }
  return rows;
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}
