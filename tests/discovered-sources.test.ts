import { describe, expect, it } from "vitest";
import { discoveredCountyNativeSources, discoveredRegionalSources } from "../src/county-discovered-sources.js";
import { buildCountyPrimaryPlan } from "../src/feed-builders.js";
import { getCounty } from "../src/geo.js";
import { filterItems } from "../src/filter.js";
import type { NewsFeedItem } from "../src/types.js";

describe("discovered county sources", () => {
  it("never grants county-tier trust automatically", () => {
    // The invariant this whole registry rests on. A trusted source has every
    // story it publishes accepted as county-local without naming the county —
    // right for an outlet covering one county, ruinous for one covering twenty.
    // Discovery cannot tell those apart reliably enough to decide, so trust
    // stays a reviewed, hand-written decision.
    for (const source of discoveredRegionalSources) {
      expect(source.trustedForCountyTier, `${source.name} must not be trusted`).toBe(false);
    }
    expect(discoveredCountyNativeSources).toEqual([]);
  });

  it("emits usable feed urls", () => {
    for (const source of discoveredRegionalSources) {
      expect(source.url).toMatch(/^https?:\/\//);
      // Feed hrefs are scraped out of HTML; un-decoded entities produce a URL
      // that silently fetches the wrong thing.
      expect(source.url).not.toContain("&amp;");
      expect(source.counties?.length ?? 0).toBeGreaterThan(0);
      expect(source.name.trim()).not.toBe("");
    }
  });

  it("scopes every source to counties that exist", () => {
    for (const source of discoveredRegionalSources) {
      for (const key of source.counties ?? []) {
        const [stateSlug, countySlug] = key.split("/");
        expect(getCounty(stateSlug, countySlug), `${key} from ${source.name}`).toBeDefined();
      }
    }
  });

  it("attaches its feeds to the county plans they were found for", () => {
    const angelina = getCounty("texas", "angelina")!;
    const plan = buildCountyPrimaryPlan(angelina, "general");
    const discovered = plan.directSources.filter((source) =>
      discoveredRegionalSources.some((entry) => entry.url === source.url),
    );
    expect(discovered.length).toBeGreaterThan(0);
  });

  it("still filters a discovered source's out-of-county stories", () => {
    // The volume comes from fetching these feeds; the precision comes from
    // their stories being filtered like any other.
    const angelina = getCounty("texas", "angelina")!;
    const scope = { level: "county", state: angelina.state, county: angelina } as const;
    const plan = buildCountyPrimaryPlan(angelina, "general");

    const story = (title: string, link: string): NewsFeedItem =>
      ({ id: title, title, link, source: "KLTV", publishedAt: new Date().toISOString(), description: "" }) as NewsFeedItem;

    const kept = filterItems(
      [
        story("Lufkin ISD names a new superintendent", "https://www.kltv.com/2026/09/04/lufkin-isd/"),
        story("Tyler council approves downtown plan", "https://www.kltv.com/2026/09/04/tyler-council/"),
      ],
      "general",
      scope,
      plan.directSources,
    );

    expect(kept.map((item) => item.title)).toEqual(["Lufkin ISD names a new superintendent"]);
  });
});
