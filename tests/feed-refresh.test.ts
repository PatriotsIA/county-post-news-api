import { GetQueueAttributesCommand, SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { edgePaths, enqueueRefresh, resolveTarget } from "../src/feed-refresh.js";

let queueId = 0;
const general = { level: "county", state: "texas", county: "potter", topic: "general" } as const;
const sports = { ...general, topic: "sports" } as const;
const attributes = (visible: number, inFlight = 0, delayed = 0) => ({ Attributes: {
  ApproximateNumberOfMessages: String(visible), ApproximateNumberOfMessagesNotVisible: String(inFlight),
  ApproximateNumberOfMessagesDelayed: String(delayed),
} });

beforeEach(() => {
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", `https://sqs.example/news-${queueId++}.fifo`);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it("coalesces identical readers and schedule jobs while keeping the FIFO identity stable", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(0) as never);
  expect(await Promise.all([enqueueRefresh(general), enqueueRefresh(general, "schedule")])).toEqual([true, false]);
  expect(await enqueueRefresh(general)).toBe(false);
  expect(await enqueueRefresh(sports)).toBe(true);
  vi.advanceTimersByTime(300_001);
  expect(await enqueueRefresh(general, "schedule")).toBe(true);
  const commands = send.mock.calls.filter(([command]) => command instanceof SendMessageCommand)
    .map(([command]) => (command as SendMessageCommand).input);
  expect(commands).toHaveLength(3);
  expect(commands[0].MessageDeduplicationId).toBe(commands[2].MessageDeduplicationId);
  expect(commands[0].MessageGroupId).not.toBe(commands[1].MessageGroupId);
});

it("defers scheduled specialist desks before general desks and active readers", async () => {
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(250) as never);
  expect(await enqueueRefresh(sports, "schedule")).toBe(false);
  expect(await enqueueRefresh(general, "schedule")).toBe(true);
  expect(await enqueueRefresh(sports)).toBe(true);
  expect(send.mock.calls.filter(([command]) => command instanceof GetQueueAttributesCommand)).toHaveLength(1);
  expect(send.mock.calls.filter(([command]) => command instanceof SendMessageCommand)).toHaveLength(2);
});

it("starts local suppression after SQS acknowledgement, including a slow send", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const send = vi.spyOn(SQSClient.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof GetQueueAttributesCommand) return attributes(0) as never;
    vi.advanceTimersByTime(1000);
    return {} as never;
  });
  expect(await enqueueRefresh(general)).toBe(true);
  // More than five minutes after starting, but within five minutes of receipt.
  vi.advanceTimersByTime(299_500);
  expect(await enqueueRefresh(general)).toBe(false);
  vi.advanceTimersByTime(501);
  expect(await enqueueRefresh(general)).toBe(true);
  expect(send.mock.calls.filter(([command]) => command instanceof SendMessageCommand)).toHaveLength(2);
});

it("leaves room for county general readers after other reader refreshes defer", async () => {
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(1000) as never);
  expect(await enqueueRefresh(general, "schedule")).toBe(false);
  expect(await enqueueRefresh(sports)).toBe(false);
  expect(await enqueueRefresh(general)).toBe(true);
  expect(send.mock.calls.filter(([command]) => command instanceof SendMessageCommand)).toHaveLength(1);
});

it("includes in-flight and delayed work, then admits a deferred target after the queue drains", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(1990, 5, 5) as never);
  expect(await enqueueRefresh(general)).toBe(false);
  send.mockResolvedValue(attributes(0) as never);
  expect(await enqueueRefresh(general)).toBe(false);
  vi.advanceTimersByTime(30_001);
  expect(await enqueueRefresh(general)).toBe(true);
  expect(send.mock.calls.filter(([command]) => command instanceof SendMessageCommand)).toHaveLength(1);
});

