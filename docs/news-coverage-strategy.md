# News Coverage Strategy

## Current Iteration

The API is a server-side news aggregation layer for The County Post. It returns the same `NewsFeedItem` shape the React frontend already renders, but moves feed fanout, freshness filtering, dedupe, and topic filtering out of the browser.

Current providers:

- Google News RSS search
- Bing News RSS search
- GDELT Document API
- Direct publisher RSS/Atom feeds from the source registry

Current recency policy:

- Articles older than `ARTICLE_MAX_AGE_DAYS` are dropped. The default is `183` days.
- Sorting prioritizes articles from the last `FRESHNESS_FOCUS_DAYS`. The default is `14` days.
- Google News queries use `when:1d`, `when:7d`, and the configured `ARTICLE_MAX_AGE_DAYS` window.
- Bing News queries use day and week freshness filters.
- GDELT queries use a six-month timespan and date-desc sorting.
- Direct publisher feeds are parsed through the same six-month cutoff and two-week freshness sort.

Current volume policy:

- Default per-section limit is `48`.
- Hard cap is `200`.
- Sparse county sections fall back to state-topic inventory until `COUNTY_FALLBACK_MIN_ITEMS`, default `12`.
- Cache TTL is `30` seconds.
- Upstream provider calls are concurrency-limited by `UPSTREAM_CONCURRENCY`, default `12`.

## County Coverage Approach

County feeds are now intentionally broader than exact county-name searches. Local publishers often write about nearby cities, school districts, police departments, courts, businesses, hospitals, and events without putting the county name in the headline.

County markets are selected by distance. The API resolves each county by FIPS, loads a county centroid, and sorts that state's news hubs by miles from the centroid. This keeps expansion local-first: Wood County, TX resolves to Tyler before larger or more distant Texas hubs, while Potter County still resolves to Amarillo.

For each county and topic, the API searches:

- Exact county names, including state-qualified variants.
- County names plus local/breaking/community/public-safety/business terms.
- Nearby market cities plus county names.
- Nearby market cities plus topic terms.
- Nearby market cities plus state-local-news terms.
- Short-window current terms like `latest`, `today`, and `breaking`.

For Potter County, this means feeds include both direct Potter County searches and Amarillo searches, so local stories from Amarillo-area publishers have more chances to appear.

For sparse counties, county-specific results remain first. If a section has too few county matches, the API appends state-topic fallback stories so small counties still render useful context instead of empty sections.

Potter/Randall direct sources currently include:

- ABC7 Amarillo local news
- ABC7 Amarillo video feeds
- MyHighPlains news/local-news/today-in-Amarillo feeds
- MyHighPlains podcasts
- Amarillo Tribune

Tyler/East Texas direct sources currently include:

- KLTV East Texas news
- CBS19 Tyler news
- KETK East Texas feeds

## Known Limitations

This is still a search-based aggregator, not a complete local-news index. Search APIs can miss stories when:

- A local publisher is not well indexed by Google News, Bing News, or GDELT.
- The article title does not mention the county, city, or state.
- The article page blocks crawlers or omits publish dates.
- The story is hidden behind social posts, newsletters, PDF police reports, or station video pages.
- A rural county’s best nearby market is not captured by the current market-city list.

The most important remaining gap is source discovery. To reach “total county news coverage,” the API needs a persistent list of local source domains and feeds by county/media market, not just search queries.

## Best Next Implementation Plan

1. Add a county/source registry.

   Store source domains and RSS feeds per state, county, and media market:

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
