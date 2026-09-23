import { countyCentroidData } from "./county-centroid-data.js";

export function getCountyCentroid(fips?: string): readonly [latitude: number, longitude: number] | undefined {
  return fips ? countyCentroidData[fips] : undefined;
}
