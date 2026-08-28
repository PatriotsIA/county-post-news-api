---
name: county-feed-contract
description: Maintains the County Post county-news API locality contract. Use when changing county feed tiers, source registry entries, filtering, deduplication, feed metadata, configuration, tests, or frontend feed integration.
---

# County Feed API Contract

## Canonical files

- Plans and queries: `src/feed-builders.ts`
- County places, FIPS, and nearby geography: `src/geo.ts`
- Curated direct publishers and county-native outlet profiles: `src/source-registry.ts`
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
6. County general-news responses balance a dominant publisher against alternative publishers; source concentration may activate market and nearby tiers even when raw item count is not sparse.

## Source and place changes

- Add known place corrections to `countyOverrides` in `src/geo.ts`.
- Add only reviewed publisher profiles and RSS/Atom feeds to `src/source-registry.ts`, scoped with state, market, and county metadata. Profiles without a usable feed can still provide domain-targeted search.
- Use source-specific `maxAgeDays` and `maxItems` only for reviewed inactive archives; never widen `ARTICLE_MAX_AGE_DAYS` globally to fill one outlet.
- Preserve separately dated recurring reports from the same publisher while continuing to collapse same-story, cross-publisher, URL, image, and related-event duplicates.
- Keep direct-source and market-publisher labels stable because filtering and `meta.sourcesUsed` rely on them.
- Use bounded configuration instead of widening all-provider queries.
- Follow `docs/nationwide-local-source-discovery-plan.md` for candidate evidence, human approval, registry snapshots, and national rollout.

## Validation

Run after feed changes:

```bash
npm test
npm run typecheck
npm run build
```

Test an ambiguous pair such as Arkansas and Florida Polk feeds. Confirm `meta.sourcesUsed` and `feed.sparse_county` logs before enabling a new market tier in production.
