# Nationwide County and Regional Source Discovery Plan

## Goal

Build and maintain a reviewed registry of newspapers, digital publishers, radio newsrooms, television stations, and civic-information sources for every U.S. county-equivalent. Automated jobs may discover and score candidates, but only approved outlet-to-county relationships may bypass literal county-name filtering.

The production county general-news mix should target:

- up to 25 stories from the dominant publisher;
- up to 25 stories from all other publishers combined;
- fewer than 50 stories when safe alternatives are unavailable rather than padding with unrelated, duplicated, or misleadingly old content.

## Guardrails

1. Preserve the requested full state and exact county throughout discovery, validation, and article filtering.
2. Never trust a source solely because of a domain name, callsign, transmitter, signal contour, DMA/CBSA, search result, GDELT appearance, RSS feed, WordPress metadata, or AI classification.
3. Keep outlet identity separate from publisher ownership and web domain. One chain domain can host many local editions.
4. Treat regional outlets as candidates for multiple counties, but continue article-level locality filtering.
5. Store article metadata and hashes by default, not full publisher article bodies.
6. Record evidence, review decisions, retrieval timestamps, and source terms/licensing provenance.

## Canonical geography

Use Census GEOIDs/FIPS as the primary key and refresh geography annually:

- [Census TIGER/Line county boundaries](https://www.census.gov/geographies/mapping-files/2025/geo/tiger-line-file.html)
- [Census Gazetteer county and place files](https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html)
- [OMB metropolitan and micropolitan delineations](https://www.census.gov/programs-surveys/metro-micro/about/delineation-files.html)
- [USGS GNIS names and coordinates](https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data)

The roster must account for 3,144 county-equivalents in the 50 states and District of Columbia after Connecticut replaced eight counties with nine planning regions. Territories should be an explicit later scope rather than silently mixed into the initial roster.

Maintain, per county:

- GEOID/FIPS, state, canonical name, aliases, centroid, and boundary;
- county seat or seats when legally defined;
- incorporated places and Census-designated places intersecting the county;
- adjacent counties and OMB regions as weak regional evidence;
- population and rurality for rollout stratification, not source trust.

## Candidate discovery inputs

### 1. Existing article observations

Aggregate publisher domains seen in strict county queries. GDELT is the primary open automated observation layer:

- [GDELT project and usage information](https://www.gdeltproject.org/about.html)
- [GDELT GKG location and source fields](http://data.gdeltproject.org/documentation/GDELT-Global_Knowledge_Graph_Codebook-V2.1.pdf)

Count how often a domain publishes recent stories that independently pass county/state locality checks. GDELT observation is discovery evidence only, never automatic approval.

Do not persistently scrape Google or Bing result pages. Google has no supported public News API, and Bing Search APIs were retired in 2025. Existing runtime search feeds can continue as aggregation fallbacks while source-registry discovery relies on permitted datasets, direct publisher metadata, manual review, or a licensed search vendor.

### 2. Broadcast facilities

Import the [FCC LMS public database](https://enterpriseefiling.fcc.gov/dataentry/public/tv/lmsDatabase.html) and identify facilities by FCC `facility_id`, not callsign. Preserve callsign history, service type, status, community of license, licensee, and technical coordinates.

Where available, intersect [FCC service contours](https://geo.fcc.gov/api/contours/) with county boundaries and collect public-file station website links. A contour or community of license is only weak coverage evidence; translators and stations without original newsrooms must not be promoted automatically.

Do not depend on unlicensed Nielsen DMA boundaries.

### 3. Publisher and association seeds

Seek licensed or permissioned source lists from state press associations and publisher organizations. Public directories such as [LION Publishers](https://lionpublishers.com/lion-membership-criteria/), [INN's Find Your News](https://findyournews.org/), and [Project Oasis](https://globalprojectoasis.org/about-the-study/us-ca/) can seed candidates but are not complete nationwide ground truth.

### 4. Direct website discovery

For every candidate homepage:

1. Resolve redirects and canonical hostnames.
2. Read `robots.txt` and honor crawl restrictions.
3. Parse HTML and HTTP `rel="alternate"` declarations for RSS or Atom.
4. Detect WordPress through its API discovery link before probing WordPress endpoints.
5. Inspect declared sitemaps and Google News sitemaps.
6. Validate feed item URLs, publication dates, IDs, categories, canonical domains, and recent unique volume.
7. Sample article metadata for bylines, dates, publisher identity, local entities, and original reporting.
8. Enforce SSRF protection, private-IP blocking, DNS-rebinding checks, XML size limits, decompression limits, host throttling, conditional requests, and backoff.

## Registry model

Store a versioned record for each outlet and each outlet-to-county edge:

```text
outlet
  outletId, publisherId, name, outletTypes, languages
  domains[], pathPrefixes[], aliases[]
  endpoints[{url, format, topics[], maxAgeDays, maxItems}]
  ownership, newsroomLocation, contactUrl

coverage
  outletId, countyFips, role[county-native|regional|state]
  localityScore, evidenceIds[], validFrom, validTo
  reviewStatus[candidate|approved|rejected|suspended]
  reviewer, reviewedAt, recertifyAt

evidence
  evidenceId, sourceFamily, sourceUrl, observedAt
  claimType, extractedValue, checksum, licenseBasis

health
  endpointId, lastSuccessAt, lastArticleAt
  parseSuccessRate, recentUniqueItems, duplicateRate
  localityPrecision, consecutiveFailures
```

Keep identity, journalism, locality, and operational health as separate scores:

- **Identity:** confidence that the domain/feed belongs to the named outlet.
- **Journalism:** recurring original reporting, bylines, civic breadth, and editorial transparency.
- **Locality:** evidence for a specific outlet-to-county relationship.
- **Health:** endpoint freshness and parse reliability.

Production approval requires two independent evidence families, human review, and high identity/journalism/locality scores. Health failures may suspend fetching but must not automatically declare an outlet closed.

## Discovery and review workflow

1. Generate county candidates from FCC facilities, approved directories, and observed local article domains.
2. Discover and validate public endpoints.
3. Sample recent stories and score county locality precision.
4. Write candidate JSON and CSV with evidence links.
5. Review candidates in a small authenticated interface or controlled review file.
6. Publish only approved records to an immutable registry snapshot.
7. Have the News API load the approved snapshot and retain an in-memory cache.
8. Revalidate endpoints monthly and require annual human recertification or immediate review after redirects, ownership changes, or major content-pattern changes.

## AWS-friendly implementation

Start with the project's existing low-cost ingestion pattern:

- EventBridge schedule starts a sharded CodeBuild discovery job.
- S3 stores immutable inputs, candidate artifacts, approved registry snapshots, checksums, and run manifests.
- The existing Lambda reads only the latest approved S3 snapshot; it never performs open-ended discovery during a reader request.
- Process a bounded county shard per run, prioritizing zero-source counties and stale health records.

Add DynamoDB only when concurrent reviewer state, endpoint scheduling, and conditional-update needs outgrow versioned S3 artifacts. Add Step Functions/SQS/Fargate or PostGIS only if measured volume, spatial processing, or host-aware crawling requires them.

No new AWS resources are required for the current static-registry and 25/25 balancing phase. The scheduled discovery phase will require an explicit infrastructure review before implementation.

## Runtime feed behavior

1. Load strict requested-county searches and approved county-native feeds.
2. If one publisher exceeds 25 stories and fewer than 25 alternatives exist, activate the existing market and nearest-county tiers to seek alternatives.
3. Deduplicate URLs, images, same-story titles, and related events.
4. Preserve separately dated recurring editions from the same publisher.
5. For county general news, return at most 25 stories from the dominant publisher and at most 25 from other publishers.
6. Never backfill a missing alternative quota with unrelated or wrong-state stories.
7. Expose source-balance and coverage-tier markers in `meta.sourcesUsed` and structured logs.

## Rollout

### Phase 1: Balance and schema

- Enforce the 25/25 response policy.
- Define the versioned registry schema and candidate artifact format.
- Seed Polk County, Arkansas and existing Amarillo, Tyler, and Denver sources.
- Establish reviewer rubric and regression fixtures.

### Phase 2: Diverse pilot

- Run discovery for 150–250 counties across rural, urban, border, tribal, multilingual, Alaska, Connecticut, Louisiana, Texas, and Virginia geographies.
- Review every outlet-to-county edge.
- Measure precision, feed health, source concentration, freshness lag, duplicate rate, and reviewer agreement.

### Phase 3: Nationwide candidate generation

- Process all 3,144 county-equivalents in bounded shards.
- Prioritize counties with zero approved sources, then counties with only one active publisher.
- Publish approved snapshots incrementally by state.

### Phase 4: Operations

- Add publisher correction/claim workflow.
- Revalidate endpoints monthly and recertify coverage annually.
- Alert on sustained endpoint failures, source concentration, cross-state leakage, and sudden syndication spikes.

## Launch gates

- At least 95% precision in blind audits of approved outlet-to-county edges.
- Zero known same-name county leakage in ambiguous-county regression samples.
- Complete evidence and licensing provenance for every approved source.
- Source coverage reported separately for counties with at least one and at least two active independent publishers.
- No rollout state may weaken the current locality or duplicate-suppression contract.
