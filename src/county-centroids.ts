import { createRequire } from "node:module";
import centroid from "@turf/centroid";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";

type Topology = Parameters<typeof feature>[0];
type GeometryCollection = Parameters<typeof feature>[1];
type CountyCentroid = readonly [latitude: number, longitude: number];

const require = createRequire(import.meta.url);
const topology = require("us-atlas/counties-10m.json") as Topology & {
  objects: { counties: GeometryCollection };
};

let centroidsByFips: Map<string, CountyCentroid> | undefined;

export function getCountyCentroid(fips?: string): CountyCentroid | undefined {
  if (!fips) return undefined;
  return getCentroidsByFips().get(fips);
}

function getCentroidsByFips() {
  if (centroidsByFips) return centroidsByFips;

  const collection = feature(topology, topology.objects.counties) as FeatureCollection<Geometry>;
  const next = new Map<string, CountyCentroid>();

  for (const county of collection.features) {
    if (!county.id) continue;
    const center = centroid(county).geometry.coordinates;
    next.set(String(county.id).padStart(5, "0"), [center[1], center[0]]);
  }

  centroidsByFips = next;
  return next;
}
