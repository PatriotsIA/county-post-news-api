import { createHash } from "node:crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { topics } from "./feed-builders.js";
import { getCounty, getState } from "./geo.js";
import type { FeedScope, Topic } from "./types.js";

export type RefreshTarget = { level: FeedScope["level"]; topic: Topic; state?: string; county?: string };
let sqs: SQSClient | undefined;

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

/** Await queue acceptance before Lambda returns; never depend on work after response. */
export async function enqueueRefresh(target: RefreshTarget): Promise<boolean> {
  const queueUrl = process.env.FEED_REFRESH_QUEUE_URL;
  if (!queueUrl) return false;
  resolveTarget(target);
  const id = createHash("sha256").update(targetPath(target)).digest("hex");
  sqs ??= new SQSClient({ maxAttempts: 2 });
  await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(target),
    MessageGroupId: id, MessageDeduplicationId: id }), { abortSignal: AbortSignal.timeout(1500) });
  return true;
}

/** Prime the exact first-page variants used by County Post and PIA. */
export function edgePaths(target: RefreshTarget, origin = "https://thecountypost.com"): string[] {
  const feed = targetPath(target);
  const paths = [`${feed}?limit=${origin.includes("patriotsinaction.com") ? 40 : target.topic === "general" ? 16 : 12}`];
  if (target.topic === "general" && !origin.includes("patriotsinaction.com")) {
    const scope = feed.slice("/v1/feeds/".length, -"/general".length);
    paths.push(`/v1/pages/${scope}?sections=${target.level === "county" ? "localNews" : "general"}&limit=${target.level === "county" ? 50 : 32}`);
  }
  return paths;
}
