# PIA advertising checkout

The shared checkout accepts an optional `brand`: `the-county-post` (default for existing clients) or `patriots-in-action`. Both use the existing Census population tiers, full-price highest county plus half-price additional counties, statewide per-county rates, and ten monthly payments' worth for an annual subscription. Client-provided amounts remain forbidden.

PIA products carry the Patriots in Action name and return only to `https://advertise.patriotsinaction.com/?checkout=success` or `?checkout=cancelled`. County Post products and configured return URLs are preserved. Brand, coverage FIPS, placement and billing are included in Stripe metadata. PIA statewide section keys are `community-updates`, `community-calendar`, `pia-tv`, `elections-resources`, and `weather`; County Post's existing feed keys are unchanged.

`POST /v1/checkout/quotes` validates the same request and returns the authoritative amount, brand URLs and metadata without contacting Stripe, sending email, or writing a campaign. It supports safe live pricing verification. `POST /v1/checkout/sessions` creates the existing Stripe subscription checkout; returning from Stripe alone is not proof of payment.

`AdvertiserCorsOrigins` extends the existing `CorsOrigins` parameter with the PIA advertiser origin. Preserve the existing pipeline overrides, secret references, schedules, concurrency settings, and County Post origins. Deploy this backend before setting the PIA advertiser branch's dedicated `VITE_ADVERTISING_API_URL` to the `NewsApiEdgeUrl` stack output. This does not enable County Post news feeds on PIA.

The frontend still uses its established EmailJS configuration (Erik To, Dan CC, Dan public contact). Local tests mock Stripe; live validation uses the read-only quote endpoint and population lookups. No test emails or payments are needed for this release.
