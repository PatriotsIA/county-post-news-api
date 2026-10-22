import { getCountyByState } from "@nickgraffis/us-counties";
import { countySlug } from "./county-geography.js";
import { getCountyFredData } from "./fred-service.js";
import { getCounty, states } from "./geo.js";
import { recordProviderFailures } from "./metrics.js";

/**
 * Two counties per five-minute run walk all 3,143 in under six days, inside
 * the week a stored copy counts as fresh, so readers are served stored data
 * and never wait on FRED. While FRED is down the run keeps each older copy
 * (readers may be served it for 90 days) and reports the failures. Ten FRED
 * requests per run stay far below FRED's rate limit.
 */
const COUNTIES_PER_RUN = 2;

let counties: Array<{ state: string; county: string }> = [];

export function scheduledCounties(pass: number) {
  if (!counties.length) {
    counties = states.flatMap(state => getCountyByState(state.name).map(county =>
      ({ state: state.slug, county: countySlug(county.name, county.FIPS) })));
  }
  return Array.from({ length: COUNTIES_PER_RUN }, (_, index) => counties[(pass * COUNTIES_PER_RUN + index) % counties.length]);
}

export async function handler() {
  const pass = Math.floor(Date.now() / (5 * 60_000));
  let refreshed = 0;
  let failed = 0;
  for (const target of scheduledCounties(pass)) {
    const county = getCounty(target.state, target.county);
    if (!county?.fips) continue;
    try {
      const data = await getCountyFredData(county, { rebuild: true });
      if (data.meta.stale) failed++;
      else refreshed++;
    } catch (error) {
      failed++;
      console.warn(JSON.stringify({ event: "fred.refresh_failed", ...target, error: String(error) }));
    }
  }
  recordProviderFailures("fred", "refresh", failed);
  const result = { refreshed, failed };
  console.info(JSON.stringify({ event: "fred.refresh_pass", ...result }));
  return result;
}