it("honors the configured queue admission threshold", async () => {
  vi.stubEnv("FEED_REFRESH_MAX_PENDING", "400");
  vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(100) as never);
  expect(await enqueueRefresh(sports, "schedule")).toBe(false);
  expect(await enqueueRefresh(general, "schedule")).toBe(true);
  expect(await enqueueRefresh(sports)).toBe(true);
});

it("keeps existing enqueue behavior when queue depth cannot be read", async () => {
  const send = vi.spyOn(SQSClient.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof GetQueueAttributesCommand) throw new Error("metrics temporarily unavailable");
    return {} as never;
  });
  expect(await enqueueRefresh(general)).toBe(true);
  expect(await enqueueRefresh(sports)).toBe(true);
  expect(send.mock.calls.filter(([command]) => command instanceof GetQueueAttributesCommand)).toHaveLength(1);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("feed.refresh_depth_unavailable"));
});

it.each([undefined, "", "NaN", "-1", "0.5"])("does not treat a missing or invalid queue count (%s) as reliable", async count => {
  vi.spyOn(SQSClient.prototype, "send").mockResolvedValue({ Attributes: {
    ...attributes(20000).Attributes, ApproximateNumberOfMessagesNotVisible: count,
  } } as never);
  expect(await enqueueRefresh(general)).toBe(true);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid refresh queue depth"));
});

it("keeps the queue depth cache scoped to the configured queue", async () => {
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(2000) as never);
  expect(await enqueueRefresh(general)).toBe(false);
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", `${process.env.FEED_REFRESH_QUEUE_URL}-replacement`);
  send.mockResolvedValue(attributes(0) as never);
  expect(await enqueueRefresh(general)).toBe(true);
  expect(send.mock.calls.filter(([command]) => command instanceof GetQueueAttributesCommand)).toHaveLength(2);
});

it("coalesces active readers after the same target's concurrent scheduled request defers", async () => {
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue(attributes(1000) as never);
  expect(await Promise.all([enqueueRefresh(general, "schedule"), enqueueRefresh(general), enqueueRefresh(general)]))
    .toEqual([false, true, false]);
  expect(send.mock.calls.filter(([command]) => command instanceof SendMessageCommand)).toHaveLength(1);
});

it("awaits acceptance and retries the same target after a failed send", async () => {
  let accept!: () => void;
  const send = vi.spyOn(SQSClient.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof GetQueueAttributesCommand) return attributes(0) as never;
    throw new Error("send failed");
  });
  await expect(enqueueRefresh(general)).rejects.toThrow("send failed");
  send.mockImplementation(async () => new Promise<void>(resolve => { accept = resolve; }) as never);
  let completed = false;
  const retry = enqueueRefresh(general).then(value => { completed = true; return value; });
  await vi.waitFor(() => expect(accept).toBeDefined());
  expect(completed).toBe(false);
  accept();
  expect(await retry).toBe(true);
});

it("does not call AWS when the queue is not configured", async () => {
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", "");
  const send = vi.spyOn(SQSClient.prototype, "send");
  expect(await enqueueRefresh(general)).toBe(false);
  expect(send).not.toHaveBeenCalled();
});

it("warms the actual county and national lead page request variants", () => {
  expect(edgePaths({ level: "county", state: "texas", county: "potter", topic: "general" })).toContain("/v1/pages/counties/texas/potter?sections=localNews&limit=50");
  expect(edgePaths({ level: "national", topic: "general" })).toContain("/v1/pages/national?sections=general&limit=32");
  expect(edgePaths({ level: "state", state: "texas", topic: "general" })).toContain("/v1/pages/states/texas?sections=general&limit=32");
});

it("rejects arbitrary destinations and resolves distinct city geography", () => {
  expect(() => resolveTarget({ level: "county", state: "texas", county: "https://evil.example", topic: "general" })).toThrow();
  const city = resolveTarget({ level: "county", state: "virginia", county: "richmond-city", topic: "general" });
  expect(city.level === "county" && city.county.fips).toBe("51760");
});
