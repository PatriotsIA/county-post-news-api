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
  /** Local item count per feed category, so a registry entry can be scoped. */
  localByTopic: Record<string, number>;
  sampleLinks: string[];
};

export type CountyDiscovery = {
  key: string;
  topics: string[];
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

/**
 * Hosts that surface for many counties without being anyone's local newsroom:
 * aggregators that republish other outlets, statewide and national wires, and
 * trade press that happened to match a county because of one industry story.
 * Excluded from the registry regardless of how often they appear.
 */
export const EXCLUDED_PUBLISHER_HOSTS = new Set([
  // Aggregators and syndicators.
  "aol.com",
  "msn.com",
  "yahoo.com",
  "news.yahoo.com",
  "newsbreak.com",
  "flipboard.com",
  "smartnews.com",
  "headtopics.com",
  "newsbreakapp.com",
  // Statewide and national wires.
  "thecentersquare.com",
  "courthousenews.com",
  "texastribune.org",
  "texasobserver.org",
  "stateline.org",
  "governing.com",
  "usnews.com",
  // Metro dailies whose coverage is regional rather than county-scoped. They
  // remain reachable through the market tier.
  "dallasnews.com",
  "chron.com",
  "houstonchronicle.com",
  "expressnews.com",
  "mysanantonio.com",
  "statesman.com",
  "star-telegram.com",
  // Trade and vertical press.
  "datacenterdynamics.com",
  "markets.businessinsider.com",
  "businessinsider.com",
  "bisnow.com",
  "law360.com",
]);
