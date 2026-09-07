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
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
for (const [index, path] of paths.entries()) {
  const origin = origins[index % origins.length]!;
  const start = performance.now();
  const response = await fetch(base.replace(/\/$/, "") + path, { headers: { Origin: origin }, signal: AbortSignal.timeout(60_000) });
  const body = asRecord(await response.json());
  const items = Array.isArray(body?.items) ? body.items : undefined;
  const sections = asRecord(body?.sections);
  const cors = response.headers.get("access-control-allow-origin") === origin;
  const valid = response.ok && cors && Boolean(body) && (!path.includes("/feeds/") || Boolean(items)) && (!path.includes("/pages/") || Boolean(asRecord(sections?.localNews) && asRecord(sections?.localSports)));
  const row = { path, origin, status: response.status, cors, valid, count: items?.length, sections: sections ? Object.keys(sections) : undefined, scope: body?.scope, ms: Math.round(performance.now()-start) };
  results.push(row);
  console.log(JSON.stringify({ ...row, scope: undefined }));
  if (!valid) process.exitCode = 1;
}
await mkdir("coverage", { recursive: true });
await writeFile("coverage/pia-compatibility-live.json", JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
