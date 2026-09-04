import { describe, expect, it } from "vitest";
import { countyPlaces } from "../src/county-places.js";
import { getCounty, getCountyLocalPlaces, getCountyMarketCities } from "../src/geo.js";
import { filterItems } from "../src/filter.js";
import type { NewsFeedItem } from "../src/types.js";

function story(title: string, description = ""): NewsFeedItem {
  return {
    id: title,
    title,
    link: "https://example.com/story",
    source: "Test Publisher",
    publishedAt: new Date().toISOString(),
    description,
    categories: [],
  } as NewsFeedItem;
}

describe("county place data", () => {
  it("covers the overwhelming majority of counties", () => {
    expect(Object.keys(countyPlaces).length).toBeGreaterThan(3_000);
  });

  it("gives rural counties their own towns instead of a distant media market", () => {
    // The bug this replaces: every county without a hand-written override fell
    // back to the nearest media markets, so Briscoe County searched Amarillo.
    const briscoe = getCounty("texas", "briscoe");
    expect(briscoe).toBeDefined();
    expect(getCountyLocalPlaces(briscoe!)).toEqual(["Silverton", "Quitaque"]);
    expect(getCountyLocalPlaces(briscoe!)).not.toContain("Amarillo");
    expect(getCountyLocalPlaces(briscoe!)).not.toContain("Lubbock");

    expect(getCountyLocalPlaces(getCounty("nebraska", "arthur")!)).toEqual(["Arthur"]);
    expect(getCountyLocalPlaces(getCounty("kentucky", "owsley")!)).toEqual(["Booneville"]);
  });

  it("keeps nearby media markets separate from the county's own towns", () => {
    const briscoe = getCounty("texas", "briscoe")!;
    // The market tier still wants Amarillo; the county tier must not have it.
    expect(getCountyMarketCities(briscoe, 3)).toContain("Amarillo");
    expect(getCountyLocalPlaces(briscoe)).not.toContain("Amarillo");
  });

  it("preserves place names the Census suffix rules could mangle", () => {
    expect(countyPlaces["32510"]).toContain("Carson City");
    expect(countyPlaces["36061"]).toContain("New York");
    expect(countyPlaces["35039"]).toContain("Española");
    expect(countyPlaces["47037"]).toContain("Nashville-Davidson");
    for (const places of Object.values(countyPlaces)) {
      for (const place of places) {
        expect(place).not.toMatch(/\b(city|town|village|borough|CDP)$/);
        expect(place).not.toMatch(/^Balance of /);
        expect(place).not.toMatch(/\(pt\.\)|\(balance\)/);
      }
    }
  });
});

describe("county locality filtering", () => {
  const briscoe = getCounty("texas", "briscoe")!;
  const scope = { level: "county", state: briscoe.state, county: briscoe } as const;

  it("accepts a story that names a town inside the county", () => {
    const items = filterItems(
      [story("Silverton city council approves new water line", "The Texas town voted Tuesday.")],
      "general",
      scope,
    );
    expect(items).toHaveLength(1);
  });

  it("still accepts a story that names the county itself", () => {
    const items = filterItems(
      [story("Briscoe County commissioners set the tax rate", "Texas county business.")],
      "general",
      scope,
    );
    expect(items).toHaveLength(1);
  });

  it("does not accept a nearby media market as county-local", () => {
    const items = filterItems(
      [story("Amarillo opens a new downtown parking garage", "The Texas city broke ground.")],
      "general",
      scope,
    );
    expect(items).toHaveLength(0);
  });

  it("requires a dateline for town names that are ordinary words", () => {
    // Hope, Arkansas is a real county seat; "hope" is also a common noun.
    const hempstead = getCounty("arkansas", "hempstead")!;
    const hopeScope = { level: "county", state: hempstead.state, county: hempstead } as const;
    expect(getCountyLocalPlaces(hempstead)).toContain("Hope");

    const bare = filterItems(
      [story("Arkansas families hold out hope after the storm", "A general Arkansas story.")],
      "general",
      hopeScope,
    );
    expect(bare).toHaveLength(0);

    const dateline = filterItems(
      [story("Hope, Arkansas schools name a new superintendent")],
      "general",
      hopeScope,
    );
    expect(dateline).toHaveLength(1);
  });
});
