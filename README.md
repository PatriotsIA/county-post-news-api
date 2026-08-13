# The County Post News API

A Node.js/AWS Lambda API that aggregates national, state, and county news into JSON for The County Post frontend. It is designed for a low-cost first deployment with a Lambda Function URL and no database.

## Documentation

Start here:

- `docs/comprehensive-guide.md`: complete architecture, data flow, endpoint, configuration, deployment, operations, troubleshooting, and roadmap reference with diagrams and tables.
- `docs/deployment.md`: focused AWS CodePipeline, CodeBuild, CloudFormation, CORS, and frontend deployment walkthrough.
- `docs/news-coverage-strategy.md`: coverage model, sparse-county strategy, and future provider/source expansion plan.
- `docs/roadmap.md`: shorter implementation roadmap.

## Why This Exists

The frontend should not build and fetch many upstream RSS/search URLs in the browser. This service moves provider fan-out, freshness filtering, dedupe, topic filtering, and county/state fallback server-side. The frontend can request one page endpoint and render sectioned results.

Current providers:

- Google News RSS search
- Bing News RSS search
- GDELT Document API
- Direct publisher RSS/Atom feeds from the source registry

County coverage is tiered and locality-safe: strict county/state coverage is always first; a sparse section then adds state-qualified configured places and trusted local-market sources; only then can it add nearest same-state county coverage. It never falls back to broad state-topic inventory for a county route.

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
- `GET /v1/markets/metals`
- `GET /v1/markets/cattle`
- `GET /v1/counties/:stateSlug/:countySlug/population`
- `POST /v1/advertising/creatives/upload`
- `POST /v1/checkout/sessions`

Core topics are `general`, `sports`, `politics`, `economy`, `crime`, `obituaries`, and `opinion`. Editorial desk subcategories are `monetary-policy`, `markets-investing`, `jobs-business`, `property-taxes`, `municipal-bonds`, `budgets-levies`, `voting-systems`, `election-administration`, `audits-recounts`, and `open-records`.

`POST /v1/checkout/sessions` creates a hosted Stripe Checkout subscription for a County Post color card or section sponsorship. The API calculates the price from the server-side rate card; it rejects client-provided amounts. The response contains only a Stripe Checkout URL and session ID.

```json
{
  "placement": "color-card",
  "billing": "annual",
  "counties": [
    { "stateSlug": "texas", "countySlug": "potter" }
  ],
  "customerEmail": "advertiser@example.com",
  "businessName": "Example Business"
}
```

Annual checkout charges ten times the monthly rate and renews annually. The highest-priced county is charged at full rate; additional counties are charged at half their tier rate. Population tiers are calculated from the bundled U.S. Census Bureau Vintage 2025 county estimates; refresh them annually with `npm run update:populations`. Inventory remains subject to sales review until reservations are backed by a database.

The county population endpoint returns the same 2025 Census estimate and pricing tier used by Checkout, so the frontend can show a quote before creating a payment session. The 3,144-county lookup is bundled with the Lambda, requiring no public Census key or runtime Census request.

