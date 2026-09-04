import { writeFile } from "node:fs/promises";

/**
 * Regenerates src/county-places.ts: the real towns inside each county, most
 * populous first.
 *
 * Without this the query builder fell back to the nearest media-market hubs, so
 * Briscoe County, Texas searched for "Amarillo", "Lubbock", and "Abilene" —
 * cities in other counties, 90 to 200 miles away — and the strict county
 * locality filter then discarded everything it found. Silverton and Quitaque,
 * the towns where Briscoe County news actually happens, were never searched.
 *
 * Refresh with: npm run update:places
 */

const SOURCE_URL =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv";
const OUTPUT_PATH = new URL("../src/county-places.ts", import.meta.url);

/** Summary level 157 is a place's part within one county — the join we need. */
const COUNTY_PLACE_PART = "157";

/** Kept per county. Callers slice to the number of query terms they want. */
const PLACES_PER_COUNTY = 6;

/**
 * Census appends a lowercase legal type to every place name ("Silverton city").
 * Only lowercase forms are stripped, so genuine names keep their words —
 * "Carson City" and "New York city" both resolve correctly.
 */
const TYPE_SUFFIXES = [
  "city",
  "town",
  "village",
  "borough",
  "township",
  "municipality",
  "comunidad",
  "zona urbana",
  "plantation",
  "gore",
  "grant",
  "location",
  "purchase",
];

const GOVERNMENT_PHRASES = [
  " metropolitan government (balance)",
  " consolidated government (balance)",
  " unified government (balance)",
  " metro government (balance)",
  " urban county government",
  " (balance)",
];

const response = await fetch(SOURCE_URL, { headers: { "user-agent": "TheCountyPost places updater" } });
if (!response.ok) throw new Error(`Census subcounty download failed: ${response.status}`);

// The Census publishes these files as Windows-1252, not UTF-8. Decoding as
// UTF-8 corrupts every accented name ("La Cañada Flintridge", "Española").
const csv = new TextDecoder("windows-1252").decode(await response.arrayBuffer());

const [headers, ...records] = parseCsv(csv);
const columns = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));
const required = ["SUMLEV", "STATE", "COUNTY", "NAME", "POPESTIMATE2024"];
const missing = required.filter((column) => columns[column] === undefined);
if (missing.length) throw new Error(`Census file is missing expected columns: ${missing.join(", ")}`);

/** @type {Map<string, Map<string, number>>} fips -> place name -> population */
const byCounty = new Map();

for (const record of records) {
  if (record[columns.SUMLEV]?.trim() !== COUNTY_PLACE_PART) continue;

  const rawName = record[columns.NAME]?.trim() ?? "";
  // "Balance of Autauga County" is the unincorporated remainder, not a place.
  // It carries FUNCSTAT S as often as F, so the name is the reliable signal.
  if (!rawName || rawName.startsWith("Balance of ")) continue;

  const name = cleanPlaceName(rawName);
  if (!name) continue;

  const population = Number(record[columns.POPESTIMATE2024]);
  if (!Number.isSafeInteger(population) || population <= 0) continue;

  const fips = `${record[columns.STATE].trim().padStart(2, "0")}${record[columns.COUNTY].trim().padStart(3, "0")}`;
  const places = byCounty.get(fips) ?? new Map();
  // A place split across county lines appears once per part; within one county
  // the parts belong to the same town, so add them together.
  places.set(name, (places.get(name) ?? 0) + population);
  byCounty.set(fips, places);
}

const countyPlaces = Object.fromEntries(
  [...byCounty.entries()]
    .map(([fips, places]) => [
      fips,
      [...places.entries()]
        .sort(([leftName, leftPop], [rightName, rightPop]) => rightPop - leftPop || leftName.localeCompare(rightName))
        .slice(0, PLACES_PER_COUNTY)
        .map(([name]) => name),
    ])
    .sort(([left], [right]) => left.localeCompare(right)),
);

/**
 * Town names shared by places in three or more states. A bare mention of one is
 * weak evidence: "Arthur" is a county seat in Nebraska and also a person's
 * name, "Miami" is a town in Texas and a city in Florida. These require the
 * dateline form to count, while a distinctive name like Mena or Quitaque is
 * trusted on its own — which matters, because the best local stories
 * ("Mena Police Reports") never name the state at all.
 */
const statesByName = new Map();
for (const [fips, places] of byCounty) {
  for (const name of places.keys()) {
    const seen = statesByName.get(name) ?? new Set();
    seen.add(fips.slice(0, 2));
    statesByName.set(name, seen);
  }
}
const ambiguousPlaceNames = [...statesByName.entries()]
  .filter(([, seen]) => seen.size >= 3)
  .map(([name]) => name)
  .sort((left, right) => left.localeCompare(right));

const counties = Object.keys(countyPlaces).length;
if (counties < 2_800) {
  throw new Error(`Expected places for at least 2,800 counties; received ${counties}.`);
}

const generated =
  `// Generated from the U.S. Census Bureau Vintage 2024 Subcounty Population Estimates.\n` +
  `// Source: ${SOURCE_URL}\n` +
  `// Refresh with: npm run update:places\n` +
  `//\n` +
  `// Incorporated places and census designated places inside each county, most\n` +
  `// populous first, keyed by five-digit county FIPS. These are the town names\n` +
  `// county news is actually written about; searching a county's nearest media\n` +
  `// market instead is what left rural feeds empty.\n` +
  `export const COUNTY_PLACES_VINTAGE = 2024;\n\n` +
  `export const countyPlaces: Record<string, string[]> = ${JSON.stringify(countyPlaces, null, 2)};\n\n` +
  `// Town names shared by three or more states. A bare mention is weak evidence,\n` +
  `// so these count only when written as a dateline ("Miami, TX").\n` +
  `export const ambiguousPlaceNames: string[] = ${JSON.stringify(ambiguousPlaceNames, null, 2)};\n`;

await writeFile(OUTPUT_PATH, generated, "utf8");
console.log(
  `Wrote places for ${counties.toLocaleString()} counties ` +
    `and ${ambiguousPlaceNames.length.toLocaleString()} ambiguous names to ${OUTPUT_PATH.pathname}.`,
);

function cleanPlaceName(value) {
  let name = value.replace(/\s*\(pt\.\)$/, "").trim();

  for (const phrase of GOVERNMENT_PHRASES) {
    if (name.toLowerCase().endsWith(phrase)) {
      name = name.slice(0, name.length - phrase.length).trim();
      break;
    }
  }

  if (name.endsWith(" CDP")) return name.slice(0, -" CDP".length).trim();

  for (const suffix of TYPE_SUFFIXES) {
    if (name.endsWith(` ${suffix}`)) return name.slice(0, name.length - suffix.length - 1).trim();
  }

  return name;
}

function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quoted) {
      if (character === '"') {
        if (value[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.length > 1);
}
