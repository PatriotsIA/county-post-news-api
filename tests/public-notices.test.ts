import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCountyByState } from "@nickgraffis/us-counties";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { getCounty } from "../src/geo.js";
import { handleRequest } from "../src/http.js";
import { parseCountyNoticeRss, parseTceqNotices, parseTxdotNotices, resolveTexasCounties, TCEQ_URL, TXDOT_URL } from "../src/public-notices/parsers.js";
import { getCountyPublicNotices } from "../src/public-notices/service.js";
import { texasCountyNoticeSources } from "../src/public-notices/texas-sources.js";

// Minimal fixtures reflect the providers' reviewed public HTML/RSS structure.
const event = (area: string, id: string, date = "2026-09-14T19:00:00-05:00") => `<article class="vevent"><p class="facility-location">Facility Location: ${area}</p><p>Hearing venue: Travis County</p><a href="${TCEQ_URL}/${id}" itemprop="url"><span>Public Meeting: ${id}</span></a><li itemprop="startDate" class="dtstart">${date}</li></article>`;
const tceq = (...events: string[]) => `Calendar of Public Meetings and Hearings on Permitting Cases${events.length ? events.join("") : "No upcoming events"}`;
const row = (area: string, id: string, date = "09/14/26") => `<tr><td>${area}</td><td>${date}</td><td>Public hearing</td><td><a href="/projects/${id}.html">Public hearing: ${id}</a></td></tr>`;
const txdot = (...rows: string[]) => `Hearings, meetings and notices schedule<table><th>Area(s)</th>${rows.join("")}</table>`;
const rssItem = (title: string, url = "https://newtools.cira.state.tx.us/page/sabine.PublicNotices?id=123", date = "Mon, 14 Sep 2026 14:00:00 GMT") => `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate></item>`;
const rss = (...items: string[]) => `<rss version="2.0"><channel><title>Public notices</title>${items.join("")}</channel></rss>`;
const local = { id: "sabine", name: "Sabine County public notices", url: "https://www.co.sabine.tx.us/page/sabine.PublicNotices", feedUrl: "https://newtools.cira.state.tx.us/page/calrss/25400/0/calendar.rss", fips: "48403", dateKind: "event" as const };

