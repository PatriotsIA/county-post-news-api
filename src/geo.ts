import { getCountyByState } from "@nickgraffis/us-counties";
import { getCountyCentroid } from "./county-centroids.js";
import type { CountySite, StateSite } from "./types.js";

type StateNewsHub = {
  city: string;
  latitude: number;
  longitude: number;
};

export const states: StateSite[] = [
  { name: "Alabama", abbr: "AL", slug: "alabama" },
  { name: "Alaska", abbr: "AK", slug: "alaska" },
  { name: "Arizona", abbr: "AZ", slug: "arizona" },
  { name: "Arkansas", abbr: "AR", slug: "arkansas" },
  { name: "California", abbr: "CA", slug: "california" },
  { name: "Colorado", abbr: "CO", slug: "colorado" },
  { name: "Connecticut", abbr: "CT", slug: "connecticut" },
  { name: "Delaware", abbr: "DE", slug: "delaware" },
  { name: "District of Columbia", abbr: "DC", slug: "district-of-columbia" },
  { name: "Florida", abbr: "FL", slug: "florida" },
  { name: "Georgia", abbr: "GA", slug: "georgia" },
  { name: "Hawaii", abbr: "HI", slug: "hawaii" },
  { name: "Idaho", abbr: "ID", slug: "idaho" },
  { name: "Illinois", abbr: "IL", slug: "illinois" },
  { name: "Indiana", abbr: "IN", slug: "indiana" },
  { name: "Iowa", abbr: "IA", slug: "iowa" },
  { name: "Kansas", abbr: "KS", slug: "kansas" },
  { name: "Kentucky", abbr: "KY", slug: "kentucky" },
  { name: "Louisiana", abbr: "LA", slug: "louisiana" },
  { name: "Maine", abbr: "ME", slug: "maine" },
  { name: "Maryland", abbr: "MD", slug: "maryland" },
  { name: "Massachusetts", abbr: "MA", slug: "massachusetts" },
  { name: "Michigan", abbr: "MI", slug: "michigan" },
  { name: "Minnesota", abbr: "MN", slug: "minnesota" },
  { name: "Mississippi", abbr: "MS", slug: "mississippi" },
  { name: "Missouri", abbr: "MO", slug: "missouri" },
  { name: "Montana", abbr: "MT", slug: "montana" },
  { name: "Nebraska", abbr: "NE", slug: "nebraska" },
  { name: "Nevada", abbr: "NV", slug: "nevada" },
  { name: "New Hampshire", abbr: "NH", slug: "new-hampshire" },
  { name: "New Jersey", abbr: "NJ", slug: "new-jersey" },
  { name: "New Mexico", abbr: "NM", slug: "new-mexico" },
  { name: "New York", abbr: "NY", slug: "new-york" },
  { name: "North Carolina", abbr: "NC", slug: "north-carolina" },
  { name: "North Dakota", abbr: "ND", slug: "north-dakota" },
  { name: "Ohio", abbr: "OH", slug: "ohio" },
  { name: "Oklahoma", abbr: "OK", slug: "oklahoma" },
  { name: "Oregon", abbr: "OR", slug: "oregon" },
  { name: "Pennsylvania", abbr: "PA", slug: "pennsylvania" },
  { name: "Rhode Island", abbr: "RI", slug: "rhode-island" },
  { name: "South Carolina", abbr: "SC", slug: "south-carolina" },
  { name: "South Dakota", abbr: "SD", slug: "south-dakota" },
  { name: "Tennessee", abbr: "TN", slug: "tennessee" },
  { name: "Texas", abbr: "TX", slug: "texas" },
  { name: "Utah", abbr: "UT", slug: "utah" },
  { name: "Vermont", abbr: "VT", slug: "vermont" },
  { name: "Virginia", abbr: "VA", slug: "virginia" },
  { name: "Washington", abbr: "WA", slug: "washington" },
  { name: "West Virginia", abbr: "WV", slug: "west-virginia" },
  { name: "Wisconsin", abbr: "WI", slug: "wisconsin" },
  { name: "Wyoming", abbr: "WY", slug: "wyoming" },
];

const stateBySlug = new Map(states.map((state) => [state.slug, state]));
const stateByAbbr = new Map(states.map((state) => [state.abbr.toLowerCase(), state]));

