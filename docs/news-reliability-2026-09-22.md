# News reliability release — September 22, 2026

PIA-002's regional quota blocker is resolved. PIA-003 stays open until the
application has deployed and measured backlog/freshness recovery is sustained.
PR: https://github.com/PatriotsIA/county-post-news-api/pull/1.

## Release contents

- Reserve **20** executions for the reader API; raise the refresh worker maximum
  from **3 to 6**. These new CloudFormation parameters have release defaults of
  20 and 6, so the first merge applies them without rewriting pipeline secrets.
  The API reservation also caps concurrency. The effective regional quota is
  **1,000**, leaving **980** unreserved for workers, warmer and other projects.
- Cap scheduled supply at **30 targets per five minutes** (8,640/day), and defer
  new work based on queue depth, favoring reader requests and general desks.
  Existing messages and shared feed snapshots are retained. FIFO identities,
  worker retries, source selection, geography/topic coverage and API contracts
  stay intact. Dormant rotation is slower; see [the exact cadence](feeds.md#speed-srccachets-srcwarmerts).
- Coalesce local refresh requests through five minutes after SQS acknowledges
  a send. Deferred and failed attempts remain retryable. A failed depth read
  logs a warning and allows work rather than preventing all refresh requests.
- Preserve **four-day queue retention**, the existing six alarm/recovery routes,
  and the confirmed `erik@patriotsinaction.com` subscription. Add API throttle
  and execution-failure alarms to the same topic. Lambda `Errors` detects
  execution failures/timeouts, not every handled HTTP error; public checks remain necessary.
- Stop default PIA edge priming. County Post priming and explicit additional
  origins remain supported. PIA retains Vimeo, Mighty and external County Post
  links. No frontend, DNS, canonical URL, sitemap, SEO, memory or source-coverage
  changes are part of this release.
- Correct county general-feed availability metadata so the site's increasing-
  limit **Load more** requests can reach stories beyond the initial slice.
  Count publisher-eligible stories reachable by the largest supported request;
  preserve existing publisher balancing and first-page selections. This does
  not redesign chronological/diversity ordering for external offset clients.

## Verified pre-release baseline

Read-only checks on September 22 confirmed account `426771918029`, region
`us-east-2`, quota 1,000, no current API reservation, worker maximum three, and
stack `county-news-api` in `UPDATE_COMPLETE`. Around 18:16 UTC the refresh queue
held **32,957 visible / 3 in-flight** messages with 345,600-second retention.
The API's maximum reported concurrency over September 15–22 was **12** across
187 hourly datapoints; twenty provides headroom over that observation, not a
guarantee for future bursts. All reads avoided consuming or purging messages.

At 18:35 UTC, queue depth was **33,083 visible / 3 in-flight**, DLQ zero.
The matched 17:35–18:35 UTC window had **1,071 sends / 446 deletes**, zero API
throttles/errors, API concurrency peak ten and worker peak three. At those rates,
doubling worker capacity alone would still not keep pace; admission controls
are essential. Six existing alarm/recovery routes and Erik's confirmed
subscription were verified; the two new API alarms await this release.

Ten bounded public checks returned successful health, feed/page, CORS and
preflight responses. Texas politics and national general were fresh. Potter's
page/feed shared a **7h25m-old** snapshot with 44 attempted / 28 failed provider
requests, so freshness recovery must also be checked against upstream failures.
The repeat apex request hit CloudFront; apex/www origins stayed separate.
These checks also found the existing Load more metadata defect addressed here.

## Validation and infrastructure preview

- **169 tests across 18 files passed** on Node 22 with
  `DOTENV_CONFIG_PATH=/dev/null`, including real cache/admission integration,
  delayed SQS acknowledgement, county Load more and publisher-balance cases.
- Typecheck, TypeScript build, SAM lint and SAM build passed. The three packaged
  functions contain the final compiled source. A scoped filename check found no
  `.env*`, credentials, `.aws`, `.ssh` or `.git` content in those artifacts.
- Independent application and infrastructure reviews completed. The existing
  CloudFormation deployment role permits adding/removing API concurrency.
- AWS change set **`news-reliability-review-20260922`** is `CREATE_COMPLETE` /
  `AVAILABLE` and was **not executed**. All twelve existing parameters use their
  previous values; the two new parameters resolve to **20 / 6**. Its resolved
  property view (`describe-change-set --include-property-values`) contains six
  in-place modifications and two added alarms, **no removals or replacements**.
  Only function artifacts, concurrency, default worker priming origin, and the
  two scoped queue-read policies change. Queue/storage/CloudFront/Atlas settings
  are unchanged. The default change view also lists conditional reference
  dependencies; the resolved view confirms they have no effective changes.

The preview artifact is in the existing pipeline artifact bucket under
`reliability-review/20260922/54f7e28ade2763bc05d28fcafc70a36d`. Release through
the merged-main pipeline so production has source/build provenance; do not
execute this review-only change set. Local validation is not a GitHub CI result.

## Merge and verification

1. Review the final PR and successful local validation. Production pipeline
   `county-news-api-pipeline` reads `PatriotsIA/county-post-news-api` **main**;
   merging starts CodeBuild and its `CREATE_UPDATE` CloudFormation action.
   CodeBuild runs SAM lint, typecheck, tests, TypeScript build, SAM build and
   packaging before deployment. The PR branch itself does not deploy.
2. Preserve existing pipeline overrides and secrets. At review time neither
   concurrency parameter existed in the live stack. Verify no override supplies
   different values. New parameters take the template defaults on this first
   update; later capacity changes must account for persisted parameter values.
   Do not change `EnableEdgeCache`, CORS, provider keys, Stripe, Atlas parameters,
   queue retention or any unrelated project's resources.
3. Follow the pipeline execution for the merged commit through `Succeeded` and
   the application stack through `UPDATE_COMPLETE`. Read back API reservation
   **20**, worker maximum **6**, four-day retention, and all eight ALARM/OK
   routes to the confirmed Erik topic. Deployment success alone is insufficient.
4. Use the read-only status command before release and again after 15, 30 and
   60 minutes:

   ```sh
   python3 scripts/ops/news-reliability-status.py
   ```

   Early snapshots verify settings and point-in-time queue depth. The default
   one-hour metric window still includes pre-release traffic at +15/+30 minutes;
   allow at least **65 minutes** for a fully post-release window after rounding.
   Compare sends and deletes over identical, fully post-deployment windows.
   SQS metrics are approximate and include deduplication/retries; counts alone
   do not prove unique-job throughput. Require falling visible depth and oldest
   age over sustained windows, no growing DLQ, and no API throttles/errors.
   The initial 33k backlog will not clear immediately. Increased worker usage
   may temporarily increase cost while draining it.
5. Check logs for `feed.refresh_depth_unavailable`, `feed.refresh_enqueue_failed`,
   `feed.refresh_deferred`, `feed.refresh`, and `warmer.pass`. Deep-backlog
   deferrals are expected; persistent depth-read failures are not. Inspect actual
   feed `fetchedAt` advances as well as queue drain: retries/degraded provider
   responses can leave older snapshots intact.
6. Make bounded public reads through `https://d2vo13idhuovzg.cloudfront.net`:
   `/health`, national general, Texas politics, Potter County general and its
   lead page. Verify apex/www CORS, pagination, response scope/topic, nonempty
   lead feeds, original timestamps/stale metadata, and repeat edge hits.
   Do not issue cache-busting nationwide audits while the backlog drains.
7. Close PIA-003 only after sustained drain and improving public freshness are
   observed. PIA needs no frontend news release.

## Rollback without dropping work

If API throttles appear at the new cap, first inspect concurrency and request
duration. Raise `NewsApiReservedConcurrency` within available regional capacity,
or set it to **0** to remove the reservation; zero omits the Lambda property and
does **not** disable the API. Worker maximum can return to **3** independently.
Use a reviewed CloudFormation update with every other parameter's previous value.
Retain any chosen emergency overrides for subsequent pipeline deployments.

If application behavior regresses, prepare a revert PR or deploy the previous
known-good application artifact with a template retaining four-day retention and
all alarm routes. Do not blindly redeploy the old main template: it lacks these
safeguards. Do not purge queues, clear shared feed snapshots, disable schedules,
switch frontend URLs or lower retention during backlog recovery.

Provider-key migration/rotation (PIA-007), memory/source-work optimization
(PIA-039), and dormant PIA client cleanup remain separate work.
For feeds requiring dominant-publisher balancing, increasing the requested
window can change article selection. The current frontend replaces the feed
using an increased limit; it does not append offset pages. A stable ordering
contract for external offset clients needs a separate editorial/API decision.
