import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { getCountyByState } from "@nickgraffis/us-counties";
import { getCounty } from "../../src/geo.js";
import { getCountyPublicNotices } from "../../src/public-notices/service.js";
import { TCEQ_URL, TXDOT_URL } from "../../src/public-notices/parsers.js";
import { texasCountyNoticeSources } from "../../src/public-notices/texas-sources.js";

process.env.FEED_CACHE_BUCKET = ""; // Local audit never reads or writes AWS.
const out = "coverage/public-notices";
await mkdir(out, { recursive: true });
const live = process.argv.includes("--live");
if (!live) {
  const files = new Map<string, string>([[TCEQ_URL, `${out}/4d6aef029187.html`], [TXDOT_URL, `${out}/74e597b54440.html`]]);
  for (const file of await readdir(`${out}/official-pages`)) {
    if (!file.endsWith(".json")) continue;
    const meta = JSON.parse(await readFile(`${out}/official-pages/${file}`, "utf8"));
    files.set(meta.finalUrl, `${out}/official-pages/${file.replace(/\.json$/, ".html")}`);
  }
  globalThis.fetch = async (input) => {
    const file = files.get(String(input));
    if (!file) throw new Error(`Missing reviewed evidence for ${input}`);
    return new Response(await readFile(file, "utf8"));
  };
}
const counties = (getCountyByState("Texas") as { name: string; FIPS: string }[]).map(row => {
  const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const county = getCounty("texas", slug);
  if (!county || county.fips !== row.FIPS) throw new Error(`County mismatch: ${row.name}`);
  return county;
});
const results: object[] = [];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < counties.length) {
    const county = counties[cursor++];
    const response = await getCountyPublicNotices(county, 100);
    if (response.items.some(item => !item.countyFips.includes(county.fips!))) throw new Error(`Wrong scope: ${county.slug}`);
    results.push({ county: county.slug, fips: county.fips, status: response.meta.status, count: response.items.length, sources: response.sources.map(source => ({ id: source.id, status: source.status })), items: response.items });
  }
}));
const rows = results as { county: string; fips: string; status: string; count: number; sources: { id: string; status: string }[]; items: { id: string }[] }[];
const ids = new Set(rows.flatMap(row => row.items.map(item => item.id)));
const summary = { reviewedAt: new Date().toISOString(), mode: live ? "live" : "reviewed-evidence", counties: rows.length, countiesWithNotices: rows.filter(row => row.count).length, uniqueNotices: ids.size, partialCounties: rows.filter(row => row.status !== "current").length, localFeeds: Object.values(texasCountyNoticeSources).reduce((sum, source) => sum + source.feeds.length, 0) };
await writeFile(`${out}/audit-${live ? "live" : "evidence"}.json`, JSON.stringify({ summary, counties: rows.sort((a,b) => a.fips.localeCompare(b.fips)) }, null, 2) + "\n");
console.log(JSON.stringify(summary));
// A reproducible digest detects accidental edits to the audited registry.
console.log("registry-sha256", createHash("sha256").update(await readFile("src/public-notices/texas-sources.ts")).digest("hex"));
