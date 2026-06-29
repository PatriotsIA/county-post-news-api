import type { CountySite, FeedScope, NewsFeedItem, StateSite, Topic } from "./types.js";

export type DirectSource = {
  name: string;
  url: string;
  mediaType: NonNullable<NewsFeedItem["mediaType"]>;
  topics?: Topic[];
  states?: string[];
  markets?: string[];
  counties?: string[];
};

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
  return directSources.filter((source) => sourceMatchesTopic(source, topic) && sourceMatchesScope(source, scope, marketCities));
}

function sourceMatchesTopic(source: DirectSource, topic: Topic) {
  return !source.topics?.length || source.topics.includes(topic);
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

function countySourceKey(county: CountySite) {
  return `${county.state.slug}/${county.slug}`;
}
