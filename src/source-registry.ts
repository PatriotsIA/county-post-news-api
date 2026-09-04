import { discoveredCountyNativeSources, discoveredRegionalSources } from "./county-discovered-sources.js";
import type { CountySite, FeedScope, NewsFeedItem, StateSite, Topic } from "./types.js";

export type DirectSource = {
  name: string;
  url: string;
  mediaType: NonNullable<NewsFeedItem["mediaType"]>;
  itemSource?: string;
  topics?: Topic[];
  states?: string[];
  markets?: string[];
  counties?: string[];
  maxAgeDays?: number;
  maxItems?: number;
  trustedForMarketTier?: boolean;
  /**
   * Whether an item from this source counts as county-local purely because it
   * came from here. True for an outlet that only covers this county; false for
   * a regional newsroom listed against a county so its feed is fetched, whose
   * stories must still name the county or one of its towns to appear. Without
   * the distinction, adding KLTV to the twenty East Texas counties it serves
   * would put all of East Texas on each of their desks.
   */
  trustedForCountyTier?: boolean;
};

export type CountyNativeFeed = {
  name?: string;
  url: string;
  topics?: Topic[];
  maxAgeDays?: number;
  maxItems?: number;
};

export type CountyNativeSource = {
  name: string;
  websiteUrl: string;
  feeds?: CountyNativeFeed[];
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
    feeds: [
      {
        url: "https://mypulsenews.com/feed/",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA page 2",
        url: "https://mypulsenews.com/feed/?paged=2",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA page 3",
        url: "https://mypulsenews.com/feed/?paged=3",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA page 4",
        url: "https://mypulsenews.com/feed/?paged=4",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA local news",
        url: "https://mypulsenews.com/category/news/feed/",
        topics: ["general", "politics", "economy", "crime"],
      },
      {
        name: "My Pulse News / KENA sports archive",
        url: "https://mypulsenews.com/category/sports/feed/",
        topics: ["sports"],
        maxAgeDays: 1_095,
        maxItems: 8,
      },
    ],
    outletTypes: ["digital", "radio"],
    aliases: ["My Pulse News", "MyPulseNews.com", "KENA", "KENA Radio", "KENA 104.1 FM"],
    counties: ["arkansas/polk"],
  },

  // Texas outlets promoted from the discovery review queue. Each was checked
  // against the county it covers before being trusted here: Athens is the
  // Henderson County seat, Gilmer the Upshur County seat, and so on. Trust
  // means every story these publish reaches that county's desk without having
  // to name it, which is what a county paper's own coverage deserves and what
  // a regional wire must never get.
  {
    // No usable RSS, but the profile still earns its place: it produces a
    // targeted site: search and lets the filter trust what that search returns.
    // This is how the Lufkin Daily News became Angelina County's top source.
    name: "The Lufkin Daily News",
    websiteUrl: "https://lufkindailynews.com/",
    outletTypes: ["newspaper"],
    aliases: ["Lufkin Daily News", "lufkindailynews.com"],
    counties: ["texas/angelina"],
  },
  {
    name: "Amarillo Globe-News",
    websiteUrl: "https://www.amarillo.com/",
    outletTypes: ["newspaper"],
    aliases: ["Amarillo Globe News", "amarillo.com"],
    // Amarillo straddles both counties, so its newsroom is native to each.
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "The Athens Review",
    websiteUrl: "https://athensreview.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/henderson"],
    feeds: [
      { url: "http://www.athensreview.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "Bluebonnet News",
    websiteUrl: "https://bluebonnetnews.com/",
    outletTypes: ["digital"],
    counties: ["texas/liberty"],
    feeds: [
      { url: "https://bluebonnetnews.com/feed/" },
      { url: "https://bluebonnetnews.com/comments/feed/" },
    ],
  },
  {
    name: "Cross Timbers Gazette",
    websiteUrl: "https://crosstimbersgazette.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/denton"],
    feeds: [
      { url: "https://www.crosstimbersgazette.com/feed/" },
      { url: "https://crosstimbersgazette.com/feed/" },
    ],
  },
  {
    name: "Denton Record-Chronicle",
    websiteUrl: "https://dentonrc.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/denton"],
    feeds: [
      { url: "http://dentonrc.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "Eagle Pass Business Journal",
    websiteUrl: "https://epbusinessjournal.com/",
    outletTypes: ["digital"],
    counties: ["texas/maverick"],
    feeds: [
      { url: "https://epbusinessjournal.com/feed/" },
      { url: "https://epbusinessjournal.com/rss" },
    ],
  },
  {
    name: "The Galveston County Daily News",
    websiteUrl: "https://galvnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/galveston"],
    feeds: [
      { url: "http://www.galvnews.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "The Gilmer Mirror",
    websiteUrl: "https://gilmermirror.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/upshur"],
    feeds: [
      { url: "https://www.gilmermirror.com/feed/" },
      { url: "https://www.gilmermirror.com/comments/feed/" },
    ],
  },
  {
    name: "The Herald-Banner",
    websiteUrl: "https://heraldbanner.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hunt"],
    feeds: [
      { url: "http://www.heraldbanner.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "The Huntsville Item",
    websiteUrl: "https://itemonline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/walker"],
    feeds: [
      { url: "http://www.itemonline.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "KAGS",
    websiteUrl: "https://kagstv.com/",
    outletTypes: ["television"],
    counties: ["texas/brazos"],
    feeds: [
      { url: "https://www.kagstv.com/feeds/syndication/rss/news" },
    ],
  },
  {
    name: "Levelland & Hockley County News Press",
    websiteUrl: "https://levellandnews.net/",
    outletTypes: ["newspaper"],
    counties: ["texas/hockley"],
    feeds: [
      { url: "https://levellandnews.net/rss.xml" },
    ],
  },
  {
    name: "News Channel 6",
    websiteUrl: "https://newschannel6now.com/",
    outletTypes: ["television"],
    counties: ["texas/wichita"],
    feeds: [
      { url: "https://newschannel6now.com/arc/outboundfeeds/rss/?outputType=xml" },
    ],
  },
  {
    name: "The Paris News",
    websiteUrl: "https://theparisnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/lamar"],
    feeds: [
      { url: "http://theparisnews.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "Royse City Herald-Banner",
    websiteUrl: "https://roysecityheraldbanner.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/rockwall"],
    feeds: [
      { url: "http://www.roysecityheraldbanner.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "San Antonio Report",
    websiteUrl: "https://sanantonioreport.org/",
    outletTypes: ["digital"],
    counties: ["texas/bexar"],
    feeds: [
      { url: "https://sanantonioreport.org/feed/" },
      { url: "https://sanantonioreport.org/rss" },
    ],
  },
  {
    name: "Seguin Today",
    websiteUrl: "https://seguintoday.com/",
    outletTypes: ["digital"],
    counties: ["texas/guadalupe"],
    feeds: [
      { url: "https://seguintoday.com/feed/" },
      { url: "https://seguintoday.com/rss" },
    ],
  },
  {
    name: "Texoma's Homepage",
    websiteUrl: "https://texomashomepage.com/",
    outletTypes: ["television"],
    counties: ["texas/wichita", "texas/archer"],
    feeds: [
      { url: "https://www.texomashomepage.com/feed/" },
      { url: "https://www.texomashomepage.com/comments/feed/" },
    ],
  },
  {
    name: "The University Star",
    websiteUrl: "https://universitystar.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hays"],
    feeds: [
      { url: "https://universitystar.com/feed/" },
      { url: "https://universitystar.com/feed/atom/" },
    ],
  },
  {
    name: "NewsChannel 10",
    websiteUrl: "https://newschannel10.com/",
    outletTypes: ["television"],
    counties: ["texas/potter", "texas/randall"],
    feeds: [
      { url: "https://www.newschannel10.com/arc/outboundfeeds/rss/?outputType=xml" },
    ],
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

/** Reviewed outlets first, then the ones discovery observed. */
function allCountyNativeSources(): CountyNativeSource[] {
  return [...countyNativeSources, ...discoveredCountyNativeSources];
}

export function getCountyNativeSources(county: CountySite, topic?: Topic) {
  const countyKey = countySourceKey(county);
  return allCountyNativeSources().filter(
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

/**
 * Hostnames whose stories count as county-local without naming the county.
 *
 * Published in the API response because the browser re-checks locality on what
 * it receives and has no copy of this registry: it was discarding items the API
 * had accepted through exactly this rule, which is why county desks showed a
 * handful of stories out of the fifty they were sent.
 */
export function trustedCountyHosts(county: CountySite): string[] {
  const countyKey = countySourceKey(county);
  const hosts = [
    ...allDirectSources()
      .filter((source) => source.counties?.includes(countyKey) && source.trustedForCountyTier !== false)
      .map((source) => hostname(source.url)),
    ...getCountyNativeSources(county).map((source) => hostname(source.websiteUrl)),
  ];
  return Array.from(new Set(hosts.filter(Boolean)));
}

export function isTrustedCountySource(item: NewsFeedItem, sources: DirectSource[], county: CountySite) {
  const countyKey = countySourceKey(county);
  const countySources = sources.filter(
    (source) => source.counties?.includes(countyKey) && source.trustedForCountyTier !== false,
  );
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
    ...discoveredRegionalSources,
    ...allCountyNativeSources().flatMap((source) =>
      (source.feeds || []).map((feed) => ({
        name: feed.name || source.name,
        url: feed.url,
        mediaType: "article" as const,
        itemSource: source.name,
        topics: feed.topics || source.topics,
        counties: source.counties,
        maxAgeDays: feed.maxAgeDays,
        maxItems: feed.maxItems,
      })),
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
