import { createHash } from "node:crypto";
import { GetQueueAttributesCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { topics } from "./feed-builders.js";
import { getCounty, getState } from "./geo.js";
import type { FeedScope, Topic } from "./types.js";

export type RefreshTarget = { level: FeedScope["level"]; topic: Topic; state?: string; county?: string };
let sqs: SQSClient | undefined;
type RefreshSource = "reader" | "schedule";
const DEDUPLICATION_MS = 5 * 60_000;
const QUEUE_DEPTH_CACHE_MS = 30_000;
const MAX_LOCAL_TARGETS = 4096;
const acceptedTargets = new Map<string, { expiresAt: number; pending: Promise<boolean> }>();
let queueDepth: { queueUrl: string; expiresAt: number; pending: Promise<number | undefined> } | undefined;

function client() { return sqs ??= new SQSClient({ maxAttempts: 2 }); }

/** Approximate admission control, shared by concurrent requests in this instance.
 * A failed depth read must not disable refreshes during an AWS metrics/IAM outage. */
async function pendingRefreshes(queueUrl: string): Promise<number | undefined> {
  const now = Date.now();
  if (queueDepth?.queueUrl === queueUrl && queueDepth.expiresAt > now) return queueDepth.pending;
  const pending = (async () => {
    try {
      const result = await client().send(new GetQueueAttributesCommand({ QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible", "ApproximateNumberOfMessagesDelayed"],
      }), { abortSignal: AbortSignal.timeout(1000) });
      const counts = (["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible", "ApproximateNumberOfMessagesDelayed"] as const)
        .map(name => {
          const value = result.Attributes?.[name];
          return value !== undefined && /^\d+$/.test(value) ? Number(value) : NaN;
        });
      if (counts.some(count => !Number.isSafeInteger(count))) throw new Error("Invalid refresh queue depth");
      return counts.reduce((sum, count) => sum + count, 0);
    } catch (error) {
      console.warn(JSON.stringify({ event: "feed.refresh_depth_unavailable", error: String(error) }));
      return undefined;
    }
  })();
  queueDepth = { queueUrl, expiresAt: now + QUEUE_DEPTH_CACHE_MS, pending };
  return pending;
}

function pendingLimit(target: RefreshTarget, source: RefreshSource): number {
  const configured = Number(process.env.FEED_REFRESH_MAX_PENDING || 1000);
  const base = Number.isFinite(configured) && configured >= 4 ? Math.floor(configured) : 1000;
  // Leave capacity for active readers and for general desks, especially county
  // lead pages. Scheduled specialty work resumes as the queue drains.
  return Math.max(1, Math.floor(base * (source === "schedule" ? 0.25 : 1) * (target.topic === "general" ? 2 : 1)));
}

export function refreshTarget(scope: FeedScope, topic: Topic): RefreshTarget {
  return { level: scope.level, topic, ...(scope.level !== "national" ? { state: scope.state.slug } : {}),
    ...(scope.level === "county" ? { county: scope.county.slug } : {}) };
}

export function resolveTarget(target: RefreshTarget): FeedScope {
  if (!topics.includes(target.topic)) throw new Error("Invalid refresh topic");
  if (target.level === "national" && !target.state && !target.county) return { level: "national" };
  if (target.level === "state" && target.state && !target.county) {
    const state = getState(target.state);
    if (state) return { level: "state", state };
  }
  if (target.level === "county" && target.state && target.county) {
    const county = getCounty(target.state, target.county);
    if (county) return { level: "county", state: county.state, county };
  }
  throw new Error("Invalid refresh geography");
}

export function targetPath(target: RefreshTarget) {
  const scope = target.level === "national" ? "national" : target.level === "state"
    ? `states/${target.state}` : `counties/${target.state}/${target.county}`;
  return `/v1/feeds/${scope}/${target.topic}`;
}

/** Await queue acceptance before Lambda returns; never depend on work after response.
 * False means deferred or already accepted locally. No existing message is removed;
 * future stale reads and the complete scheduled rotation can retry deferred targets. */
export async function enqueueRefresh(target: RefreshTarget, source: RefreshSource = "reader"): Promise<boolean> {
  const queueUrl = process.env.FEED_REFRESH_QUEUE_URL;
  if (!queueUrl) return false;
  resolveTarget(target);
  const id = createHash("sha256").update(targetPath(target)).digest("hex");
  const localKey = `${queueUrl}:${id}`;
  for (;;) {
    const existing = acceptedTargets.get(localKey);
    if (!existing || existing.expiresAt <= Date.now()) break;
    if (await existing.pending) return false;
    if (acceptedTargets.get(localKey) === existing) acceptedTargets.delete(localKey);
    // A deferred scheduled attempt must not suppress an active reader. Recheck
    // after awaiting so concurrent readers still share the next accepted send.
  }
  const now = Date.now();
  for (const [key, entry] of acceptedTargets) if (entry.expiresAt <= now) acceptedTargets.delete(key);
  // This only bounds a per-process optimization. SQS remains the cross-instance
  // deduplicator, so eviction cannot lose a refresh opportunity.
  if (acceptedTargets.size >= MAX_LOCAL_TARGETS) acceptedTargets.delete(acceptedTargets.keys().next().value!);

  const pending = (async () => {
    const depth = await pendingRefreshes(queueUrl);
    const limit = pendingLimit(target, source);
    if (depth !== undefined && depth >= limit) {
      console.info(JSON.stringify({ event: "feed.refresh_deferred", source, ...target, depth, limit }));
      return false;
    }
    await client().send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(target),
      MessageGroupId: id, MessageDeduplicationId: id }), { abortSignal: AbortSignal.timeout(1500) });
    return true;
  })();
  acceptedTargets.set(localKey, { expiresAt: now + DEDUPLICATION_MS, pending });
  try {
    const accepted = await pending;
    if (!accepted && acceptedTargets.get(localKey)?.pending === pending) acceptedTargets.delete(localKey);
    return accepted;
  } catch (error) {
    if (acceptedTargets.get(localKey)?.pending === pending) acceptedTargets.delete(localKey);
    throw error;
  }
}

/** Prime County Post's first-page variants. Explicit legacy origins retain
 * their own feed limit; PIA is excluded from the template's default warm targets. */
export function edgePaths(target: RefreshTarget, origin = "https://thecountypost.com"): string[] {
  const feed = targetPath(target);
  const paths = [`${feed}?limit=${origin.includes("patriotsinaction.com") ? 40 : target.topic === "general" ? 16 : 12}`];
  if (target.topic === "general" && !origin.includes("patriotsinaction.com")) {
    const scope = feed.slice("/v1/feeds/".length, -"/general".length);
    paths.push(`/v1/pages/${scope}?sections=${target.level === "county" ? "localNews" : "general"}&limit=${target.level === "county" ? 50 : 32}`);
  }
  return paths;
}
