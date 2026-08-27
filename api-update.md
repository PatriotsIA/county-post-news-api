# County Feed Locality and Deduplication Update

## Purpose

County feeds now use an ordered, locality-safe expansion pipeline: strict requested-county coverage first, configured local places and trusted market sources only when sparse, then nearest same-state counties only if still sparse.

## Locality rules

- Primary county queries require both the county display name (for example, `Polk County`) and the full state name.
- County feed filtering also requires an item to identify the full requested state and requested county. This prevents a same-name county in another state from appearing in the feed.
- Primary queries always contain the requested county display name and full state name. Optional county-agency queries remain state-qualified.
- If the primary county produces fewer than `COUNTY_FALLBACK_MIN_ITEMS`, the API can query configured local places and registered trusted market publishers. Market items still need the requested state plus an exact county, configured local place, or trusted publisher match.
- If that market tier is still sparse, the API queries the nearest counties by centroid distance within the same state.
- The nearby fallback is restricted to those county names plus the requested state. It does not use a broad state-wide feed.
- `meta.sourcesUsed` identifies activated tiers with `county:primary`, `county:market`, and `county:fallback-nearby`, plus configured markets and nearby county slugs.
- `feed.sparse_county` structured logs record primary, market, nearby, and final result counts for rollout tuning.
- `COUNTY_MARKET_TIER_ENABLED`, `COUNTY_AGENCY_QUERY_ENABLED`, `COUNTY_LOCAL_SOURCE_SEARCH_ENABLED`, `COUNTY_PRIMARY_QUERY_LIMIT`, `COUNTY_MARKET_QUERY_LIMIT`, and `COUNTY_NEARBY_LIMIT` make the expansion reversible and bounded.

## Local publishers and stations

- Every county primary plan includes a bounded, state-qualified search for reporting from local newspapers, radio stations, television stations, and local newsrooms. This gives all counties a source-discovery path without broadening the locality filter.
- Reviewed county-native outlet profiles and county-scoped RSS/Atom feeds are curated in `src/source-registry.ts`. Profiles add site-targeted Google News, Bing News, and GDELT searches even when an outlet has no usable public feed.
- An approved county source may supply a local-city story that does not literally include the county name; it is accepted only when the article domain matches the reviewed outlet, or when a Google/Bing result has a reviewed publisher label, and the item does not identify another state.
- This preserves same-name county protections while allowing local outlets to report naturally on cities, schools, and community events.
- Polk County, Arkansas now explicitly targets The Mena Star and My Pulse News / KENA. The verified My Pulse News / KENA feed is fetched directly; The Mena Star is covered through a site-targeted search because no dependable current public RSS feed was verified.
- The browser fallback mirrors these reviewed profiles, direct feeds, and nationwide source-focused query while retaining the same wrong-state rejection.
- Add future stations and newspapers only after confirming their domain, county scope, recency, state coverage, and public feed when one exists.

## Duplicate handling

- All API feeds deduplicate by normalized title before returning results.
- The same title from separate links or publishers appears only once in a feed.
- Near-title matches are also collapsed when their meaningful title words substantially overlap. DVIDS image items additionally use their normalized captions to collapse multiple image records for the same article.
- Records that resolve to the same image URL are collapsed after image enrichment, including resized variants that differ only by URL query parameters.
- Related updates from the same publisher family are collapsed when they share a county/event context, even if their headlines use slightly different wording.
- URL-based deduplication remains as a fallback only when an item has no title.

## Client fallback protections

The website RSS fallback now uses state-qualified county searches, requires an explicit state match for county items, and applies the same near-title and DVIDS-caption deduplication before rendering. This keeps the fallback behavior aligned with the API if the API is unavailable.

## Validation

API tests cover:

- Rejecting same-name county stories from another state.
- Rejecting a county story with no explicit state match.
- Filling sparse county feeds from nearest same-state counties.
- Filling sparse feeds from state-qualified configured county places before nearby counties.
- Rejecting wrong-state market results and accepting only configured places or trusted market publishers.
- Keeping primary, market, and nearby results in priority order and enforcing tier query budgets.
- Targeting reviewed Polk County outlets while keeping county-native source searches available to every county.
- Suppressing same-title stories from different publishers.
- Suppressing near-duplicate DVIDS image items.
- Suppressing distinct-title records that reuse the same article image.
- Suppressing same-publisher county-event updates that describe the same incident with different headlines.
