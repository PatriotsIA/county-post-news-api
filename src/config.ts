import "dotenv/config";

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
  countyNearbyLimit: Number(process.env.COUNTY_NEARBY_LIMIT || 3),
  countyMarketTierEnabled: process.env.COUNTY_MARKET_TIER_ENABLED !== "false",
  countyAgencyQueryEnabled: process.env.COUNTY_AGENCY_QUERY_ENABLED !== "false",
  countyPrimaryQueryLimit: Number(process.env.COUNTY_PRIMARY_QUERY_LIMIT || 4),
  countyMarketQueryLimit: Number(process.env.COUNTY_MARKET_QUERY_LIMIT || 4),
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
  metalsApiKey: process.env.METALS_API_KEY || "",
  metalsApiUrl: "https://api.metals.dev/v1/latest",
  metalsCacheTtlSeconds: Number(process.env.METALS_CACHE_TTL_SECONDS || 60),
  usdaMarsApiKey: process.env.USDA_MARS_API_KEY || process.env.MARS_API_KEY || "",
  stripePublishableKey: process.env.STRIPE_PK_KEY || "",
  stripeSecretKey: process.env.STRIPE_SK_KEY || "",
  checkoutSuccessUrl: process.env.STRIPE_CHECKOUT_SUCCESS_URL || "",
  checkoutCancelUrl: process.env.STRIPE_CHECKOUT_CANCEL_URL || "",
  advertisingCreativeBucket: process.env.ADVERTISING_CREATIVE_BUCKET || "",
  advertisingCreativeMaxBytes: Number(process.env.ADVERTISING_CREATIVE_MAX_BYTES || 10 * 1024 * 1024),
};

function parseCorsOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/g, ""))
    .filter(Boolean);
}
