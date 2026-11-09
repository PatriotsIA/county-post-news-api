import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const { createSession, retrieveSession, stripeKeys, orders, receipts, claim, attach, record, subscriptions } = vi.hoisted(() => ({
  createSession: vi.fn(), retrieveSession: vi.fn(), stripeKeys: [] as string[],
  orders: new Map<string, any>(), receipts: new Map<string, any>(),
  claim: vi.fn(), attach: vi.fn(), record: vi.fn(), subscriptions: vi.fn(),
}));
vi.mock("../src/advertising-payments-store.js", () => ({
  claimAdvertisingOrder: claim, attachAdvertisingSession: attach, recordAdvertisingEvent: record,
  getAdvertisingOrder: vi.fn(async (_mode: string, id: string) => orders.get(id)),
}));
vi.mock("stripe", async (importOriginal) => {
  const { default: Actual } = await importOriginal<typeof import("stripe")>();
  return { default: class Stripe {
    constructor(key: string) { stripeKeys.push(key); }
    checkout = { sessions: { create: createSession, retrieve: retrieveSession } };
    subscriptions = { retrieve: subscriptions };
    webhooks = new Actual("sk_test_signature_only").webhooks;
  }};
});

import { config } from "../src/config.js";
import { handleRequest } from "../src/http.js";

const savedConfig = { ...config };
const defaultStripeSecretKey = config.stripeSecretKey;
const defaultSuccessUrl = config.checkoutSuccessUrl;
const defaultCancelUrl = config.checkoutCancelUrl;

