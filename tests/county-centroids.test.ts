import { createRequire } from "node:module";
import centroid from "@turf/centroid";
import { feature } from "topojson-client";
import { expect, it } from "vitest";
import { getCountyCentroid } from "../src/county-centroids.js";
import { getCounty } from "../src/geo.js";

it("preserves existing coordinates exactly outside the documented dateline correction", () => {
  const require = createRequire(import.meta.url);
  const topology = require("us-atlas/counties-10m.json");
  const collection = feature(topology, topology.objects.counties) as unknown as GeoJSON.FeatureCollection;
  for (const county of collection.features) {
    const fips = String(county.id).padStart(5, "0");
    if (fips === "02016") continue;
    const [longitude, latitude] = centroid(county).geometry.coordinates;
    expect(getCountyCentroid(fips)).toEqual([latitude, longitude]);
  }
});

it("supplies current Alaska census areas and a dateline-safe Aleutians point", () => {
  for (const county of ["chugach", "copper-river", "aleutians-west"]) {
    const value = getCounty("alaska", county)!;
    expect(value.latitude).toBeGreaterThan(50);
    expect(Math.abs(value.longitude!)).toBeGreaterThan(140);
  }
});
