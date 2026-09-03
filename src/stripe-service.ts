import Stripe from "stripe";
import {
  ANNUAL_BILLED_MONTHS,
  isBillingCadence,
  isCountyPlacement,
  isSponsorableFeed,
  isStatePlacement,
  monthlyRateFor,
  monthlyStateRateFor,
  type BillingCadence,
  type CountyPlacement,
  type CountyRateTierKey,
  type SponsorableFeed,
  type StatePlacement,
} from "./ad-pricing.js";
import { isAdCreativeAssetKey } from "./ad-creative-service.js";
import { config } from "./config.js";
import { getState, getStateCountyCount } from "./geo.js";
import { COUNTY_POPULATION_ESTIMATE_VINTAGE } from "./county-populations.js";
import { getCountyPopulation, PopulationError } from "./population-service.js";

type CheckoutContact = {
  billing: BillingCadence;
  customerEmail: string;
  businessName: string;
  creativeAssetKey?: string;
};

type CheckoutCounty = {
  stateSlug: string;
  countySlug: string;
  population: number;
  rateTier: CountyRateTierKey;
};

type CheckoutState = {
  slug: string;
  abbr: string;
  countyCount: number;
};

type CountyCheckoutRequest = CheckoutContact & {
  scope: "county";
  placement: CountyPlacement;
  counties: CheckoutCounty[];
};

type StateCheckoutRequest = CheckoutContact & {
  scope: "state";
  placement: StatePlacement;
  states: CheckoutState[];
  feeds: SponsorableFeed[];
};

export type CheckoutRequest = CountyCheckoutRequest | StateCheckoutRequest;

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
  const amountCents = request.billing === "annual" ? monthlyAmountCents * ANNUAL_BILLED_MONTHS : monthlyAmountCents;
  const cadenceLabel = request.billing === "annual" ? "annual plan (12 months for the price of 10)" : "monthly plan";
  const stripe = new Stripe(config.stripeSecretKey);
  const product = checkoutProductDetails(request, cadenceLabel);
  const metadata = checkoutMetadata(request);

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
              name: `The County Post — ${product.name}`,
              description: product.description,
            },
          },
        },
      ],
      metadata,
      subscription_data: { metadata },
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
  if (!isBillingCadence(payload.billing)) throw new CheckoutError(400, "Choose monthly or annual billing.");

  const contact = parseCheckoutContact(payload);
  const scope = payload.scope ?? (Array.isArray(payload.counties) ? "county" : undefined);
  if (scope === "county") return parseCountyCheckout(payload, contact);
  if (scope === "state") return parseStateCheckout(payload, contact);
  throw new CheckoutError(400, "Choose county or state campaign reach.");
}

function parseCheckoutContact(payload: Record<string, unknown>): CheckoutContact {
  const customerEmail = requiredText(payload.customerEmail, "A valid contact email is required.", 254);
  if (!emailPattern.test(customerEmail)) throw new CheckoutError(400, "A valid contact email is required.");
  const businessName = requiredText(payload.businessName, "A business name is required.", 120);
  const creativeAssetKey = payload.creativeAssetKey;
  if (creativeAssetKey !== undefined && !isAdCreativeAssetKey(creativeAssetKey)) {
    throw new CheckoutError(400, "The creative upload reference is invalid.");
  }

  return { billing: payload.billing as BillingCadence, customerEmail, businessName, creativeAssetKey };
}

function parseCountyCheckout(payload: Record<string, unknown>, contact: CheckoutContact): CountyCheckoutRequest {
  if (!isCountyPlacement(payload.placement)) throw new CheckoutError(400, "Choose a valid county placement.");
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

  return { ...contact, scope: "county", placement: payload.placement, counties };
}

