import { afterEach, describe, expect, it, vi } from "vitest";

const createSession = vi.hoisted(() => vi.fn());

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { create: createSession } };
  },
}));

import { config } from "../src/config.js";
import { handleRequest } from "../src/http.js";

const defaultStripeSecretKey = config.stripeSecretKey;
const defaultSuccessUrl = config.checkoutSuccessUrl;
const defaultCancelUrl = config.checkoutCancelUrl;

describe("Stripe Checkout endpoint", () => {
  afterEach(() => {
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
    expect(createSession).toHaveBeenCalledWith(
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
    expect(createSession).toHaveBeenCalledWith(
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
    expect(createSession).toHaveBeenCalledWith(
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
    expect(createSession).toHaveBeenCalledWith(
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
    expect(JSON.parse(response.body).error).toBe("Checkout prices are determined by the County Post rate card.");
    expect(createSession).not.toHaveBeenCalled();
  });
});

function configureCheckout() {
  config.stripeSecretKey = "sk_test_checkout";
  config.checkoutSuccessUrl = "https://www.advertise.thecountypost.com/?checkout=success";
  config.checkoutCancelUrl = "https://www.advertise.thecountypost.com/?checkout=cancelled";
  createSession.mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" });
}

function checkout(body: Record<string, unknown>) {
  return handleRequest({
    method: "POST",
    path: "/v1/checkout/sessions",
    query: new URLSearchParams(),
    body: JSON.stringify(body),
  });
}
