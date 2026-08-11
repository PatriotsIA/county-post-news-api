import { writeFile } from "node:fs/promises";

const SOURCE_URL = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv";
const OUTPUT_PATH = new URL("../src/county-populations.ts", import.meta.url);

const response = await fetch(SOURCE_URL, { headers: { "user-agent": "TheCountyPost population updater" } });
if (!response.ok) throw new Error(`Census population download failed: ${response.status}`);

const rows = parseCsv(await response.text());
const [headers, ...records] = rows;
const columns = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));
const fipsIndex = columns.STATE;
const countyIndex = columns.COUNTY;
const summaryLevelIndex = columns.SUMLEV;
const populationIndex = columns.POPESTIMATE2025;

if ([fipsIndex, countyIndex, summaryLevelIndex, populationIndex].some((index) => index === undefined)) {
  throw new Error("The Census file format did not include the expected county population columns.");
}

const populations = Object.fromEntries(
  records.flatMap((record) => {
    if (record[summaryLevelIndex].trim() !== "050") return [];
    const population = Number(record[populationIndex]);
    const fips = `${record[fipsIndex].trim().padStart(2, "0")}${record[countyIndex].trim().padStart(3, "0")}`;
    return Number.isSafeInteger(population) && population >= 0 ? [[fips, population]] : [];
  }).sort(([left], [right]) => left.localeCompare(right)),
);

if (Object.keys(populations).length < 3_000) {
  throw new Error(`Expected at least 3,000 county estimates; received ${Object.keys(populations).length}.`);
}

const generated = `// Generated from the U.S. Census Bureau Vintage 2025 County Population Estimates.\n// Source: ${SOURCE_URL}\n// Refresh with: npm run update:populations\nexport const COUNTY_POPULATION_ESTIMATE_VINTAGE = 2025;\n\nexport const countyPopulationEstimates: Record<string, number> = ${JSON.stringify(populations, null, 2)};\n`;
await writeFile(OUTPUT_PATH, generated, "utf8");
console.log(`Wrote ${Object.keys(populations).length} county population estimates to ${OUTPUT_PATH.pathname}.`);

function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "\"") {
      if (quoted && value[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
