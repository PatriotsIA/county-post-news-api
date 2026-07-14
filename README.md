# The County Post News API

A Node.js/AWS Lambda API that aggregates national, state, and county news into JSON for The County Post frontend. It is designed for a low-cost first deployment with a Lambda Function URL and no database.

## Why This Exists

The frontend should not build and fetch many upstream RSS/search URLs in the browser. This service moves provider fan-out, freshness filtering, dedupe, topic filtering, and county/state fallback server-side. The frontend can request one page endpoint and render sectioned results.

Current providers:

- Google News RSS search
- Bing News RSS search
- GDELT Document API
- Direct publisher RSS/Atom feeds from the source registry

County feeds intentionally search beyond exact county names. The API expands through nearby in-state news markets selected by county centroid distance, then falls back to state-topic inventory when a small county has too few direct matches.

```ts
type NewsFeedItem = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string;
  mediaType?: "article" | "video" | "podcast";
};
```

## Endpoints

- `GET /health`
- `GET /v1/states`
- `GET /v1/feeds/national/:topic?limit=48`
- `GET /v1/feeds/states/:stateSlug/:topic?limit=48`
- `GET /v1/feeds/counties/:stateSlug/:countySlug/:topic?limit=48`
- `GET /v1/pages/national?sections=general,sports,politics&limit=48`
- `GET /v1/pages/states/:stateSlug?sections=general,sports,politics&limit=48`
- `GET /v1/pages/counties/:stateSlug/:countySlug?sections=localNews,localSports,politics,economy,crime,obituaries,opinion&limit=48`

Topics are `general`, `sports`, `politics`, `economy`, `crime`, `obituaries`, and `opinion`.

## Local Development

```bash
npm ci
npm run dev
```

Try:

```bash
curl "http://localhost:8787/v1/pages/counties/texas/potter?sections=localNews,localSports&limit=48"
```

Run checks before deployment:

```bash
npm run typecheck
npm test
npm run build
```

## Configuration

Copy `.env.example` into your environment provider or shell:

- `CORS_ORIGINS`: comma-separated frontend origin allowlist. Use `*` for local testing only.
- `CACHE_TTL_SECONDS`: warm Lambda in-memory cache TTL, default `30`.
- `REQUEST_TIMEOUT_MS`: upstream fetch timeout, default `3500`.
- `DEFAULT_LIMIT`: default items per section, default `48`.
- `MAX_LIMIT`: hard cap, default `200`.
- `COUNTY_FALLBACK_MIN_ITEMS`: minimum county section inventory before state-topic fallback fills the response, default `12`.
- `ARTICLE_MAX_AGE_DAYS`: hard article cutoff, default `183`.
- `FRESHNESS_FOCUS_DAYS`: freshness sort focus window, default `14`.
- `STATE_MARKET_LIMIT`: nearby state markets to search, default `4`.
- `COUNTY_MARKET_LIMIT`: nearby county markets to search, default `3`.
- `GDELT_ENABLED`: set to `false` to disable GDELT, default `true`.
- `GDELT_MAX_RECORDS`: max GDELT records per query, default `100`.
- `BING_NEWS_ENABLED`: set to `false` to disable Bing News RSS, default `true`.
- `PAGE_SECTION_CONCURRENCY`: max page sections aggregated at once, default `2`.
- `UPSTREAM_CONCURRENCY`: max concurrent upstream requests per provider group, default `12`.
- `MAX_RSS_URLS_PER_FEED`: RSS/provider URL cap per section, default `18`.
- `MAX_ARTICLE_QUERIES_PER_FEED`: article-search query cap per section, default `6`.

## Request Logs

Every request logs one structured JSON line. Successful requests use `console.log`; failed requests use `console.error`.

```json
{"event":"api.request","ok":true,"method":"GET","path":"/v1/pages/counties/texas/potter","query":"limit=48","statusCode":200,"durationMs":842,"origin":"http://localhost:5173","referer":"http://localhost:5173/texas/potter"}
```

## AWS Deployment

This repo is prepared for deployment from GitHub through an AWS-managed connection, not GitHub Actions.

Deployment files:

- `template.yaml`: SAM template for Lambda Function URL deployment.
- `buildspec.yml`: CodeBuild build/test/package steps for an AWS CodePipeline GitHub source connection.
- `docs/deployment.md`: pipeline setup and deployment notes.

Set up AWS in this order:

1. Choose one AWS region and use it for every deployment resource.
2. Create a private S3 artifact bucket in that region, for example `county-news-api-artifacts-<account-id>-<region>`.
3. Create the GitHub CodeConnections connection in the same region.
4. Create a CodePipeline from `Continuous integration` -> `CI Build NodeJS`.
5. Configure CodeBuild to use this repo's `buildspec.yml`.
6. Add this CodeBuild environment variable:

```text
ARTIFACT_BUCKET=<your-artifact-bucket-name>
```

7. Run the build stage and confirm it produces `packaged.yaml`.
8. Add a CloudFormation deploy stage that uses the CodeBuild output artifact and deploys `packaged.yaml`.
9. After deploy succeeds, open the `county-news-api` CloudFormation stack and copy `Outputs` -> `NewsApiUrl`.

Do not deploy raw `template.yaml` directly through CloudFormation. CodeBuild must run `sam package` first so `packaged.yaml` contains S3-backed Lambda code references.

The first deployment target is an ARM64 Node.js 20 Lambda with a Function URL. Add CloudFront later if traffic grows or edge caching becomes important.

## Frontend Integration Notes

Use page endpoints for initial frontend loads:

```text
GET /v1/pages/counties/texas/potter?sections=localNews,localSports,politics,economy,crime,obituaries,opinion&limit=48
```

Each section response includes `items: NewsFeedItem[]`, so the React UI can keep its card rendering simple.

Set the deployed URL in the frontend as:

```text
VITE_NEWS_API_URL=https://<function-url-id>.lambda-url.<region>.on.aws/
```

See `docs/news-coverage-strategy.md`, `docs/deployment.md`, and `docs/roadmap.md` for more detail.
