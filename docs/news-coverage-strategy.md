# News Coverage Strategy

## Current Iteration

The API is a server-side news aggregation layer for The County Post. It returns the same `NewsFeedItem` shape the React frontend already renders, but moves feed fanout, freshness filtering, dedupe, and topic filtering out of the browser.

Current providers:

- Google News RSS search
- Bing News RSS search
- GDELT Document API
- Direct publisher RSS/Atom feeds from the source registry
- County-native outlet profiles for domain-targeted searches when a reviewed publisher has no usable feed

`weather` is a normal news topic in this pipeline: it searches and filters real reporting from these providers. Forecasts, observations, and alerts are not synthesized into articles. A dedicated county endpoint retrieves those separately from the official National Weather Service API using its [API documentation](https://www.weather.gov/documentation/services-web-api) and [alerts documentation](https://www.weather.gov/documentation/services-web-alerts).

Current recency policy:

- Articles older than `ARTICLE_MAX_AGE_DAYS` are dropped. The default is `183` days.
- Sorting prioritizes articles from the last `FRESHNESS_FOCUS_DAYS`. The default is `14` days.
- Google News queries use `when:1d`, `when:7d`, and the configured `ARTICLE_MAX_AGE_DAYS` window.
- Bing News queries use day and week freshness filters.
- GDELT queries use a six-month timespan and date-desc sorting.
- Direct publisher feeds are parsed through the same six-month cutoff and two-week freshness sort unless a reviewed, bounded archive exception is explicitly configured for that endpoint.

Current volume policy:

- Default per-section limit is `48`.
- Hard cap is `200`.
- A county section only expands when primary results are below `COUNTY_FALLBACK_MIN_ITEMS`, default `12`.
- County general news also expands when one publisher exceeds `COUNTY_SINGLE_PUBLISHER_MAX` and fewer than `COUNTY_OTHER_SOURCES_TARGET` alternatives are available.
- Balanced county general-news responses target at most 25 stories from the dominant publisher and 25 from all other publishers combined.
- County tiers are bounded by `COUNTY_PRIMARY_QUERY_LIMIT`, `COUNTY_MARKET_QUERY_LIMIT`, `COUNTY_NEARBY_LIMIT`, and the existing RSS/article-query caps.
- Cache TTL is `30` seconds.
- Upstream provider calls are concurrency-limited by `UPSTREAM_CONCURRENCY`, default `12`.

## County Coverage Approach

County feeds use three ordered tiers. This expands useful coverage without letting a same-name county in another state leak into a local feed.

1. `county:primary` uses the requested `County` name and full state name, county-keyed direct sources, a bounded local-newspaper/radio/television query, reviewed outlet domain searches, and optional county-agency queries. Primary filtering requires both the county and full state unless an item is tied to a reviewed county-native publisher; wrong-state mentions are still rejected.
2. `county:market` runs if primary inventory is sparse or publisher-diversity expansion is needed and `COUNTY_MARKET_TIER_ENABLED` is enabled. It uses county place overrides/local cities and nearby market cities, all state-qualified. Its filter requires the requested state and accepts an exact county, configured local place, or trusted source-registry publisher.
3. `county:fallback-nearby` runs if the market tier remains sparse or lacks sufficient publisher diversity. It queries the closest counties in the same state by centroid distance and requires those county names plus the requested state.

The selection order is preserved after URL, image, near-title, DVIDS-caption, and related-event deduplication. `meta.sourcesUsed` returns tier and source markers. When expansion occurs, a `feed.sparse_county` structured log records each tier's contribution for tuning.

County place overrides address ambiguous or misleading markets. For example, Polk County, Arkansas starts with Mena-area terms while Polk County, Florida starts with Lakeland/Winter Haven/Bartow-area terms. The system never emits a bare same-name county query.

The reviewed nationwide source-registry expansion plan is in `docs/nationwide-local-source-discovery-plan.md`.

## Safe rollout

- Deploy with `COUNTY_MARKET_TIER_ENABLED=false` to verify primary and nearby behavior first.
- Enable the market tier for pilot counties, then inspect `meta.sourcesUsed` and `feed.sparse_county` records for cross-state leakage or excessive request volume.
- Keep the query and nearby limits low while adding direct-source registry entries; increase only with provider-cost and latency evidence.
- Add known-good city and publisher metadata to `src/geo.ts` and `src/source-registry.ts` rather than widening generic searches.

## Current curated markets

The source registry contains curated direct feeds for the Amarillo, Tyler/East Texas, and Denver markets. Polk County, Arkansas also has paginated My Pulse News / KENA main feeds, dedicated local-news and sports category feeds, and reviewed county-native profiles for My Pulse News / KENA and The Mena Star. The Mena Star profile uses domain-targeted search because a dependable current public RSS feed was not verified. My Pulse's sports category is inactive after June 2024, so its reviewed sports feed alone may contribute up to eight clearly dated entries through a bounded three-year archive window; other feeds retain the normal recency policy.

Every county receives a bounded, state-qualified native-publisher search even when it has no reviewed profile. This provides nationwide discovery capability; the reviewed registry remains intentionally conservative because an unverified source must never become a locality bypass.

## Known Limitations

This is still a search-based aggregator, not a complete local-news index. Search APIs can miss stories when:

- A local publisher is not well indexed by Google News, Bing News, or GDELT.
- The article title does not mention the county, city, or state.
- The article page blocks crawlers or omits publish dates.
- The story is hidden behind social posts, newsletters, PDF police reports, or station video pages.
- A rural county’s best nearby market is not captured by the current market-city list.

The most important remaining gap is registry depth. Automated source-focused searches now run nationwide, but direct same-day coverage still depends on adding reviewed local source domains and feeds by county/media market.

## Registry Expansion Plan

1. Expand the county/source registry.

   Continue storing reviewed source domains and RSS feeds per state, county, and media market:

   - newspaper sites
   - TV station sites
   - radio/news sites
   - school district news feeds
   - sheriff/police/court public information pages where available
   - city/county government press release feeds

2. Add direct-source crawlers.

   For sources with RSS, fetch RSS directly. For sources without RSS, add source-specific lightweight scrapers only where permitted by terms and robots policy. Direct feeds are more reliable than search indexes for same-day local stories.

3. Add a source discovery job.

   Run a scheduled job that searches each county/market for likely source domains, stores candidates, and marks whether they have RSS, sitemap news URLs, or article pages. Human review can approve high-value sources.

4. Add durable caching.

   Move from Lambda warm-memory cache to DynamoDB or S3-backed article cache:

   - key by normalized URL
   - store provider/source, county candidates, topics, publish date, title, description
   - keep six months of articles
   - refresh high-traffic counties more often

5. Add scheduled prefetch.

   Do not wait for a frontend page view to discover articles. Use EventBridge schedules:

   - national and state feeds every 5-10 minutes
   - high-population counties every 10-15 minutes
   - all counties every 30-60 minutes
   - direct source RSS feeds every 5-15 minutes

6. Add scoring instead of only filtering.

   Each article should get scores for:

   - recency
   - exact county mention
   - city/market mention
   - known local source domain
   - topic match
   - duplicate/canonical URL confidence

   Return high-score articles first, but keep broader city-market articles as fallback inventory.

7. Add observability.

   Track per county/section:

   - newest article date
   - article count in last 24 hours
   - article count in last 7 days
   - article count in last 14 days
   - provider hit counts
   - filtered-out counts and reasons

   This makes gaps like “Potter County newest local headline is June 15” visible immediately.

## Recommended AWS Shape

Keep the public API cheap and simple:

- Lambda Function URL or API Gateway for read endpoints.
- DynamoDB table for normalized articles and per-county feed cache.
- EventBridge scheduled jobs for prefetch.
- SQS queue for provider/source fetch tasks.
- S3 for raw provider snapshots if debugging is needed.
- CloudFront in front of read endpoints for short edge cache.

This keeps costs low while avoiding page-load-time scraping.

## Frontend Integration

The frontend should use the API page endpoints for initial loads.

Recommended behavior:

- Set `VITE_NEWS_API_URL`.
- Fetch `GET /v1/pages/counties/:stateSlug/:countySlug` once on county pages instead of creating many RSS requests.
- Fetch `GET /v1/pages/states/:stateSlug` once on state pages.
- Fetch `GET /v1/pages/national` once on the front page.
- Treat API page-section results as server-filtered.
- Do not auto-increment per-topic feed limits just because a sparse section has fewer cards than the UI page size.
- Display API metadata per section in development, especially newest article date and provider counts.

The biggest user-facing improvement will come from using page batch endpoints. County pages should request all county sections in one API call and render the returned section map.

## Provider Expansion Candidates

Free/no-key providers are useful but incomplete:

- Google News RSS
- Bing News RSS
- GDELT Document API

Higher-quality expansion options:

- Direct RSS feeds from known local publishers.
- Publisher sitemaps and news sitemaps.
- Government/public-safety feeds where allowed.
- Paid APIs such as NewsAPI, Event Registry, MediaCloud, or DataForSEO if budget allows.

For nationwide county coverage, direct local source mapping will matter more than adding another generic search provider.
