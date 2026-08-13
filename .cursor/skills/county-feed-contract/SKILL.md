---
name: county-feed-contract
description: Maintains the County Post county-news API locality contract. Use when changing county feed tiers, source registry entries, filtering, deduplication, feed metadata, configuration, tests, or frontend feed integration.
---

# County Feed API Contract

## Canonical files

- Plans and queries: `src/feed-builders.ts`
- County places, FIPS, and nearby geography: `src/geo.ts`
- Curated direct publishers: `src/source-registry.ts`
- Topic and locality filtering: `src/filter.ts`
- Ordered tier orchestration and duplicate suppression: `src/news-service.ts`
- Runtime knobs: `src/config.ts`, `.env.example`, `template.yaml`
- Contract tests: `tests/http.test.ts`

## Locality invariants

1. Keep county coverage ordered: strict primary → configured place/trusted market → nearest same-state counties.
2. Primary results must identify the requested full state and `County` name.
3. Market results must identify the requested state and an exact county, configured place, or trusted registered publisher.
4. Never introduce a bare ambiguous county query; state-qualify every county, place, and agency query.
5. Preserve URL, image, title/near-title, DVIDS caption, and related-event duplicate protections across tier merges.

## Source and place changes

- Add known place corrections to `countyOverrides` in `src/geo.ts`.
- Add only reviewed RSS/Atom publisher feeds to `src/source-registry.ts`, scoped with state, market, and county metadata.
- Keep direct-source and market-publisher labels stable because filtering and `meta.sourcesUsed` rely on them.
- Use bounded configuration instead of widening all-provider queries.

## Validation

Run after feed changes:

```bash
npm test
npm run typecheck
npm run build
```

Test an ambiguous pair such as Arkansas and Florida Polk feeds. Confirm `meta.sourcesUsed` and `feed.sparse_county` logs before enabling a new market tier in production.
