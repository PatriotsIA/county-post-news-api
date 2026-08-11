import Stripe from "stripe";
import {
  isBillingCadence,
  isCountyPlacement,
  monthlyRateFor,
  type BillingCadence,
  type CountyPlacement,
  type CountyRateTierKey,
} from "./ad-pricing.js";
import { config } from "./config.js";
import { COUNTY_POPULATION_ESTIMATE_VINTAGE } from "./county-populations.js";
import { getCountyPopulation, PopulationError } from "./population-service.js";
import { isAdCreativeAssetKey } from "./ad-creative-service.js";

type CheckoutCounty = {
  stateSlug: string;
  countySlug: string;
  population: number;
  rateTier: CountyRateTierKey;
};

export type CheckoutRequest = {
  placement: CountyPlacement;
  billing: BillingCadence;
  counties: CheckoutCounty[];
  customerEmail: string;
  businessName: string;
  creativeAssetKey?: string;
};

export type CheckoutResponse = {
  sessionId: string;
  url: string;
  amountCents: number;
  currency: "usd";
  billing: BillingCadence;
  requiresSalesReview: true;
};

export class CheckoutError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createCheckoutSession(payload: unknown): Promise<CheckoutResponse> {
  if (!config.stripeSecretKey) throw new CheckoutError(503, "Payments are not configured.");
  if (!config.checkoutSuccessUrl || !config.checkoutCancelUrl) throw new CheckoutError(503, "Checkout return URLs are not configured.");

  const request = parseCheckoutRequest(payload);
  const monthlyAmountCents = calculateMonthlyAmount(request);
  const amountCents = request.billing === "annual" ? monthlyAmountCents * 10 : monthlyAmountCents;
  const placementLabel = request.placement === "color-card" ? "Local color card" : "Section sponsorship";
  const cadenceLabel = request.billing === "annual" ? "annual plan (12 months for the price of 10)" : "monthly plan";
  const stripe = new Stripe(config.stripeSecretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: request.customerEmail,
      billing_address_collection: "auto",
      success_url: config.checkoutSuccessUrl,
      cancel_url: config.checkoutCancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            recurring: { interval: request.billing === "annual" ? "year" : "month" },
            product_data: {
              name: `The County Post — ${placementLabel}`,
              description: `${request.counties.length} county ${request.counties.length === 1 ? "placement" : "placements"}, ${cadenceLabel}.`,
            },
          },
        },
      ],
      metadata: {
        businessName: request.businessName,
        placement: request.placement,
        billing: request.billing,
        countyCount: String(request.counties.length),
        populationEstimateVintage: String(COUNTY_POPULATION_ESTIMATE_VINTAGE),
        requiresSalesReview: "true",
        ...(request.creativeAssetKey ? { creativeAssetKey: request.creativeAssetKey } : {}),
      },
      subscription_data: {
        metadata: {
          placement: request.placement,
          billing: request.billing,
          countyCount: String(request.counties.length),
          populationEstimateVintage: String(COUNTY_POPULATION_ESTIMATE_VINTAGE),
          requiresSalesReview: "true",
          ...(request.creativeAssetKey ? { creativeAssetKey: request.creativeAssetKey } : {}),
        },
      },
    });

    if (!session.url) throw new CheckoutError(502, "Stripe did not return a checkout URL.");

    return {
      sessionId: session.id,
      url: session.url,
      amountCents,
      currency: "usd",
      billing: request.billing,
      requiresSalesReview: true,
    };
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(502, "Unable to start secure checkout.");
  }
}

function parseCheckoutRequest(payload: unknown): CheckoutRequest {
  if (!isRecord(payload)) throw new CheckoutError(400, "Checkout details must be a JSON object.");
  if ("amount" in payload || "price" in payload || "unitAmount" in payload) {
    throw new CheckoutError(400, "Checkout prices are determined by the County Post rate card.");
  }

  if (!isCountyPlacement(payload.placement)) throw new CheckoutError(400, "Choose a valid county placement.");
  if (!isBillingCadence(payload.billing)) throw new CheckoutError(400, "Choose monthly or annual billing.");

  const customerEmail = requiredText(payload.customerEmail, "A valid contact email is required.", 254);
  if (!emailPattern.test(customerEmail)) throw new CheckoutError(400, "A valid contact email is required.");
  const businessName = requiredText(payload.businessName, "A business name is required.", 120);
  const creativeAssetKey = payload.creativeAssetKey;
  if (creativeAssetKey !== undefined && !isAdCreativeAssetKey(creativeAssetKey)) {
    throw new CheckoutError(400, "The creative upload reference is invalid.");
  }
  if (!Array.isArray(payload.counties) || !payload.counties.length || payload.counties.length > 25) {
    throw new CheckoutError(400, "Choose between 1 and 25 counties.");
  }

  const seenCounties = new Set<string>();
  const counties = payload.counties.map((value) => {
    if (!isRecord(value)) throw new CheckoutError(400, "Each county selection is invalid.");
    const stateSlug = requiredSlug(value.stateSlug, "Each county needs a valid state.");
    const countySlug = requiredSlug(value.countySlug, "Each county needs a valid county.");
    let county;
    try {
      county = getCountyPopulation(stateSlug, countySlug);
    } catch (error) {
      if (error instanceof PopulationError) throw new CheckoutError(error.statusCode, error.message);
      throw error;
    }

    const key = `${stateSlug}/${countySlug}`;
    if (seenCounties.has(key)) throw new CheckoutError(400, "Each county can be selected only once.");
    seenCounties.add(key);
    return { stateSlug, countySlug, population: county.population, rateTier: county.rateTier };
  });

  return { placement: payload.placement, billing: payload.billing, counties, customerEmail, businessName, creativeAssetKey };
}

function calculateMonthlyAmount(request: CheckoutRequest) {
  const rates = request.counties
    .map((county) => monthlyRateFor(request.placement, county.rateTier))
    .sort((left, right) => right - left);

  return rates.reduce((total, rate, index) => total + (index === 0 ? rate : Math.round(rate / 2)), 0);
}

function requiredText(value: unknown, message: string, maxLength: number) {
  if (typeof value !== "string") throw new CheckoutError(400, message);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new CheckoutError(400, message);
  return text;
}

function requiredSlug(value: unknown, message: string) {
  const slug = requiredText(value, message, 80).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw new CheckoutError(400, message);
  return slug;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
