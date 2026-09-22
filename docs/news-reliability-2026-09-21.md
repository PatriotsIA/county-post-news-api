# News reliability — September 21, 2026

Tracked work: **PIA-002**, **PIA-003**. The former **PIA-004** news-routing
recommendation was withdrawn after confirming PIA has no news consumer. Preserve uninterrupted
service and all AWS alarm/recovery destinations at **erik@patriotsinaction.com**.
This branch includes the earlier notification source changes so a later release
keeps the verified live alert routing.

**September 22 follow-up:** the complete PR now defaults to twenty reserved API
executions and six workers, with reader API throttle/execution alarms and an
acknowledgement-window fix for local refresh deduplication. The [release runbook](news-reliability-2026-09-22.md)
supersedes the proposed settings and validation below; this document retains
the original investigation and mitigation history.

## Observed production state before the quota increase

- PIA account `426771918029`, `us-east-2`: regional Lambda concurrency is **10**,
  shared by News API, refresh worker, warmer, Mighty, candidates and Classifieds
  signup. No API reserved concurrency is configured; worker maximum is **3**.
- At 01:35 UTC September 22 (September 21 local), SQS held about **28,627** visible
  jobs and retained them for **86,400 seconds**. No jobs were consumed or purged
  during diagnosis.
- The 24-hour CloudWatch query ending 01:53 UTC returned **30,825** messages sent,
  **11,535** deleted, maximum oldest age **86,401 seconds**, and **1,180** News API
  throttles from **92,636** invocations (zero Lambda execution errors). Hourly
  aggregate metrics are approximate throughput evidence, not unique-job counts.
- The existing warmer can supply **14,400 jobs/day** before reader requests.
  Earlier observations of 13–15k daily completions and the latest 11.5k both
  demonstrate that scheduled demand consumes most or all worker capacity.
- The existing edge `https://d2vo13idhuovzg.cloudfront.net` returned matching
  Potter general and Texas politics feeds and a repeat CloudFront cache hit.
  Those shared snapshots were stale: cache routing alone does not repair refreshes.
  The earlier PIA routing recommendation was based on unused client/configuration
  remnants. PIA's live pages use Vimeo and Mighty API feeds and link to County Post.

## Live mitigation and external dependency

The regional quota increase from **10 to 1,000** was submitted through Service
Quotas. Request `bc8581f8b5c848da9dcece3c866137fbbT4oNf9G` is **CASE_CLOSED**, AWS
case **179004092500914**. The effective regional limit was verified at **1,000**
on September 21 (September 22 UTC). The increase itself creates no resources
and has no charge; newly executable workload still incurs normal usage charges.
Recheck Service Quotas and `lambda get-account-settings` before allocating capacity.

A separate, deployed-template-based CloudFormation change set
`news-retention-only-20260921` changes only
`FeedRefreshQueue.MessageRetentionPeriod` from **86,400 to 345,600 seconds**.
Every parameter uses its previous value; application code, permissions,
concurrency, routing and alarm actions are unchanged. Independent review of
`describe-change-set --include-property-values` found exactly one static property
change with no replacement. The default description also lists dynamic reference
dependencies; the resolved property view excludes them. The stack reached
**UPDATE_COMPLETE**. SQS readback confirms **345,600** seconds, unchanged
visibility timeout **1,080**, and three in-flight jobs. All three News Lambda
code hashes and modification timestamps match the pre-change snapshot. No
application code was deployed. The remaining backlog still requires the
application and capacity rollout; retention is only an expiry buffer.

The private deployed-template and function-version snapshots are under
`~/.local/share/pia/news-reliability/20260921/`. They must not be committed.

## Prepared application changes

- Reduce scheduled admission to **30 targets per five-minute pass** (at most
  **8,640/day**). Every geography/topic remains in rotation; county general has
  the largest allocation. [Feed documentation](feeds.md) records the slower
  dormant rotations and corrects the former inaccurate county-specialty cadence.
