import type { CountySite, FeedScope, NewsFeedItem, StateSite, Topic } from "./types.js";

export type DirectSource = {
  name: string;
  url: string;
  mediaType: NonNullable<NewsFeedItem["mediaType"]>;
  topics?: Topic[];
  states?: string[];
  markets?: string[];
  counties?: string[];
  trustedForMarketTier?: boolean;
};

export type CountyNativeSource = {
  name: string;
  websiteUrl: string;
  feedUrl?: string;
  outletTypes: Array<"newspaper" | "radio" | "television" | "digital">;
  aliases?: string[];
  topics?: Topic[];
  counties: string[];
};

/**
 * Reviewed county-native outlets. A profile can be used for targeted search
 * even when the publisher does not expose a usable RSS or Atom feed.
 */
const countyNativeSources: CountyNativeSource[] = [
  {
    name: "The Mena Star",
    websiteUrl: "https://www.menastar.com/",
    outletTypes: ["newspaper"],
    aliases: ["Mena Star", "MenaStar.com"],
    counties: ["arkansas/polk"],
  },
  {
    name: "My Pulse News / KENA",
    websiteUrl: "https://mypulsenews.com/",
    feedUrl: "https://mypulsenews.com/feed/",
    outletTypes: ["digital", "radio"],
    aliases: ["My Pulse News", "MyPulseNews.com", "KENA", "KENA Radio", "KENA 104.1 FM"],
    counties: ["arkansas/polk"],
  },
];

const directSources: DirectSource[] = [
  {
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    mediaType: "article",
    topics: ["general", "politics", "economy", "crime", "opinion"],
  },
  {
    name: "ABC7 Amarillo Local",
    url: "https://abc7amarillo.com/news/local.rss",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "ABC7 Amarillo Video",
    url: "https://abc7amarillo.com/news/videos.rss",
    mediaType: "video",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "ABC7 Amarillo Watch",
    url: "https://abc7amarillo.com/watch.rss",
    mediaType: "video",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains News",
    url: "https://www.myhighplains.com/news/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains Local News",
    url: "https://www.myhighplains.com/news/local-news/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains Today in Amarillo",
    url: "https://www.myhighplains.com/news/today-in-amarillo/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains Podcasts",
    url: "https://www.myhighplains.com/podcasts/feed/",
    mediaType: "podcast",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "Amarillo Tribune",
    url: "https://www.amarillotribune.org/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "KLTV East Texas News",
    url: "https://www.kltv.com/arc/outboundfeeds/rss/category/news/?outputType=xml",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "CBS19 Tyler News",
    url: "https://www.cbs19.tv/feeds/syndication/rss/news",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "KETK East Texas",
    url: "https://www.ketk.com/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "KETK Local News",
    url: "https://www.ketk.com/news/local-news/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "KETK Top Stories",
    url: "https://www.ketk.com/news/top-stories/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "Denver7 Local News",
    url: "https://www.denver7.com/news/local-news.rss",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "Denver7 News",
    url: "https://www.denver7.com/news.rss",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "CBS Colorado",
    url: "https://www.cbsnews.com/colorado/latest/rss/main",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "Denverite",
    url: "https://denverite.com/feed/",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "Westword",
    url: "https://www.westword.com/index.rss",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
];

export function getDirectSources(scope: FeedScope, topic: Topic, marketCities: string[] = []) {
  return allDirectSources().filter(
    (source) => sourceMatchesTopic(source, topic) && sourceMatchesScope(source, scope, marketCities),
  );
}

export function getCountyNativeSources(county: CountySite, topic?: Topic) {
  const countyKey = countySourceKey(county);
  return countyNativeSources.filter(
    (source) => source.counties.includes(countyKey) && (!topic || !source.topics?.length || source.topics.includes(topic)),
  );
}

export function getMarketSourcesForCounty(county: CountySite, topic: Topic, marketCities: string[]) {
  const markets = marketCities.map((city) => city.toLowerCase());
  return allDirectSources().filter(
    (source) =>
      sourceMatchesTopic(source, topic) &&
      source.trustedForMarketTier !== false &&
      source.states?.includes(county.state.slug) === true &&
      source.markets?.some((market) => markets.includes(market.toLowerCase())) === true,
  );
}

export function isTrustedMarketSource(item: NewsFeedItem, sources: DirectSource[]) {
  const sourceName = item.source?.trim().toLowerCase();
  if (sourceName && sources.some((source) => source.name.toLowerCase() === sourceName)) return true;
  const itemDomain = hostname(item.link);
  return Boolean(itemDomain && sources.some((source) => hostname(source.url) === itemDomain));
}

export function isTrustedCountySource(item: NewsFeedItem, sources: DirectSource[], county: CountySite) {
  const countyKey = countySourceKey(county);
  const countySources = sources.filter((source) => source.counties?.includes(countyKey));
  const itemDomain = hostname(item.link);
  if (itemDomain && countySources.some((source) => hostname(source.url) === itemDomain)) return true;

  const nativeSources = getCountyNativeSources(county);
  if (itemDomain && nativeSources.some((source) => hostname(source.websiteUrl) === itemDomain)) return true;

  if (!isSearchAggregatorDomain(itemDomain)) return false;
  const sourceName = normalizePublisherName(item.source);
  return Boolean(
    sourceName &&
      nativeSources.some((source) =>
        [source.name, ...(source.aliases || [])].some((alias) => normalizePublisherName(alias) === sourceName),
      ),
  );
}

function sourceMatchesTopic(source: DirectSource, topic: Topic) {
  return !source.topics?.length || source.topics.includes(topic);
}

function allDirectSources(): DirectSource[] {
  return [
    ...directSources,
    ...countyNativeSources.flatMap((source) =>
      source.feedUrl
        ? [
            {
              name: source.name,
              url: source.feedUrl,
              mediaType: "article" as const,
              topics: source.topics,
              counties: source.counties,
            },
          ]
        : [],
    ),
  ];
}

function sourceMatchesScope(source: DirectSource, scope: FeedScope, marketCities: string[]) {
  if (scope.level === "national") return !source.states?.length && !source.markets?.length && !source.counties?.length;

  const state = scope.level === "state" ? scope.state : scope.county.state;
  if (scope.level === "state") {
    return Boolean(source.states?.includes(state.slug) && !source.markets?.length && !source.counties?.length);
  }

  if (scope.level === "county") {
    const countyKey = countySourceKey(scope.county);
    if (source.counties?.includes(countyKey)) return true;
    const markets = marketCities.map((city) => city.toLowerCase());
    return Boolean(source.markets?.some((market) => markets.includes(market)));
  }

  return false;
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSearchAggregatorDomain(domain: string) {
  return domain === "news.google.com" || domain === "bing.com" || domain.endsWith(".bing.com");
}

function normalizePublisherName(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function countySourceKey(county: CountySite) {
  return `${county.state.slug}/${county.slug}`;
}
