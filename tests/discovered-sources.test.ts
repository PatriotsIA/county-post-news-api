import { describe, expect, it } from "vitest";
import { discoveredCountyNativeSources, discoveredRegionalSources } from "../src/county-discovered-sources.js";
import { getReviewedCountySourceProfiles, trustedCountyHosts } from "../src/source-registry.js";
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

  it("scopes every source to counties that exist", { timeout: 30_000 }, () => {
    // getCounty is a linear scan per call; with the national registry there
    // are thousands of keys, so resolve each distinct key exactly once or the
    // test blows the default timeout on CI hardware.
    const keys = new Set(discoveredRegionalSources.flatMap((source) => source.counties ?? []));
    const unknown = [...keys].filter((key) => {
      const [stateSlug, countySlug] = key.split("/");
      return !getCounty(stateSlug, countySlug);
    });
    expect(unknown, unknown.join(", ")).toEqual([]);
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

describe("reviewed is not the same as trusted", () => {
  it("an untrusted reviewed outlet is listed in the directory but never in trustedHosts", () => {
    const mclennan = getCounty("texas", "mclennan")!;
    const profiles = getReviewedCountySourceProfiles(mclennan);
    // KWTX is McLennan County's newsroom and belongs on the Local Sources
    // page, but its Gray feed mixes in national wire, so its stories must
    // still pass the text rules.
    expect(profiles.map((p) => p.name)).toContain("KWTX News 10");
    expect(trustedCountyHosts(mclennan)).not.toContain("kwtx.com");
  });

  it("a trusted county weekly reaches both the directory and trustedHosts", () => {
    const hall = getCounty("texas", "hall")!;
    expect(getReviewedCountySourceProfiles(hall).map((p) => p.name)).toContain("The Greenbelt Intrepid");
    expect(trustedCountyHosts(hall)).toContain("the-intrepid.com");
  });

  it("Potter County's directory names its Amarillo newsrooms", () => {
    const potter = getCounty("texas", "potter")!;
    const names = getReviewedCountySourceProfiles(potter).map((p) => p.name);
    for (const name of ["Amarillo Globe-News", "NewsChannel 10", "MyHighPlains (KAMR/KCIT)", "ABC7 Amarillo (KVII)"]) {
      expect(names).toContain(name);
    }
  });
});

describe("metro counties carry multiple reviewed outlets", () => {
  it("Tarrant County lists its dailies and newsrooms, with the daily trusted", () => {
    const tarrant = getCounty("texas", "tarrant")!;
    const names = getReviewedCountySourceProfiles(tarrant).map((p) => p.name);
    for (const name of ["Fort Worth Report", "Fort Worth Star-Telegram", "WFAA", "NBC 5 Dallas-Fort Worth", "FOX 4 News"]) {
      expect(names).toContain(name);
    }
    const hosts = trustedCountyHosts(tarrant);
    expect(hosts).toContain("star-telegram.com");
    expect(hosts).toContain("fortworthreport.org");
    // The TV feeds carry syndicated national wire; their stories pass the
    // text rules instead of arriving by provenance.
    expect(hosts).not.toContain("wfaa.com");
  });
});

describe("national pass coverage", () => {
  it("major counties nationwide carry reviewed outlets with correct trust", () => {
    const king = getCounty("washington", "king")!;
    expect(getReviewedCountySourceProfiles(king).map((p) => p.name)).toContain("The Seattle Times");
    expect(trustedCountyHosts(king)).toContain("seattletimes.com");

    const cook = getCounty("illinois", "cook")!;
    const cookNames = getReviewedCountySourceProfiles(cook).map((p) => p.name);
    expect(cookNames).toContain("Chicago Tribune");
    expect(cookNames).toContain("Block Club Chicago");
    expect(trustedCountyHosts(cook)).toContain("blockclubchicago.org");

    // Statewide hosts are reviewed but never trusted: an AL.com story about
    // Mobile must not land on the Jefferson County desk by provenance.
    const jefferson = getCounty("alabama", "jefferson")!;
    expect(getReviewedCountySourceProfiles(jefferson).map((p) => p.name)).toContain("AL.com");
    expect(trustedCountyHosts(jefferson)).not.toContain("al.com");
  });
});
