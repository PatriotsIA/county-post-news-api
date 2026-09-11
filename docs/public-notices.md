# County public notices

`GET /v1/counties/:stateSlug/:countySlug/public-notices?limit=50&offset=0` returns selected official government notices assigned to the requested county. The initial rollout covers Texas. Other valid counties return `meta.rollout/status: "not-yet-supported"`, empty items and no Texas source requests. Unknown counties return 404.

This endpoint is separate from news, weather, obituaries and PIA's existing feed contracts. It uses the existing canonical county/FIPS catalog, including all 254 Texas counties. No new credentials, dependencies, AWS resources or environment variables are required.

## Reviewed Texas coverage — September 11, 2026

All 254 counties have a source profile. The review verified 179 official notice/agenda boards and 99 county notice-calendar RSS feeds. Remaining profiles link to the official county government or its Texas Association of Counties directory entry when the legacy government address is broken. Source URLs, original directory evidence and review outcomes are in [the source review CSV](public-notices/texas-source-review.csv).

The live local audit checked all 254 county responses using four concurrent workers: 171 unique dated notices appeared across 92 counties, and all 101 connected feeds/pages were available (99 local calendars plus TCEQ and TxDOT). These are observations at review time, not a promise that every county has a recent notice. Some official calendars are empty; many additional notices are posted only as PDFs, on separate department websites, or in newspapers. A successful source fetch is not a claim of complete legal coverage.

Sources:

- [Texas Association of Counties directory](https://www.county.org/county-information-map) supplies the county-to-government link evidence. Manually reviewed overrides fix Jefferson's old hostname and add Potter's agendas and Randall's notice board.
- [TCEQ permitting meetings and hearings](https://www.tceq.texas.gov/agency/decisions/hearings) supplies the affected facility county and event date. The hearing venue may be in another county; it never determines coverage.
- [TxDOT hearings, meetings and notices](https://www.txdot.gov/projects/hearings-meetings.html) supplies explicit county or multicounty project areas. City-only areas, statewide records and partially unresolved regions are excluded rather than assigned speculatively.
- Official county notice calendars provide links to the original calendar postings. CIRA RSS `pubDate` represents the calendar event date and is returned as `eventDate`, not as publication time. Holiday/social entries are excluded.
- [Texas newspaper public notices](https://www.texaspublicnotices.com/) is a link-only directory. Its [terms of use](https://www.texaspublicnotices.com/Terms-of-Use.aspx) restrict automated collection and republication; no Column/newspaper API data or notice text is ingested. Newspaper archive ingestion requires a permitted feed or provider agreement.

## Response and behavior

`county` contains canonical state/county slugs, FIPS and display name. Each item has a stable ID, title, original HTTPS URL, source name/ID, explicit `countyFips`, `coverage: county | regional`, geography label, category, and an event or publication date. Full legal text, inferred deadlines and assertions that a notice is still open are deliberately absent. Categories are meeting, hearing, procurement, tax, legal and other.

`sources` distinguishes current, stale, unavailable and link-only sources. `meta` reports current, partial or unavailable retrieval, result counts, pagination, checked time and a 90-day lookback. Event dates may be up to 366 days ahead; future publication dates beyond one day are rejected. Up to 100 items are returned per page, ordered by date descending. A notice appears only when the requested FIPS is in its explicit coverage; there is no neighboring-county or statewide fallback.

Requests to the reviewed sources allow HTTPS only, reject redirects, time out after eight seconds and cap bodies at 2 MB. Source snapshots share the existing S3 feed cache, independently of county and pagination, with one-hour freshness and a 24-hour maximum stale age after refresh failure. Partial/unavailable HTTP responses use `no-store`. A changed/broken provider is reported as unavailable rather than as an empty calendar.

## Review and validation

Use Node 22. Python uses the standard library only. Run discovery before emission; inspect the review and overrides rather than publishing discovery output blindly.

```sh
python3 scripts/public-notices/discover-texas.py
node scripts/public-notices/emit-texas.mjs
node --import tsx scripts/public-notices/audit-texas.ts --live
npm run typecheck
npm test
npm run build
```

Discovery caches requested and final URLs, limits concurrency to four, and keeps downloaded evidence under ignored `coverage/public-notices/`. The audit disables AWS caching and saves county-level results there. The optional offline audit uses the saved review HTML/RSS; live auditing does not need those files. Registry SHA-256 at release review: `47afc3aa6dfb3bd750aad88d952cbe3a0672bfb62db10e101011d400a528b307`.

Backend validation passed 141 tests, including geography isolation, regional assignments, event/publication dates, stale-cache limits, outages, pagination, unknown counties and all 254 source profiles. Frontend regression, live browser checks and deployment evidence are recorded in The County Post's public-notice release notes.

## Expansion

Add reviewed official state adapters and county profiles keyed by canonical FIPS, then enable that state's rollout, UI and sitemap together. Add structured county board/PDF adapters or permitted newspaper feeds to deepen Texas coverage. Do not infer county coverage from incidental body-text mentions, publisher headquarters or a meeting venue. Keep empty and unavailable states visible to users, and retain original notice links for deadlines and amendments.
