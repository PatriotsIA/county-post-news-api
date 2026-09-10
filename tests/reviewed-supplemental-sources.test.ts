import { describe, expect, it } from "vitest";
import { getCountyByState } from "@nickgraffis/us-counties";
import { countySlug } from "../src/county-geography.js";
import { getCounty, states } from "../src/geo.js";
import { reviewedSupplementalSources } from "../src/reviewed-supplemental-sources.js";
import { getDirectSources, getReviewedCountySourceProfiles, isTrustedCountySource } from "../src/source-registry.js";
import { filterItems } from "../src/filter.js";
import type { NewsFeedItem } from "../src/types.js";

const counties = states.flatMap((state) =>
  (getCountyByState(state.name) as { FIPS: string; name: string }[]).map((raw) =>
    getCounty(state.slug, countySlug(raw.name, raw.FIPS))!,
  ),
);

describe("reviewed publisher expansion", () => {
  it("serves a typed directory across all canonical county routes without duplicate publisher cards", () => {
    expect(counties).toHaveLength(3143);
    expect(new Set(counties.map((county) => county.fips)).size).toBe(3143);
    expect(new Set(counties.map((county) => `${county.state.slug}/${county.slug}`)).size).toBe(3143);
    for (const county of counties) {
      const sources = getReviewedCountySourceProfiles(county);
      expect(sources.length, county.fips).toBeGreaterThan(0);
      const urls = sources.map((source) => {
        expect(source.outletTypes.length).toBeGreaterThan(0);
        expect(source.outletTypes.every((type) => ["newspaper", "radio", "television", "digital"].includes(type))).toBe(true);
        const url = new URL(source.websiteUrl);
        return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
      });
      expect(new Set(urls).size).toBe(urls.length);
    }
  });

  it("keeps auditable approval evidence and exact county/FIPS relationships without implicit trust", () => {
    const byKey = new Map(counties.map((county) => [`${county.state.slug}/${county.slug}`, county.fips]));
    expect(new Set(reviewedSupplementalSources.map((source) => source.id)).size).toBe(reviewedSupplementalSources.length);
    for (const source of reviewedSupplementalSources) {
      expect(source.review.status).toBe("approved");
      expect(source.review.evidenceUrls.length).toBeGreaterThan(0);
      expect(source.trustedForCountyTier).toBe(false);
      expect(source.countyFips).toEqual(source.counties.map((key) => byKey.get(key)));
      expect(source.countyFips).not.toContain(undefined);
      if (source.coverage === "statewide") {
        expect(source.counties).toEqual([]);
        expect(source.states).toHaveLength(1);
        expect(states.some((state) => state.slug === source.states![0])).toBe(true);
      } else {
        expect(source.counties.length).toBeGreaterThan(0);
        expect(source.states).toBeUndefined();
      }
    }
  });

  it("keeps statewide sources within their state and named regional publishers within reviewed counties", () => {
    const names = (state: string, county: string) => getReviewedCountySourceProfiles(getCounty(state, county)!).map((s) => s.name);
    expect(names("arkansas", "polk")).toContain("Arkansas Advocate");
    expect(names("florida", "polk")).not.toContain("Arkansas Advocate");
    expect(names("florida", "polk")).toContain("Florida Phoenix");
    expect(names("virginia", "henrico")).toContain("Henrico Citizen");
    expect(names("virginia", "richmond-city")).not.toContain("Henrico Citizen");
    expect(names("new-york", "ulster")).toContain("Hudson Valley One");
    expect(names("new-york", "dutchess")).not.toContain("Hudson Valley One");
    expect(names("maryland", "prince-george-s")).toContain("WTOP News");
    expect(names("virginia", "prince-george")).not.toContain("WTOP News");
  });

  it("fetches new feeds once and still rejects unrelated stories from an approved statewide publisher", () => {
    const county = getCounty("arkansas", "polk")!;
    const scope = { level: "county", state: county.state, county } as const;
    const sources = getDirectSources(scope, "general");
    expect(new Set(sources.map((source) => source.url)).size).toBe(sources.length);
    expect(sources).toContainEqual(expect.objectContaining({ itemSource: "Arkansas Advocate", trustedForCountyTier: false }));
    const story = (title: string, path: string): NewsFeedItem => ({ id: path, title, link: `https://arkansasadvocate.com/${path}`, source: "Arkansas Advocate", publishedAt: new Date().toISOString(), mediaType: "article" });
    const local = story("Polk County Arkansas opens a community center in Mena", "local");
    const otherCounty = story("Pulaski County Arkansas opens a community center in Little Rock", "elsewhere");
    const wrongState = story("Polk County Florida opens a community center in Lakeland", "florida");
    const national = story("Congress debates a new federal budget", "national");
    expect(isTrustedCountySource(national, sources, county)).toBe(false);
    expect(filterItems([local, otherCounty, wrongState, national], "general", scope, sources)).toEqual([local]);
  });

  it("lists verified publishers even when no usable feed was found and leaves held candidates out", () => {
    expect(getReviewedCountySourceProfiles(getCounty("illinois", "alexander")!)).toContainEqual(expect.objectContaining({ name: "Capitol News Illinois", coverage: "statewide" }));
    expect(reviewedSupplementalSources.find((s) => s.name === "Capitol News Illinois")!.feeds).toEqual([]);
    expect(reviewedSupplementalSources.some((s) => new URL(s.websiteUrl).hostname.endsWith("tidewaternews.com"))).toBe(false);
  });
});
