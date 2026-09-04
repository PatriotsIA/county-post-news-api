import { getCountyByState as getCountyByStateRaw } from "@nickgraffis/us-counties";

export type UsCounty = { FIPS: string; name: string; state: string };

export function getCountyByState(stateName: string) {
  return getCountyByStateRaw(stateName) as UsCounty[];
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** One publisher seen writing about a county, before any feed probing. */
export type PublisherObservation = {
  host: string;
  publisher: string;
  /** Items from this host in the county's raw search results. */
  items: number;
  /** Of those, how many named the county or one of its towns. */
  localItems: number;
  sampleLinks: string[];
};

export type CountyDiscovery = {
  key: string;
  stateSlug: string;
  countySlug: string;
  countyName: string;
  stateName: string;
  fips: string;
  places: string[];
  itemsSeen: number;
  discoveredAt: string;
  publishers: PublisherObservation[];
};

/** A publisher's feed, once probed and validated. */
export type ProbedFeed = {
  url: string;
  items: number;
  recentItems: number;
  localItems: number;
};

export type ProbedHost = {
  host: string;
  publisher: string;
  websiteUrl: string;
  status: "ok" | "no-feed" | "unreachable" | "not-local";
  feeds: ProbedFeed[];
  /** Counties this host was observed covering, strongest first. */
  counties: string[];
  probedAt: string;
  note?: string;
};
