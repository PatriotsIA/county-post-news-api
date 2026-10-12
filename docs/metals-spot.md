# Gold-API.com spot prices

`GET /v1/markets/metals` returns one complete USD/troy-ounce spot snapshot for
gold, silver, platinum and palladium. No API key, account or paid endpoints.
Commercial use: https://gold-api.com/terms. Provider endpoint/cache contract:
https://gold-api.com/llms.txt.

The existing S3 feed bucket stores `feed-cache/markets-gold-api-v1.json`.
Its state contains the last good snapshot, failure count and next-attempt time.
`If-None-Match: *` creates the initial lease; subsequent `If-Match` writes use
the prior ETag. This protects refreshes across independent Lambda instances,
including cold starts. A 120-second lease bounds abandoned refreshes.

Four requests are sequential and spaced 1.1 seconds apart, with no automatic
retries. The next batch starts no sooner than 60 seconds after the previous
batch completes; longer provider Cache-Control values also apply. Thus audience
size does not multiply upstream requests: at most four calls per minute for this
deployment while requested, and none when nobody requests an expired snapshot.

The first failed request stops the batch. Retry backoff starts at five minutes
and doubles to one hour. A longer Retry-After (seconds or HTTP date) overrides it.
All instances share this cooldown, even when no valid snapshot exists yet.
Storage errors fail closed: no provider calls without a successfully acquired
lease. Publication uses the lease ETag so a late writer cannot replace a newer
state. If publication fails, the original persisted lease remains in force.

Only positive finite USD prices with matching symbols and valid, nonfuture
timestamps are accepted. Quote times may not move backwards. A failed/partial
batch retains the entire previous snapshot. Quote age over 15 minutes or an
outage marks data stale; quotes older than four days are unavailable. No daily
benchmark fallback is mixed with spot prices.

The response includes `priceType: "spot"`, per-metal `quotedAt`, our
`fetchedAt`, `nextRefreshAt`, and optional `previousPrice/previousQuotedAt`.
The previous value means the previous distinct saved quote, not a daily close.
The HTTP response caches for 15 seconds, without long stale-while-revalidate.

The legacy `METALS_CACHE_TTL_SECONDS` still controls cattle only. The obsolete
`METALS_PROVIDER_URL` is removed from the SAM template/config. Never make the
spot throttle user-controlled through query parameters.

Release API before frontend. Check the live endpoint's priceType, four symbols,
quote ages, cache headers and stable fetchedAt on repeated reads. Check the
Market Desk and ITM calculator against the same response. Do not mark PIA-061
closed solely for this work: its separate Amplify route requirement also needs
verification.