beforeEach(() => { clearCache(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-11T12:00:00Z")); vi.stubEnv("FEED_CACHE_BUCKET", ""); });
afterEach(() => { clearCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
function mockSources(environment = tceq(event("Bell County 76571", "bell")), transportation = txdot(row("Harris and Montgomery counties", "regional"))) {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    return new Response(url === TCEQ_URL ? environment : url === TXDOT_URL ? transportation : rss(rssItem("Commissioners Court Meeting")), { status: 200 });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("public notice source geography and dates", () => {
  it("resolves explicit counties while rejecting statewide, city and partially unknown regions", () => {
    expect(resolveTexasCounties("Harris and Montgomery counties")).toEqual(["48201", "48339"]);
    expect(resolveTexasCounties("Bell County 76571")).toEqual(["48027"]);
    for (const area of ["Statewide", "Austin city", "Harris and Unknown counties", "Jefferson County Florida", ""]) expect(resolveTexasCounties(area)).toEqual([]);
  });
  it("uses the affected facility county, never the hearing venue or article mentions", () => {
    const [notice] = parseTceqNotices(tceq(event("Bell County 76571", "bell"), event("Statewide", "statewide")));
    expect(notice.countyFips).toEqual(["48027"]);
    expect(notice).toMatchObject({ coverage: "county", category: "meeting", eventDate: "2026-09-14T19:00:00-05:00" });
    expect(notice.publishedAt).toBeUndefined();
  });
  it("keeps explicit regional scopes and excludes cities, bad dates and external links", () => {
    const notices = parseTxdotNotices(txdot(row("Harris and Montgomery counties", "regional"), row("Statewide", "all"), row("Cameron", "city"), row("Bell County", "bad-date", "02/31/26"), row("Bell County", "external").replace('/projects/external.html', 'https://unverified.example/notice')));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ countyFips: ["48201", "48339"], coverage: "regional", eventDate: "2026-09-14" });
  });
  it("preserves county calendar event dates and rejects holiday, invalid and unsafe items", () => {
    const items = parseCountyNoticeRss(rss(rssItem("Commissioners Court Meeting &amp; Budget"), rssItem("Christmas holiday"), rssItem("Public hearing", "javascript:alert(1)"), rssItem("Tax notice", "https://unverified.example/tax"), rssItem("Public meeting", local.url, "unknown")), local);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Commissioners Court Meeting & Budget", countyFips: ["48403"], eventDate: "2026-09-14T14:00:00.000Z" });
    expect(items[0].publishedAt).toBeUndefined();
    expect(parseCountyNoticeRss(rss(rssItem("Public notice")), { ...local, dateKind: "published" })[0].publishedAt).toBeDefined();
  });
  it("distinguishes an empty calendar from a broken provider response", () => {
    expect(parseCountyNoticeRss(rss(), local)).toEqual([]);
    expect(parseTceqNotices(tceq())).toEqual([]);
    expect(() => parseCountyNoticeRss("<html>Unavailable</html>", local)).toThrow();
    expect(() => parseTceqNotices("<html>Changed</html>")).toThrow();
    expect(() => parseTxdotNotices("<html>Changed</html>")).toThrow();
  });
});

describe("county public notices service and route", () => {
  it("has a reviewed, FIPS-matched official source profile for every Texas county", () => {
    const counties = getCountyByState("Texas") as { name: string; FIPS: string }[];
    expect(Object.keys(texasCountyNoticeSources)).toHaveLength(254);
    for (const county of counties) {
      const source = texasCountyNoticeSources[county.FIPS];
      expect(source.county).toBe(county.name);
      for (const url of [source.evidenceUrl, source.websiteUrl, source.noticeUrl, ...source.feeds.map((feed) => feed.url)].filter(Boolean)) expect(new URL(url!).protocol).toBe("https:");
    }
  });
  it("filters each county, deduplicates records and shares state fetches across counties/pages", async () => {
    const fetch = mockSources(tceq(event("Bell County", "one"), event("Bell County", "one"), event("Bell County", "two"), event("Bell County", "old", "2025-01-01")));
    const bell = getCounty("texas", "bell")!;
    const first = await getCountyPublicNotices(bell, 1);
    const next = await getCountyPublicNotices(bell, 1, 1);
    const harris = await getCountyPublicNotices(getCounty("texas", "harris")!);
    expect(first.meta).toMatchObject({ count: 1, totalAvailable: 2, hasMore: true });
    expect(next.meta).toMatchObject({ count: 1, offset: 1, hasMore: false });
    expect(next.items[0].id).not.toBe(first.items[0].id);
    expect(harris.items).toHaveLength(1);
    expect(harris.items[0].coverage).toBe("regional");
    expect(fetch.mock.calls.filter(([url]) => String(url) === TCEQ_URL)).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => String(url) === TXDOT_URL)).toHaveLength(1);
  });
  it("keeps future calendar meetings and reports partial or total source outages with source links", async () => {
    mockSources();
    const sabine = await getCountyPublicNotices(getCounty("texas", "sabine")!);
    expect(sabine.items.some((item) => item.sourceId.startsWith("texas-48403"))).toBe(true);
    clearCache();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === TXDOT_URL ? new Response(txdot(row("Harris County", "works"))) : new Response("Unavailable", { status: 503 })));
    const partial = await getCountyPublicNotices(getCounty("texas", "harris")!);
    expect(partial.meta.status).toBe("partial");
    expect(partial.items).toHaveLength(1);
    clearCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    const failed = await handleRequest({ method: "GET", path: "/v1/counties/texas/harris/public-notices", query: new URLSearchParams() });
    expect(failed.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(failed.body).meta.status).toBe("unavailable");
    expect(JSON.parse(failed.body).sources.some((source: { status: string }) => source.status === "link-only")).toBe(true);
  });
  it("serves bounded stale snapshots after refresh failure without overwriting the cache", async () => {
    vi.stubEnv("FEED_CACHE_BUCKET", "notice-test-cache");
    const items = parseTceqNotices(tceq(event("Bell County", "saved")));
    const storedAt = Date.now() - 7200000;
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand && command.input.Key?.includes("tceq")) return { Body: { transformToString: async () => JSON.stringify({ storedAt, value: { fetchedAt: new Date(storedAt).toISOString(), items } }) } };
      throw new Error("No source snapshot");
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    const response = await getCountyPublicNotices(getCounty("texas", "bell")!);
    expect(response.items).toHaveLength(1);
    expect(response.sources.find((source) => source.id === "tceq")?.status).toBe("stale");
    expect(send.mock.calls.some(([command]) => command instanceof PutObjectCommand)).toBe(false);
    clearCache(); vi.setSystemTime(new Date(Date.now() + 86400000));
    expect((await getCountyPublicNotices(getCounty("texas", "bell")!)).meta.status).toBe("unavailable");
  });
  it("defaults to 50 results, rejects unknown counties and never fetches Texas sources for other states", async () => {
    const fetch = mockSources(tceq(...Array.from({ length: 60 }, (_, i) => event("Bell County", `notice-${i}`))));
    const response = await handleRequest({ method: "GET", path: "/v1/counties/texas/bell/public-notices", query: new URLSearchParams() });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).items).toHaveLength(50);
    const calls = fetch.mock.calls.length;
    expect((await getCountyPublicNotices(getCounty("florida", "jefferson")!)).meta.status).toBe("not-yet-supported");
    expect(fetch.mock.calls).toHaveLength(calls);
    expect((await handleRequest({ method: "GET", path: "/v1/counties/texas/not-a-county/public-notices", query: new URLSearchParams() })).statusCode).toBe(404);
  });
});
