/**
 * Scores each native-candidates.md row by reading its feed and counting items
 * that mention the candidate county's own towns or county name. High scores
 * on a single-county candidate are promotion evidence; zero scores expose the
 * national outlets the counties-per-host heuristic mislabels.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getCounty, getCountyLocalPlaces } from "../../src/geo.js";
import { trustedCountyHosts } from "../../src/source-registry.js";

const md = readFileSync("scripts/discover-sources/.out/native-candidates.md", "utf8");
const rows = [...md.matchAll(/^\| (.+?) \| (\S+) \| (\S+(?:, \S+)*) \| (\S+) \|$/gm)].map((m) => ({
  name: m[1].trim(), host: m[2], counties: m[3].split(",").map((c) => c.trim()), feed: m[4],
}));
console.log(`${rows.length} candidates`);

const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";
function decode(s: string) {
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
}
function includesTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value);
}

async function score(row: (typeof rows)[number]) {
  const terms = new Set<string>();
  for (const key of row.counties) {
    const [state, slug] = key.split("/");
    const county = getCounty(state, slug);
    if (!county) continue;
    terms.add(`${county.name.toLowerCase()} county`);
    for (const place of getCountyLocalPlaces(county, 8)) terms.add(place.toLowerCase());
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(row.feed, { headers: { "user-agent": UA }, signal: ctrl.signal });
    const xml = await res.text();
    clearTimeout(t);
    const items = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].slice(0, 15).map((m) => m[0]);
    if (!items.length) return { ...row, status: "no-items", local: 0, total: 0, samples: [] as string[] };
    let local = 0;
    const samples: string[] = [];
    for (const block of items) {
      const title = decode(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
      const desc = decode(block.match(/<(description|summary)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || "").slice(0, 300);
      const hay = `${title} ${desc}`.toLowerCase();
      const hit = [...terms].some((term) => includesTerm(hay, term));
      if (hit) local++;
      if (samples.length < 4) samples.push((hit ? "+ " : "- ") + title.slice(0, 80));
    }
    return { ...row, status: "ok", local, total: items.length, samples };
  } catch (e) {
    return { ...row, status: `error:${String(e).slice(0, 40)}`, local: 0, total: 0, samples: [] as string[] };
  }
}

const out: unknown[] = [];
let i = 0, active = 0, done = 0;
await new Promise<void>((resolve) => {
  const next = () => {
    while (active < 8 && i < rows.length) {
      const row = rows[i++]; active++;
      score(row).then((r) => { out.push(r); done++; if (done % 50 === 0) console.log(done); })
        .finally(() => { active--; if (i >= rows.length && active === 0) resolve(); else next(); });
    }
  };
  next();
});
writeFileSync("scripts/discover-sources/.out/candidate-scores.json", JSON.stringify(out, null, 1));
console.log("wrote candidate-scores.json");
