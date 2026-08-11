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

  it("creates a no-store hosted Checkout session with server-calculated rate-card pricing", async () => {
    config.stripeSecretKey = "sk_test_checkout";
    config.checkoutSuccessUrl = "https://thecountypost.com/payments?checkout=success";
    config.checkoutCancelUrl = "https://thecountypost.com/payments?checkout=cancelled";
    createSession.mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" });

    const response = await handleRequest({
      method: "POST",
      path: "/v1/checkout/sessions",
      query: new URLSearchParams(),
      body: JSON.stringify({
        placement: "color-card",
        billing: "annual",
        counties: [{ stateSlug: "texas", countySlug: "potter" }],
        customerEmail: "advertiser@example.com",
        businessName: "Example Business",
      }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(JSON.parse(response.body)).toEqual({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
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
      }),
    );
  });

  it("rejects client-supplied prices before calling Stripe", async () => {
    config.stripeSecretKey = "sk_test_checkout";
    config.checkoutSuccessUrl = "https://thecountypost.com/payments?checkout=success";
    config.checkoutCancelUrl = "https://thecountypost.com/payments?checkout=cancelled";

    const response = await handleRequest({
      method: "POST",
      path: "/v1/checkout/sessions",
      query: new URLSearchParams(),
      body: JSON.stringify({
        placement: "color-card",
        billing: "monthly",
        counties: [{ stateSlug: "texas", countySlug: "potter" }],
        customerEmail: "advertiser@example.com",
        businessName: "Example Business",
        amount: 1,
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("Checkout prices are determined by the County Post rate card.");
    expect(createSession).not.toHaveBeenCalled();
  });
});
