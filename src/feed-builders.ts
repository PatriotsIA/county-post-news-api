import { config } from "./config.js";
import { getCountyPlaceTerms, getStateMarketCities } from "./geo.js";
import { getDirectSources, getMarketSourcesForCounty, type DirectSource } from "./source-registry.js";
import type { CountySite, FeedScope, StateSite, Topic } from "./types.js";

export type FeedPlan = {
  rssUrls: string[];
  directSources: DirectSource[];
  articleQueries: string[];
  sourcesUsed: string[];
};

export const topics: Topic[] = [
  "general", "sports", "politics", "economy", "crime", "weather", "obituaries", "opinion",
  "monetary-policy", "markets-investing", "jobs-business",
  "property-taxes", "municipal-bonds", "budgets-levies",
  "voting-systems", "election-administration", "audits-recounts", "open-records",
];

const topicQueries: Record<Topic, string[]> = {
  general: ["news", "breaking news", "top stories", "local news"],
  sports: ["sports", "high school sports", "college sports", "football", "basketball", "baseball"],
  politics: ["politics", "election", "legislature", "governor", "council", "commission"],
  economy: ["economy", "business", "jobs", "housing market", "development", "industry"],
  crime: ["crime", "courts", "police", "sheriff", "arrests", "trial"],
  weather: ["weather", "forecast", "storm", "tornado", "hurricane", "flood", "snow", "heat", "drought"],
  obituaries: ["obituaries", "obituary", "funeral home", "death notice"],
  opinion: ["opinion", "editorial", "column", "commentary", "op-ed"],
  "monetary-policy": ["inflation", "interest rates", "Federal Reserve", "central bank", "currency policy"],
  "markets-investing": ["markets", "commodities", "stocks", "bonds", "investing", "business cycle"],
  "jobs-business": ["jobs", "employment", "employer", "small business", "industry", "economic development"],
  "property-taxes": ["property taxes", "tax assessment", "appraisal", "tax levy", "homestead exemption"],
  "municipal-bonds": ["municipal bond", "school bond", "bond election", "public debt", "bond proposal"],
  "budgets-levies": ["public budget", "county budget", "city budget", "school budget", "tax rate", "public finance"],
  "voting-systems": ["voting systems", "ballot processing", "voting equipment", "ballot certification", "election technology"],
  "election-administration": ["election administration", "election office", "polling place", "voter registration", "election date"],
  "audits-recounts": ["election audit", "recount", "canvass", "post-election review", "election results certification"],
  "open-records": ["public records", "open records", "freedom of information", "FOIA", "government transparency"],
};

const nationalQueries: Record<Topic, string[]> = {
  general: ["United States news", "U.S. news", "national news", "breaking news"],
  sports: ["United States sports", "NFL", "NBA", "MLB", "college sports", "high school sports"],
  politics: ["United States politics", "Congress", "White House", "federal government", "elections"],
  economy: ["United States economy", "business", "jobs", "housing market", "markets", "Federal Reserve"],
  crime: ["United States crime", "courts", "justice department", "police", "public safety"],
  weather: ["United States weather", "forecast", "storm", "tornado", "hurricane", "flood", "snow", "heat", "drought"],
  obituaries: ["United States obituaries", "obituary", "funeral", "death notice"],
  opinion: ["United States opinion", "editorial", "column", "commentary", "op-ed"],
  "monetary-policy": ["United States inflation", "interest rates", "Federal Reserve", "central bank", "currency policy"],
  "markets-investing": ["United States markets", "commodities", "stocks", "bonds", "investing"],
  "jobs-business": ["United States jobs", "employment", "small business", "industry", "economic development"],
  "property-taxes": ["United States property taxes", "tax assessment", "appraisal", "homestead exemption"],
  "municipal-bonds": ["municipal bonds", "school bonds", "public debt", "bond elections"],
  "budgets-levies": ["public budgets", "local government finance", "tax rates", "school finance"],
  "voting-systems": ["United States voting systems", "ballot processing", "voting equipment", "election certification"],
  "election-administration": ["United States election administration", "voter registration", "polling places", "election offices"],
  "audits-recounts": ["United States election audits", "recounts", "canvass", "election certification"],
  "open-records": ["United States public records", "open records", "FOIA", "government transparency"],
};

