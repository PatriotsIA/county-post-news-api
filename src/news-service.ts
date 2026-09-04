import { cached } from "./cache.js";
import { enrichArticleImages } from "./article-images.js";
import { config } from "./config.js";
import { buildCountyFallbackPlan, buildCountyMarketPlan, buildFeedPlan, topics } from "./feed-builders.js";
import { filterCountyFallbackItems, filterItems, filterMarketItems } from "./filter.js";
import { fetchGdeltItems } from "./gdelt.js";
import { featuredCountyPostOpinion } from "./editorial.js";
import { getCountyLocalPlaces, getCountyPlaceTerms, getNearbyCounties } from "./geo.js";
import { fetchRssItems, getItemMaxAgeDays } from "./rss.js";
import type { FeedResponse, FeedScope, NewsFeedItem, PageResponse, Topic } from "./types.js";

export async function getFeed(scope: FeedScope, topic: Topic, limit: number): Promise<FeedResponse> {
  const cappedLimit = capLimit(limit);
  const cacheKey = `feed:${scopeKey(scope)}:${topic}`;
  const feed = await cached(cacheKey, config.cacheTtlSeconds, async () => {
    const plan = buildFeedPlan(scope, topic);
    const items = await loadPlanItems(plan);
    const filtered = dedupeItems(
      await enrichArticleImages(
        newest(dedupeItems(filterItems(recentItems(items), topic, scope, plan.directSources)), config.maxLimit),
      ),
    );
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
    return withCountyCoverage(primaryFeed, scope, topic, config.maxLimit);
  });
  const feedItems = topic === "opinion" ? dedupeItems([featuredCountyPostOpinion, ...feed.items]) : feed.items;
  const sliced =
    scope.level === "county" && topic === "general"
      ? balanceCountyPublisherMix(feedItems, cappedLimit)
      : feedItems.slice(0, cappedLimit);
  const publisherBalanceApplied =
    scope.level === "county" &&
    topic === "general" &&
    config.countyPublisherBalanceEnabled &&
    publisherConcentration(feed.items).dominantCount > publisherLimit();
  const sourcesUsed =
    topic === "opinion"
      ? Array.from(new Set([...feed.meta.sourcesUsed, "publisher:the-county-post"]))
      : feed.meta.sourcesUsed;
  return {
    ...feed,
    items: sliced,
    meta: {
      ...feed.meta,
      count: sliced.length,
      sourcesUsed: publisherBalanceApplied
        ? Array.from(new Set([...sourcesUsed, "county:publisher-balanced"]))
        : sourcesUsed,
    },
  };
}

async function withCountyCoverage(feed: FeedResponse, scope: FeedScope, topic: Topic, limit: number) {
  if (scope.level !== "county") {
    return feed;
  }

  const sparsePrimary = feed.items.length < Math.min(limit, config.countyFallbackMinItems);
  const diversityPrimary = needsPublisherDiversity(feed.items, topic);
  if (!sparsePrimary && !diversityPrimary) return feed;

  let items = feed.items;
  let sourcesUsed = diversityPrimary
    ? Array.from(new Set([...feed.meta.sourcesUsed, "county:publisher-diversity"]))
    : feed.meta.sourcesUsed;
  let marketCount = 0;

  if (config.countyMarketTierEnabled) {
    const marketPlan = buildCountyMarketPlan(scope.county, topic);
    const marketItems = dedupeItems(
      await enrichArticleImages(
        newest(
          dedupeItems(
            filterMarketItems(
              recentItems(await loadPlanItems(marketPlan)),
              topic,
              scope,
              getCountyPlaceTerms(scope.county, config.countyMarketLimit),
              marketPlan.directSources,
            ),
          ),
          config.maxLimit,
        ),
      ),
    );
    marketCount = marketItems.length;
    items = dedupeItems(await enrichArticleImages(prioritizeUniqueItems(items, marketItems, limit)));
    sourcesUsed = Array.from(new Set([...sourcesUsed, ...marketPlan.sourcesUsed]));
  }

  let nearbyCount = 0;
  if (needsCountyExpansion(items, topic, limit)) {
    const nearbyCounties = getNearbyCounties(scope.county, config.countyNearbyLimit);
    if (nearbyCounties.length) {
      const fallbackPlan = buildCountyFallbackPlan(scope.county, nearbyCounties, topic);
      const fallbackItems = await loadPlanItems(fallbackPlan);
      const nearbyItems = newest(
        dedupeItems(filterCountyFallbackItems(recentItems(fallbackItems), topic, scope, nearbyCounties)),
        config.maxLimit,
      );
      nearbyCount = nearbyItems.length;
      items = dedupeItems(await enrichArticleImages(prioritizeUniqueItems(items, nearbyItems, limit)));
      sourcesUsed = Array.from(new Set([...sourcesUsed, ...fallbackPlan.sourcesUsed]));
    }
  }

  if (marketCount || nearbyCount || diversityPrimary) {
    console.info(
      JSON.stringify({
        event: "feed.sparse_county",
        scope: `${scope.state.slug}/${scope.county.slug}`,
        topic,
        sparsePrimary,
        diversityPrimary,
        primaryCount: feed.items.length,
        marketCount,
        nearbyCount,
        finalCount: items.length,
      }),
    );
  }

  return {
    ...feed,
    items,
    meta: {
      ...feed.meta,
      count: items.length,
      sourcesUsed,
    },
  };
}

