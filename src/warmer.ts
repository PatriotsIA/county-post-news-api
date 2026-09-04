import { getCounty, states } from "./geo.js";
import { getCountyByState } from "@nickgraffis/us-counties";

/**
 * Scheduled cache warmer.
 *
 * Runs every few minutes and requests each covered county's lead feed through
 * CloudFront, so the reader who lands on a county desk is never the one paying
 * for the upstream fan-out. The requests carry the site's own Origin header,
 * because Origin is part of the CDN cache key — warming without it would fill
 * an entry the browser never reads.
 *
 * With stale-while-revalidate on the responses, steady-state passes are cheap:
 * CloudFront answers each warm request from cache immediately and refreshes in
 * the background, so this function mostly just keeps the clock ticking.
 */
const WARM_TIMEOUT_MS = 90_000;

type WarmerResult = { warmed: number; failed: number; ms: number };

export async function handler(): Promise<WarmerResult> {
  const baseUrl = (process.env.WARM_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("WARM_BASE_URL is not set.");

  const origin = process.env.WARM_ORIGIN || "https://thecountypost.com";
  const concurrency = Math.max(1, Number(process.env.WARM_CONCURRENCY || 10));
  const limit = Number(process.env.WARM_FEED_LIMIT || process.env.DEFAULT_LIMIT || 120);
  const warmStatesEnv = process.env.WARM_STATES || "texas";
  const stateSlugs =
    warmStatesEnv.trim() === "all"
      ? states.map((state) => state.slug)
      : warmStatesEnv
          .split(",")
          .map((slug) => slug.trim())
          .filter(Boolean);

  const allTargets = stateSlugs.flatMap((stateSlug) => {
    const state = states.find((entry) => entry.slug === stateSlug);
    if (!state) return [];
    return getCountyByState(state.name)
      .map((county) => getCounty(stateSlug, county.name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")))
      .filter((county): county is NonNullable<typeof county> => Boolean(county))
      .map((county) => `${baseUrl}/v1/feeds/counties/${county.state.slug}/${county.slug}/general?limit=${limit}`);
  });

  // One pass cannot rebuild every county in the country: 3,143 rebuilds would
  // blow the function timeout and hammer the upstream search feeds. Each pass
  // therefore warms one shard, chosen by wall-clock so consecutive scheduled
  // runs walk the whole list in order. Every county still gets rebuilt well
  // inside the S3 cache's stale window; readers in between are served the
  // stored copy instantly.
  const maxPerPass = Math.max(25, Number(process.env.WARM_MAX_PER_PASS || 150));
  const shardCount = Math.max(1, Math.ceil(allTargets.length / maxPerPass));
  const intervalMs = Math.max(1, Number(process.env.WARM_INTERVAL_MINUTES || 5)) * 60_000;
  const shardIndex = Math.floor(Date.now() / intervalMs) % shardCount;
  const targets = allTargets.filter((_, index) => index % shardCount === shardIndex);

  const started = Date.now();
  let warmed = 0;
  let failed = 0;
  const queue = [...targets];

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (;;) {
        const url = queue.shift();
        if (!url) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WARM_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              origin,
              "user-agent": "TheCountyPost cache warmer",
              // Marks this as the pass that rebuilds; reader requests never do.
              "x-warm-refresh": "1",
            },
          });
          if (response.ok) warmed += 1;
          else failed += 1;
          // Drain so the connection can be reused; the body itself is the point.
          await response.arrayBuffer();
        } catch {
          failed += 1;
        } finally {
          clearTimeout(timeout);
        }
      }
    }),
  );

  const result = { warmed, failed, ms: Date.now() - started };
  console.info(JSON.stringify({ event: "warmer.pass", targets: targets.length, totalTargets: allTargets.length, shard: `${shardIndex + 1}/${shardCount}`, ...result }));
  return result;
}