export function buildFeedPlan(scope: FeedScope, topic: Topic): FeedPlan {
  if (scope.level === "national") {
    const terms = nationalQueries[topic];
    const queries = [`(${terms.join(" OR ")})`, `"United States" (${terms.join(" OR ")})`];
    const directSources = getDirectSources(scope, topic);
    return {
      rssUrls: urlsForQueries(queries),
      directSources,
      articleQueries: queriesForArticleSearch(queries),
      sourcesUsed: ["national", "provider:google-news-rss", "provider:bing-news-rss", "provider:gdelt", ...directSources.map((source) => `direct:${source.name}`)],
    };
  }

  if (scope.level === "state") {
    return buildStatePlan(scope.state, topic);
  }

  return buildCountyPrimaryPlan(scope.county, topic);
}

function buildStatePlan(state: StateSite, topic: Topic): FeedPlan {
  const hubs = getStateMarketCities(state, config.stateMarketLimit);
  const directSources = getDirectSources({ level: "state", state }, topic, hubs);
  if (topic === "general") {
    const queries = [
      `"${state.name}" ("news" OR "politics" OR "legislature" OR "governor" OR "economy" OR "crime")`,
      `"${state.name}" ("breaking news" OR "top stories" OR "local news")`,
      `"${state.name}" ("state legislature" OR "governor" OR "attorney general" OR "supreme court")`,
      ...hubs.map((city) => `"${city} ${state.name}" OR "${city} ${state.abbr}"`),
    ];
    return {
      rssUrls: urlsForQueries(queries),
      directSources,
      articleQueries: queriesForArticleSearch(queries),
      sourcesUsed: ["state", ...hubs.map((city) => `market:${city}`), "provider:google-news-rss", "provider:bing-news-rss", "provider:gdelt", ...directSources.map((source) => `direct:${source.name}`)],
    };
  }

  const topicQuery = topicQueries[topic].join(" OR ");
  const queries = [
    `"${state.name}" (${topicQuery})`,
    `"${state.abbr}" "${state.name}" (${topicQuery})`,
    ...hubs.map((city) => `"${city} ${state.name}" (${topicQuery})`),
  ];
  return {
    rssUrls: urlsForQueries(queries),
    directSources,
    articleQueries: queriesForArticleSearch(queries),
    sourcesUsed: ["state", ...hubs.map((city) => `market:${city}`), "provider:google-news-rss", "provider:bing-news-rss", "provider:gdelt", ...directSources.map((source) => `direct:${source.name}`)],
  };
}

export function buildCountyPrimaryPlan(county: CountySite, topic: Topic): FeedPlan {
  const countyTopic = countyTopicQueries(topic).join(" OR ");
  const queries = buildCountyPrimaryQueries(county, countyTopic).slice(0, config.countyPrimaryQueryLimit);
  const directSources = getDirectSources({ level: "county", state: county.state, county }, topic, []);

  return {
    rssUrls: urlsForQueries(queries),
    directSources,
    articleQueries: queriesForArticleSearch(queries),
    sourcesUsed: ["county:primary", "provider:google-news-rss", "provider:bing-news-rss", "provider:gdelt", ...directSources.map((source) => `direct:${source.name}`)],
  };
}

export function buildCountyMarketPlan(county: CountySite, topic: Topic): FeedPlan {
  const marketCities = getCountyPlaceTerms(county, config.countyMarketLimit);
  const countyTopic = countyTopicQueries(topic).join(" OR ");
  const queries = marketCities
    .flatMap((city) => [
      `("${city}" "${county.state.name}") (${countyTopic})`,
      `("${city}" "${county.state.name}") ("local news" OR "breaking news" OR sheriff OR police OR schools OR courthouse)`,
    ])
    .slice(0, config.countyMarketQueryLimit);
  const directSources = getMarketSourcesForCounty(county, topic, marketCities);

  return {
    rssUrls: urlsForQueries(queries),
    directSources,
    articleQueries: queriesForArticleSearch(queries),
    sourcesUsed: [
      "county:market",
      ...marketCities.map((city) => `market:${city}`),
      "provider:google-news-rss",
      "provider:bing-news-rss",
      "provider:gdelt",
      ...directSources.map((source) => `direct:${source.name}`),
    ],
  };
}

