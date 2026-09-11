import { cached, cachedShared } from "../cache.js";
import type { CountySite } from "../types.js";
import { parseCountyNoticeRss, parseTceqNotices, parseTxdotNotices, TCEQ_URL, TXDOT_URL } from "./parsers.js";
import { texasCountyNoticeSources } from "./texas-sources.js";
import type { PublicNotice, NoticeSource, PublicNoticesResponse } from "./types.js";

const TTL = 3600;
const STALE_TTL = 86400;
const LOOKBACK_DAYS = 90;
type Adapter = { id: string; name: string; url: string; fetchUrl: string; parse: (body: string) => PublicNotice[] };
type Snapshot = { fetchedAt: string; items: PublicNotice[] };
const stateAdapters: Adapter[] = [
  { id: "tceq", name: "TCEQ hearings and public meetings", url: TCEQ_URL, fetchUrl: TCEQ_URL, parse: parseTceqNotices },
  { id: "txdot", name: "TxDOT public meetings and notices", url: TXDOT_URL, fetchUrl: TXDOT_URL, parse: parseTxdotNotices },
];

async function fetchSource(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "error", headers: { "user-agent": "county-post-news-api/1.0 (public notices)" } });
  if (!response.ok || !response.body) throw new Error(`Notice source HTTP ${response.status}`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Notice source too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadSource(adapter: Adapter): Promise<{ source: NoticeSource; items: PublicNotice[] }> {
  const source: NoticeSource = { id: adapter.id, name: adapter.name, url: adapter.url, kind: "government", status: "unavailable" };
  // One shared snapshot per source, independent of county, page or limit. The
  // short outer cache coalesces readers; it never shares the S3 cache's key.
  const snapshot = await cached(`notice-request:${adapter.id}`, 60, async () => {
    const key = `public-notices:v1:${adapter.id}`;
    try {
      return await cachedShared<Snapshot>(key, TTL, async () => ({
        fetchedAt: new Date().toISOString(), items: adapter.parse(await fetchSource(adapter.fetchUrl)),
      }), { forceFresh: true, staleTtlSeconds: STALE_TTL });
    } catch (error) {
      console.warn(JSON.stringify({ event: "public_notices.source_failed", source: adapter.id, error: error instanceof Error ? error.message : "Unknown source error" }));
      // Failed refreshes may use a bounded existing snapshot. No queue or new
      // infrastructure is needed, and failures cannot overwrite valid notices.
      return cachedShared<Snapshot>(key, TTL, async () => { throw error; }, { staleTtlSeconds: STALE_TTL });
    }
  }).catch(() => undefined);
  if (!snapshot) return { source, items: [] };
  return { source: { ...source, checkedAt: snapshot.fetchedAt, status: Date.now() - Date.parse(snapshot.fetchedAt) >= TTL * 1000 ? "stale" : "current" }, items: snapshot.items };
}

export async function getCountyPublicNotices(county: CountySite, limit = 50, offset = 0): Promise<PublicNoticesResponse> {
  const checkedAt = new Date().toISOString();
  const scope = { state: county.state.slug, county: county.slug, fips: county.fips || "", displayName: county.displayName };
  const baseMeta = { count: 0, totalAvailable: 0, hasMore: false, offset: 0, checkedAt, lookbackDays: LOOKBACK_DAYS, cacheTtlSeconds: 300 };
  if (county.state.slug !== "texas") return { county: scope, items: [], sources: [], meta: { ...baseMeta, rollout: "not-yet-supported", status: "not-yet-supported" } };

  const local = texasCountyNoticeSources[county.fips || ""];
  const adapters = [...stateAdapters, ...(local?.feeds || []).map((feed, index): Adapter => {
    const id = `texas-${county.fips}-${index}`;
    const name = `${county.displayName} public notices`;
    const url = local.noticeUrl || local.websiteUrl || local.evidenceUrl;
    return { id, name, url, fetchUrl: feed.url, parse: (body) => parseCountyNoticeRss(body, { id, name, url, feedUrl: feed.url, fips: county.fips!, dateKind: feed.dateKind }) };
  })];
  const loaded = await Promise.all(adapters.map(loadSource));
  const cutoff = Date.now() - LOOKBACK_DAYS * 86400000;
  const maxFuture = Date.now() + 366 * 86400000;
  const unique = new Map<string, PublicNotice>();
  for (const { items } of loaded) for (const item of items) {
    const date = Date.parse(item.eventDate || item.publishedAt || "");
    if (!item.countyFips.includes(scope.fips) || !Number.isFinite(date) || date < cutoff || date > maxFuture) continue;
    if (item.publishedAt && date > Date.now() + 86400000) continue;
    unique.set(item.id, item);
  }
  const items = [...unique.values()].sort((a, b) => Date.parse(b.eventDate || b.publishedAt!) - Date.parse(a.eventDate || a.publishedAt!));
  const pageSize = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 50;
  const start = Number.isFinite(offset) ? Math.max(0, Math.min(10000, Math.floor(offset))) : 0;
  const sources = loaded.map((result) => result.source);
  if (local && !local.feeds.length) sources.unshift({ id: `texas-${scope.fips}-board`, name: `${county.displayName} ${local.noticeUrl ? "public notice board" : "county government"}`, url: local.noticeUrl || local.websiteUrl || local.evidenceUrl, kind: "government", status: "link-only" });
  sources.push({ id: "texas-newspaper-notices", name: "Texas newspaper public notices — search by county", url: "https://www.texaspublicnotices.com/", kind: "newspaper-directory", status: "link-only" });
  const available = loaded.filter((result) => result.source.status !== "unavailable").length;
  const partial = loaded.some((result) => result.source.status !== "current");
  return {
    county: scope, items: items.slice(start, start + pageSize), sources,
    meta: { ...baseMeta, rollout: "texas", status: !available ? "unavailable" : partial ? "partial" : "current", count: items.slice(start, start + pageSize).length, totalAvailable: items.length, hasMore: start + pageSize < items.length, offset: start },
  };
}
