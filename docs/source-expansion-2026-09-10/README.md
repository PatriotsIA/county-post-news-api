# County Post source expansion — September 10, 2026

This report records the local source review and validation completed in `county-post-news-api` and `the-county-post` before release. Deployment uses the existing GitHub main → CodePipeline and Amplify connections; live deployment checks are separate from the local results below.

The directory now has 144 additional reviewed profiles: **92 county/regional profiles and 52 statewide profiles**. These represent 141 publisher websites not previously listed anywhere, plus expanded coverage for three existing publishers. Every current county route gains at least one listing. County/regional additions benefit **138 counties**; most nationwide gains come from explicitly labeled statewide supplements. **2,462 counties still have no verified county/regional publisher in the directory.** This is a verified expansion and a nationwide discovery pass, not a completed census of local publishers.

| Measurement | Before | After |
| --- | ---: | ---: |
| Counties with a reviewed listing | 602 | 3,143 |
| County-to-publisher directory listings | 808 | 4,175 |
| Distinct publisher websites | 722 | 863 |
| Counties whose listing count increased | — | 3,143 |
| Counties gaining a county/regional publisher | — | 138 |

Counts use the application's existing **3,143 unique county routes and FIPS codes**, including its independent-city distinctions and existing Connecticut county geography. This change does not migrate to Connecticut planning regions. A repeated statewide publisher on several county pages counts as several listings but only one publisher website.

## Deliverables

- [County-by-county coverage and candidate sources](county-coverage.csv): all 3,143 routes, FIPS, before/after counts, approved additions, publisher types, coverage labels, unapproved discovery domains, sample evidence links, and remaining gaps. Import FIPS as text to preserve leading zeros. Array-valued columns contain JSON arrays.
- [Publisher approval evidence](publisher-review.json): 144 approvals and 18 held review decisions, with coverage boundaries, categories, evidence URLs, check times, snapshot hashes and feed registration decisions. Source pages and feed samples were checked; these records contain no full article bodies.
- [Previously unreviewed scored queue](pending-queue.csv): 325 candidates, of which **93 are now approved, 17 held, and 215 still pending**. The broader review file also includes an unresolved entry for an already-listed publisher, explaining its one additional hold.
- [Coverage totals](summary.json), [runtime feed results](runtime-feed-check.json), [local HTTP/browser results](local-integration.json), and [raw-evidence checksums](evidence-checksums.json).

“Pending” is the repository's discovery/review queue, not permission to treat every search hit as a verified local newsroom. Lower-evidence observations still need current publisher identity and geographic review. Raw observations were not bulk-promoted.

## Classification and coverage

The County Post directory now displays and filters **Newspaper, TV channel, Radio station, and News website**. A publisher can have multiple types, such as KPBS television/radio or a radio newsroom with a news website. These describe publishing formats; they are not reliability scores, ownership categories or endorsements.

Coverage is a separate field: **Local**, **Regional**, or **Statewide** for the new profiles. Existing profiles whose coverage granularity was not reviewed in this pass display **Local / regional**, preserving their prior directory scope. New entries include an “About this source” link where publisher information is available. Filters have accessible names, an announced result count, and a clear no-match state.

