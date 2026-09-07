import { states } from "./geo.js";
import { countySlug } from "./county-geography.js";
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
 * Each refresh performs an origin rebuild. Leave Lambda capacity for readers:
 * this account currently has only ten concurrent executions, including the
 * warmer itself and other services.
 */
const WARM_TIMEOUT_MS = 90_000;

type WarmerResult = { warmed: number; failed: number; ms: number };

export async function handler(): Promise<WarmerResult> {
  const baseUrl = (process.env.WARM_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("WARM_BASE_URL is not set.");

  const origin = process.env.WARM_ORIGIN || "https://thecountypost.com";
  const concurrency = Math.max(1, Math.min(4, Number(process.env.WARM_CONCURRENCY || 3)));
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
      .map((county) => `${baseUrl}/v1/feeds/counties/${stateSlug}/${countySlug(county.name, county.FIPS)}/general?limit=${limit}`);
  });
  // PIA state landing pages read both desks. Include them in the same bounded
  // rotation instead of leaving every state's first visitor with a cold build.
  for (const stateSlug of stateSlugs) {
    if (!states.some((state) => state.slug === stateSlug)) continue;
    for (const topic of ["general", "politics"]) {
      allTargets.push(`${baseUrl}/v1/feeds/states/${stateSlug}/${topic}?limit=${limit}`);
    }
  }

  // One pass cannot rebuild every county in the country: 3,143 rebuilds would
  // blow the function timeout and hammer the upstream search feeds. Each pass
  // therefore warms one shard, chosen by wall-clock so consecutive scheduled
  // runs walk the whole list in order. Every county still gets rebuilt well
  // inside the S3 cache's stale window; readers in between are served the
  // stored copy instantly.
  const maxPerPass = Math.max(25, Number(process.env.WARM_MAX_PER_PASS || 50));
  const shardCount = Math.max(1, Math.ceil(allTargets.length / maxPerPass));
  const intervalMs = Math.max(1, Number(process.env.WARM_INTERVAL_MINUTES || 5)) * 60_000;
  const shardIndex = Math.floor(Date.now() / intervalMs) % shardCount;
  const targets = allTargets.filter((_, index) => index % shardCount === shardIndex);

  const started = Date.now();
  let warmed = 0;
  let failed = 0;
  const failureStatuses: Record<string, number> = {};
  const queue = [...targets];

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (;;) {
        const url = queue.shift();
        if (!url) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WARM_TIMEOUT_MS);
        try {
          for (let attempt = 0; ; attempt++) {
            const response = await fetch(url, {
              signal: controller.signal,
              headers: {
                origin,
                "user-agent": "TheCountyPost cache warmer",
                "x-warm-refresh": "1",
              },
            });
            // Drain before retrying so throttled requests do not consume the
            // whole shard immediately or hold connections while backing off.
            await response.arrayBuffer();
            if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
              continue;
            }
            if (response.ok) warmed += 1;
            else {
              failed += 1;
              failureStatuses[response.status] = (failureStatuses[response.status] || 0) + 1;
            }
            break;
          }
        } catch {
          failed += 1;
          failureStatuses.network = (failureStatuses.network || 0) + 1;
        } finally {
          clearTimeout(timeout);
        }
      }
    }),
  );

  const result = { warmed, failed, ms: Date.now() - started };
  console.info(JSON.stringify({ event: "warmer.pass", targets: targets.length, totalTargets: allTargets.length, shard: `${shardIndex + 1}/${shardCount}`, failureStatuses, ...result }));
  return result;
}
