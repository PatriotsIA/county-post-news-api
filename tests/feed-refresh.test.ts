import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { afterEach, expect, it, vi } from "vitest";
import { edgePaths, enqueueRefresh, resolveTarget } from "../src/feed-refresh.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("deduplicates identical refresh jobs across readers and the schedule", async () => {
  vi.stubEnv("FEED_REFRESH_QUEUE_URL", "https://sqs.example/news.fifo");
  const send = vi.spyOn(SQSClient.prototype, "send").mockResolvedValue({} as never);
  await enqueueRefresh({ level: "county", state: "texas", county: "potter", topic: "general" });
  await enqueueRefresh({ level: "county", state: "texas", county: "potter", topic: "general" });
  await enqueueRefresh({ level: "county", state: "texas", county: "potter", topic: "sports" });
  const commands = send.mock.calls.map(([command]) => (command as SendMessageCommand).input);
  expect(commands[0].MessageDeduplicationId).toBe(commands[1].MessageDeduplicationId);
  expect(commands[0].MessageGroupId).not.toBe(commands[2].MessageGroupId);
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
