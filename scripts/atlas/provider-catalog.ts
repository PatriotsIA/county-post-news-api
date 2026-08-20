import type { AtlasProviderDefinition } from "./types.js";

export const atlasProviderCatalog = [
  provider("census-acs", 1, "implemented", ["demographics", "economy", "housing", "jobs-business", "education", "health", "civic-elections", "infrastructure"], "Annual", {
    credentialEnv: "CENSUS_API_KEY",
    notes: "ACS 5-year county estimates; the API is free and the key is optional but recommended.",
  }),
  provider("census-popest", 1, "planned", ["demographics"], "Annual", {
    notes: "Population Estimates bulk county file adapter is defined but not enabled.",
  }),
  provider("census-saipe", 1, "planned", ["economy"], "Annual", {
    notes: "SAIPE income and poverty adapter is defined but not enabled.",
  }),
  provider("census-cbp", 1, "planned", ["jobs-business"], "Annual", {
    notes: "County Business Patterns adapter must preserve disclosure flags before enablement.",
  }),
  provider("bls-laus", 1, "planned", ["economy", "jobs-business"], "Monthly and annual", {
    notes: "LAUS bulk-file adapter is awaiting county-series validation.",
  }),
  provider("bls-qcew", 1, "planned", ["jobs-business"], "Quarterly", {
    notes: "QCEW adapter is awaiting disclosure-aware aggregation validation.",
  }),
  provider("bea", 1, "planned", ["economy"], "Annual", {
    notes: "BEA regional adapter is awaiting combined-geography handling.",
  }),
  provider("fred", 1, "planned", ["economy"], "Varies by series", {
    credentialEnv: "FRED_API_KEY",
    notes: "FRED remains available through the API fallback; scheduled snapshot ingestion is not enabled.",
  }),
  provider("cdc-places", 2, "planned", ["health"], "Annual", {
    notes: "PLACES modeled estimates require measure-specific confidence and release metadata.",
  }),
  provider("nces", 2, "planned", ["education"], "Annual", {
    notes: "NCES and EDGE require a documented district-to-county allocation method.",
  }),
  provider("usda-nass", 2, "planned", ["agriculture"], "Five-year census and periodic estimates", {
    credentialEnv: "USDA_NASS_API_KEY",
    notes: "Quick Stats credentials are free; disclosure suppression must be retained.",
  }),
  provider("hud", 2, "planned", ["housing"], "Annual and quarterly", {
    notes: "Only county-compatible HUD releases will be enabled.",
  }),
  provider("fcc", 2, "planned", ["infrastructure"], "Twice yearly", {
    notes: "Restricted Broadband Fabric records are explicitly excluded.",
  }),
  provider("fema", 2, "planned", ["environment-disasters"], "Continuous and release-based", {
    notes: "OpenFEMA county attribution and statewide declarations require separate measures.",
  }),
  provider("epa", 2, "planned", ["environment-disasters"], "Varies by program", {
    notes: "Monitor and facility coverage denominators must accompany EPA metrics.",
  }),
  provider("usaspending", 3, "planned", ["government-finance"], "Nightly source pipeline", {
    notes: "Place-of-performance and recipient-location totals will remain distinct.",
  }),
  provider("census-govs", 3, "planned", ["government-finance"], "Five-year census with annual surveys", {
    notes: "Overlapping government service areas require explicit allocation metadata.",
  }),
  provider("fhwa", 3, "planned", ["infrastructure"], "Annual", {
    notes: "National Bridge Inventory records require county-code and inspection-vintage validation.",
  }),
  provider("bts", 3, "planned", ["infrastructure"], "Varies by dataset", {
    notes: "No BTS adapter is enabled until a stable county-compatible official release is selected.",
  }),
  provider("eia", 3, "planned", ["infrastructure"], "Monthly and annual", {
    notes: "Facility locations are not population coverage and will be labeled accordingly.",
  }),
  provider("medsl", 3, "planned", ["civic-elections"], "After federal elections", {
    notes: "MEDSL records must retain links to certified official state results and geography caveats.",
  }),
  provider("official-state-elections", 3, "planned", ["civic-elections"], "After each election", {
    notes: "State-specific adapters and certification status are required before publication.",
  }),
  provider("fbi-cde", 3, "planned", ["public-safety"], "Monthly and annual", {
    notes: "No crime rate will publish without agency population and reporting coverage.",
  }),
] satisfies AtlasProviderDefinition[];

export function implementedProviderIds() {
  return atlasProviderCatalog.filter((definition) => definition.status === "implemented").map((definition) => definition.id);
}

function provider(
  id: string,
  wave: AtlasProviderDefinition["wave"],
  status: AtlasProviderDefinition["status"],
  domains: AtlasProviderDefinition["domains"],
  cadence: string,
  options: Pick<AtlasProviderDefinition, "credentialEnv" | "notes">,
): AtlasProviderDefinition {
  return { id, wave, status, domains, cadence, ...options };
}