describe("Stripe Checkout endpoint", () => {
  beforeEach(() => {
    orders.clear(); receipts.clear(); stripeKeys.length = 0;
    claim.mockImplementation(async (candidate) => {
      if (!orders.has(candidate.id)) orders.set(candidate.id, structuredClone(candidate));
      return structuredClone(orders.get(candidate.id));
    });
    attach.mockImplementation(async (order, id) => { orders.get(order.id).sessionId = id; });
    record.mockImplementation(async (_mode, event) => { receipts.set(event.eventId, event); });
  });
  afterEach(() => {
    Object.assign(config, savedConfig);
    retrieveSession.mockReset(); subscriptions.mockReset();
    claim.mockClear(); attach.mockClear(); record.mockClear();
    config.stripeSecretKey = defaultStripeSecretKey;
    config.checkoutSuccessUrl = defaultSuccessUrl;
    config.checkoutCancelUrl = defaultCancelUrl;
    createSession.mockReset();
    vi.restoreAllMocks();
  });

  it("returns the bundled Census population tier for a county", async () => {
    const response = await handleRequest({
      method: "GET",
      path: "/v1/counties/texas/potter/population",
      query: new URLSearchParams(),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      countySlug: "potter",
      fips: "48375",
      population: 114453,
      estimateVintage: 2025,
      rateTier: "100000-250000",
    });
  });

  it("preserves county checkout and server-calculated annual pricing", async () => {
    configureCheckout();
    const response = await checkout({
      placement: "color-card",
      billing: "annual",
      counties: [{ stateSlug: "texas", countySlug: "potter" }],
      customerEmail: "advertiser@example.com",
      businessName: "Example Business",
      referredBy: "County Post Sales Team",
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.body)).toMatchObject({
      sessionId: "cs_test_123",
      amountCents: 250000,
      currency: "usd",
      billing: "annual",
      requiresSalesReview: true,
    });
    expect(createSession.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "advertiser@example.com",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 250000,
              recurring: { interval: "year" },
            }),
          }),
        ],
        metadata: expect.objectContaining({
          scope: "county",
          placement: "color-card",
          countyCount: "1",
          referredBy: "County Post Sales Team",
        }),
      }),
    );
  });

  it("prices a Texas state ad at $2,540 per month", async () => {
    configureCheckout();
    const response = await checkout({
      scope: "state",
      placement: "state-ad",
      billing: "monthly",
      states: ["texas"],
      customerEmail: "advertiser@example.com",
      businessName: "Texas Advertiser",
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).amountCents).toBe(254000);
    expect(createSession.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          scope: "state",
          placement: "state-ad",
          states: "TX",
          stateCount: "1",
          countyCount: "254",
          feedCount: "0",
        }),
      }),
    );
  });

  it("prices one Texas feed sponsorship at $5,080 per month", async () => {
    configureCheckout();
    const response = await checkout({
      scope: "state",
      placement: "state-feed-sponsorship",
      billing: "monthly",
      states: ["texas"],
      feeds: ["sports"],
      customerEmail: "advertiser@example.com",
      businessName: "Texas Sports Sponsor",
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).amountCents).toBe(508000);
    expect(createSession.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          states: "TX",
          feeds: "sports",
          feedCount: "1",
        }),
      }),
    );
  });

  it("charges every selected state and feed at full price with the annual discount", async () => {
    configureCheckout();
    const response = await checkout({
      scope: "state",
      placement: "state-feed-sponsorship",
      billing: "annual",
      states: ["texas", "oklahoma"],
      feeds: ["general", "weather"],
      customerEmail: "advertiser@example.com",
      businessName: "Regional Sponsor",
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).amountCents).toBe(13_240_000);
    expect(createSession.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 13_240_000,
              recurring: { interval: "year" },
            }),
          }),
        ],
        metadata: expect.objectContaining({
          states: "TX,OK",
          stateCount: "2",
          countyCount: "331",
          feeds: "general,weather",
          feedCount: "2",
        }),
      }),
    );
  });

  it("rejects unknown or duplicate state feed selections", async () => {
    configureCheckout();
    const unknownFeed = await checkout({
      scope: "state",
      placement: "state-feed-sponsorship",
      billing: "monthly",
      states: ["texas"],
      feeds: ["technology"],
      customerEmail: "advertiser@example.com",
      businessName: "Example Business",
    });
    expect(unknownFeed.statusCode).toBe(400);
    expect(JSON.parse(unknownFeed.body).error).toBe("Choose a valid feed sponsorship.");

    const duplicateState = await checkout({
      scope: "state",
      placement: "state-ad",
      billing: "monthly",
      states: ["texas", "texas"],
      customerEmail: "advertiser@example.com",
      businessName: "Example Business",
    });
    expect(duplicateState.statusCode).toBe(400);
    expect(JSON.parse(duplicateState.body).error).toBe("Each state can be selected only once.");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("validates referral attribution before sending it to Stripe", async () => {
    configureCheckout();
    const response = await checkout({
      scope: "state",
      placement: "state-ad",
      billing: "monthly",
      states: ["texas"],
      customerEmail: "advertiser@example.com",
      businessName: "Example Business",
      referredBy: "x".repeat(121),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("The referral name must be 120 characters or fewer.");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects client-supplied prices before calling Stripe", async () => {
    configureCheckout();
    const response = await checkout({
      scope: "state",
      placement: "state-ad",
      billing: "monthly",
      states: ["texas"],
      customerEmail: "advertiser@example.com",
      businessName: "Example Business",
      amount: 1,
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("Checkout prices are determined by the published rate card.");
    expect(createSession).not.toHaveBeenCalled();
  });
  it("uses PIA branding, return destinations and exact half-county cents in Stripe", async () => {
    configureCheckout();
    const response = await checkout({ brand: "patriots-in-action", scope: "county", placement: "color-card", billing: "monthly",
      counties: [{stateSlug: "texas", countySlug: "loving"}, {stateSlug: "texas", countySlug: "potter"}],
      customerEmail: "advertiser@example.com", businessName: "PIA advertiser",
      creativeAssetKey: "ad-creatives/2026-09-29/11111111-1111-4111-8111-111111111111.png",
      bannerCreativeAssetKey: "ad-creatives/2026-09-29/22222222-2222-4222-8222-222222222222.jpg" });
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).amountCents).toBe(26250);
    const session = createSession.mock.calls[0][0];
    expect(session.success_url).toBe("https://advertise.patriotsinaction.com/?checkout=success");
    expect(session.cancel_url).toBe("https://advertise.patriotsinaction.com/?checkout=cancelled");
    expect(session.line_items[0].price_data.product_data.name).toBe("Patriots in Action — Local color card");
    expect(session.metadata).toMatchObject({brand: "patriots-in-action", counties: "48301,48375",
      creativeAssetKey: "ad-creatives/2026-09-29/11111111-1111-4111-8111-111111111111.png",
      bannerCreativeAssetKey: "ad-creatives/2026-09-29/22222222-2222-4222-8222-222222222222.jpg"});
    expect(session.subscription_data.metadata).toEqual(session.metadata);
    expect(stripeKeys).toEqual(["sk_test_checkout"]);
    expect(claim).not.toHaveBeenCalled();
  });

  it("supports PIA sections and preserves County Post's separate section catalog", async () => {
    configureCheckout();
    const body = { brand: "patriots-in-action", scope: "state", placement: "state-feed-sponsorship", billing: "annual", states: ["texas", "oklahoma"], feeds: ["pia-tv", "community-calendar"], customerEmail: "advertiser@example.com", businessName: "PIA advertiser" };
    expect(JSON.parse((await checkout(body)).body).amountCents).toBe(13240000);
    expect(createSession.mock.calls[0][0].metadata.feeds).toBe("pia-tv,community-calendar");
    expect((await checkout({...body, brand: "the-county-post"})).statusCode).toBe(400);
    expect((await checkout({...body, brand: "other"})).statusCode).toBe(400);
    expect((await checkout({...body, feeds: ["sports"]})).statusCode).toBe(400);
  });

  it("quotes the same price without contacting Stripe or requiring a payment key", async () => {
    config.stripeSecretKey = "";
    const response = await handleRequest({ method: "POST", path: "/v1/checkout/quotes", query: new URLSearchParams(), body: JSON.stringify({brand: "patriots-in-action", scope: "county", placement: "color-card", billing: "annual", counties: [{stateSlug: "texas", countySlug: "potter"}, {stateSlug: "texas", countySlug: "loving"}], customerEmail: "advertiser@example.com", businessName: "PIA advertiser"}) });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.body)).toMatchObject({amountCents: 262500, brand: {name: "Patriots in Action"}});
    expect(createSession).not.toHaveBeenCalled();
  });

  const requestId = "12345678-1234-4123-8123-123456789012";
  const input = { checkoutRequestId: requestId, scope: "county", placement: "color-card", billing: "monthly",
    counties: [{ stateSlug: "texas", countySlug: "potter" }], customerEmail: "advertiser@example.com", businessName: "Example" };
  const status = () => handleRequest({ method: "POST", path: "/v1/checkout/status", query: new URLSearchParams(), body: JSON.stringify({ orderId: requestId }) });

  it("routes County Post to its own key and refuses fallback to the PIA key", async () => {
    configureCheckout();
    expect((await checkout(input)).statusCode).toBe(201);
    expect(stripeKeys).toEqual(["sk_test_county_post"]);
    expect(createSession.mock.calls[0][0].success_url).toContain(`order_id=${requestId}`);
    config.countyPostStripeSecretKey = "";
    expect((await checkout(input)).statusCode).toBe(503);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("recovers a timed-out creation with identical persisted parameters and idempotency key", async () => {
    configureCheckout();
    createSession.mockRejectedValueOnce(new Error("lost response"));
    expect((await checkout(input)).statusCode).toBe(502);
    expect((await checkout(input)).statusCode).toBe(201);
    expect(createSession.mock.calls[1]).toEqual(createSession.mock.calls[0]);
    expect(createSession.mock.calls[1][1]).toEqual({ idempotencyKey: `county-post-advertising-${requestId}` });
    retrieveSession.mockResolvedValue(await createSession.mock.results[1].value);
    expect((await checkout(input)).statusCode).toBe(201);
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it("refuses altered quotes, ambiguous old retries, and missing durable storage", async () => {
    configureCheckout();
    createSession.mockRejectedValueOnce(new Error("lost response"));
    await checkout(input);
    expect((await checkout({ ...input, billing: "annual" })).statusCode).toBe(409);
    orders.get(requestId).createdAt -= 86400;
    expect((await checkout(input)).statusCode).toBe(409);
    expect(createSession).toHaveBeenCalledTimes(1);
    claim.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await checkout(input)).statusCode).toBe(502);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("only confirms provider-reported payment for the exact saved order", async () => {
    configureCheckout();
    await checkout(input);
    const session = await createSession.mock.results[0].value;
    retrieveSession.mockResolvedValue(session);
    expect(JSON.parse((await status()).body).status).toBe("pending");
    retrieveSession.mockResolvedValue({ ...session, status: "complete", payment_status: "paid" });
    const paid = await status();
    expect(JSON.parse(paid.body)).toMatchObject({ status: "paid", amountCents: 25000 });
    expect(paid.body).not.toContain("advertiser@example.com");
    for (const mismatch of [{ amount_total: 1 }, { livemode: true }, { metadata: { application: "county_classifieds" } }, { client_reference_id: "other" }]) {
      retrieveSession.mockResolvedValue({ ...session, ...mismatch, payment_status: "paid" });
      expect((await status()).statusCode).toBe(502);
    }
  });

  it("verifies raw webhook signatures, deduplicates receipts and ignores foreign applications and modes", async () => {
    configureCheckout();
    await checkout(input);
    const session = await createSession.mock.results[0].value;
    retrieveSession.mockResolvedValue({ ...session, payment_status: "paid", status: "complete" });
    const event = { id: "evt_verified", object: "event", livemode: false, type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000), data: { object: { ...session, object: "checkout.session" } } };
    const deliver = (value: unknown, valid = true) => {
      const body = JSON.stringify(value);
      const time = Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", config.countyPostStripeWebhookSecret).update(`${time}.${body}`).digest("hex");
      return handleRequest({ method: "POST", path: "/v1/checkout/webhook", query: new URLSearchParams(), body,
        headers: { "Stripe-Signature": `t=${time},v1=${valid ? sig : "bad"}` } });
    };
    expect((await deliver(event, false)).statusCode).toBe(400);
    expect(record).not.toHaveBeenCalled();
    expect((await deliver(event)).statusCode).toBe(200);
    expect((await deliver(event)).statusCode).toBe(200);
    expect(receipts.size).toBe(1);
    await deliver({ ...event, livemode: true });
    await deliver({ ...event, data: { object: { ...event.data.object, metadata: { application: "county_classifieds", environment: "test" } } } });
    expect(record).toHaveBeenCalledTimes(2);
    record.mockRejectedValueOnce(new Error("storage down"));
    expect((await deliver(event)).statusCode).toBe(500);
  });

});

function configureCheckout() {
  config.stripeSecretKey = "sk_test_checkout";
  config.checkoutSuccessUrl = "https://www.advertise.thecountypost.com/?checkout=success";
  config.checkoutCancelUrl = "https://www.advertise.thecountypost.com/?checkout=cancelled";
  config.countyPostStripeSecretKey = "sk_test_county_post";
  config.countyPostStripeLiveMode = false;
  config.countyPostStripeWebhookSecret = "whsec_test_signature_only";
  config.advertisingPaymentsTable = "test-orders";
  createSession.mockImplementation(async (params) => ({
    id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123", status: "open", payment_status: "unpaid",
    mode: params.mode, livemode: false, client_reference_id: params.client_reference_id,
    metadata: params.metadata, currency: "usd", amount_total: params.line_items[0].price_data.unit_amount,
  }));
}

function checkout(body: Record<string, unknown>) {
  return handleRequest({
    method: "POST",
    path: "/v1/checkout/sessions",
    query: new URLSearchParams(),
    body: JSON.stringify(body),
  });
}
