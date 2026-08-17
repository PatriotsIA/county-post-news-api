# County Data Atlas sources and methodology

The County Data Atlas publishes FIPS-keyed county snapshots from authoritative public datasets. Scheduled ingestion is separate from API deployment. A refresh writes every document under an immutable `versions/<version>/` prefix, validates the complete result, and updates `manifest/current.json` only after all version objects succeed. A failed build leaves the previous manifest active.

## Current release: Wave 1 ACS

The enabled adapter uses the U.S. Census Bureau American Community Survey 5-year API. It currently publishes validated county measures for:

- Demographics: population, median age, and households.
- Economy: median household income and poverty rate.
- Housing: median home value, median gross rent, homeownership, and vacancy.
- Jobs and business: labor-force participation and mean commute.
- Education: high-school completion and bachelor's-degree attainment.

The adapter requests county, state, and national estimates plus 90% margins of error. Comparable county measures include official state and U.S. benchmarks for accessible charts. Ratio and summed-category margins use conservative propagation from published component margins. ACS suppression and missing-value sentinels remain suppressed with a reason; they are never converted to zero. Ratio metrics retain numerator and denominator. Every metric records source, source URL, observation date, release vintage, county-geography vintage, retrieval time, and modeled-estimate status.

ACS 5-year values are survey estimates, not exact current-year counts. Values from overlapping ACS releases should not be treated as independent observations. The selected release is controlled by `ATLAS_CENSUS_YEAR`; changing it should be followed by fixture and representative-county review.

Production validation requires 3,100-3,250 county equivalents after limiting results to the 50 states and District of Columbia. It rejects malformed/duplicate FIPS, missing population, incomplete provenance, invalid margins or coverage denominators, and implausible ranges. This range intentionally accommodates county-equivalent geography changes such as Connecticut planning regions. Alaska boroughs/census areas, Louisiana parishes, Virginia independent cities, and the District of Columbia remain Census county equivalents.

## Planned source waves

Declaring a source as planned does not make its domain available. A domain is marked available only when a validated metric is actually present.

### Wave 1

- Census Population Estimates Program, annual: annual population and change. The currently bundled Vintage 2025 estimates are used only by the API fallback until a bulk-file adapter is enabled.
- Census SAIPE, annual: model-based county income and poverty, with confidence intervals and model vintage.
- Census County Business Patterns, annual: establishments and employment, preserving disclosure flags.
- BLS LAUS, monthly/annual: model-based labor force and unemployment, including preliminary/revision status.
- BLS QCEW, quarterly: employment and wages. Confidential cells must remain suppressed; aggregate coverage must be retained.
- BEA Regional Economic Accounts, annual: personal income and GDP. Combined small-county/independent-city geographies cannot be assigned to individual counties without an official allocation.
- FRED, source-dependent cadence: retained as the existing live development fallback. Scheduled ingestion is not yet enabled because canonical Census/BLS/BEA releases should remain distinguishable from republished series.

### Wave 2

- CDC PLACES, annual: modeled health prevalence with release/model metadata; not direct case counts.
- NCES Common Core of Data and EDGE, annual: schools, students, and district context. Districts crossing county boundaries require a documented allocation and denominator.
- USDA Census of Agriculture, every five years, and NASS Quick Stats periodic estimates: farms, land, sales, crops, and livestock. Disclosure markers are unavailable values, not zero.
- HUD USER releases, annual/quarterly: only products with defensible county geography.
- FCC National Broadband Map, twice yearly: public county summaries only. Restricted Fabric records are excluded; reported availability is not adoption or measured speed.
- OpenFEMA and National Risk Index, continuous/release-based: declarations and modeled hazards. Statewide/tribal declarations and county declarations remain distinct.
- EPA Envirofacts and AirData, program-specific cadence: facility/monitor context with explicit monitor or population coverage.

### Wave 3

- USAspending, nightly source pipeline: recipient-location and place-of-performance awards remain separate.
- Census of Governments, five-year census plus annual surveys: units, employment, revenue, and expenditure; overlapping service areas require caveats.
- FHWA National Bridge Inventory, annual: structures, inspection vintage, and condition—not overall network quality.
- BTS and EIA, dataset-specific cadence: an adapter will be enabled only after a stable official county-compatible release is selected. Facility counts are not population coverage.
- MIT Election Data and Science Lab plus certified official state results, after elections: normalized county returns with certification status. Alaska and non-county reporting geographies require explicit caveats.
- FBI Crime Data Explorer, monthly/annual: rates require agency reporting coverage, population coverage, and jurisdiction-overlap handling. Voluntary reporting gaps prevent unconditional county comparisons.

## Credentials and offline operation

- Census API access is free. Since May 2026, `CENSUS_API_KEY` is required for all live Census Data API queries and must be supplied to the atlas ingestion build.
- `FRED_API_KEY` is required only for the live API economy fallback and existing `/economic-data` endpoint.
- A future NASS adapter may use the free `USDA_NASS_API_KEY`.
- No paid credential is required by the enabled ingestion adapter.
- `npm run atlas:ingest -- --fixture <file> --output <directory>` performs deterministic offline ingestion. Fixtures use Census API tabular response shape and still pass normalization, plausibility, suppression, and county-count validation.

Never place source credentials in frontend variables or snapshot documents.

## Refresh and publication

The default EventBridge schedule starts the atlas CodeBuild project every seven days so release changes are picked up promptly, while each metric still reports its actual official vintage. The regular API build and deployment do not download source datasets.

CodeBuild runs typechecking and atlas tests, ingests enabled adapters, uploads immutable JSON with long cache metadata, and writes `manifest/current.json` last. The S3 bucket is private, encrypted with S3-managed keys, versioned, blocked from public access, and retained if the stack is deleted. The API Lambda receives read-only access; the ingestion role receives object read/write but no delete permission.

CloudWatch retains ingestion logs for 30 days. Alarms cover failed builds, EventBridge target failures, and absence of a successful build for seven days, the maximum evaluation window CloudWatch permits for this daily-period alarm. Alarm actions (SNS, PagerDuty, and so on) are intentionally account-specific and must be attached after deployment.

## API behavior and caveats

- `/v1/counties/:stateSlug/:countySlug/atlas` returns all domain cards. Unavailable domains have `available: false`, no fabricated metrics, and an explanatory warning.
- `/v1/counties/:stateSlug/:countySlug/atlas/:domain` returns a known domain even when its metrics are empty. Unknown domain names return HTTP 400.
- Published documents are read through the active manifest and cached in-process. Malformed data or S3 permission/service failures return HTTP 502.
- If the bucket is unset or the requested object is missing, the development fallback can supply bundled Census population and, when configured, live FRED economy measures. Every other domain remains explicitly unavailable.
- Missing, suppressed, modeled, preliminary, and partial data must remain visually distinguishable in downstream clients. Values with different vintages or county definitions should not be combined without a documented crosswalk.