The statewide layer uses one state-focused newsroom per state from the [States Newsroom owned/partner directory](https://statesnewsroom.com/newsrooms/), plus [Hawaiʻi Public Radio](https://www.hawaiipublicradio.org/about) and the [Mississippi Free Press](https://www.mississippifreepress.org/about/). [WTOP](https://wtop.com/) supplies an additional Washington-region outlet for DC and explicitly listed neighboring counties. National “DC Bureau” and Stateline entries were not substituted for a DC local publisher.

Statewide sources are supplements. Their policy reporting does not establish routine coverage of every county's schools, courts or community events. The state layer relies heavily on one network's directory of owned and partner outlets; it is not evidence of independent ownership or editorial diversity in every county.

Examples of reviewed regional coverage include [KPBS in San Diego and Imperial counties](https://www.kpbs.org/about-us), [Potomac Local's specifically named Virginia counties and cities](https://www.potomaclocal.com/about/), and [WECT's five-county service area](https://www.wect.com/). The [Village Reporter rate card](https://thevillagereporter.com/wp-content/uploads/2026/01/2026-Rate-Card.pdf) supports Fulton and Williams counties in Ohio.

## Discovery and review findings

The fresh discovery run searched **all 3,143 routes**, using general-news queries with four provider feeds per county and four county workers. It found **5,900 county-to-publisher observations across 1,391 domains**, covering **2,293 counties**. The other **850 counties produced no new candidate observations in this bounded pass**. That does not mean they have no publishers. Sports, obituary and crime discovery passes were not rerun nationwide, and these numbers do not establish all-topic story coverage.

Publisher checks covered 159 targets in two batches, followed by three explicit holds from the earlier queue. Reviews checked current mastheads, publisher service-area statements, feed metadata, and canonical county/place mappings. HTTP success alone was insufficient: Tidewater News was held because the current guest-post/commercial site did not establish the queued historical Southampton newspaper identity. Richland Today was held for inconsistent identity and wrong-state observations. Other holds include unavailable/blocked publisher pages or insufficient scope evidence. Access restrictions were respected.

Approval boundaries corrected several misleading search matches:

- Henrico Citizen: Henrico County, Virginia.
- McKenzie County Farmer: McKenzie County, North Dakota.
- Badger Herald: Dane County, Wisconsin, excluding the Winnebago observation.
- Clinton County Daily News: Clinton County, Indiana, excluding the Kentucky observation.
- WCJB: Gainesville/Ocala/Lake City counties in Florida, excluding Georgia's Marion County.
- Post Bulletin: reviewed Wabasha County coverage in Minnesota, excluding the Iowa observation.
- Hudson Valley One and Tillamook County Pioneer: narrower reviewed scope where the additional observed county lacked sufficient evidence.

These corrections apply to approved directory profiles. Existing discovery feeds remain untrusted; this pass does not recertify or rewrite every legacy feed or all 722 previously listed publisher websites. Fresh candidate URLs in the county CSV remain discovery evidence even when the same publisher was independently approved for a particular scope.

## Feed behavior and validation

Every new profile explicitly has `trustedForCountyTier: false`. Directory approval therefore cannot make unrelated stories local merely because they came from an approved regional or statewide publisher. The existing county/place/state checks, topic filtering, story deduplication, trust rules and query budgets remain in effect. Exact duplicate direct-feed URLs are fetched once per plan, with reviewed publisher metadata taking precedence over discovery metadata. Statewide matching is explicit and confined to the named state.

The 144 profiles have **135 enabled feed entries**. Some were already discovered feeds, so this is not a claim of 135 newly found URLs. Seven profiles had no usable feed identified. Two more publishers, **NBC 7 San Diego and New York Focus**, parsed successfully during discovery but exceeded the local runtime timeout on two attempts; their new feed registrations are deferred while their directory profiles and domain-targeted search remain available. The pre-existing NBC discovery entries are unchanged. No timeout or global article-age setting was increased to make them pass.

| Check | Result |
| --- | --- |
| API typecheck and production build, Node 22 | Pass |
| API regression suite | 131 tests pass |
| County Post production build and sitemap | Pass; 15,787 sitemap URLs |
| County Post lint | Pass with four pre-existing hook warnings |
| County Post browser suite | 37 tests pass |
| Real local source endpoint sweep | 3,143 successful responses; every count increased; no HTTP failures |
| Directory endpoint latency on this workstation | Median 2 ms; p95 3 ms, four concurrent workers |
| Real frontend/local API samples | Seven county routes, desktop and 320px; no page errors or horizontal overflow |
| Publisher feeds through the API parser | 137 checked; 135 successful with dated recent items; two repeat timeouts deferred |

The feed check used this workstation's existing **3,500 ms timeout**. KGAB timed out once and passed its one retry. The two persistent timeouts were not retried indefinitely. Discovery's slower publisher verification and runtime feed compatibility are reported separately.

The regression suite includes county/state separation, same-name county exclusions, independent city/FIPS uniqueness, directory/feed deduplication, source types, and rejection of unrelated national, wrong-county and wrong-state stories from an approved statewide publisher. One existing publisher-family fixture was narrowed to search-provider URLs so newly added direct feeds would not artificially relabel its stories.

Real browser samples covered Arkansas Polk, Florida Polk, Texas Loving, Wyoming Campbell, New York Ulster, DC and Hawaii Honolulu. The local API's existing CORS settings initially excluded the isolated test port; the final run allowed that localhost origin through a process-only override. No production configuration changed. Third-party widgets were excluded from this integration check; the broader browser suite still emitted existing widget ResizeObserver messages while all assertions passed. The production build also retains its existing large-chunk advisory.

These checks establish directory availability, source classification, geographic matching and feed parsing. They do not guarantee story volume, publisher uptime, future editorial quality or production feed latency after deployment.

## Reproduction and release state

The changes were prepared on API branch `sources/nationwide-expansion` and frontend branch `sources/nationwide-directory`. The user authorized their production release after reviewing the local findings. Deployment targets are `county-news-api-pipeline` and County Post Amplify app `d2z6lt4e5q50in`, both following GitHub `main` in `us-east-2`.

Use Node 22 for both projects. Standard API checks are `npm run typecheck`, `npm test`, and `npm run build`. Frontend checks are `npm run lint`, `npm run build`, and `PLAYWRIGHT_PORT=4186 npm run test:e2e` with Chromium installed. The test server uses a strict isolated port.

The fresh raw discovery and publisher snapshots are retained locally under `coverage/source-expansion/` in the API project; their hashes are recorded here. They are ignored runtime artifacts. Rebuild the county report with:

```sh
node --import tsx scripts/discover-sources/report-expansion.ts \
  coverage/source-expansion/baseline.json \
  coverage/source-expansion/fresh-discovery/discovered.jsonl \
  docs/source-expansion-2026-09-10
```

`scripts/discover-sources/review-publishers.py` performs bounded, read-only checks of controlled seed files. It does not approve sources. Runtime approvals are the explicit reviewed records in `src/reviewed-supplemental-sources.ts`. Future reviews should address the 215 remaining scored candidates, the held records, and especially counties marked as statewide-only in the CSV.

The local integration runner and desktop/mobile screenshots are retained in the frontend project's `coverage/source-expansion/`, with the runner at `coverage/verify-source-expansion.mjs`. Deploy the API registry before or alongside the frontend when releasing this batch; the new frontend accepts the old response shape, and existing consumers can ignore the optional metadata.
