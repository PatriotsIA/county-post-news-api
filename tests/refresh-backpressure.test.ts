import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetQueueAttributesCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { resolveTarget } from "../src/feed-refresh.js";
import { getFeed } from "../src/news-service.js";
import type { FeedResponse } from "../src/types.js";

const target = { level: "county", state: "texas", county: "potter", topic: "sports" } as const;
let queueId = 0;

beforeEach(() => {
  clearCache();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
  vi.stubEnv("FEED_CACHE_BUCKET", "test-feed-cache");
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", `https://sqs.example/backpressure-${queueId++}.fifo`);
  vi.stubEnv("FEED_REFRESH_MAX_PENDING", "1000");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Reader must not fetch providers for this stale snapshot"); }));
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  clearCache();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([
  { state: "deep", initialDepth: 2000, expectedSends: 0 },
  { state: "shallow", initialDepth: 0, expectedSends: 1 },
])("serves the same paginated stale feed with a $state refresh queue", async ({ initialDepth, expectedSends }) => {
  const ageSeconds = config.cacheTtlSeconds + 120;
  const storedAt = Date.now() - ageSeconds * 1000;
  const snapshot: FeedResponse = {
    scope: { level: "county", stateSlug: "texas", countySlug: "potter", places: ["Amarillo"], trustedHosts: ["local.example"] },
    topic: "sports",
    items: Array.from({ length: 4 }, (_, index) => ({
      id: `story-${index}`, title: `Potter County sports ${index}`, link: `https://local.example/${index}`,
      source: "Local newsroom", publishedAt: new Date(storedAt - index * 1000).toISOString(),
    })),
    meta: { count: 4, sourcesUsed: ["local:potter"], fetchedAt: new Date(storedAt).toISOString(), cacheTtlSeconds: config.cacheTtlSeconds },
  };
  const s3 = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input).toMatchObject({
      Bucket: "test-feed-cache", Key: "feed-cache/feed%3Acounty%3Atexas%3Apotter%3Asports.json",
    });
    return { Body: { transformToString: async () => JSON.stringify({ storedAt, value: snapshot }) } } as never;
  });
  let depth = initialDepth;
  const sqs = vi.spyOn(SQSClient.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof GetQueueAttributesCommand) return { Attributes: {
      ApproximateNumberOfMessages: String(depth), ApproximateNumberOfMessagesNotVisible: "0", ApproximateNumberOfMessagesDelayed: "0",
    } } as never;
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect(JSON.parse((command as SendMessageCommand).input.MessageBody!)).toEqual(target);
    return { MessageId: "accepted-refresh" } as never;
  });
  const sendCommands = () => sqs.mock.calls.filter(([command]) => command instanceof SendMessageCommand);

  const response = await getFeed(resolveTarget(target), target.topic, 2, 1);
  expect(response).toEqual({
    ...snapshot, items: snapshot.items.slice(1, 3),
    meta: { ...snapshot.meta, count: 2, offset: 1, totalAvailable: 4, hasMore: true, ageSeconds, stale: true },
  });
  expect(sendCommands()).toHaveLength(expectedSends);
  expect(s3).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();

  if (initialDepth > 0) {
    // A refused send must not suppress this active desk when the queue drains.
    depth = 0;
    vi.advanceTimersByTime(60_001);
    const retried = await getFeed(resolveTarget(target), target.topic, 2, 1);
    expect(sendCommands()).toHaveLength(1);
    expect(retried).toEqual({ ...response, meta: { ...response.meta, ageSeconds: ageSeconds + 60 } });
    expect(s3).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  }
});
