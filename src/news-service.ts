import { cached } from "./cache.js";
import { enrichArticleImages } from "./article-images.js";
import { config } from "./config.js";
import { buildCountyFallbackPlan, buildFeedPlan, topics } from "./feed-builders.js";
import { filterCountyFallbackItems, filterItems } from "./filter.js";
import { fetchGdeltItems } from "./gdelt.js";
import { getNearbyCounties } from "./geo.js";
import { fetchRssItems } from "./rss.js";
import type { FeedResponse, FeedScope, NewsFeedItem, PageResponse, Topic } from "./types.js";

export async function getFeed(scope: FeedScope, topic: Topic, limit: number): Promise<FeedResponse> {
  const cappedLimit = capLimit(limit);
  const cacheKey = `feed:${scopeKey(scope)}:${topic}`;
  const feed = await cached(cacheKey, config.cacheTtlSeconds, async () => {
    const plan = buildFeedPlan(scope, topic);
    const items = await loadPlanItems(plan);
    const filtered = await enrichArticleImages(newest(dedupeItems(filterItems(recentItems(items), topic, scope)), config.maxLimit));
    const fetchedAt = new Date().toISOString();

    const primaryFeed = {
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
    return withCountyFallback(primaryFeed, scope, topic, config.maxLimit);
  });
  const sliced = feed.items.slice(0, cappedLimit);
  return {
    ...feed,
    items: sliced,
    meta: {
      ...feed.meta,
      count: sliced.length,
    },
  };
}

async function withCountyFallback(feed: FeedResponse, scope: FeedScope, topic: Topic, limit: number) {
  if (scope.level !== "county" || feed.items.length >= Math.min(limit, config.countyFallbackMinItems)) {
    return feed;
  }

  const nearbyCounties = getNearbyCounties(scope.county, config.countyMarketLimit);
  if (!nearbyCounties.length) return feed;

  const fallbackPlan = buildCountyFallbackPlan(scope.county, nearbyCounties, topic);
  const fallbackItems = await loadPlanItems(fallbackPlan);
  const nearbyItems = newest(
    dedupeItems(filterCountyFallbackItems(recentItems(fallbackItems), topic, scope, nearbyCounties)),
    config.maxLimit,
  );
  const items = await enrichArticleImages(prioritizeUniqueItems(feed.items, nearbyItems, limit));
  return {
    ...feed,
    items,
    meta: {
      ...feed.meta,
      count: items.length,
      sourcesUsed: Array.from(new Set([...feed.meta.sourcesUsed, ...fallbackPlan.sourcesUsed])),
    },
  };
}

async function loadPlanItems(plan: ReturnType<typeof buildFeedPlan>) {
  const [rssResults, directResults, gdeltResults] = await Promise.all([
    settleLimited(plan.rssUrls, (url) => fetchRssItems(url)),
    settleLimited(plan.directSources, (source) => fetchRssItems(source.url, { source: source.name, mediaType: source.mediaType })),
    settleLimited(plan.articleQueries, (query) => fetchGdeltItems(query)),
  ]);
  return [...settledItems(rssResults), ...settledItems(directResults), ...settledItems(gdeltResults)];
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
  const accepted: Array<{ link: string; title: string; item: NewsFeedItem }> = [];
  return items.filter((item) => {
    const title = normalizeTitle(item.title, item.source);
    const link = normalizeDedupeKey(item.link);
    if (accepted.some((existing) => existing.link === link || isNearDuplicate(item, title, existing.item, existing.title))) return false;
    accepted.push({ link, title, item });
    return true;
  });
}

function prioritizeUniqueItems(primaryItems: NewsFeedItem[], fallbackItems: NewsFeedItem[], maxItems: number) {
  const accepted: Array<{ link: string; title: string; item: NewsFeedItem }> = [];
  const addUnique = (item: NewsFeedItem) => {
    const title = normalizeTitle(item.title, item.source);
    const link = normalizeDedupeKey(item.link);
    if (accepted.some((existing) => existing.link === link || isNearDuplicate(item, title, existing.item, existing.title))) return false;
    accepted.push({ link, title, item });
    return true;
  };
  return [...primaryItems.filter(addUnique), ...fallbackItems.filter(addUnique)].slice(0, maxItems);
}

function normalizeTitle(value: string, source?: string) {
  const sourceSuffix = source ? ` - ${source}`.toLowerCase() : "";
  const withoutSource = sourceSuffix && value.toLowerCase().endsWith(sourceSuffix) ? value.slice(0, -sourceSuffix.length) : value;
  return withoutSource
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNearDuplicate(item: NewsFeedItem, title: string, existingItem: NewsFeedItem, existingTitle: string) {
  if (!title || !existingTitle) return false;
  if (title === existingTitle || title.includes(existingTitle) || existingTitle.includes(title)) return true;

  const titleSimilarity = tokenSimilarity(title, existingTitle);
  if (titleSimilarity >= 0.82) return true;

  if (!isDvidsItem(item) || !isDvidsItem(existingItem)) return false;
  const description = normalizeTitle(item.description || "");
  const existingDescription = normalizeTitle(existingItem.description || "");
  return description.length >= 36 && existingDescription.length >= 36 && tokenSimilarity(description, existingDescription) >= 0.72;
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return 0;

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / (leftTokens.size + rightTokens.size - shared);
}

function isDvidsItem(item: NewsFeedItem) {
  return Boolean(item.source?.toLowerCase().includes("dvids") || item.link.toLowerCase().includes("dvidshub.net"));
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
