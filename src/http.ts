import { config } from "./config.js";
import { getCounty, getState, states } from "./geo.js";
import { getFeed, getPage } from "./news-service.js";
import { topics } from "./feed-builders.js";
import { getCattleTicker, getMetalsTicker, MarketServiceError } from "./markets-service.js";
import { CheckoutError, createCheckoutSession } from "./stripe-service.js";
import { getCountyPopulation, PopulationError } from "./population-service.js";
import { AdCreativeError, createAdCreativeUpload } from "./ad-creative-service.js";
import { FredServiceError, getCountyFredData } from "./fred-service.js";
import {
  AtlasServiceError,
  getCountyAtlasDomain,
  getCountyAtlasOverview,
} from "./atlas-service.js";
import { getCountyWeather, WeatherServiceError } from "./weather-service.js";
import type { FeedScope, Topic } from "./types.js";

export type ApiRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  headers?: Record<string, string | undefined>;
  body?: string;
  remoteAddress?: string;
  requestId?: string;
};

export type ApiResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export async function handleRequest(request: ApiRequest): Promise<ApiResponse> {
  const startedAt = Date.now();
  const path = normalizePath(request.path);
  let response: ApiResponse;
  let errorMessage: string | undefined;

  try {
    if (request.method === "OPTIONS") {
      response = empty(204);
    } else if (request.method === "POST" && path === "/v1/advertising/creatives/upload") {
      response = json(201, await createAdCreativeUpload(parseJsonBody(request.body)), "no-store");
    } else if (request.method === "POST" && path === "/v1/checkout/sessions") {
      response = json(201, await createCheckoutSession(parseJsonBody(request.body)), "no-store");
    } else if (request.method !== "GET") {
      response = json(405, { error: "Method not allowed" });
    } else if (path === "/health") {
      response = json(200, { ok: true, service: "county-post-news-api", uptimeMs: process.uptime() * 1000 });
    } else if (path === "/v1/states") {
      response = json(200, { states });
    } else {
      const parts = path.split("/").filter(Boolean);
      if (parts[0] !== "v1") {
        response = json(404, { error: "Not found" });
      } else if (parts[1] === "counties" && parts[2] && parts[3] && parts[4] === "population" && parts.length === 5) {
        response = json(200, getCountyPopulation(parts[2], parts[3]));
      } else if (parts[1] === "counties" && parts[2] && parts[3] && parts[4] === "economic-data" && parts.length === 5) {
        const county = getCounty(parts[2], parts[3]);
        if (!county) throw new ApiError(404, "Unknown county");
        response = json(
          200,
          await getCountyFredData(county),
          `public, max-age=1800, s-maxage=${config.fredCacheTtlSeconds}`,
        );
      } else if (parts[1] === "counties" && parts[2] && parts[3] && parts[4] === "weather" && parts.length === 5) {
        response = json(200, await getCountyWeather(parts[2], parts[3]), weatherCacheControl());
      } else if (parts[1] === "counties" && parts[2] && parts[3] && parts[4] === "atlas" && parts.length === 5) {
        response = json(200, await getCountyAtlasOverview(parts[2], parts[3]), atlasCacheControl());
      } else if (parts[1] === "counties" && parts[2] && parts[3] && parts[4] === "atlas" && parts[5] && parts.length === 6) {
        response = json(200, await getCountyAtlasDomain(parts[2], parts[3], parts[5]), atlasCacheControl());
      } else if (parts[1] === "feeds") {
        response = await handleFeed(parts.slice(2), request.query);
      } else if (parts[1] === "pages") {
        response = await handlePage(parts.slice(2), request.query);
      } else if (parts[1] === "markets" && parts[2] === "metals" && parts.length === 3) {
        response = json(200, await getMetalsTicker());
      } else if (parts[1] === "markets" && parts[2] === "cattle" && parts.length === 3) {
        response = json(200, await getCattleTicker());
      } else {
        response = json(404, { error: "Not found" });
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isExpectedError =
      error instanceof ApiError ||
      error instanceof MarketServiceError ||
      error instanceof CheckoutError ||
      error instanceof PopulationError ||
      error instanceof AdCreativeError ||
      error instanceof FredServiceError ||
      error instanceof WeatherServiceError ||
      error instanceof AtlasServiceError;
    const message = isExpectedError ? error.message : "Internal server error";
    const status = isExpectedError ? error.statusCode : 500;
    response = json(status, { error: message, durationMs: Date.now() - startedAt }, request.method === "POST" ? "no-store" : undefined);
  }

  const corsResponse = withCorsHeaders(response, request.headers);
  logRequest(request, path, corsResponse, Date.now() - startedAt, errorMessage);
  return corsResponse;
}

async function handleFeed(parts: string[], query: URLSearchParams) {
  const { scope, topic } = parseFeedScope(parts);
  return json(200, await getFeed(scope, topic, numberParam(query, "limit", config.defaultLimit)));
}

async function handlePage(parts: string[], query: URLSearchParams) {
  const scope = parsePageScope(parts);
  const sections = csvParam(query, "sections");
  return json(200, await getPage(scope, sections, numberParam(query, "limit", config.defaultLimit)));
}

function parseFeedScope(parts: string[]): { scope: FeedScope; topic: Topic } {
  if (parts[0] === "national" && parts[1]) {
    return { scope: { level: "national" }, topic: parseTopic(parts[1]) };
  }

  if (parts[0] === "states" && parts[1] && parts[2]) {
    const state = getState(parts[1]);
    if (!state) throw new ApiError(404, "Unknown state");
    return { scope: { level: "state", state }, topic: parseTopic(parts[2]) };
  }

  if (parts[0] === "counties" && parts[1] && parts[2] && parts[3]) {
    const county = getCounty(parts[1], parts[2]);
    if (!county) throw new ApiError(404, "Unknown county");
    return { scope: { level: "county", state: county.state, county }, topic: parseTopic(parts[3]) };
  }

  throw new ApiError(404, "Unknown feed route");
}

function parsePageScope(parts: string[]): FeedScope {
  if (parts[0] === "national") return { level: "national" };

  if (parts[0] === "states" && parts[1]) {
    const state = getState(parts[1]);
    if (!state) throw new ApiError(404, "Unknown state");
    return { level: "state", state };
  }

  if (parts[0] === "counties" && parts[1] && parts[2]) {
    const county = getCounty(parts[1], parts[2]);
    if (!county) throw new ApiError(404, "Unknown county");
    return { level: "county", state: county.state, county };
  }

  throw new ApiError(404, "Unknown page route");
}

function parseTopic(value: string): Topic {
  if (topics.includes(value as Topic)) return value as Topic;
  throw new ApiError(400, `Unknown topic. Use one of: ${topics.join(", ")}`);
}

function numberParam(query: URLSearchParams, name: string, fallback: number) {
  const value = Number(query.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function csvParam(query: URLSearchParams, name: string) {
  return (query.get(name) || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizePath(path: string) {
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

function empty(statusCode: number): ApiResponse {
  return { statusCode, headers: responseHeaders(), body: "" };
}

function json(statusCode: number, body: unknown, cacheControl?: string): ApiResponse {
  return {
    statusCode,
    headers: responseHeaders(cacheControl),
    body: JSON.stringify(body),
  };
}

function responseHeaders(cacheControl?: string) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "cache-control": cacheControl || `public, max-age=${config.cacheTtlSeconds}, s-maxage=${config.cacheTtlSeconds}`,
  };
}

function atlasCacheControl() {
  return `public, max-age=3600, s-maxage=${config.atlasPublicCacheTtlSeconds}, stale-while-revalidate=604800`;
}

function weatherCacheControl() {
  const ttl = Math.min(config.weatherResponseCacheTtlSeconds, config.weatherAlertsCacheTtlSeconds);
  return `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=60`;
}

function parseJsonBody(body?: string) {
  if (!body) throw new ApiError(400, "Checkout details are required.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, "Checkout details must be valid JSON.");
  }
}

function withCorsHeaders(response: ApiResponse, headers?: Record<string, string | undefined>): ApiResponse {
  const origin = normalizeHeaders(headers).origin?.replace(/\/+$/g, "");
  const allowedOrigin = allowedCorsOrigin(origin);
  return {
    ...response,
    headers: {
      ...response.headers,
      "access-control-allow-origin": allowedOrigin,
      vary: "Origin",
    },
  };
}

function allowedCorsOrigin(origin?: string) {
  if (config.corsOrigins.includes("*")) return "*";
  if (origin && config.corsOrigins.includes(origin)) return origin;
  return config.corsOrigins[0] || "*";
}

function logRequest(request: ApiRequest, path: string, response: ApiResponse, durationMs: number, errorMessage?: string) {
  const headers = normalizeHeaders(request.headers);
  const payload = {
    event: "api.request",
    ok: response.statusCode < 400,
    method: request.method,
    path,
    query: request.query.toString(),
    statusCode: response.statusCode,
    durationMs,
    origin: headers.origin,
    referer: headers.referer,
    userAgent: headers["user-agent"],
    remoteAddress: request.remoteAddress,
    requestId: request.requestId,
    error: errorMessage,
  };

  const line = JSON.stringify(payload);
  if (response.statusCode >= 400) {
    console.error(line);
  } else {
    console.log(line);
  }
}

function normalizeHeaders(headers?: Record<string, string | undefined>) {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
