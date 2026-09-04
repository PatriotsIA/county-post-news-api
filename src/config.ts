import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 8787),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "*"),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 30),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 3500),
  defaultLimit: Number(process.env.DEFAULT_LIMIT || 120),
  maxLimit: Number(process.env.MAX_LIMIT || 600),
  countyFallbackMinItems: Number(process.env.COUNTY_FALLBACK_MIN_ITEMS || 12),
  articleMaxAgeDays: Number(process.env.ARTICLE_MAX_AGE_DAYS || 183),
  freshnessFocusDays: Number(process.env.FRESHNESS_FOCUS_DAYS || 14),
  /**
   * Stories newer than this are ordered ahead of everything else, and older
   * bands follow in turn, so a county desk leads with the current news it has
   * without discarding the archive that keeps a thin feed populated.
   */
  recencyPrimaryDays: Number(process.env.RECENCY_PRIMARY_DAYS || 60),
  recencySecondaryDays: Number(process.env.RECENCY_SECONDARY_DAYS || 180),
  stateMarketLimit: Number(process.env.STATE_MARKET_LIMIT || 4),
  countyMarketLimit: Number(process.env.COUNTY_MARKET_LIMIT || 3),
  countyNearbyLimit: Number(process.env.COUNTY_NEARBY_LIMIT || 3),
  countyMarketTierEnabled: process.env.COUNTY_MARKET_TIER_ENABLED !== "false",
  countyAgencyQueryEnabled: process.env.COUNTY_AGENCY_QUERY_ENABLED !== "false",
  countyLocalSourceSearchEnabled: process.env.COUNTY_LOCAL_SOURCE_SEARCH_ENABLED !== "false",
  countyPublisherBalanceEnabled: process.env.COUNTY_PUBLISHER_BALANCE_ENABLED !== "false",
  countySinglePublisherMax: Number(process.env.COUNTY_SINGLE_PUBLISHER_MAX || 90),
  countyOtherSourcesTarget: Number(process.env.COUNTY_OTHER_SOURCES_TARGET || 90),
  /**
   * When one publisher supplies more than this, the desk reaches out for other
   * newsrooms. Deliberately much lower than the single-publisher cap: the cap
   * decides how many stories one outlet may end up contributing, this decides
   * when a feed looks too monotonous to leave alone. Tying the two together
   * meant raising the cap silently switched the diversity search off.
   */
  countyPublisherDiversityThreshold: Number(process.env.COUNTY_PUBLISHER_DIVERSITY_THRESHOLD || 12),
  countyPrimaryQueryLimit: Number(process.env.COUNTY_PRIMARY_QUERY_LIMIT || 8),
  countyMarketQueryLimit: Number(process.env.COUNTY_MARKET_QUERY_LIMIT || 6),
  // How many of a county's own towns are named in its search queries.
  countyPlaceQueryLimit: Number(process.env.COUNTY_PLACE_QUERY_LIMIT || 4),
  gdeltEnabled: process.env.GDELT_ENABLED !== "false",
  gdeltMaxRecords: Number(process.env.GDELT_MAX_RECORDS || 100),
  gdeltDocApi: "https://api.gdeltproject.org/api/v2/doc/doc",
  bingNewsEnabled: process.env.BING_NEWS_ENABLED !== "false",
  /**
   * Share of a feed's URL budget given to Bing. Both providers are used: Bing
   * surfaces results Google misses and supplies the publisher name Google
   * omits. It is simply far less productive per slot — measured across five
   * counties, Bing returned 0 to 9 items where Google returned 92 to 234 — so
   * it takes a minority of the budget rather than 40 percent of it.
   */
  bingNewsUrlShare: Number(process.env.BING_NEWS_URL_SHARE || 0.2),
  bingNewsSearch: "https://www.bing.com/news/search",
  pageSectionConcurrency: Number(process.env.PAGE_SECTION_CONCURRENCY || 2),
  upstreamConcurrency: Number(process.env.UPSTREAM_CONCURRENCY || 20),
  articleImageLookupLimit: Number(process.env.ARTICLE_IMAGE_LOOKUP_LIMIT || 30),
  maxRssUrlsPerFeed: Number(process.env.MAX_RSS_URLS_PER_FEED || 30),
  maxArticleQueriesPerFeed: Number(process.env.MAX_ARTICLE_QUERIES_PER_FEED || 10),
  googleNewsRssSearch: "https://news.google.com/rss/search",
  metalsProviderUrl: process.env.METALS_PROVIDER_URL || "https://mintedmetal.com/api/prices.json",
  metalsCacheTtlSeconds: Number(process.env.METALS_CACHE_TTL_SECONDS || 900),
  usdaMarsApiKey: process.env.USDA_MARS_API_KEY || process.env.MARS_API_KEY || "",
  fredApiKey: process.env.FRED_API_KEY || "",
  fredApiUrl: "https://api.stlouisfed.org/fred",
  fredCacheTtlSeconds: Number(process.env.FRED_CACHE_TTL_SECONDS || 21600),
  nwsApiBase: process.env.NWS_API_BASE || "https://api.weather.gov",
  nwsUserAgent:
    process.env.NWS_USER_AGENT ||
    "TheCountyPost/1.0 (https://thecountypost.com; contact@thecountypost.com)",
  weatherPointsCacheTtlSeconds: Number(process.env.WEATHER_POINTS_CACHE_TTL_SECONDS || 86400),
  weatherResponseCacheTtlSeconds: Number(process.env.WEATHER_RESPONSE_CACHE_TTL_SECONDS || 600),
  weatherAlertsCacheTtlSeconds: Number(process.env.WEATHER_ALERTS_CACHE_TTL_SECONDS || 180),
  usdmApiBase: process.env.USDM_API_BASE || "https://usdmdataservices.unl.edu",
  droughtCacheTtlSeconds: Number(process.env.DROUGHT_CACHE_TTL_SECONDS || 21600),
  nasaPowerApiBase: process.env.NASA_POWER_API_BASE || "https://power.larc.nasa.gov",
  rainfallHistoryDays: Number(process.env.RAINFALL_HISTORY_DAYS || 14),
  rainfallCacheTtlSeconds: Number(process.env.RAINFALL_CACHE_TTL_SECONDS || 86400),
  weatherTimeoutMs: Number(process.env.WEATHER_TIMEOUT_MS || 5000),
  atlasDataBucket: process.env.ATLAS_DATA_BUCKET || "",
  atlasDataPrefix: process.env.ATLAS_DATA_PREFIX || "",
  atlasCacheTtlSeconds: Number(process.env.ATLAS_CACHE_TTL_SECONDS || 3600),
  atlasManifestCacheTtlSeconds: Number(process.env.ATLAS_MANIFEST_CACHE_TTL_SECONDS || 300),
  atlasPublicCacheTtlSeconds: Number(process.env.ATLAS_PUBLIC_CACHE_TTL_SECONDS || 86400),
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
