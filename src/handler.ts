import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handleRequest } from "./http.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const response = await handleRequest({
    method: event.requestContext.http.method,
    path: event.rawPath || "/",
    query: new URLSearchParams(event.rawQueryString || ""),
    headers: event.headers,
    body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : undefined,
    remoteAddress: event.requestContext.http.sourceIp,
    requestId: event.requestContext.requestId,
  });

  return response;
}
