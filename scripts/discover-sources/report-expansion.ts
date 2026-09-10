/** Reproduce a county-by-county review report from saved, read-only evidence.
 * node --import tsx scripts/discover-sources/report-expansion.ts BASELINE DISCOVERY OUTPUT
 * Discovery observations are reported as pending; they never become approvals here.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCounty } from "../../src/geo.js";
import { getReviewedCountySourceProfiles } from "../../src/source-registry.js";
import { reviewedSupplementalSources } from "../../src/reviewed-supplemental-sources.js";
import type { CountyDiscovery } from "./shared.js";

type Baseline = { key: string; fips: string; displayName: string; state: string; sources: { name: string; websiteUrl: string }[] };
const [baselinePath, discoveryPath, output] = process.argv.slice(2);
if (!baselinePath || !discoveryPath || !output) throw new Error("Expected BASELINE.json DISCOVERY.jsonl OUTPUT_DIRECTORY");
const baseline: Baseline[] = JSON.parse(readFileSync(baselinePath, "utf8"));
const observations: CountyDiscovery[] = readFileSync(discoveryPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
const discovery = new Map(observations.map((row) => [row.key, row]));
if (baseline.length !== 3143 || new Set(baseline.map((r) => r.key)).size !== 3143 || new Set(baseline.map((r) => r.fips)).size !== 3143) throw new Error("Baseline must contain 3,143 unique routes and FIPS");
if (discovery.size !== baseline.length || observations.length !== baseline.length) throw new Error("Discovery is incomplete or contains duplicate routes");
const identity = (urlString: string) => {
  const url = new URL(urlString);
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
};
const rows = baseline.map((before) => {
  const [stateSlug, countySlug] = before.key.split("/");
  const county = getCounty(stateSlug, countySlug);
  if (!county || county.fips !== before.fips || discovery.get(before.key)?.fips !== before.fips) throw new Error(`County/FIPS mismatch: ${before.key}`);
  const sources = getReviewedCountySourceProfiles(county);
  const previous = new Set(before.sources.map((s) => identity(s.websiteUrl)));
  const added = sources.filter((s) => !previous.has(identity(s.websiteUrl)));
  const candidates = discovery.get(before.key)!.publishers;
  return { before, county, sources, added, candidates };
});
const csv = (value: unknown) => {
  let text = typeof value === "string" ? value : JSON.stringify(value);
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const header = ["fips", "route", "county", "state", "before_reviewed", "after_reviewed", "new_county_or_regional", "statewide_supplements", "added_publishers", "added_urls", "added_publisher_types", "added_coverage", "candidate_count", "candidate_urls_unapproved", "candidate_evidence_urls", "remaining_gap"];
const records = rows.map(({ before, county, sources, added, candidates }) => [
  county.fips, before.key, county.displayName, county.state.name, before.sources.length, sources.length,
  added.filter((s) => s.coverage !== "statewide").map((s) => s.name), sources.filter((s) => s.coverage === "statewide").map((s) => s.name),
  added.map((s) => s.name), added.map((s) => s.websiteUrl), added.map((s) => s.outletTypes), added.map((s) => s.coverage), candidates.length,
  candidates.map((p) => `https://${p.host}/`), candidates.flatMap((p) => p.sampleLinks.slice(0, 1)),
  sources.every((s) => s.coverage === "statewide") ? "No verified county or regional publisher yet; statewide supplement only" : "",
]);
const summary = {
  date: "2026-09-10", counties: rows.length,
  countiesWithReviewedBefore: rows.filter((r) => r.before.sources.length).length,
  countiesWithReviewedAfter: rows.filter((r) => r.sources.length).length,
  countiesWithIncrease: rows.filter((r) => r.sources.length > r.before.sources.length).length,
  countiesWithNewCountyOrRegional: rows.filter((r) => r.added.some((s) => s.coverage !== "statewide")).length,
  countiesWithOnlyStatewide: rows.filter((r) => r.sources.every((s) => s.coverage === "statewide")).length,
  directoryListingsBefore: rows.reduce((n, r) => n + r.before.sources.length, 0),
  directoryListingsAfter: rows.reduce((n, r) => n + r.sources.length, 0),
  distinctPublisherWebsitesBefore: new Set(rows.flatMap((r) => r.before.sources.map((s) => identity(s.websiteUrl)))).size,
  distinctPublisherWebsitesAfter: new Set(rows.flatMap((r) => r.sources.map((s) => identity(s.websiteUrl)))).size,
  approvedProfiles: reviewedSupplementalSources.length,
  approvedLocalRegionalProfiles: reviewedSupplementalSources.filter((s) => s.coverage !== "statewide").length,
  approvedStatewideProfiles: reviewedSupplementalSources.filter((s) => s.coverage === "statewide").length,
  approvedProfileFeeds: reviewedSupplementalSources.flatMap((s) => s.feeds || []).length,
  candidates: {
    countiesSearched: discovery.size,
    countiesWithObservations: rows.filter((r) => r.candidates.length).length,
    countiesWithoutObservations: rows.filter((r) => !r.candidates.length).length,
    distinctDomains: new Set(rows.flatMap((r) => r.candidates.map((c) => c.host))).size,
    countyPublisherPairs: rows.reduce((n, r) => n + r.candidates.length, 0),
    approvedAutomatically: 0,
  },
};
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "county-coverage.csv"), [header, ...records].map((row) => row.map(csv).join(",")).join("\n") + "\n");
writeFileSync(join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
