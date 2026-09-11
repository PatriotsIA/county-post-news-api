import { createHash } from "node:crypto";
import { getCountyByState } from "@nickgraffis/us-counties";
import { XMLParser } from "fast-xml-parser";
import type { PublicNotice } from "./types.js";

export const TCEQ_URL = "https://www.tceq.texas.gov/agency/decisions/hearings";
export const TXDOT_URL = "https://www.txdot.gov/projects/hearings-meetings.html";
const texasCounties = getCountyByState("Texas") as { name: string; FIPS: string }[];
const byName = new Map(texasCounties.map((county) => [county.name.toLowerCase(), county.FIPS]));
const byFips = new Map(texasCounties.map((county) => [county.FIPS, county.name]));
function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '\"', apos: "'", nbsp: " " };
  return value.replace(/&(amp|lt|gt|quot|apos|nbsp|#x[0-9a-f]+|#\d+);/gi, (original, key: string) => {
    if (!key.startsWith("#")) return named[key.toLowerCase()] || original;
    const code = key.toLowerCase().startsWith("#x") ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
  });
}
const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// Accept only a fully resolved list of county names. Unknown areas, statewide
// records, city names and incidental county mentions in body text stay out.
export function resolveTexasCounties(value: string): string[] {
  const names = value.toLowerCase().replace(/\bcount(?:y|ies)\b/g, "").replace(/\btexas\b/g, "").replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .split(/,|;|\band\b|&|\//).map((name) => name.trim()).filter(Boolean);
  if (!names.length || names.some((name) => !byName.has(name))) return [];
  return [...new Set(names.map((name) => byName.get(name)!))];
}

export function safeNoticeUrl(value: string, base: string, hosts?: string[]) {
  try {
    const url = new URL(decodeEntities(value), base);
    if (url.protocol !== "https:" || url.username || url.password || (hosts && !hosts.includes(url.hostname))) return undefined;
    return url.href;
  } catch { return undefined; }
}

function makeNotice(sourceId: string, sourceName: string, title: string, url: string, countyFips: string[], dates: { eventDate?: string; publishedAt?: string }): PublicNotice {
  return {
    id: `${sourceId}-${createHash("sha256").update(`${url}|${dates.eventDate || dates.publishedAt || ""}`).digest("hex").slice(0, 20)}`,
    title: title.slice(0, 350), url, sourceId, sourceName, countyFips,
    coverage: countyFips.length > 1 ? "regional" : "county",
    geographyLabel: countyFips.map((fips) => `${byFips.get(fips)} County`).join(", "),
    category: /hearing/i.test(title) ? "hearing" : /meeting|commissioners?\s*court|agenda/i.test(title) ? "meeting" : /bid|proposal|procurement/i.test(title) ? "procurement" : /tax|budget/i.test(title) ? "tax" : /legal|foreclos|trustee/i.test(title) ? "legal" : "other",
    ...dates,
  };
}

export function parseTceqNotices(html: string): PublicNotice[] {
  if (!html.includes("Calendar of Public Meetings and Hearings on Permitting Cases")) throw new Error("TCEQ notice page changed");
  const notices: PublicNotice[] = [];
  for (const match of html.matchAll(/<article\b[^>]*class="[^"]*\bvevent\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi)) {
    const block = match[1];
    const area = text(block.match(/<p\b[^>]*class="facility-location[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "").replace(/^Facility Location:\s*/i, "");
    const fips = resolveTexasCounties(area);
    const link = block.match(/<a\b[^>]*href="([^"]+)"[^>]*itemprop="url"[^>]*>([\s\S]*?)<\/a>/i);
    const date = text(block.match(/<li\b[^>]*itemprop="startDate"[^>]*>([\s\S]*?)<\/li>/i)?.[1] || "");
    const url = link && safeNoticeUrl(link[1], TCEQ_URL, ["www.tceq.texas.gov"]);
    if (!fips.length || !link || !url || !Number.isFinite(Date.parse(date))) continue;
    notices.push(makeNotice("tceq", "Texas Commission on Environmental Quality", text(link[2]), url, fips, { eventDate: date }));
  }
  if (!html.includes('class="vevent') && !/no (?:upcoming )?events/i.test(html)) throw new Error("TCEQ event structure missing");
  return notices;
}

export function parseTxdotNotices(html: string): PublicNotice[] {
  if (!html.includes("Hearings, meetings and notices schedule") || !html.includes("Area(s)")) throw new Error("TxDOT notice page changed");
  const notices: PublicNotice[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length !== 4) continue;
    const area = text(cells[0]);
    if (!/\bcount(?:y|ies)\b/i.test(area)) continue;
    const fips = resolveTexasCounties(area);
    const date = text(cells[1]).match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    const link = cells[3].match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const url = link && safeNoticeUrl(link[1], TXDOT_URL, ["www.txdot.gov"]);
    if (!fips.length || !date || !link || !url) continue;
    const eventDate = `20${date[3]}-${date[1]}-${date[2]}`;
    if (!Number.isFinite(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0, 10) !== eventDate) continue;
    notices.push(makeNotice("txdot", "Texas Department of Transportation", text(link[2]), url, fips, { eventDate }));
  }
  return notices;
}

const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
export function parseCountyNoticeRss(xml: string, source: { id: string; name: string; url: string; feedUrl: string; fips: string; dateKind: "event" | "published" }): PublicNotice[] {
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel) throw new Error("County notice feed is not RSS");
  const rows = !channel.item ? [] : Array.isArray(channel.item) ? channel.item : [channel.item];
  return rows.flatMap((item: Record<string, unknown>) => {
    const title = typeof item.title === "string" ? text(item.title) : "";
    // A notice-board calendar can include holidays and social events.
    if (!/notice|hearing|meeting|commissioners?\s*court|agenda|bids?|proposal|budget|tax|foreclos|trustee/i.test(title)) return [];
    const rawUrl = typeof item.link === "string" ? item.link : "";
    const url = safeNoticeUrl(rawUrl, source.url, [new URL(source.url).hostname, new URL(source.feedUrl).hostname]);
    const date = typeof item.pubDate === "string" ? Date.parse(item.pubDate) : NaN;
    if (!url || !Number.isFinite(date)) return [];
    return [makeNotice(source.id, source.name, title, url, [source.fips], source.dateKind === "event" ? { eventDate: new Date(date).toISOString() } : { publishedAt: new Date(date).toISOString() })];
  });
}
