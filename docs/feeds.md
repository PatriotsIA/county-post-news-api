# County feeds: relevance, sources, and speed

How a story earns its place on a county desk, where the data behind that
decision comes from, and why readers get answers in half a second when building
one from scratch costs twenty. This documents the architecture as of September
2026; the companion client-side notes live in the frontend repo's
`docs/feeds.md`.

## The goal the design serves

As many genuinely county-relevant stories per desk as the sources can supply,
across every category — general, sports, obituaries and public notices,
politics, economy, crime, opinion, weather. A story qualifies when the news
takes place in the county, whoever published it: a regional station's report on
a Hall County data center is Hall County news. The failure modes to design
against are symmetric — an empty desk in a real community, and a desk carrying
another county's stories as its own.

## How a story qualifies (`src/filter.ts`)

Locality is decided from text plus data, in this order:

1. **Wrong state, out.** Text naming another state never qualifies.
2. **A distinctive county name stands alone.** "Angelina County" appears in one
   state; a headline naming it needs nothing else — and such headlines rarely
   repeat "Texas". County names found in three or more states (Polk, Hall,
   Franklin, Washington) need the state alongside, or corroboration below.
3. **A distinctive town name stands alone.** Lufkin, Mena and Quitaque each
   exist in one state, so the name is its own state qualifier. Distinctiveness
   is data, not judgment: `ambiguousPlaceNames` in `county-places.ts` marks
   every town name found in three or more states, measured across all of GNIS.
4. **Ambiguous town names need a dateline** — "Memphis, TX" or
   "Memphis, Texas" — which supplies the state itself.