function needsCountyExpansion(items: NewsFeedItem[], topic: Topic, limit: number) {
  return (
    items.length < Math.min(limit, config.countyFallbackMinItems) ||
    needsPublisherDiversity(items, topic)
  );
}

function needsPublisherDiversity(items: NewsFeedItem[], topic: Topic) {
  if (topic !== "general" || !config.countyPublisherBalanceEnabled) return false;
  const { dominantCount, otherCount } = publisherConcentration(items);
  return (
    dominantCount > publisherLimit() &&
    otherCount < otherSourcesTarget()
  );
}

export function balanceCountyPublisherMix(items: NewsFeedItem[], maxItems: number) {
  const cappedLimit = Math.max(0, Math.floor(maxItems));
  if (!config.countyPublisherBalanceEnabled || !cappedLimit) return items.slice(0, cappedLimit);

  const groups = publisherGroups(items);
  const dominant = [...groups.entries()].sort((left, right) => right[1].length - left[1].length)[0];
  if (!dominant || dominant[1].length <= publisherLimit()) return items.slice(0, cappedLimit);

  const [dominantKey, dominantItems] = dominant;
  const otherItems = items.filter((item) => itemPublisherKey(item) !== dominantKey);
  const desiredOtherCount = Math.min(
    otherSourcesTarget(),
    otherItems.length,
    Math.floor(cappedLimit / 2),
  );
  const desiredDominantCount = Math.min(
    publisherLimit(),
    dominantItems.length,
    cappedLimit - desiredOtherCount,
  );
  const selected = new Set([
    ...dominantItems.slice(0, desiredDominantCount),
    ...otherItems.slice(0, desiredOtherCount),
  ]);
  return items.filter((item) => selected.has(item)).slice(0, cappedLimit);
}

function publisherConcentration(items: NewsFeedItem[]) {
  const counts = [...publisherGroups(items).values()].map((group) => group.length);
  const dominantCount = counts.length ? Math.max(...counts) : 0;
  return { dominantCount, otherCount: Math.max(0, items.length - dominantCount) };
}

