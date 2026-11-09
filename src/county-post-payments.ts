import { createHash, randomUUID } from "node:crypto";
import Stripe from "stripe";
import { config } from "./config.js";
import { CheckoutError } from "./checkout-error.js";
import {
  attachAdvertisingSession, claimAdvertisingOrder, getAdvertisingOrder,
  recordAdvertisingEvent, type AdvertisingOrder,
} from "./advertising-payments-store.js";

export const ADVERTISING_APPLICATION = "county_post_advertising";
export const ADVERTISING_STRIPE_API_VERSION = "2026-07-29.dahlia";
export const ADVERTISING_WEBHOOK_EVENTS = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "checkout.session.expired",
  "invoice.paid", "invoice.payment_failed",
  "customer.subscription.updated", "customer.subscription.deleted",
] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mode = () => config.countyPostStripeLiveMode ? "live" as const : "test" as const;

function gateway() {
  const key = config.countyPostStripeSecretKey;
  if (!config.advertisingPaymentsTable || !new RegExp(`^(sk|rk)_${mode()}_`).test(key)) {
    throw new CheckoutError(503, "County Post payments are not configured.");
  }
  return new Stripe(key, { apiVersion: ADVERTISING_STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 15000 });
}

function owned(metadata?: Stripe.Metadata | null) {
  return metadata?.application === ADVERTISING_APPLICATION && metadata.environment === mode();
}

function verifySession(order: AdvertisingOrder, session: Stripe.Checkout.Session) {
  if (session.livemode !== (order.mode === "live") || session.mode !== "subscription" ||
      !owned(session.metadata) || session.metadata?.order_id !== order.id ||
      session.client_reference_id !== order.id || session.amount_total !== order.amountCents ||
      session.currency !== order.currency || (order.sessionId && order.sessionId !== session.id)) {
    throw new CheckoutError(502, "Payment details do not match the saved advertising order.");
  }
}

function safeCheckoutUrl(value: string | null) {
  if (!value) throw new CheckoutError(502, "Stripe did not return a checkout URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
    throw new CheckoutError(502, "Stripe returned an invalid checkout URL.");
  }
  return value;
}

export async function createCountyPostCheckout(input: {
  requestId?: unknown; params: Stripe.Checkout.SessionCreateParams; amountCents: number;
}) {
  // Old deployed clients may omit an ID during a rolling frontend release.
  const id = input.requestId === undefined ? randomUUID() : input.requestId;
  if (typeof id !== "string" || !uuid.test(id)) throw new CheckoutError(400, "Invalid checkout request reference.");
  const stripe = gateway();
  const requestHash = createHash("sha256").update(JSON.stringify(input.params)).digest("hex");
  const createdAt = Math.floor(Date.now() / 1000);
  const metadata = { ...input.params.metadata, application: ADVERTISING_APPLICATION, environment: mode(), order_id: id };
  const success = new URL(input.params.success_url!);
  success.searchParams.set("order_id", id);
  const order = await claimAdvertisingOrder({
    id, mode: mode(), createdAt, requestHash, amountCents: input.amountCents, currency: "usd",
    params: { ...input.params, metadata, client_reference_id: id,
      subscription_data: { ...input.params.subscription_data, metadata },
      payment_method_types: ["card"], expires_at: createdAt + 86400, success_url: success.toString() },
  });
  if (order.requestHash !== requestHash) throw new CheckoutError(409, "This checkout reference belongs to different order details.");
  // Stripe retains idempotency keys for at least 24 hours. Never recreate an
  // ambiguous attempt beyond that window: finance must reconcile it first.
  if (!order.sessionId && createdAt - order.createdAt > 23 * 3600) {
    throw new CheckoutError(409, "This checkout needs review. Please contact the advertising team before retrying.");
  }
  const session = order.sessionId
    ? await stripe.checkout.sessions.retrieve(order.sessionId)
    : await stripe.checkout.sessions.create(order.params, { idempotencyKey: `county-post-advertising-${order.id}` });
  verifySession(order, session);
  await attachAdvertisingSession(order, session.id);
  if (session.status === "expired") throw new CheckoutError(409, "This checkout has expired. Click continue to start a new checkout.", "checkout_expired");
  return { id: session.id, url: session.status === "complete" ? order.params.success_url! : safeCheckoutUrl(session.url) };
}

export async function advertisingCheckoutStatus(payload: unknown) {
  const id = typeof payload === "object" && payload !== null ? (payload as { orderId?: unknown }).orderId : undefined;
  if (typeof id !== "string" || !uuid.test(id)) throw new CheckoutError(400, "Invalid advertising order reference.");
  const stripe = gateway();
  const order = await getAdvertisingOrder(mode(), id);
  if (!order) throw new CheckoutError(404, "Advertising order not found.");
  if (!order.sessionId) return { status: "pending", requiresSalesReview: true };
  const session = await stripe.checkout.sessions.retrieve(order.sessionId);
  verifySession(order, session);
  return { status: session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : "pending",
    amountCents: order.amountCents, currency: order.currency, requiresSalesReview: true };
}

export async function receiveAdvertisingWebhook(body: string, signature?: string) {
  if (!config.countyPostStripeWebhookSecret) throw new CheckoutError(503, "Payment notifications are not configured.");
  if (!signature || Buffer.byteLength(body) > 262144) throw new CheckoutError(400, "Invalid payment notification.");
  const stripe = gateway();
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(body, signature, config.countyPostStripeWebhookSecret); }
  catch { throw new CheckoutError(400, "Invalid payment notification signature."); }
  if (event.livemode !== config.countyPostStripeLiveMode || !(ADVERTISING_WEBHOOK_EVENTS as readonly string[]).includes(event.type)) return;
  let metadata: Stripe.Metadata | null | undefined;
  const object = event.data.object;
  if (object.object === "checkout.session" || object.object === "subscription") metadata = object.metadata;
  if (object.object === "invoice") {
    const subscription = object.parent?.subscription_details?.subscription;
    if (subscription) metadata = (await stripe.subscriptions.retrieve(typeof subscription === "string" ? subscription : subscription.id)).metadata;
  }
  // The account also serves Classifieds. Those events belong to its ledger.
  if (!owned(metadata) || !metadata?.order_id || !uuid.test(metadata.order_id)) return;
  if (!("id" in object)) return;
  const order = await getAdvertisingOrder(mode(), metadata.order_id);
  if (!order) throw new CheckoutError(503, "Advertising order is not available yet; retry notification.");
  if (object.object === "checkout.session") {
    const session = await stripe.checkout.sessions.retrieve(object.id);
    verifySession(order, session);
    await attachAdvertisingSession(order, session.id);
  }
  // Receipts are immutable and deduplicated. Inventory and creative approval
  // remain with the advertising team; a webhook never publishes an ad.
  await recordAdvertisingEvent(mode(), { eventId: event.id, type: event.type,
    orderId: order.id, objectId: object.id, created: event.created });
}
