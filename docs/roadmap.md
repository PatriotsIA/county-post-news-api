# Roadmap

## Near Term

- Expand the direct-source registry by state, county, and media market.
- Add provider diagnostics to response metadata in development mode:
  - attempted provider count
  - successful provider count
  - failed provider count
  - filtered-out count by reason
  - newest article age by section
- Add a scheduled refresh path for national, state, and high-traffic county pages.
- Add CloudFront in front of the Lambda Function URL once the production frontend domain is stable.

## Coverage Improvements

Generic search providers are useful but incomplete. The strongest path to reliable nationwide county coverage is a reviewed source registry:

- local newspapers
- TV station news feeds
- radio/news sites
- school district feeds
- city/county public information pages
- sheriff, police, court, and public safety feeds where available

Direct RSS/Atom feeds should be preferred. Lightweight source-specific scrapers should only be added where allowed by publisher terms and robots policy.

## Performance Improvements

The current first deployment uses Lambda warm-memory caching. This keeps the service cheap, but cold requests still wait on upstream providers.

Future durable caching options:

- DynamoDB table for normalized article records and page-section cache entries.
- S3 snapshots for raw provider responses when debugging coverage.
- EventBridge scheduled jobs to refresh common pages before users arrive.
- SQS queue for provider fetch tasks if refresh work grows.

## Ranking Improvements

The current implementation filters and sorts by recency. A future scoring layer should rank articles by:

- exact county mention
- nearby market city mention
- state relevance
- known local source domain
- topic match
- recency
- duplicate/canonical URL confidence

The goal is to keep exact county stories first while still filling sparse counties with useful nearby and state context.