function publisherGroups(items: NewsFeedItem[]) {
  const groups = new Map<string, NewsFeedItem[]>();
  for (const item of items) {
    const key = itemPublisherKey(item) || `unknown:${normalizeDedupeKey(item.link)}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function itemPublisherKey(item: NewsFeedItem) {
  try {
    const domain = new URL(normalizeDedupeKey(item.link)).hostname.toLowerCase().replace(/^www\./, "");
    if (domain && domain !== "news.google.com" && domain !== "bing.com" && !domain.endsWith(".bing.com")) {
      return domain;
    }
  } catch {
    // Fall back to the normalized publisher label.
  }
  return publisherKey(item.source);
}

function publisherLimit() {
  return Math.max(1, Math.floor(config.countySinglePublisherMax));
}

function otherSourcesTarget() {
  return Math.max(1, Math.floor(config.countyOtherSourcesTarget));
}

async function loadPlanItems(plan: ReturnType<typeof buildFeedPlan>) {
  const [rssResults, directResults, gdeltResults] = await Promise.all([
    settleLimited(plan.rssUrls, (url) => fetchRssItems(url)),
    settleLimited(plan.directSources, async (source) => {
      const items = await fetchRssItems(source.url, {
        source: source.itemSource || source.name,
        mediaType: source.mediaType,
        maxAgeDays: source.maxAgeDays,
      });
      return source.maxItems ? items.slice(0, source.maxItems) : items;
    }),
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
      : topics.filter((topic) => topic !== "weather").map((topic) => [topic, topic]);

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
  const now = Date.now();
  return items.filter((item) => {
    const publishedAt = timestamp(item.publishedAt);
    const maxAgeDays = getItemMaxAgeDays(item) || config.articleMaxAgeDays;
    const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
    return publishedAt !== undefined && publishedAt >= cutoff && publishedAt <= now + 24 * 60 * 60 * 1000;
  });
}

function dedupeItems(items: NewsFeedItem[]) {
  const accepted: Array<{ link: string; title: string; image: string; item: NewsFeedItem }> = [];
  return items.filter((item) => {
    const title = normalizeTitle(item.title, item.source);
    const link = normalizeDedupeKey(item.link);
    const image = normalizeImageKey(item.imageUrl);
    if (accepted.some((existing) => existing.link === link || (image && existing.image === image) || isNearDuplicate(item, title, existing.item, existing.title))) return false;
    accepted.push({ link, title, image, item });
    return true;
  });
}

function prioritizeUniqueItems(primaryItems: NewsFeedItem[], fallbackItems: NewsFeedItem[], maxItems: number) {
  const accepted: Array<{ link: string; title: string; image: string; item: NewsFeedItem }> = [];
  const addUnique = (item: NewsFeedItem) => {
    const title = normalizeTitle(item.title, item.source);
    const link = normalizeDedupeKey(item.link);
    const image = normalizeImageKey(item.imageUrl);
    if (accepted.some((existing) => existing.link === link || (image && existing.image === image) || isNearDuplicate(item, title, existing.item, existing.title))) return false;
    accepted.push({ link, title, image, item });
    return true;
  };
  return [...primaryItems.filter(addUnique), ...fallbackItems.filter(addUnique)].slice(0, maxItems);
}

function normalizeTitle(value: string, source?: string) {
  const sourceSuffix = source ? ` - ${source}`.toLowerCase() : "";
  const withoutSource = sourceSuffix && value.toLowerCase().endsWith(sourceSuffix) ? value.slice(0, -sourceSuffix.length) : value;
  const headline = withoutSource.split(/\s[-–—]\s/)[0] || withoutSource;
  return headline
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNearDuplicate(item: NewsFeedItem, title: string, existingItem: NewsFeedItem, existingTitle: string) {
  if (!title || !existingTitle) return false;
  if (isDistinctRecurringEdition(item, title, existingItem, existingTitle)) return false;
  if (title === existingTitle || title.includes(existingTitle) || existingTitle.includes(title)) return true;

  const titleSimilarity = tokenSimilarity(title, existingTitle);
  if (titleSimilarity >= 0.82) return true;
  if (samePublisher(item, existingItem) && sharesEventContext(title, existingTitle)) return true;

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

function sharesEventContext(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").map(stemToken).filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").map(stemToken).filter((token) => token.length > 2));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  return shared.length >= 3 && shared.some((token) => !genericStoryTokens.has(token));
}

function stemToken(token: string) {
  if (token.startsWith("escape")) return "escape";
  return token.replace(/(ing|ed|es|s)$/u, "");
}

const genericStoryTokens = new Set(["county", "local", "news", "official", "officials", "report", "update", "today"]);
const recurringSeriesTokens = new Set(["report", "reports", "log", "logs", "blotter", "briefing", "roundup"]);

function isDistinctRecurringEdition(
  item: NewsFeedItem,
  title: string,
  existingItem: NewsFeedItem,
  existingTitle: string,
) {
  if (!samePublisher(item, existingItem)) return false;
  const publishedAt = timestamp(item.publishedAt);
  const existingPublishedAt = timestamp(existingItem.publishedAt);
  if (publishedAt === undefined || existingPublishedAt === undefined) return false;
  if (Math.abs(publishedAt - existingPublishedAt) < 48 * 60 * 60 * 1000) return false;

  const titleTokens = title.split(" ");
  const existingTitleTokens = existingTitle.split(" ");
  return (
    title === existingTitle ||
    [...recurringSeriesTokens].some(
      (token) => titleTokens.includes(token) && existingTitleTokens.includes(token),
    )
  );
}

function samePublisher(left: NewsFeedItem, right: NewsFeedItem) {
  const leftPublisher = publisherKey(left.source);
  const rightPublisher = publisherKey(right.source);
  return Boolean(leftPublisher && leftPublisher === rightPublisher);
}

function publisherKey(value?: string) {
  const normalized = (value || "")
    .toLowerCase()
    .replace(/\b(the|north|south|east|west|northeast|northwest|southeast|southwest)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (normalized.includes("my pulse news")) return "mypulsenews.com";
  return normalized;
}

function isDvidsItem(item: NewsFeedItem) {
  return Boolean(item.source?.toLowerCase().includes("dvids") || item.link.toLowerCase().includes("dvidshub.net"));
}

function normalizeImageKey(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (/(logo|masthead|favicon|placeholder|default[-_]?image|site[-_]?icon)/.test(url.pathname.toLowerCase())) {
      return "";
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.toLowerCase().replace(/\s+/g, "");
  }
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

function scopePayload(scope: FeedScope): Record<string, string | string[]> {
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
    // The towns this feed was scoped to. Published so the browser can apply the
    // same locality rule the API did: it has no county place list of its own,
    // and re-checking for the county's name alone discards the very local
    // stories — a Silverton council report — that the API just found.
    places: getCountyLocalPlaces(scope.county),
  };
}
