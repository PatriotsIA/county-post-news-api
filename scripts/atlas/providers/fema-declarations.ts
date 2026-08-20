import { atlasSources } from "../../../src/atlas-registry.js";
import type { CountyAtlasMetric } from "../../../src/types.js";
import type { AtlasProviderAdapter, AtlasProviderContext, AtlasProviderResult } from "../types.js";

const FEMA_DECLARATIONS_URL = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries";
const PAGE_SIZE = 10_000;
const LOOKBACK_YEARS = 5;

type FemaDeclaration = {
  disasterNumber?: number;
  declarationDate?: string;
  declarationType?: string;
  incidentType?: string;
  fipsStateCode?: string | number;
  fipsCountyCode?: string | number;
};

type FemaResponse = {
  DisasterDeclarationsSummaries?: FemaDeclaration[];
};

export class FemaDeclarationsProvider implements AtlasProviderAdapter {
  readonly id = "fema-declarations";

  async ingest(context: AtlasProviderContext): Promise<AtlasProviderResult> {
    if (!context.countyRoster?.length) {
      throw new Error("fema-declarations requires the Census ACS county roster.");
    }

    const declarations = await loadDeclarations(context);
    const cutoff = new Date(context.retrievedAt);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - LOOKBACK_YEARS);
    const byCounty = new Map<string, FemaDeclaration[]>();

    for (const declaration of declarations) {
      const fips = countyFips(declaration);
      const date = parseDate(declaration.declarationDate);
      if (!fips || !date || date < cutoff) continue;
      const current = byCounty.get(fips) || [];
      current.push(declaration);
      byCounty.set(fips, current);
    }

    return {
      providerId: this.id,
      vintage: `FEMA Disaster Declarations, rolling ${LOOKBACK_YEARS}-year window`,
      geographyVintage: "County FIPS reported by FEMA OpenFEMA",
      retrievedAt: context.retrievedAt,
      counties: context.countyRoster.map((county) => ({
        county,
        metrics: metricsForCounty(byCounty.get(county.fips) || [], context),
      })),
    };
  }
}

async function loadDeclarations(context: AtlasProviderContext) {
  const results: FemaDeclaration[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = new URL(FEMA_DECLARATIONS_URL);
    url.searchParams.set("$top", String(PAGE_SIZE));
    url.searchParams.set("$skip", String(skip));
    url.searchParams.set(
      "$select",
      "disasterNumber,declarationDate,declarationType,incidentType,fipsStateCode,fipsCountyCode",
    );
    const body = context.fixturePath ? await loadFixture(context) : await context.fetchJson(url);
    const rows = extractDeclarations(body);
    results.push(...rows);
    if (context.fixturePath || rows.length < PAGE_SIZE) return results;
  }
}

async function loadFixture(context: AtlasProviderContext) {
  const url = new URL("file://fema-declarations.fixture");
  return context.fetchJson(url);
}

function extractDeclarations(value: unknown) {
  if (!value || typeof value !== "object" || !Array.isArray((value as FemaResponse).DisasterDeclarationsSummaries)) {
    throw new Error("FEMA Disaster Declarations response is malformed.");
  }
  return (value as FemaResponse).DisasterDeclarationsSummaries!;
}

function metricsForCounty(declarations: FemaDeclaration[], context: AtlasProviderContext): CountyAtlasMetric[] {
  const source = atlasSources.fema;
  const uniqueDisasters = new Map<string, FemaDeclaration>();
  for (const declaration of declarations) {
    const key = String(declaration.disasterNumber || "");
    if (!key) continue;
    const existing = uniqueDisasters.get(key);
    if (!existing || parseDate(declaration.declarationDate)! > parseDate(existing.declarationDate)!) {
      uniqueDisasters.set(key, declaration);
    }
  }
  const unique = [...uniqueDisasters.values()];
  const latest = [...unique]
    .sort((left, right) => (parseDate(right.declarationDate)?.getTime() || 0) - (parseDate(left.declarationDate)?.getTime() || 0))[0];
  const incidentTypes = new Map<string, number>();
  for (const declaration of unique) {
    const type = declaration.incidentType?.trim() || "Unspecified incident";
    incidentTypes.set(type, (incidentTypes.get(type) || 0) + 1);
  }
  const base = {
    domain: "environment-disasters" as const,
    source,
    date: context.retrievedAt.slice(0, 10),
    vintage: `FEMA rolling ${LOOKBACK_YEARS}-year window`,
    retrievedAt: context.retrievedAt,
    geographyVintage: "County FIPS reported by FEMA OpenFEMA",
    revisionStatus: "preliminary" as const,
  };

  return [
    {
      ...base,
      key: "disaster-declarations-5y",
      label: "Federal disaster declarations",
      description: `Distinct FEMA disaster declarations designating this county in the preceding ${LOOKBACK_YEARS} years.`,
      unit: "Declarations",
      valueKind: "number",
      chart: "distribution",
      value: unique.length,
      distribution: [...incidentTypes.entries()].map(([label, value]) => ({
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label,
        value,
        unit: "Declarations",
      })),
    },
    {
      ...base,
      key: "major-disaster-declarations-5y",
      label: "Major disaster declarations",
      description: `FEMA major disaster declarations designating this county in the preceding ${LOOKBACK_YEARS} years.`,
      unit: "Declarations",
      valueKind: "number",
      chart: "none",
      value: unique.filter((declaration) => declaration.declarationType === "DR").length,
    },
    {
      ...base,
      key: "latest-disaster-declaration",
      label: "Latest federal disaster declaration",
      description: "Most recent FEMA declaration date designating this county in the rolling window.",
      unit: "Date",
      valueKind: "text",
      chart: "none",
      value: latest ? parseDate(latest.declarationDate)!.getTime() : undefined,
      displayValue: latest ? formatDate(latest.declarationDate!) : undefined,
      ...(latest
        ? {}
        : { suppressed: true, suppressionReason: `No county-level FEMA declaration was reported in the preceding ${LOOKBACK_YEARS} years.` }),
    },
  ];
}

function countyFips(declaration: FemaDeclaration) {
  const state = String(declaration.fipsStateCode ?? "").padStart(2, "0");
  const county = String(declaration.fipsCountyCode ?? "").padStart(3, "0");
  if (!/^\d{2}$/.test(state) || !/^\d{3}$/.test(county) || county === "000") return undefined;
  return `${state}${county}`;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function formatDate(value: string) {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date)
    : value;
}