- Cache approximate SQS depth for 30 seconds and defer scheduled work before
  reader work. Default pending thresholds are 250 scheduled specialty, 500
  scheduled general, 1,000 reader specialty, and 2,000 reader general. General
  county desks benefit from the higher general threshold. This does not reorder
  existing messages or establish a strict distributed queue-size ceiling.
- Coalesce concurrent per-feed sends within a process while retaining FIFO
  five-minute deduplication. Deferred/failed sends remain retryable; missing
  queue metrics fail open with a warning. Existing S3 snapshots, freshness rules,
  worker retry behavior and topic/geography contracts are preserved.
- Give only the API and warmer `sqs:GetQueueAttributes` on this queue. Preserve
  all six ALARM/OK SNS actions.
- Add optional `NewsApiReservedConcurrency` (default **0**, meaning omitted)
  and `FeedRefreshMaximumConcurrency` (default **3**). Default deployment remains
  compatible with the former ten-slot quota. Add SAM lint to the build gate.
- Remove PIA from the template's edge warm targets because it no longer consumes
  news. Keep County Post's page/feed priming, explicit origin configuration,
  API/CORS compatibility and all freshness/coverage behavior. This is a small
  cost cleanup, not the main Lambda saving: September 18–20 PIA-origin calls
  used about $0.20/month of API duration at that observed rate, and all worker
  post-build overhead combined was about $0.61/month.

These code changes are prepared for review, not deployed by the retention update.

## Controlled application release

1. The effective regional quota is now **1,000**. For a controlled release, propose
   **20** reserved executions for the reader API and worker maximum **6**, leaving
   **980** unreserved for workers, warmer and other projects. The API reservation
   is also its ceiling, so watch API throttles and duration. Keep worker maximum
   three until the reviewed application release; measure spend and do not exhaust
   other projects' shared capacity.
2. Preserve every existing CodePipeline CloudFormation override and secret when
   setting the two concurrency parameters. Review the source commit, SAM package
   and actual application change set. `main` is the production pipeline source;
   merging this branch starts an application release.
3. Run typecheck, full tests, build and `sam validate --lint`. Deploy queue
   admission code and its scoped permission together. Keep the live four-day
   retention and confirmed Erik SNS actions. No queue purge or service stop is
   part of the rollout.
4. Verify bounded health and news reads with County Post apex/www
   origins, pagination, stale metadata and edge hits. Check API throttles,
   `feed.refresh_depth_unavailable`, `feed.refresh_deferred`, `warmer.pass`, worker
   errors, DLQ and oldest-job age. Compare sent/deleted rates in the same window;
   require sustained net drain before treating PIA-003 as resolved. Approximate
   deferrals may lengthen dormant rotations; tune only with measured headroom.
5. Confirm County Post still uses its expected edge URL. No PIA frontend news
   rollout is needed; preserve its candidate, community/calendar and Vimeo
   integrations. The unused PIA client cleanup can be reviewed separately.

If application checks fail, use the previous known-good application artifact
while retaining safe queue retention and notifications. Do not blindly deploy an
old template that removes alarm actions or drops retention back to one day. Roll
the frontend URL back independently if needed. Lowering retention while old jobs
remain can expire them; increasing the buffer alone does not fix throughput.

## Validation

- Full News regression suite: **160 tests passed** across 16 files, including
  County Post's national/county/specialty warm paths and explicit extra origins.
- TypeScript build and typecheck passed.
- SAM template validation with lint passed; no warnings.
- Independent review covered deferred-send races, failure retryability, queue
  isolation, resource scope and concurrency defaults. A coalescing race found
  during review was fixed and has a regression test.
- The earlier PIA news URL proposal was closed because there is no active news
  consumer. This application rollout does not require a PIA frontend release.

AWS references: [reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html),
[queue retention and update behavior](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-sqs-queue.html),
[FIFO deduplication window](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-key-terms.html).
