import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { edgePaths, resolveTarget, type RefreshTarget } from "./feed-refresh.js";
import { getFeed } from "./news-service.js";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (let index = 0; index < event.Records.length; index++) {
    const record = event.Records[index];
    const started = Date.now();
    try {
      const target = JSON.parse(record.body) as RefreshTarget;
      const scope = resolveTarget(target);
      // Internal invocation, bypassing CloudFront. Reuse fresh shared objects on
      // duplicate delivery; failed builds leave the previous S3 object intact.
      const feed = await getFeed(scope, target.topic, 120, 0, true);
      console.info(JSON.stringify({ event: "feed.refresh", ok: true, ...target,
        count: feed.meta.totalAvailable ?? feed.items.length, fetchedAt: feed.meta.fetchedAt,
        ageSeconds: Math.max(0, (Date.now() - Date.parse(feed.meta.fetchedAt)) / 1000), stale: feed.meta.stale,
        retrieval: feed.meta.retrieval, durationMs: Date.now() - started }));
      const base = process.env.FEED_EDGE_URL;
      if (base) {
        const origins = (process.env.FEED_EDGE_ORIGINS || "https://thecountypost.com").split(",").filter(Boolean);
        // Priming failure must never cause a successful provider rebuild to retry.
        for (const origin of origins) for (const path of edgePaths(target, origin)) {
          try {
            const response = await fetch(new URL(path, base), { headers: { origin }, signal: AbortSignal.timeout(5000) });
            await response.arrayBuffer();
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
          } catch (error) {
            console.warn(JSON.stringify({ event: "feed.edge_prime_failed", path, origin, error: String(error) }));
          }
        }
      }
    } catch (error) {
      console.error(JSON.stringify({ event: "feed.refresh", ok: false, durationMs: Date.now() - started, error: String(error) }));
      // Stop on failure to preserve FIFO order, including unprocessed records.
      batchItemFailures.push(...event.Records.slice(index).map(item => ({ itemIdentifier: item.messageId })));
      break;
    }
  }
  return { batchItemFailures };
}