5. **Ambiguous names corroborate each other.** Hall County, Texas is why this
   exists: the county name is shared by three states and its towns are Memphis,
   Turkey and Lakeview, so no genuine headline about it can qualify on any
   single name. The county name plus one of its towns counts ("Hall County set
   to receive data center near Turkey"); two of its towns together count; each
   alone still does not.
6. **A trusted source's stories qualify by provenance.** Right for an outlet
   that covers one county — the Mena Star, Polk County, Arkansas — and granted
   only by hand; see the registry section.

Retrieval and filtering divide the work deliberately: queries fetch broadly
(the state-qualified town-name query out-yields the county-name query several
times over; a dateline *query* form was measured near zero and removed), and
the filter provides the precision.

## The scope contract with the browser

The frontend re-checks locality on what it renders and owns none of the data
above, so every county response's `scope` carries the filter's inputs:
`places` (distinctive towns), `datelinePlaces` (ambiguous towns),
`trustedHosts`, and `countyNameDistinctive`. The client mirrors the rules from
these fields exactly. History says any drift between the two filters shows up
as "the API returned fifty stories and the page rendered three" — change both
sides together, and extend the scope rather than letting the client guess.

### The Local Sources directory reads the registry too

`/v1/sources/counties/{state}/{county}` publishes the reviewed
`countyNativeSources` profiles (name, website, outlet types, aliases — no feed
URLs) and backs the frontend's Local Sources page. The frontend keeps no copy
of the registry: its static list drifted once and Potter County's directory
showed "no sources" while three Amarillo newsrooms were trusted here. Promote
an outlet in `source-registry.ts` and the county's directory page updates on
the next API deploy.

## Place data (`src/county-places.ts`, `npm run update:places`)

Every county's towns, most populous first, from three public-domain federal
sources that each cover the previous one's gap:

1. **Census subcounty population estimates** — incorporated places and CDPs,
   with population to rank by. Published as Windows-1252; decoding as UTF-8
   corrupts every accented name.
2. **2020 Census Gazetteer county subdivisions, Connecticut only** — the last
   file carrying the legacy county FIPS this site is organised by; every newer
   vintage reports planning regions instead.
3. **USGS GNIS domestic names** — unincorporated communities the Census files
   omit, which in the smallest counties is the county seat itself (Gail, TX;
   Sarita, TX; all of Hawaii outside Honolulu). GNIS entries are unranked, so
   they are ordered by Census place land area — without that, Hawaii County led
   with "Elevenmile Homestead" instead of Hilo — and "(historical)" ghost towns
   are dropped. GNIS is also the corpus behind the ambiguity split.

Coverage is 3,143 of 3,143 counties, asserted in tests. Hand-written overrides
in `geo.ts` merge with the generated list rather than replacing it. Market
cities (the regional hubs whose newsrooms cover a county from outside) are kept
strictly separate from a county's own towns: the market tier wants Amarillo for
Briscoe County, the county tier must never see it as local.

## Sources: reviewed trust, discovered fetch

Two registries with deliberately different powers:

- **`countyNativeSources` (`source-registry.ts`) — reviewed, trusted.** Every
  story from these outlets lands on their counties' desks without naming them.
  Entries are added only after a human confirms the outlet is that county's own
  (the Athens Review is Henderson County's; Athens is its seat). A profile
  without feeds still earns a targeted `site:` search plus trust — how the
  Lufkin Daily News leads Angelina County despite publishing no usable RSS.
  Adjacent counties may share entries: Amarillo straddles Potter and Randall,
  so its newsrooms are native to both.
- **Reviewed but untrusted** (`trustedForCountyTier: false` on a reviewed
  entry): a real local newsroom listed on the Local Sources page whose feed
  mixes syndicated national wire (Gray/TEGNA/Scripps/CNHI platforms), or whose
  hostname serves several counties' papers. Fetched and listed; stories still
  pass the text rules. The flag propagates when native feeds are flattened
  into direct sources — dropping it there once made every such feed trusted
  through the side door.
- **`county-discovered-sources.ts` — generated, fetched, never trusted.**
  Produced by the discovery pipeline; every entry carries
  `trustedForCountyTier: false`, so its feed is pulled for the counties it was
  observed covering while its stories still pass the text rules. This is where
  the volume comes from without the flooding risk — trusting one East Texas
  station outright would put the whole region on twenty county desks.

Why trust stays manual: the counties-per-host heuristic mislabels statewide
wires that happen to match few counties (The Center Square, Courthouse News),
and same-named papers exist — memphisdemocrat.com reads like Hall County,
Texas's weekly and is actually Memphis, Missouri's, caught only by reading its
items. Fetch the feed and read the stories before promoting anything.

The pipeline (`scripts/discover-sources/`): `discover:sources` reads **raw**
search results per county and topic — auditing our own API would be circular,
since it only returns what already passed the filter — and scores publishers
with the filter's own exported rule; `probe:sources` finds each host a working,
recent feed (advertised links first, then common paths, continuing even when
the homepage blocks); `emit:sources` writes the registry plus
`native-candidates.md`, the human review queue. All stages are resumable.
Texas is complete.

## Speed (`src/cache.ts`, `src/warmer.ts`)

For PIA operations, use `aws --profile pia` and region `us-east-2`; verify account `426771918029` before writes. The PIA frontend is separately hosted in `us-west-1`. CodeBuild uses its assigned role.

Building a feed costs 9–27 seconds of upstream fan-out; serving one costs under
half a second. The design keeps those on different actors:

- **Every build is written to a shared S3 bucket** (`FeedCacheBucket`,
  self-expiring). Readers get the stored copy instantly — fresh, or stale up to
  a day — from any Lambda instance. The S3 write is awaited on purpose: work
  started after a Lambda response is sent freezes with the sandbox, so a
  fire-and-forget put is lost.
- **Stale reads enqueue a refresh.** All national, state, and county topics
  use the same shared cache. After five minutes, a reader receives the stored
  feed while an awaited SQS send requests rebuilding. FIFO deduplication and
  per-feed message groups suppress duplicate work. The worker calls the feed
  service directly, so CloudFront cannot swallow a refresh request. The old
  public `x-warm-refresh` bypass is removed.
- **The schedule queues at most 50 jobs every five minutes.** Eight core
  national topics are visited every pass; ten specialist national topics rotate
  two at a time (25-minute cycle). State general/politics rotate eight per pass
  (65 minutes); other state topics four per pass (17 hours). County general
  rotates twenty per pass (about 13 hours 10 minutes), and specialist county
  topics eight per pass (about 56 hours). These are baseline visits to dormant
  desks, not freshness guarantees: active desks request their own refresh after
  five minutes. Failed enqueue passes retry through EventBridge.
- **Three workers leave reader capacity.** SQS invokes the refresh Lambda with
  batch size one and maximum concurrency three under the PIA ten-execution
  regional quota. Failed work retries and eventually enters a dead-letter queue.
  CloudWatch alarms track a backlog over 15 minutes, dead letters, and schedule
  failures. Queue and worker roles are scoped to their required resources;
  payment and economic API secrets are not inherited by refresh functions.
- **CloudFront remains controlled by `EnableEdgeCache`.** It caches `limit`,
  `offset`, `sections`, and browser Origin variants, with gzip/Brotli and Origin
  Shield in the API region. Workers prime actual County Post page URLs and
  first-feed limits, plus PIA's 40-item feeds. A prime may hit an existing edge
  response; the direct worker rebuild has already updated S3. Subsequent edge
  revalidation adopts that update. Health, writes, and errors are not cached.
  CloudFront account verification previously blocked creation; see the current
  deployment record for the result of the September 8 rollout.

Feed `meta.fetchedAt` retains the provider-data timestamp; `ageSeconds` and
`stale` describe its age when the API generated the response. At the edge,
calculate current data age from `fetchedAt` rather than treating `Age` as data
freshness. Page timestamps use the oldest included feed. A complete provider
failure leaves the old shared feed intact instead of replacing it with an
empty result. A successfully fetched empty source can still produce an empty
feed: the cache does not invent articles or create an archive.

Supporting behavior: thumbnail enrichment runs once after coverage selection
under a 750 ms budget (`imageEnrichmentBudgetMs`), retaining completed images
when another publisher is slow. Already-started lookups can populate the
per-URL cache while the runtime remains active;
ordering is banded by recency (fortnight, 60 days, 180, older, undated last)
with undated items kept rather than dropped; feeds accept `offset` and report
`hasMore`/`totalAvailable` for the client's infinite scroll; publisher
balancing caps a dominant outlet (`countySinglePublisherMax`) on a different
knob than the one that triggers the search for more outlets
(`countyPublisherDiversityThreshold`) — tying those together once switched the
diversity search off by accident.

## Configuration truths that cost us deploys

- **`template.yaml` wins.** Every tuning knob is pinned there as a Lambda
  environment variable; changing a `config.ts` default changes nothing deployed
  until the template moves too.
- **The repo's `.env` masks the same way locally** — and CI has no `.env`, so a
  test asserting a literal budget can pass on this machine and fail in
  CodeBuild. Tests assert against `config`; keep `.env` aligned with the
  template.
- Pipeline failures are diagnosed from
  `aws --profile pia cloudformation describe-stack-events --stack-name county-news-api --region us-east-2`; CI
  test output is in the CodeBuild log group.

## PIA integration

PIA reads the API's locality/topic decisions directly, validates the response
scope and topic, and uses general/politics on state landing pages. Its county
elections widget maps to `politics`; video selects video items from the shared
general feed. It does not repeat County Post's browser locality filter.

Louisiana display names and search queries use **Parish**, including nearby
expansion. Locality matches that display name too. The URL contract retains
county slugs such as `/v1/feeds/counties/louisiana/west-carroll/general`. The
previous County suffix produced an empty West Carroll feed; a live-source
run after correction returned 21 stories. Clients that mirror locality must
honor `scope.displayName` for parish-name evidence.

Independent cities sharing a county name use `-city` routes for FIPS 24510,
29510, 51600, 51620, 51760 and 51770. `county-geography.ts` supplies the same
mapping to lookup, warming, discovery and audits. Existing county routes keep
their meaning. Tests verify each of the 3,143 records resolves to its own FIPS.
