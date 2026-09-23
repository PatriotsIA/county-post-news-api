# News API reliability and cost — September 23, 2026

This release follows the PIA-002 reader-capacity incident, addresses PIA-045's
intermittent FRED failures, and measures PIA-039's memory/source-cache options.
PIA-003's existing refresh backlog remains under observation; no queued work is
removed and four-day retention stays in place.

## What changes

- Reader reserved concurrency increases from **20 to 50** against the verified
  regional quota of 1,000. CloudFormation applied the capacity-only change at
  17:44 UTC without replacement; the persisted parameter and template default
  now agree. This increases the ceiling without purchasing provisioned capacity.
- Entire shared-cache lookups/builds are coalesced within an instance. Memory
  caches retain at most 256 keys. Exact RSS URLs share in-flight requests and
  parsed documents for at most 60 seconds, bounded by the feed TTL and upstream
  Cache-Control/Age. ETag/Last-Modified support conditional 304 responses.
  Limits: 128 sources, 16 MiB of retained source-body bytes, 2 MiB per source;
  parsed JavaScript objects have additional memory overhead. Failures are not
  cached. Attribution, age/media filters and county selection run independently.
- FRED, USDA cattle and weather resources use the existing private S3 cache
  across instances. FRED's deadline is six seconds and cattle's eight seconds.
  Complete FRED results remain fresh for six hours; cattle for fifteen minutes.
  Partial responses retry after five minutes / one minute respectively. On an
  outage or a less complete refresh, use the previous snapshot for at most
  three days (FRED) / one day (cattle), marking it stale and preserving its
  original timestamp. Failed refreshes cannot continually extend that age.
  Shared storage retains its existing three-day lifecycle.
- Weather provider resources retain their individual TTLs. Expired forecasts,
  observations and emergency alerts are never used as an outage fallback. A
  bounded prior forecast-location mapping can still route live requests; if no
  mapping exists, independent point alerts, drought and rainfall can succeed
  with explicit partial-response warnings. Total resource failure stays a 502.
- County coordinates are generated at development time, removing runtime
  topology expansion and build-only map libraries from Lambda. Coordinates
  match previous values exactly except the documented Aleutians West dateline
  correction and newly supplied Chugach/Copper River census areas. Corrections
  use official Census internal points; see `scripts/generate-centroids.mjs`.
- Handled provider errors send `Cache-Control: no-store`; partial/stale economic and cattle
  data use a short edge TTL. A ninth operational alarm detects handled HTTP 5xx
  failures, which Lambda execution Errors misses: more than 1%, with at least
  five errors and fifty requests per five-minute interval, in two of three
  intervals. All ALARM/OK routes remain on `pia-operations-alerts` with Erik's
  confirmed subscription. Existing throttle and queue alarms remain active.

## Isolated measurements

Temporary ARM Node 22 Lambdas compared baseline `b28b3ce` with this release's
aggregation/cache implementation. No URL, schedule or queue trigger was added.
Only `benchmarks/news-efficiency-20260923/fixtures.json` and five distinctly
prefixed benchmark snapshots were written in the existing cache bucket.

The [harness](benchmarks/2026-09-23/handler.mjs) captures public upstream bodies,
status/headers and elapsed fetch times once, then replays the same recordings
for each variant. Five cases cover national general, Texas politics, Potter and
Randall general, and Harris markets-investing. Each run includes fresh builds,
memory hits, and real S3 snapshot hits. Upstream fixtures are deliberately not
committed. Ordered story IDs, titles, links, sources and publication dates match
across every variant; image decoration and changing response timestamps are not
part of that equality check. This is a bounded comparison, not a nationwide
load test or a statistically reliable production p95 estimate.

Reader timeout profile (3.5 seconds), five runs per variant, four warm runs:

| Variant | Median five-build batch | Maximum warm batch | Compute GB-seconds/batch | Upstream fetches |
| --- | ---: | ---: | ---: | ---: |
| Baseline 1,536 MB | 32.054 s | 32.079 s | 48.080 | 332 |
| Candidate 1,536 MB | 32.016 s | 32.082 s | 48.024 | 321 |
| Candidate 1,024 MB | 33.789 s | 33.882 s | 33.789 | 321 |

Keep the **reader at 1,536 MB**: smaller memory makes county builds about
10–12% slower even though aggregate compute is about 30% cheaper. The source
cache removes 3.3% of fetches in this particular workload without changing
stories; it does not establish a corresponding reduction in Lambda duration.
Shared provider caching has separate benefits not measured in this news replay.
Do not add these percentages together or extrapolate them to the whole AWS bill.

Reader raw results and exact signatures are stored beside the harness. Observed
cold initialization was 817 ms baseline / 591 ms candidate at 1,536 MB, and
641 ms candidate at 1,024 MB; single observations are directional evidence only.

Worker timeout profile (eight seconds), five runs per variant: warm median
batches were 63.735 s baseline / 63.776 s candidate at 1,536 MB and 65.422 s
candidate at 1,024 MB. Smaller memory suggests roughly 32% lower compute cost
with 2.6% slower refreshes. Core story signatures match across all variants.
However, all worker replays encountered 39 unrecorded fetches, and URL-only
capture does not distinguish the bodies of image-resolution POSTs. These
results do not qualify full image/enrichment parity or production p95. Keep the
**worker at 1,536 MB and concurrency six** while the older queue drains. Any
future reduction should repeat with method/body-aware recordings, image
coverage checks and a wider county sample, then check live queue throughput.
Worker raw reports and summary are included beside the reader results.

## Validation and release procedure

The packaged CloudFormation preview `news-efficiency-review-20260923` is
CREATE_COMPLETE and is not executed. Its effective property changes are the
three Lambda code artifacts and non-secret timeout/cache settings plus the new
HTTP alarm; packaging also removes incidental SAM metadata. There are no
removals or replacements. Queue retention, concurrency six, both news memories
1,536 MB, edge behavior, provider secrets and all existing routes are preserved.
Neither capacity parameter is overridden by the pipeline.


**188 tests across 21 files pass** on Node 22. Tests cover source coalescing, independent attribution/age/media rules,
conditional requests, upstream cache restrictions/Age, cold-instance provider
reuse, partial retries, bounded dated fallbacks, expired-alert rejection,
coordinate parity and HTTP error caching. Run typecheck, tests, TypeScript build,
SAM lint and SAM build before merging through the main CodePipeline. Runtime
`npm audit --omit=dev` reports zero vulnerabilities on this date.

Preserve every existing CloudFormation parameter and secret. Preview the packaged
template with `UsePreviousValue`, inspect the resolved changes, then release the
reviewed commit through GitHub main → CodePipeline. Check deployed code, reader
reservation, worker memory/concurrency, nine notification routes, public CORS,
cache hits and real weather/FRED/cattle responses. Use the status script and
matched CloudWatch windows to distinguish pre-release and post-release traffic.

At 18:11 UTC, visible refresh depth was **10,163**, down from about 33,000 the
previous day, with six jobs in flight and an empty DLQ. The previous hour had
1,288 deletes and zero sends, but oldest age was still roughly 49 hours. A
falling count alone does not resolve PIA-003 or prove all counties are fresh.

## Rollback

Revert application changes through the same pipeline while retaining reader
capacity 50, four-day queue retention and existing alert routes. Memory can be
restored independently if refresh throughput or memory pressure worsens. Do not
purge queues, expire stored news early, disable schedules or restore PIA news
fetching. Provider snapshots remain compatible `{storedAt, value}` records;
`freshForSeconds` is optional for older readers.
