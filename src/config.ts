export const config = {
  port: Number(process.env.PORT || 8787),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "*"),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 30),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 3500),
  defaultLimit: Number(process.env.DEFAULT_LIMIT || 48),
  maxLimit: Number(process.env.MAX_LIMIT || 200),
  countyFallbackMinItems: Number(process.env.COUNTY_FALLBACK_MIN_ITEMS || 12),
  articleMaxAgeDays: Number(process.env.ARTICLE_MAX_AGE_DAYS || 183),
  freshnessFocusDays: Number(process.env.FRESHNESS_FOCUS_DAYS || 14),
  stateMarketLimit: Number(process.env.STATE_MARKET_LIMIT || 4),
  countyMarketLimit: Number(process.env.COUNTY_MARKET_LIMIT || 3),
  gdeltEnabled: process.env.GDELT_ENABLED !== "false",
  gdeltMaxRecords: Number(process.env.GDELT_MAX_RECORDS || 100),
  gdeltDocApi: "https://api.gdeltproject.org/api/v2/doc/doc",
  bingNewsEnabled: process.env.BING_NEWS_ENABLED !== "false",
  bingNewsSearch: "https://www.bing.com/news/search",
  pageSectionConcurrency: Number(process.env.PAGE_SECTION_CONCURRENCY || 2),
  upstreamConcurrency: Number(process.env.UPSTREAM_CONCURRENCY || 12),
  articleImageLookupLimit: Number(process.env.ARTICLE_IMAGE_LOOKUP_LIMIT || 18),
  maxRssUrlsPerFeed: Number(process.env.MAX_RSS_URLS_PER_FEED || 18),
  maxArticleQueriesPerFeed: Number(process.env.MAX_ARTICLE_QUERIES_PER_FEED || 6),
  googleNewsRssSearch: "https://news.google.com/rss/search",
};

function parseCorsOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/g, ""))
    .filter(Boolean);
}
