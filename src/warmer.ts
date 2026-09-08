import { states } from "./geo.js";
import { countySlug } from "./county-geography.js";
import { getCountyByState } from "@nickgraffis/us-counties";
import { topics } from "./feed-builders.js";
import { enqueueRefresh, type RefreshTarget } from "./feed-refresh.js";

function rotate<T>(items: T[], count: number, pass: number): T[] {
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(pass * count + index) % items.length]);
}

/** Fifty queued builds per pass. Reader-triggered refreshes cover active desks
 * between scheduled visits; dormant specialized desks have a slower rotation. */
let poolKey = "";
let pools: RefreshTarget[][] = [];

export function scheduledTargets(pass: number, stateSlugs = states.map(state => state.slug)): RefreshTarget[] {
  const key = stateSlugs.join(",");
  if (key !== poolKey || !pools.length) {
    pools = targetPools(stateSlugs);
    poolKey = key;
  }
  const [national, statePrimary, stateOther, counties, countyOther] = pools;
  return [
    ...national.slice(0, 8), ...rotate(national.slice(8), 2, pass),
    ...rotate(statePrimary, 8, pass), ...rotate(stateOther, 4, pass),
    ...rotate(counties, 20, pass), ...rotate(countyOther, 8, pass),
  ];
}

function targetPools(stateSlugs: string[]): RefreshTarget[][] {
  const selectedStates = states.filter(state => stateSlugs.includes(state.slug));
  const national = topics.map(topic => ({ level: "national", topic } as RefreshTarget));
  const statePrimary = selectedStates.flatMap(state => ["general", "politics"].map(topic =>
    ({ level: "state", state: state.slug, topic } as RefreshTarget)));
  const stateOther = selectedStates.flatMap(state => topics.filter(topic => !["general", "politics"].includes(topic)).map(topic =>
    ({ level: "state", state: state.slug, topic } as RefreshTarget)));
  const counties = selectedStates.flatMap(state => getCountyByState(state.name).map(county =>
    ({ level: "county", state: state.slug, county: countySlug(county.name, county.FIPS), topic: "general" } as RefreshTarget)));
  const countyOther = counties.flatMap(county => topics.filter(topic => topic !== "general").map(topic => ({ ...county, topic })));
  return [national, statePrimary, stateOther, counties, countyOther];
}

export async function handler() {
  if (!process.env.FEED_REFRESH_QUEUE_URL) throw new Error("FEED_REFRESH_QUEUE_URL is not set");
  const pass = Math.floor(Date.now() / (5 * 60_000));
  const warmStates = process.env.WARM_STATES || "all";
  const targets = scheduledTargets(pass, warmStates === "all" ? undefined : warmStates.split(",").map(value => value.trim()));
  let queued = 0;
  let failed = 0;
  const started = Date.now();
  const pending = [...targets];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (;;) {
      const target = pending.shift();
      if (!target) return;
      try { await enqueueRefresh(target); queued++; }
      catch (error) { failed++; console.error(JSON.stringify({ event: "warmer.enqueue_failed", ...target, error: String(error) })); }
    }
  }));
  const result = { queued, failed, targets: targets.length, ms: Date.now() - started };
  console.info(JSON.stringify({ event: "warmer.pass", ...result }));
  if (failed) throw new Error(`${failed} feed refresh jobs could not be queued`);
  return result;
}
