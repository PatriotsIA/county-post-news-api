import { describe, expect, it } from "vitest";
import { countyPlaces } from "../src/county-places.js";
import { getCountyByState } from "@nickgraffis/us-counties";
import { getCounty, getCountyLocalPlaces, getCountyMarketCities, states } from "../src/geo.js";
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
  it("covers every county the site publishes", () => {
    // No county may fall back to a distant media market. The Census subcounty
    // file alone left 85 short — counties whose population centre is
    // unincorporated, plus Connecticut, which the Census now reports as
    // planning regions rather than the counties this site is organised by.
    const missing: string[] = [];
    let total = 0;
    for (const state of states) {
      for (const county of getCountyByState(state.name)) {
        total += 1;
        if (!countyPlaces[county.FIPS]?.length) missing.push(`${state.slug}/${county.name}`);
      }
    }
    expect(total).toBe(3_143);
    expect(missing).toEqual([]);
  });

  it("fills the counties the Census subcounty file omits", () => {
    // Unincorporated county seats, absent from the population estimates.
    expect(countyPlaces["48033"]).toContain("Gail"); // Borden County, Texas
    expect(countyPlaces["48261"]).toContain("Sarita"); // Kenedy County, Texas
    expect(countyPlaces["15005"]).toContain("Kalaupapa"); // Kalawao County, Hawaii
    expect(countyPlaces["32009"]).toContain("Goldfield"); // Esmeralda County, Nevada

    // Hawaii has no incorporated places at all, so every county but Honolulu
    // came from GNIS, ranked by Census place area rather than population.
    expect(countyPlaces["15001"]).toContain("Hilo");
    expect(countyPlaces["15009"]).toContain("Kahului");

    // Connecticut, mapped back to the legacy counties from the 2020 Gazetteer
    // and ranked by the population the subcounty file reports for each town.
    expect(countyPlaces["09001"]?.slice(0, 3)).toEqual(["Bridgeport", "Stamford", "Norwalk"]);
    expect(countyPlaces["09003"]?.[0]).toBe("Hartford");
  });

  it("keeps ghost towns out", () => {
    // GNIS lists razed settlements alongside county seats, flagged in the name.
    for (const places of Object.values(countyPlaces)) {
      for (const place of places) expect(place).not.toContain("(historical)");
    }
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

  it("accepts a distinctive town name on its own", () => {
    // Quitaque exists in one state, so a bare mention is evidence enough. This
    // permissiveness is the point: the strongest local stories never name the
    // state — "Mena Police Reports" is a complete Polk County, Arkansas headline.
    const items = filterItems(
      [story("Quitaque council approves a new water line", "The Texas town voted Tuesday.")],
      "general",
      scope,
    );
    expect(items).toHaveLength(1);
  });

  it("requires a dateline for a town name shared across states", () => {
    // Silverton is also in Colorado and Oregon, so a bare mention beside the
    // word "Texas" is not evidence this story is about Briscoe County.
    expect(
      filterItems([story("Silverton council approves a new water line", "The Texas town voted.")], "general", scope),
    ).toHaveLength(0);

    expect(
      filterItems([story("Silverton, TX council approves a new water line")], "general", scope),
    ).toHaveLength(1);
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

describe("place-name ambiguity", () => {
  it("rejects the false matches that bare name matching produced", () => {
    // Observed on production before this rule existed.
    const arthur = getCounty("nebraska", "arthur")!;
    expect(
      filterItems(
        [story("Clues in the cellar: a night of mystery at James Arthur Vineyard", "A Nebraska event.")],
        "general",
        { level: "county", state: arthur.state, county: arthur },
      ),
    ).toHaveLength(0);

    const roberts = getCounty("texas", "roberts")!;
    expect(
      filterItems(
        [story("Miami Dolphins cut Bradley Chubb", "Texas Roadhouse coverage of the move.")],
        "general",
        { level: "county", state: roberts.state, county: roberts },
      ),
    ).toHaveLength(0);
  });

  it("still lets a genuinely local story through for those counties", () => {
    const roberts = getCounty("texas", "roberts")!;
    expect(
      filterItems(
        [story("Miami, TX schools name a new superintendent")],
        "general",
        { level: "county", state: roberts.state, county: roberts },
      ),
    ).toHaveLength(1);
  });
});