function parseStateCheckout(payload: Record<string, unknown>, contact: CheckoutContact): StateCheckoutRequest {
  if (!isStatePlacement(payload.placement)) throw new CheckoutError(400, "Choose a valid state placement.");
  if (!Array.isArray(payload.states) || !payload.states.length || payload.states.length > 51) {
    throw new CheckoutError(400, "Choose between 1 and 51 states.");
  }

  const seenStates = new Set<string>();
  const states = payload.states.map((value) => {
    const slug = requiredSlug(value, "Each state selection is invalid.");
    if (seenStates.has(slug)) throw new CheckoutError(400, "Each state can be selected only once.");
    seenStates.add(slug);
    const state = getState(slug);
    const countyCount = getStateCountyCount(slug);
    if (!state || countyCount === undefined || countyCount < 1) throw new CheckoutError(400, `Unknown state: ${slug}.`);
    return { slug: state.slug, abbr: state.abbr, countyCount };
  });

  const feeds = parseFeeds(payload.feeds, payload.placement);
  return { ...contact, scope: "state", placement: payload.placement, states, feeds };
}

function parseFeeds(value: unknown, placement: StatePlacement) {
  if (placement === "state-ad") {
    if (value !== undefined && (!Array.isArray(value) || value.length)) {
      throw new CheckoutError(400, "Feeds apply only to state feed sponsorships.");
    }
    return [];
  }
  if (!Array.isArray(value) || !value.length) throw new CheckoutError(400, "Choose at least one feed to sponsor.");

  const feeds = value.map((feed) => {
    if (!isSponsorableFeed(feed)) throw new CheckoutError(400, "Choose a valid feed sponsorship.");
    return feed;
  });
  if (new Set(feeds).size !== feeds.length) throw new CheckoutError(400, "Each feed can be selected only once.");
  return feeds;
}

function calculateMonthlyAmount(request: CheckoutRequest) {
  if (request.scope === "state") {
    const countyCount = request.states.reduce((total, state) => total + state.countyCount, 0);
    return monthlyStateRateFor(countyCount, request.placement, request.feeds.length);
  }

  const rates = request.counties
    .map((county) => monthlyRateFor(request.placement, county.rateTier))
    .sort((left, right) => right - left);
  return rates.reduce((total, rate, index) => total + (index === 0 ? rate : Math.round(rate / 2)), 0);
}

function checkoutProductDetails(request: CheckoutRequest, cadenceLabel: string) {
  if (request.scope === "state") {
    const countyCount = request.states.reduce((total, state) => total + state.countyCount, 0);
    const isSponsorship = request.placement === "state-feed-sponsorship";
    return {
      name: isSponsorship ? "State feed sponsorship" : "State ad network",
      description: `${request.states.length} state ${request.states.length === 1 ? "network" : "networks"}, ${countyCount} county editions${isSponsorship ? `, ${request.feeds.length} sponsored ${request.feeds.length === 1 ? "feed" : "feeds"}` : ""}, ${cadenceLabel}.`,
    };
  }

  return {
    name: request.placement === "color-card" ? "Local color card" : "Feed sponsorship",
    description: `${request.counties.length} county ${request.counties.length === 1 ? "placement" : "placements"}, ${cadenceLabel}.`,
  };
}

function checkoutMetadata(request: CheckoutRequest): Record<string, string> {
  const shared = {
    businessName: request.businessName,
    scope: request.scope,
    placement: request.placement,
    billing: request.billing,
    requiresSalesReview: "true",
    ...(request.creativeAssetKey ? { creativeAssetKey: request.creativeAssetKey } : {}),
  };

  if (request.scope === "state") {
    return {
      ...shared,
      stateCount: String(request.states.length),
      countyCount: String(request.states.reduce((total, state) => total + state.countyCount, 0)),
      states: request.states.map((state) => state.abbr).join(","),
      feedCount: String(request.feeds.length),
      feeds: request.feeds.join(","),
    };
  }

  return {
    ...shared,
    countyCount: String(request.counties.length),
    populationEstimateVintage: String(COUNTY_POPULATION_ESTIMATE_VINTAGE),
  };
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
