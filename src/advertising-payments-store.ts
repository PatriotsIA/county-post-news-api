import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type Stripe from "stripe";
import { config } from "./config.js";

export type AdvertisingOrder = {
  id: string;
  mode: "live" | "test";
  createdAt: number;
  requestHash: string;
  amountCents: number;
  currency: "usd";
  params: Stripe.Checkout.SessionCreateParams;
  sessionId?: string;
};

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function table() {
  if (!config.advertisingPaymentsTable) throw new Error("Advertising payment storage is not configured.");
  return config.advertisingPaymentsTable;
}

function key(mode: AdvertisingOrder["mode"], id: string) {
  return `${mode}:order:${id}`;
}

export async function getAdvertisingOrder(mode: AdvertisingOrder["mode"], id: string): Promise<AdvertisingOrder | undefined> {
  const response = await database.send(new GetCommand({
    TableName: table(), Key: { id: key(mode, id) }, ConsistentRead: true,
  }));
  return response.Item?.order as AdvertisingOrder | undefined;
}

export async function claimAdvertisingOrder(order: AdvertisingOrder): Promise<AdvertisingOrder> {
  try {
    await database.send(new PutCommand({
      TableName: table(), Item: { id: key(order.mode, order.id), kind: "order", order },
      ConditionExpression: "attribute_not_exists(id)",
    }));
    return order;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
    const existing = await getAdvertisingOrder(order.mode, order.id);
    if (!existing) throw new Error("Advertising order could not be recovered.");
    return existing;
  }
}

export async function attachAdvertisingSession(order: AdvertisingOrder, sessionId: string): Promise<void> {
  await database.send(new UpdateCommand({
    TableName: table(), Key: { id: key(order.mode, order.id) },
    UpdateExpression: "SET #order.sessionId = :session",
    ConditionExpression: "attribute_exists(id) AND (attribute_not_exists(#order.sessionId) OR #order.sessionId = :session)",
    ExpressionAttributeNames: { "#order": "order" },
    ExpressionAttributeValues: { ":session": sessionId },
  }));
}

export async function recordAdvertisingEvent(mode: AdvertisingOrder["mode"], event: {
  eventId: string; type: string; orderId: string; objectId: string; created: number;
}): Promise<void> {
  try {
    await database.send(new PutCommand({
      TableName: table(), Item: { id: `${mode}:event:${event.eventId}`, kind: "event", mode, ...event },
      ConditionExpression: "attribute_not_exists(id)",
    }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
  }
}
