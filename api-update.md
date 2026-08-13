# County Feed Locality and Deduplication Update

## Purpose

County feeds now prioritize articles explicitly tied to the requested county and state, then expand only to the nearest counties in that same state when local coverage is sparse.

## Locality rules

- Primary county queries require both the county display name (for example, `Polk County`) and the full state name.
- County feed filtering also requires an item to identify the full requested state and requested county. This prevents a same-name county in another state from appearing in the feed.
- If the primary county produces fewer than `COUNTY_FALLBACK_MIN_ITEMS`, the API queries the nearest counties by centroid distance within the same state.
- The fallback is restricted to those nearby county names plus the requested state. It does not use a broad state-wide feed.
- `meta.sourcesUsed` identifies this expansion with `county:fallback-nearby` and the nearby county slugs.

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
- Suppressing same-title stories from different publishers.
- Suppressing near-duplicate DVIDS image items.
- Suppressing distinct-title records that reuse the same article image.
- Suppressing same-publisher county-event updates that describe the same incident with different headlines.