const stateNewsHubs: Record<string, StateNewsHub[]> = {
  alabama: [{ city: "Birmingham", latitude: 33.5207, longitude: -86.8025 }],
  alaska: [{ city: "Anchorage", latitude: 61.2181, longitude: -149.9003 }],
  arizona: [
    { city: "Phoenix", latitude: 33.4484, longitude: -112.074 },
    { city: "Tucson", latitude: 32.2226, longitude: -110.9747 },
  ],
  arkansas: [
    { city: "Little Rock", latitude: 34.7465, longitude: -92.2896 },
    { city: "Fayetteville", latitude: 36.0626, longitude: -94.1574 },
  ],
  california: [
    { city: "Los Angeles", latitude: 34.0522, longitude: -118.2437 },
    { city: "San Francisco", latitude: 37.7749, longitude: -122.4194 },
    { city: "San Diego", latitude: 32.7157, longitude: -117.1611 },
    { city: "San Jose", latitude: 37.3382, longitude: -121.8863 },
    { city: "Sacramento", latitude: 38.5816, longitude: -121.4944 },
    { city: "Fresno", latitude: 36.7378, longitude: -119.7871 },
    { city: "Bakersfield", latitude: 35.3733, longitude: -119.0187 },
    { city: "Riverside", latitude: 33.9533, longitude: -117.3962 },
  ],
  colorado: [
    { city: "Denver", latitude: 39.7392, longitude: -104.9903 },
    { city: "Colorado Springs", latitude: 38.8339, longitude: -104.8214 },
    { city: "Grand Junction", latitude: 39.0639, longitude: -108.5506 },
  ],
  connecticut: [{ city: "Hartford", latitude: 41.7658, longitude: -72.6734 }],
  delaware: [{ city: "Wilmington", latitude: 39.7391, longitude: -75.5398 }],
  "district-of-columbia": [{ city: "Washington", latitude: 38.9072, longitude: -77.0369 }],
  florida: [
    { city: "Miami", latitude: 25.7617, longitude: -80.1918 },
    { city: "Orlando", latitude: 28.5383, longitude: -81.3792 },
    { city: "Tampa", latitude: 27.9506, longitude: -82.4572 },
    { city: "Jacksonville", latitude: 30.3322, longitude: -81.6557 },
    { city: "Tallahassee", latitude: 30.4383, longitude: -84.2807 },
    { city: "Pensacola", latitude: 30.4213, longitude: -87.2169 },
  ],
  georgia: [
    { city: "Atlanta", latitude: 33.749, longitude: -84.388 },
    { city: "Savannah", latitude: 32.0809, longitude: -81.0912 },
    { city: "Augusta", latitude: 33.4735, longitude: -82.0105 },
  ],
  hawaii: [{ city: "Honolulu", latitude: 21.3069, longitude: -157.8583 }],
  idaho: [
    { city: "Boise", latitude: 43.615, longitude: -116.2023 },
    { city: "Idaho Falls", latitude: 43.4917, longitude: -112.0339 },
  ],
  illinois: [
    { city: "Chicago", latitude: 41.8781, longitude: -87.6298 },
    { city: "Springfield", latitude: 39.7817, longitude: -89.6501 },
    { city: "Rockford", latitude: 42.2711, longitude: -89.094 },
  ],
  indiana: [
    { city: "Indianapolis", latitude: 39.7684, longitude: -86.1581 },
    { city: "Fort Wayne", latitude: 41.0793, longitude: -85.1394 },
    { city: "Evansville", latitude: 37.9716, longitude: -87.5711 },
  ],
  iowa: [
    { city: "Des Moines", latitude: 41.5868, longitude: -93.625 },
    { city: "Cedar Rapids", latitude: 41.9779, longitude: -91.6656 },
    { city: "Davenport", latitude: 41.5236, longitude: -90.5776 },
  ],
  kansas: [
    { city: "Wichita", latitude: 37.6872, longitude: -97.3301 },
    { city: "Kansas City", latitude: 39.1141, longitude: -94.6275 },
  ],
  kentucky: [
    { city: "Louisville", latitude: 38.2527, longitude: -85.7585 },
    { city: "Lexington", latitude: 38.0406, longitude: -84.5037 },
  ],
  louisiana: [
    { city: "New Orleans", latitude: 29.9511, longitude: -90.0715 },
    { city: "Baton Rouge", latitude: 30.4515, longitude: -91.1871 },
    { city: "Shreveport", latitude: 32.5252, longitude: -93.7502 },
  ],
  maine: [{ city: "Portland", latitude: 43.6591, longitude: -70.2568 }],
  maryland: [{ city: "Baltimore", latitude: 39.2904, longitude: -76.6122 }],
  massachusetts: [{ city: "Boston", latitude: 42.3601, longitude: -71.0589 }],
  michigan: [
    { city: "Detroit", latitude: 42.3314, longitude: -83.0458 },
    { city: "Grand Rapids", latitude: 42.9634, longitude: -85.6681 },
    { city: "Lansing", latitude: 42.7325, longitude: -84.5555 },
  ],
  minnesota: [
    { city: "Minneapolis", latitude: 44.9778, longitude: -93.265 },
    { city: "Duluth", latitude: 46.7867, longitude: -92.1005 },
    { city: "Rochester", latitude: 44.0121, longitude: -92.4802 },
  ],
  mississippi: [
    { city: "Jackson", latitude: 32.2988, longitude: -90.1848 },
    { city: "Gulfport", latitude: 30.3674, longitude: -89.0928 },
  ],
  missouri: [
    { city: "Kansas City", latitude: 39.0997, longitude: -94.5786 },
    { city: "St. Louis", latitude: 38.627, longitude: -90.1994 },
    { city: "Springfield", latitude: 37.209, longitude: -93.2923 },
  ],
  montana: [
    { city: "Billings", latitude: 45.7833, longitude: -108.5007 },
    { city: "Missoula", latitude: 46.8721, longitude: -113.994 },
  ],
  nebraska: [
    { city: "Omaha", latitude: 41.2565, longitude: -95.9345 },
    { city: "Lincoln", latitude: 40.8136, longitude: -96.7026 },
  ],
  nevada: [{ city: "Las Vegas", latitude: 36.1699, longitude: -115.1398 }],
  "new-hampshire": [{ city: "Manchester", latitude: 42.9956, longitude: -71.4548 }],
  "new-jersey": [{ city: "Newark", latitude: 40.7357, longitude: -74.1724 }],
  "new-mexico": [
    { city: "Albuquerque", latitude: 35.0844, longitude: -106.6504 },
    { city: "Santa Fe", latitude: 35.687, longitude: -105.9378 },
    { city: "Las Cruces", latitude: 32.3199, longitude: -106.7637 },
  ],
  "new-york": [
    { city: "New York City", latitude: 40.7128, longitude: -74.006 },
    { city: "Buffalo", latitude: 42.8864, longitude: -78.8784 },
    { city: "Albany", latitude: 42.6526, longitude: -73.7562 },
    { city: "Syracuse", latitude: 43.0481, longitude: -76.1474 },
    { city: "Rochester", latitude: 43.1566, longitude: -77.6088 },
  ],
  "north-carolina": [
    { city: "Charlotte", latitude: 35.2271, longitude: -80.8431 },
    { city: "Raleigh", latitude: 35.7796, longitude: -78.6382 },
    { city: "Greensboro", latitude: 36.0726, longitude: -79.792 },
    { city: "Asheville", latitude: 35.5951, longitude: -82.5515 },
  ],
  "north-dakota": [{ city: "Fargo", latitude: 46.8772, longitude: -96.7898 }],
  ohio: [
    { city: "Columbus", latitude: 39.9612, longitude: -82.9988 },
    { city: "Cleveland", latitude: 41.4993, longitude: -81.6944 },
    { city: "Cincinnati", latitude: 39.1031, longitude: -84.512 },
    { city: "Toledo", latitude: 41.6528, longitude: -83.5379 },
  ],
  oklahoma: [
    { city: "Oklahoma City", latitude: 35.4676, longitude: -97.5164 },
    { city: "Tulsa", latitude: 36.154, longitude: -95.9928 },
  ],
  oregon: [
    { city: "Portland", latitude: 45.5152, longitude: -122.6784 },
    { city: "Eugene", latitude: 44.0521, longitude: -123.0868 },
    { city: "Bend", latitude: 44.0582, longitude: -121.3153 },
  ],
  pennsylvania: [
    { city: "Philadelphia", latitude: 39.9526, longitude: -75.1652 },
    { city: "Pittsburgh", latitude: 40.4406, longitude: -79.9959 },
    { city: "Harrisburg", latitude: 40.2732, longitude: -76.8867 },
  ],
  "rhode-island": [{ city: "Providence", latitude: 41.824, longitude: -71.4128 }],
  "south-carolina": [
    { city: "Charleston", latitude: 32.7765, longitude: -79.9311 },
    { city: "Columbia", latitude: 34.0007, longitude: -81.0348 },
    { city: "Greenville", latitude: 34.8526, longitude: -82.394 },
  ],
  "south-dakota": [{ city: "Sioux Falls", latitude: 43.546, longitude: -96.7313 }],
  tennessee: [
    { city: "Nashville", latitude: 36.1627, longitude: -86.7816 },
    { city: "Memphis", latitude: 35.1495, longitude: -90.049 },
    { city: "Knoxville", latitude: 35.9606, longitude: -83.9207 },
    { city: "Chattanooga", latitude: 35.0456, longitude: -85.3097 },
  ],
  texas: [
    { city: "Houston", latitude: 29.7604, longitude: -95.3698 },
    { city: "Dallas", latitude: 32.7767, longitude: -96.797 },
    { city: "San Antonio", latitude: 29.4241, longitude: -98.4936 },
    { city: "Austin", latitude: 30.2672, longitude: -97.7431 },
    { city: "Fort Worth", latitude: 32.7555, longitude: -97.3308 },
    { city: "El Paso", latitude: 31.7619, longitude: -106.485 },
    { city: "Amarillo", latitude: 35.222, longitude: -101.8313 },
    { city: "Lubbock", latitude: 33.5779, longitude: -101.8552 },
    { city: "Midland", latitude: 31.9973, longitude: -102.0779 },
    { city: "Corpus Christi", latitude: 27.8006, longitude: -97.3964 },
    { city: "McAllen", latitude: 26.2034, longitude: -98.23 },
    { city: "Tyler", latitude: 32.3513, longitude: -95.3011 },
    { city: "Waco", latitude: 31.5493, longitude: -97.1467 },
    { city: "Abilene", latitude: 32.4487, longitude: -99.7331 },
    { city: "Beaumont", latitude: 30.0802, longitude: -94.1266 },
  ],
  utah: [{ city: "Salt Lake City", latitude: 40.7608, longitude: -111.891 }],
  vermont: [{ city: "Burlington", latitude: 44.4759, longitude: -73.2121 }],
  virginia: [
    { city: "Virginia Beach", latitude: 36.8529, longitude: -75.978 },
    { city: "Richmond", latitude: 37.5407, longitude: -77.436 },
    { city: "Roanoke", latitude: 37.271, longitude: -79.9414 },
  ],
  washington: [
    { city: "Seattle", latitude: 47.6062, longitude: -122.3321 },
    { city: "Spokane", latitude: 47.6588, longitude: -117.426 },
    { city: "Tri-Cities", latitude: 46.2851, longitude: -119.2845 },
  ],
  "west-virginia": [{ city: "Charleston", latitude: 38.3498, longitude: -81.6326 }],
  wisconsin: [
    { city: "Milwaukee", latitude: 43.0389, longitude: -87.9065 },
    { city: "Madison", latitude: 43.0731, longitude: -89.4012 },
    { city: "Green Bay", latitude: 44.5133, longitude: -88.0133 },
  ],
  wyoming: [{ city: "Cheyenne", latitude: 41.14, longitude: -104.8202 }],
};

