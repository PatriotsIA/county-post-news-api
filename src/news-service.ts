import { cached } from "./cache.js";
import { config } from "./config.js";
import { buildFeedPlan, topics } from "./feed-builders.js";
import { filterItems } from "./filter.js";
import { fetchGdeltItems } from "./gdelt.js";
import { fetchRssItems } from "./rss.js";
import type { FeedResponse, FeedScope, NewsFeedItem, PageResponse, Topic } from "./types.js";

export async function getFeed(scope: FeedScope, topic: Topic, limit: number): Promise<FeedResponse> {
  const cappedLimit = capLimit(limit);
  const cacheKey = `feed:${scopeKey(scope)}:${topic}`;
  const feed = await cached(cacheKey, config.cacheTtlSeconds, async () => {
    const plan = buildFeedPlan(scope, topic);
    const [rssResults, directResults, gdeltResults] = await Promise.all([
      settleLimited(plan.rssUrls, (url) => fetchRssItems(url)),
      settleLimited(plan.directSources, (source) => fetchRssItems(source.url, { source: source.name, mediaType: source.mediaType })),
      settleLimited(plan.articleQueries, (query) => fetchGdeltItems(query)),
    ]);
    const items = [...settledItems(rssResults), ...settledItems(directResults), ...settledItems(gdeltResults)];
    const filtered = newest(dedupeItems(filterItems(recentItems(items), topic, scope)), config.maxLimit);
    const fetchedAt = new Date().toISOString();

    return {
      scope: scopePayload(scope),
      topic,
      items: filtered,
      meta: {
        count: filtered.length,
        sourcesUsed: plan.sourcesUsed,
        fetchedAt,
        cacheTtlSeconds: config.cacheTtlSeconds,
      },
    };
  });
  const enriched = await withCountyFallback(feed, scope, topic, cappedLimit);
  const sliced = enriched.items.slice(0, cappedLimit);
  return {
    ...enriched,
    items: sliced,
    meta: {
      ...enriched.meta,
      count: sliced.length,
    },
  };
}

async function withCountyFallback(feed: FeedResponse, scope: FeedScope, topic: Topic, limit: number) {
  if (scope.level !== "county" || feed.items.length >= Math.min(limit, config.countyFallbackMinItems)) {
    return feed;
  }

  const stateFeed = await getFeed({ level: "state", state: scope.state }, topic, Math.max(limit, config.countyFallbackMinItems));
  const items = prioritizeUniqueItems(feed.items, stateFeed.items, limit);
  return {
    ...feed,
    items,
    meta: {
      ...feed.meta,
      count: items.length,
      sourcesUsed: Array.from(new Set([...feed.meta.sourcesUsed, "fallback:state", ...stateFeed.meta.sourcesUsed])),
    },
  };
}

function settledItems(results: PromiseSettledResult<NewsFeedItem[]>[]) {
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function settleLimited<T, R>(items: T[], load: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(config.upstreamConcurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = { status: "fulfilled", value: await load(items[index]) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    }),
  );

  return results;
}

export async function getPage(scope: FeedScope, sectionNames: string[], limit: number): Promise<PageResponse> {
  const selectedSections = normalizeSections(sectionNames, scope);
  const entries = await loadPageEntries(selectedSections, scope, limit);
  const sections = Object.fromEntries(entries);
  const count = Object.values(sections).reduce((total, section) => total + section.meta.count, 0);

  return {
    scope: scopePayload(scope),
    sections,
    meta: {
      count,
      fetchedAt: new Date().toISOString(),
      cacheTtlSeconds: config.cacheTtlSeconds,
    },
  };
}

async function loadPageEntries(
  selectedSections: [string, Topic][],
  scope: FeedScope,
  limit: number,
): Promise<[string, FeedResponse][]> {
  const entries = new Array<[string, FeedResponse]>(selectedSections.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(config.pageSectionConcurrency, selectedSections.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < selectedSections.length) {
        const index = cursor;
        cursor += 1;
        const [section, topic] = selectedSections[index];
        try {
          entries[index] = [section, await getFeed(scope, topic, limit)];
        } catch (reason) {
          console.warn(
            JSON.stringify({
              event: "api.page.section_failed",
              section,
              topic,
              error: reason instanceof Error ? reason.message : String(reason),
            }),
          );
          entries[index] = [section, emptyFeed(scope, topic)];
        }
      }
    }),
  );

  return entries;
}

