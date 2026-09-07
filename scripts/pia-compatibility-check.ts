import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.VITE_NEWS_API_URL || "https://ntqzmx2vo55fnwkqfwggcmdkny0jzlco.lambda-url.us-east-2.on.aws";
const origins = ["https://patriotsinaction.com", "https://www.patriotsinaction.com", "https://thecountypost.com", "https://www.thecountypost.com"];
const paths = [
  "/health",
  "/v1/feeds/national/general?limit=3",
  "/v1/feeds/states/texas/politics?limit=3",
  "/v1/feeds/counties/texas/potter/general?limit=12",
  "/v1/pages/counties/texas/potter?sections=localNews,localSports&limit=12",
  "/v1/sources/counties/texas/potter",
  "/v1/counties/arkansas/polk/atlas",
  ...["maryland/baltimore-city", "missouri/st-louis-city", "virginia/fairfax-city", "virginia/franklin-city", "virginia/richmond-city", "virginia/roanoke-city"].map(place => `/v1/feeds/counties/${place}/general?limit=3`),
];
const results: Array<Record<string, unknown>> = [];
for (const [index, path] of paths.entries()) {
  const origin = origins[index % origins.length]!;
  const start = performance.now();
  const response = await fetch(base.replace(/\/$/, "") + path, { headers: { Origin: origin }, signal: AbortSignal.timeout(60_000) });
  const body = await response.json();
  const cors = response.headers.get("access-control-allow-origin") === origin;
  const valid = response.ok && cors && (!path.includes("/feeds/") || Array.isArray(body.items)) && (!path.includes("/pages/") || Boolean(body.sections?.localNews && body.sections?.localSports));
  const row = { path, origin, status: response.status, cors, valid, count: body.items?.length, sections: body.sections ? Object.keys(body.sections) : undefined, scope: body.scope, ms: Math.round(performance.now()-start) };
  results.push(row);
  console.log(JSON.stringify({ ...row, scope: undefined }));
  if (!valid) process.exitCode = 1;
}
await mkdir("coverage", { recursive: true });
await writeFile("coverage/pia-compatibility-live.json", JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
