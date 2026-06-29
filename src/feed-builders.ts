import { config } from "./config.js";
import { getCountyMarketCities, getStateMarketCities } from "./geo.js";
import { getDirectSources, type DirectSource } from "./source-registry.js";
import type { CountySite, FeedScope, StateSite, Topic } from "./types.js";

type FeedPlan = {
  rssUrls: string[];
  directSources: DirectSource[];
  articleQueries: string[];
  sourcesUsed: string[];
};

export const topics: Topic[] = ["general", "sports", "politics", "economy", "crime", "obituaries", "opinion"];

const topicQueries: Record<Topic, string[]> = {
  general: ["news", "breaking news", "top stories", "local news"],
  sports: ["sports", "high school sports", "college sports", "football", "basketball", "baseball"],
  politics: ["politics", "election", "legislature", "governor", "council", "commission"],
  economy: ["economy", "business", "jobs", "housing market", "development", "industry"],
  crime: ["crime", "courts", "police", "sheriff", "arrests", "trial"],
  obituaries: ["obituaries", "obituary", "funeral home", "death notice"],
  opinion: ["opinion", "editorial", "column", "commentary", "op-ed"],
};

const nationalQueries: Record<Topic, string[]> = {
  general: ["United States news", "U.S. news", "national news", "breaking news"],
  sports: ["United States sports", "NFL", "NBA", "MLB", "college sports", "high school sports"],
  politics: ["United States politics", "Congress", "White House", "federal government", "elections"],
  economy: ["United States economy", "business", "jobs", "housing market", "markets", "Federal Reserve"],
  crime: ["United States crime", "courts", "justice department", "police", "public safety"],
  obituaries: ["United States obituaries", "obituary", "funeral", "death notice"],
  opinion: ["United States opinion", "editorial", "column", "commentary", "op-ed"],
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

  return buildCountyPlan(scope.county, topic);
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

function buildCountyPlan(county: CountySite, topic: Topic): FeedPlan {
  const countyTopic = countyTopicQueries(topic).join(" OR ");
  const marketCities = getCountyMarketCities(county, config.countyMarketLimit);
  const queries = buildCountyQueries(county, marketCities, countyTopic);
  const directSources = getDirectSources({ level: "county", state: county.state, county }, topic, marketCities);

  return {
    rssUrls: urlsForQueries(queries),
    directSources,
    articleQueries: queriesForArticleSearch(queries),
    sourcesUsed: ["county", ...marketCities.map((city) => `market:${city}`), "provider:google-news-rss", "provider:bing-news-rss", "provider:gdelt", ...directSources.map((source) => `direct:${source.name}`)],
  };
}

function buildCountyQueries(county: CountySite, marketCities: string[], countyTopic: string) {
  const state = county.state;
  const currentTerms = `"latest" OR "today" OR "breaking" OR "local news" OR "community" OR "public safety"`;
  const countyNames = [
    `"${county.name} County"`,
    `"${county.name} County ${state.name}"`,
    `"${county.name} County ${state.abbr}"`,
    `"${county.name} ${state.abbr}"`,
  ];

  const countyQueries = [
    `(${countyNames.join(" OR ")}) (${countyTopic})`,
    `(${countyNames.join(" OR ")}) ("breaking news" OR "local news" OR "community" OR "public safety" OR "business")`,
    `(${countyNames.join(" OR ")}) (${currentTerms})`,
    `("${county.displayName}" "${state.name}")`,
    `("${county.displayName}" "${state.abbr}")`,
  ];

  const marketQueries = marketCities.flatMap((city) => [
    `("${city}" "${county.name} County")`,
    `("${city} ${state.name}" OR "${city} ${state.abbr}") (${countyTopic})`,
    `("${city}" "${state.abbr}" ("local news" OR "breaking news"))`,
  ]);

  return Array.from(new Set([...countyQueries.slice(0, 2), ...marketQueries, ...countyQueries.slice(2)]));
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
