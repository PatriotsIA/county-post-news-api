// Read one Census record using CodeBuild's injected key. Never publish a snapshot
// or print the key, request URL, response body, or provider exception.
const key = process.env.CENSUS_API_KEY;
const year = process.env.ATLAS_CENSUS_YEAR;
try {
  if (!key || !/^20\d{2}$/.test(year || "")) throw new Error("configuration");
  const url = new URL(`https://api.census.gov/data/${year}/acs/acs5`);
  url.search = new URLSearchParams({ get: "B01003_001E", for: "county:375", in: "state:48", key });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("provider");
  const rows = await response.json();
  if (rows.length !== 2 || JSON.stringify(rows[0]) !== '["B01003_001E","state","county"]' ||
      rows[1][1] !== "48" || rows[1][2] !== "375" || !(Number(rows[1][0]) > 0)) throw new Error("record");
  console.log(JSON.stringify({ censusCredentialAccepted: true, validatedRecords: 1, published: false }));
} catch {
  console.error("Atlas credential smoke failed; provider details suppressed to protect the request key.");
  process.exitCode = 1;
}
