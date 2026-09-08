import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cachedShared, clearCache } from "../src/cache.js";

beforeEach(() => { clearCache(); vi.stubEnv("FEED_CACHE_BUCKET", "test-cache"); });
afterEach(() => { clearCache(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function stored(ageSeconds: number) {
  return { Body: { transformToString: async () => JSON.stringify({ storedAt: Date.now() - ageSeconds * 1000, value: { articles: ["existing"] } }) } };
}

it("serves stale data and awaits queue acceptance without rebuilding on the reader", async () => {
  vi.spyOn(S3Client.prototype, "send").mockResolvedValue(stored(600) as never);
  const build = vi.fn();
  let accepted!: () => void;
  const onStale = vi.fn(() => new Promise<void>(resolve => { accepted = resolve; }));
  let complete = false;
  const response = cachedShared("feed:test", 300, build, { onStale }).then(value => { complete = true; return value; });
  await vi.waitFor(() => expect(onStale).toHaveBeenCalledOnce());
  expect(complete).toBe(false);
  accepted();
  expect(await response).toEqual({ articles: ["existing"] });
  expect(build).not.toHaveBeenCalled();
});

it("retains useful data when enqueueing is unavailable", async () => {
  vi.spyOn(S3Client.prototype, "send").mockResolvedValue(stored(600) as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const build = vi.fn();
  expect(await cachedShared("feed:test", 300, build, { onStale: async () => { throw new Error("SQS outage"); } })).toEqual({ articles: ["existing"] });
  expect(build).not.toHaveBeenCalled();
});

it("skips duplicate refreshes of already fresh shared data", async () => {
  vi.spyOn(S3Client.prototype, "send").mockResolvedValue(stored(20) as never);
  const build = vi.fn();
  await cachedShared("feed:test", 300, build, { forceFresh: true });
  expect(build).not.toHaveBeenCalled();
});

it("keeps the previous shared object when rebuilding fails", async () => {
  const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue(stored(600) as never);
  await expect(cachedShared("feed:test", 300, async () => { throw new Error("providers down"); }, { forceFresh: true })).rejects.toThrow("providers down");
  expect(send.mock.calls.every(([command]) => command instanceof GetObjectCommand)).toBe(true);
});

it("rebuilds expired data and awaits publishing it", async () => {
  const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) =>
    command instanceof GetObjectCommand ? stored(90_000) : {} as never);
  const build = vi.fn(async () => ({ articles: ["new"] }));
  expect(await cachedShared("feed:test", 300, build)).toEqual({ articles: ["new"] });
  expect(send.mock.calls.some(([command]) => command instanceof PutObjectCommand)).toBe(true);
});

it("retries the worker job if a refreshed feed cannot be stored", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof GetObjectCommand) return stored(600) as never;
    throw new Error("S3 write failed");
  });
  await expect(cachedShared("feed:test", 300, async () => ({ articles: ["new"] }), { forceFresh: true })).rejects.toThrow("S3 write failed");
});

it("retains the original snapshot without resetting its age during a degraded refresh", async () => {
  const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue(stored(600) as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await cachedShared("feed:test", 300, async () => ({ articles: [] }), {
    forceFresh: true, shouldReplace: () => false,
  });
  expect(result).toEqual({ articles: ["existing"] });
  expect(send.mock.calls.some(([command]) => command instanceof PutObjectCommand)).toBe(false);
});