const countyOverrides: Record<string, Pick<CountySite, "primaryCity" | "localCities">> = {
  "texas/potter": { primaryCity: "Amarillo", localCities: ["Amarillo", "Bushland", "Bishop Hills"] },
  "texas/randall": { primaryCity: "Amarillo", localCities: ["Amarillo", "Canyon", "Lake Tanglewood", "Palisades", "Timbercreek Canyon"] },
};

export function getState(slugOrAbbr: string) {
  const normalized = slugOrAbbr.toLowerCase();
  return stateBySlug.get(normalized) || stateByAbbr.get(normalized);
}

export function getCounty(stateSlug: string, countySlug: string) {
  const state = getState(stateSlug);
  if (!state) return undefined;

  const normalizedCountySlug = countySlug.toLowerCase();
  const countyRecord = getCountyByState(state.name).find((county) => slugify(county.name) === normalizedCountySlug);
  if (!countyRecord) return undefined;

  const name = countyRecord.name;
  const override = countyOverrides[`${state.slug}/${countySlug.toLowerCase()}`];
  const centroid = getCountyCentroid(countyRecord.FIPS);
  const nearestMarkets =
    centroid && !override
      ? sortedStateHubsForCounty(state, centroid[0], centroid[1])
          .map((hub) => hub.city)
          .slice(0, 3)
      : [];
  const primaryCity = override?.primaryCity || nearestMarkets[0];
  const localCities = override?.localCities || nearestMarkets.slice(1);

  return {
    name,
    slug: normalizedCountySlug,
    fips: countyRecord.FIPS,
    displayName: `${name} County`,
    state,
    primaryCity,
    localCities,
    latitude: centroid?.[0],
    longitude: centroid?.[1],
  };
}

export function getStateMarketCities(state: StateSite, limit = 3) {
  return (stateNewsHubs[state.slug] || []).map((hub) => hub.city).slice(0, limit);
}

export function getCountyMarketCities(county: CountySite, limit = 2) {
  if (county.primaryCity || county.localCities.length) {
    return Array.from(new Set([county.primaryCity, ...county.localCities].filter(Boolean) as string[])).slice(0, limit);
  }
  const sortedHubs =
    county.latitude !== undefined && county.longitude !== undefined
      ? sortedStateHubsForCounty(county.state, county.latitude, county.longitude)
      : stateNewsHubs[county.state.slug] || [];

  return Array.from(new Set(sortedHubs.map((hub) => hub.city))).slice(0, limit);
}

function sortedStateHubsForCounty(state: StateSite, latitude: number, longitude: number) {
  return [...(stateNewsHubs[state.slug] || [])].sort(
    (a, b) =>
      haversineMiles(latitude, longitude, a.latitude, a.longitude) -
      haversineMiles(latitude, longitude, b.latitude, b.longitude),
  );
}

function haversineMiles(latA: number, lonA: number, latB: number, lonB: number) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