export function buildCountyFallbackPlan(county: CountySite, nearbyCounties: CountySite[], topic: Topic): FeedPlan {
  const countyTopic = countyTopicQueries(topic).join(" OR ");
  const queries = nearbyCounties.flatMap((nearbyCounty) => [
    `("${nearbyCounty.displayName}" "${county.state.name}") (${countyTopic})`,
    `("${nearbyCounty.displayName}" "${county.state.name}") ("breaking news" OR "local news" OR "community" OR "public safety" OR "business")`,
  ]);

  return {
    rssUrls: urlsForQueries(queries),
    directSources: [],
    articleQueries: queriesForArticleSearch(queries),
    sourcesUsed: ["county:fallback-nearby", ...nearbyCounties.map((nearbyCounty) => `nearby:${nearbyCounty.slug}`), "provider:google-news-rss", "provider:bing-news-rss", "provider:gdelt"],
  };
}

function buildCountyPrimaryQueries(county: CountySite, countyTopic: string) {
  const state = county.state;
  const agencyQuery = `"${county.displayName}" "${state.name}" (sheriff OR police OR courthouse OR "school district" OR "city council" OR commissioners)`;
  return [
    `("${county.displayName}" "${state.name}") (${countyTopic})`,
    `("${county.displayName}" "${state.name}") ("breaking news" OR "local news" OR "community" OR "public safety" OR "business")`,
    `("${county.displayName}" "${state.name}")`,
    ...(config.countyAgencyQueryEnabled ? [agencyQuery] : []),
  ];
}

function countyTopicQueries(topic: Topic) {
  if (topic === "general") return ["local news", "community news"];
  if (topic === "sports") return ["high school sports", "college sports", "football", "basketball", "baseball", "softball"];
  return topicQueries[topic];
}

function googleNewsRssUrl(query: string) {
  const url = new URL(config.googleNewsRssSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

function urlsForQueries(queries: string[]) {
  const googleUrls = googleUrlsForQueries(queries);
  const bingUrls = config.bingNewsEnabled ? bingUrlsForQueries(queries) : [];
  if (!bingUrls.length) return googleUrls.slice(0, config.maxRssUrlsPerFeed);

  const bingBudget = Math.max(1, Math.ceil(config.maxRssUrlsPerFeed * 0.4));
  const googleBudget = Math.max(1, config.maxRssUrlsPerFeed - bingBudget);
  return Array.from(new Set([...bingUrls.slice(0, bingBudget), ...googleUrls.slice(0, googleBudget)])).slice(
    0,
    config.maxRssUrlsPerFeed,
  );
}

function googleUrlsForQueries(queries: string[]) {
  const expanded = queries.flatMap((query) => [
    // Google News supports `when:` search operators; keep the search recent while still filling sparse counties.
    `${query} when:1d`,
    `${query} when:7d`,
    `${query} when:${config.articleMaxAgeDays}d`,
  ]);
  return Array.from(new Set(expanded.map(googleNewsRssUrl)));
}

function bingUrlsForQueries(queries: string[]) {
  const expanded = queries.flatMap((query) => [
    { query, freshness: "Day" },
    { query, freshness: "Week" },
  ]);
  return Array.from(new Set(expanded.map(({ query, freshness }) => bingNewsRssUrl(query, freshness))));
}

function bingNewsRssUrl(query: string, freshness: string) {
  const url = new URL(config.bingNewsSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("mkt", "en-US");
  url.searchParams.set("setlang", "en-US");
  url.searchParams.set("cc", "US");
  url.searchParams.set("freshness", freshness);
  return url.toString();
}

function queriesForArticleSearch(queries: string[]) {
  return Array.from(new Set(queries)).slice(0, config.maxArticleQueriesPerFeed);
}