`POST /v1/advertising/creatives/upload` accepts an advertised JPG or PNG file name, MIME type, and byte size and returns a 15-minute S3 presigned POST form. The browser uploads the creative directly to a private, encrypted S3 bucket before Stripe Checkout starts. Stripe Checkout itself does not support file-upload fields. The resulting private asset key is attached to the Checkout Session for the sales team.

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
- `CACHE_TTL_SECONDS`: warm Lambda in-memory cache TTL, production default `300`.
- `REQUEST_TIMEOUT_MS`: upstream fetch timeout, default `3500`.
- `DEFAULT_LIMIT`: default items per section, default `48`.
- `MAX_LIMIT`: hard cap, default `200`.
- `COUNTY_FALLBACK_MIN_ITEMS`: minimum county section inventory before the next county-coverage tier is loaded, default `12`.
- `ARTICLE_MAX_AGE_DAYS`: hard article cutoff, default `183`.
- `FRESHNESS_FOCUS_DAYS`: freshness sort focus window, default `14`.
- `STATE_MARKET_LIMIT`: nearby state markets to search, default `4`.
- `COUNTY_MARKET_LIMIT`: configured/local market places included in a sparse county's market tier, default `3`.
- `COUNTY_NEARBY_LIMIT`: nearest same-state counties used as the final sparse-coverage tier, default `3`.
- `COUNTY_MARKET_TIER_ENABLED`: set `false` to skip the configured-place and trusted-market tier during a cautious rollout; default `true`.
- `COUNTY_AGENCY_QUERY_ENABLED`: set `false` to omit state-qualified county-agency searches; default `true`.
- `COUNTY_PRIMARY_QUERY_LIMIT`: bounded strict county query count, default `4`.
- `COUNTY_MARKET_QUERY_LIMIT`: bounded market/place query count, default `4`.
- `GDELT_ENABLED`: set to `false` to disable GDELT, default `true`.
- `GDELT_MAX_RECORDS`: max GDELT records per query, default `100`.
- `BING_NEWS_ENABLED`: set to `false` to disable Bing News RSS, default `true`.
- `PAGE_SECTION_CONCURRENCY`: max page sections aggregated at once, production default `4`.
- `UPSTREAM_CONCURRENCY`: max concurrent upstream requests per provider group, default `12`.
- `ARTICLE_IMAGE_LOOKUP_LIMIT`: max article pages scraped for missing images per feed, production default `4`.
- `MAX_RSS_URLS_PER_FEED`: RSS/provider URL cap per section, default `18`.
- `MAX_ARTICLE_QUERIES_PER_FEED`: article-search query cap per section, default `6`.
- `METALS_API_KEY`: Metals.dev API key. Set this only in the API runtime, never in a `VITE_*` frontend variable.
- `METALS_CACHE_TTL_SECONDS`: shared Metals.dev response cache duration, default `60`.
- `USDA_MARS_API_KEY`: USDA MyMarketNews MARS API key for the cattle ticker. `MARS_API_KEY` is also accepted as a local alias.
- `STRIPE_SK_KEY`: Stripe secret key used only by the API to create hosted Checkout sessions. Never expose this value to the frontend.
- `STRIPE_PK_KEY`: Stripe publishable key. It is not required for redirect Checkout, but may be used by a future embedded Checkout flow.
- `STRIPE_CHECKOUT_SUCCESS_URL`: absolute URL Stripe redirects to after a successful payment.
- `STRIPE_CHECKOUT_CANCEL_URL`: absolute URL Stripe redirects to after a cancelled Checkout.
- `ADVERTISING_CREATIVE_BUCKET`: private S3 bucket used for advertiser creative uploads. The SAM stack provisions this automatically; set it only for local development with an existing bucket and AWS credentials.
- `ADVERTISING_CREATIVE_MAX_BYTES`: creative upload cap, default `10485760` (10 MB).

## Request Logs

Every request logs one structured JSON line. Successful requests use `console.log`; failed requests use `console.error`.

```json
{"event":"api.request","ok":true,"method":"GET","path":"/v1/pages/counties/texas/potter","query":"limit=48","statusCode":200,"durationMs":842,"origin":"http://localhost:5173","referer":"http://localhost:5173/texas/potter"}
```

When a county needs coverage beyond strict primary results, the service additionally logs a `feed.sparse_county` JSON line with primary, market, nearby, and final counts. `meta.sourcesUsed` records the activated tiers as `county:primary`, `county:market`, and/or `county:fallback-nearby`.

## AWS Deployment

This repo is prepared for deployment from GitHub through an AWS-managed connection, not GitHub Actions.

Deployment files:

- `template.yaml`: SAM template for Lambda Function URL deployment.
- `buildspec.yml`: CodeBuild build/test/package steps for an AWS CodePipeline GitHub source connection.
- `docs/comprehensive-guide.md`: full deployment shape and operational reference.
- `docs/deployment.md`: step-by-step pipeline setup and troubleshooting notes.

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

See `docs/comprehensive-guide.md` for the full architecture and operations reference. Use `docs/deployment.md` for the step-by-step AWS console walkthrough.
