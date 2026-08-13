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
- URL-based deduplication remains as a fallback only when an item has no title.

## Client fallback protections

The website RSS fallback now uses state-qualified county searches, requires an explicit state match for county items, and deduplicates normalized titles before rendering. This keeps the fallback behavior aligned with the API if the API is unavailable.

## Validation

API tests cover:

- Rejecting same-name county stories from another state.
- Rejecting a county story with no explicit state match.
- Filling sparse county feeds from nearest same-state counties.
- Suppressing same-title stories from different publishers.
