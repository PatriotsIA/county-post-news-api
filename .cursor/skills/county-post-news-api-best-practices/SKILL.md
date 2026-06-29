---
name: county-post-news-api-best-practices
description: Applies best practices for The County Post News API. Use when changing feed aggregation, provider fan-out, caching, filtering, source registry coverage, frontend API integration, or performance for county/state/national news pages.
---

# County Post News API Best Practices

## First Checks

When diagnosing slow or sparse feeds:

1. Read recent structured request logs and note path, query, duration, origin, and repeated limits.
2. Compare frontend calls against the intended page endpoints:
   - `GET /v1/pages/national`
   - `GET /v1/pages/states/:stateSlug`
   - `GET /v1/pages/counties/:stateSlug/:countySlug`
3. Measure provider success counts before changing query breadth.
4. Confirm whether sparse output is caused by upstream failures, recency filtering, topic filtering, locality filtering, dedupe, or frontend re-filtering.

## Performance Rules

- Prefer page endpoints for page loads. Avoid issuing every topic feed separately from the frontend.
- Cache feed aggregation by scope and topic, not by requested limit. Slice cached results after retrieval.
- Keep cache keys stable across scroll/load-more increments.
- Put fast, high-yield providers early in the fetch plan. If a provider frequently times out, do not let it occupy the whole first concurrency wave.
- Tune fan-out with measured provider behavior. More upstream URLs can make latency worse without increasing articles.
- Treat `REQUEST_TIMEOUT_MS`, `UPSTREAM_CONCURRENCY`, `MAX_RSS_URLS_PER_FEED`, and `MAX_ARTICLE_QUERIES_PER_FEED` as one system, not independent knobs.

## Coverage Rules

- Generic search providers are incomplete. For better county coverage, add verified direct publisher feeds by state, county, and media market.
- For sparse counties, broaden with nearby market cities, but keep exact county/city/source scoring so local stories rank first.
- Prefer scoring over hard exclusion when a valid local story may lack exact county wording.
- Preserve obituaries, sports, opinion, crime, and economy as separate topics, but avoid frontend topic filtering when the API already returns server-filtered sections.

## Frontend Integration

- Fetch one page batch per page route, then pass section items down as initial data.
- Do not let section components auto-increment limits for server-batched sections just because a sparse section has fewer cards than `pageSize`.
- Use a larger initial page batch instead of many progressive per-topic requests.
- Keep `VITE_NEWS_API_URL` as the API base URL setting.

## Observability

When adding diagnostics, prefer structured metadata:

- provider attempted/succeeded/failed counts
- filtered-out counts by reason
- newest article age by section
- direct source hits
- cache hit/miss status

Do not log full article bodies or sensitive headers.