function emptyFeed(scope: FeedScope, topic: Topic): FeedResponse {
  return {
    scope: scopePayload(scope),
    topic,
    items: [],
    meta: {
      count: 0,
      sourcesUsed: ["error:page-section"],
      fetchedAt: new Date().toISOString(),
      cacheTtlSeconds: config.cacheTtlSeconds,
    },
  };
}

function normalizeSections(sectionNames: string[], scope: FeedScope): [string, Topic][] {
  const defaults: [string, Topic][] =
    scope.level === "county"
      ? [
          ["localNews", "general"],
          ["localSports", "sports"],
          ["politics", "politics"],
          ["economy", "economy"],
          ["crime", "crime"],
          ["obituaries", "obituaries"],
          ["opinion", "opinion"],
        ]
      : topics.map((topic) => [topic, topic]);

  if (!sectionNames.length) return defaults;
  const defaultMap = new Map(defaults);
  return sectionNames.flatMap((section) => {
    const normalized = section.trim();
    const directTopic = topics.includes(normalized as Topic) ? (normalized as Topic) : undefined;
    const topic = defaultMap.get(normalized) || directTopic;
    return topic ? [[normalized, topic] as [string, Topic]] : [];
  });
}

function capLimit(limit: number) {
  if (!Number.isFinite(limit) || limit <= 0) return config.defaultLimit;
  return Math.min(Math.floor(limit), config.maxLimit);
}

function newest(items: NewsFeedItem[], maxItems: number) {
  const focusCutoff = Date.now() - config.freshnessFocusDays * 24 * 60 * 60 * 1000;
  return [...items]
    .sort((a, b) => {
      const aTime = timestamp(a.publishedAt) ?? 0;
      const bTime = timestamp(b.publishedAt) ?? 0;
      const focusDelta = Number(bTime >= focusCutoff) - Number(aTime >= focusCutoff);
      return focusDelta || bTime - aTime;
    })
    .slice(0, maxItems);
}

function recentItems(items: NewsFeedItem[]) {
  const cutoff = Date.now() - config.articleMaxAgeDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const publishedAt = timestamp(item.publishedAt);
    return publishedAt !== undefined && publishedAt >= cutoff && publishedAt <= Date.now() + 24 * 60 * 60 * 1000;
  });
}

function dedupeItems(items: NewsFeedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeDedupeKey(item.link || item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prioritizeUniqueItems(primaryItems: NewsFeedItem[], fallbackItems: NewsFeedItem[], maxItems: number) {
  const seen = new Set<string>();
  const addUnique = (item: NewsFeedItem) => {
    const key = normalizeDedupeKey(item.link || item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  return [...primaryItems.filter(addUnique), ...fallbackItems.filter(addUnique)].slice(0, maxItems);
}

function normalizeDedupeKey(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("bing.com") && url.pathname.endsWith("/news/apiclick.aspx")) {
      const targetUrl = url.searchParams.get("url");
      if (targetUrl) return normalizeDedupeKey(targetUrl);
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }
}

function timestamp(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function scopeKey(scope: FeedScope) {
  if (scope.level === "national") return "national";
  if (scope.level === "state") return `state:${scope.state.slug}`;
  return `county:${scope.state.slug}:${scope.county.slug}`;
}

function scopePayload(scope: FeedScope): Record<string, string> {
  if (scope.level === "national") return { level: "national" };
  if (scope.level === "state") return { level: "state", stateSlug: scope.state.slug, stateName: scope.state.name, stateAbbr: scope.state.abbr };
  return {
    level: "county",
    stateSlug: scope.state.slug,
    stateName: scope.state.name,
    stateAbbr: scope.state.abbr,
    countySlug: scope.county.slug,
    countyName: scope.county.name,
    displayName: scope.county.displayName,
  };
}
