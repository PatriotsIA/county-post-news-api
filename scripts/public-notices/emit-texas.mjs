// Run only after reviewing discovery output and source overrides.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { getCountyByState } from "@nickgraffis/us-counties";

const records = JSON.parse(await readFile("coverage/public-notices/texas-discovery.json", "utf8"));
const overrides = JSON.parse(await readFile(new URL("./texas-overrides.json", import.meta.url), "utf8"));
const counties = getCountyByState("Texas");
if (records.length !== 254 || new Set(records.map(r => r.county)).size !== 254) throw new Error("Incomplete Texas review");
const sources = {};
const review = [];
for (const county of counties) {
  const record = records.find(r => r.county === county.name);
  if (!record) throw new Error(`Missing county: ${county.name}`);
  const source = { county: county.name, evidenceUrl: record.evidenceUrl, websiteUrl: record.websiteUrl, noticeUrl: record.noticeUrl, feeds: record.feeds.map(({ url, dateKind }) => ({ url, dateKind })) };
  // A broken/expired legacy directory link is less useful than the TAC profile.
  if (record.error && !record.error.includes("403")) delete source.websiteUrl;
  Object.assign(source, overrides[county.name]);
  for (const field of ["websiteUrl", "noticeUrl"]) {
    if (!source[field]) { delete source[field]; continue; }
    const url = new URL(source[field]);
    if (url.protocol !== "https:") delete source[field];
    else source[field] = url.href;
  }
  for (const feed of source.feeds) if (!feed.url.startsWith("https://")) throw new Error(`Unsafe feed: ${county.name}`);
  sources[county.FIPS] = source;
  review.push([county.FIPS, county.name, source.noticeUrl || "", source.websiteUrl || "", source.feeds.map(f => f.url).join(" "), record.evidenceUrl, record.reviewedAt, overrides[county.name] ? "Reviewed official override" : record.error || "Reviewed"]);
}
await writeFile("src/public-notices/texas-sources.ts", 'import type { CountyNoticeSource } from "./types.js";\n\n// Official county directories and notice calendars reviewed 2026-09-11.\n// Reproduce with scripts/public-notices; see docs/public-notices.md.\nexport const texasCountyNoticeSources: Record<string, CountyNoticeSource> = {\n' + Object.entries(sources).map(([fips, source]) => `  "${fips}": ${JSON.stringify(source)},`).join("\n") + '\n};\n');
await mkdir("docs/public-notices", { recursive: true });
const quote = value => `"${String(value).replaceAll('"', '""')}"`;
await writeFile("docs/public-notices/texas-source-review.csv", [["fips", "county", "noticeBoard", "website", "feeds", "directoryEvidence", "reviewedAt", "result"], ...review].map(row => row.map(quote).join(",")).join("\n") + "\n");
console.log(JSON.stringify({ counties: Object.keys(sources).length, noticeBoards: Object.values(sources).filter(s => s.noticeUrl).length, feeds: Object.values(sources).reduce((sum, s) => sum + s.feeds.length, 0) }));
