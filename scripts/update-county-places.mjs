import { writeFile } from "node:fs/promises";
import { extractZipEntry } from "./lib/unzip.mjs";

/**
 * Regenerates src/county-places.ts: the real towns inside each county.
 *
 * Without this the query builder fell back to the nearest media-market hubs, so
 * Briscoe County, Texas searched for "Amarillo", "Lubbock", and "Abilene" —
 * cities in other counties, 90 to 200 miles away — and the county locality
 * filter then discarded everything it found. Silverton and Quitaque, the towns
 * where Briscoe County news actually happens, were never searched.
 *
 * Three public-domain federal sources, each covering the previous one's gap:
 *
 *   1. Census subcounty population estimates. Incorporated places and CDPs with
 *      a population to rank them by. Covers most of the country, but omits
 *      unincorporated communities — which in the smallest counties is the county
 *      seat itself — and reports Connecticut as planning regions rather than the
 *      counties this site is organised by.
 *   2. Census 2020 Gazetteer county subdivisions, for Connecticut only. The last
 *      vintage that still carries the legacy county FIPS the app uses.
 *   3. USGS GNIS domestic names, for the counties still left empty. It lists
 *      unincorporated communities — Gail, Texas; Sarita, Texas; Kalaupapa,
 *      Hawaii — with no population to rank by, so they are kept in file order,
 *      which empirically front-loads the prominent ones.
 *
 * GNIS also supplies the ambiguity signal. A name shared by places in three or
 * more states is weak evidence on its own, and knowing that requires seeing
 * every populated place in the country, not only the ones this file keeps.
 *
 * Refresh with: npm run update:places
 */

const SUB_EST_URL =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv";
const GAZETTEER_COUSUBS_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_cousubs_national.zip";
const GNIS_URL =
  "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_National_Text.zip";
const GAZETTEER_PLACES_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip";

const OUTPUT_PATH = new URL("../src/county-places.ts", import.meta.url);

/** Summary level 157 is a place's part within one county — the join we need. */
const COUNTY_PLACE_PART = "157";

/** Connecticut. Reported as planning regions since the 2020-2022 vintage. */
const CONNECTICUT = "09";

/** Kept per county when ranked by population. */
const PLACES_PER_COUNTY = 6;

/**
 * Kept per county when filled from GNIS. Higher, because these have no
 * population to rank by and the county seat is not reliably first.
 */
const GNIS_PLACES_PER_COUNTY = 8;

/** A name in this many states or more counts only in dateline form. */
const AMBIGUOUS_STATE_THRESHOLD = 3;

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

/** fips -> Map<placeName, {population, order}>. Population 0 means unranked. */
const byCounty = new Map();
/** Connecticut town populations, kept aside because its rows are keyed by planning region. */
const connecticutPopulations = new Map();
/** placeName -> Set<state fips>, across every populated place in the country. */
const statesByName = new Map();

await loadSubcountyEstimates();
await loadConnecticutTowns();
const censusPlaceArea = await loadGazetteerPlaces();
const gnisByCounty = await loadGnis();
fillGapsFromGnis(gnisByCounty, censusPlaceArea);

const countyPlaces = Object.fromEntries(
  [...byCounty.entries()]
    .filter(([fips]) => fips.slice(0, 2) !== CONNECTICUT || Number(fips.slice(2)) < 100)
    .map(([fips, places]) => [
      fips,
      rankedPlaces(places, [...places.values()].some((entry) => entry.population > 0) ? PLACES_PER_COUNTY : GNIS_PLACES_PER_COUNTY),
    ])
    .filter(([, places]) => places.length)
    .sort(([left], [right]) => left.localeCompare(right)),
);

const usedNames = new Set(Object.values(countyPlaces).flat());
const ambiguousPlaceNames = [...usedNames]
  .filter((name) => (statesByName.get(name)?.size ?? 0) >= AMBIGUOUS_STATE_THRESHOLD)
  .sort((left, right) => left.localeCompare(right));

const counties = Object.keys(countyPlaces).length;
if (counties < 3_100) throw new Error(`Expected places for at least 3,100 counties; received ${counties}.`);

const generated =
  `// Generated from three public-domain federal sources:\n` +
  `//   ${SUB_EST_URL}\n` +
  `//   ${GAZETTEER_COUSUBS_URL}\n` +
  `//   ${GNIS_URL}\n` +
  `// Refresh with: npm run update:places\n` +
  `//\n` +
  `// Towns inside each county, keyed by five-digit county FIPS and ordered most\n` +
  `// populous first where a population is known. These are the names county news\n` +
  `// is actually written about; searching a county's nearest media market\n` +
  `// instead is what left rural feeds empty.\n` +
  `export const COUNTY_PLACES_VINTAGE = 2024;\n\n` +
  `export const countyPlaces: Record<string, string[]> = ${JSON.stringify(countyPlaces, null, 2)};\n\n` +
  `// Town names shared by places in three or more states, measured across every\n` +
  `// populated place in GNIS. A bare mention is weak evidence, so these count\n` +
  `// only when written as a dateline ("Miami, TX").\n` +
  `export const ambiguousPlaceNames: string[] = ${JSON.stringify(ambiguousPlaceNames, null, 2)};\n`;

await writeFile(OUTPUT_PATH, generated, "utf8");
console.log(
  `Wrote places for ${counties.toLocaleString()} counties ` +
    `and ${ambiguousPlaceNames.length.toLocaleString()} ambiguous names to ${OUTPUT_PATH.pathname}.`,
);

/* -------------------------------------------------------------------------- */

async function loadSubcountyEstimates() {
  // The Census publishes these as Windows-1252, not UTF-8. Decoding as UTF-8
  // corrupts every accented name ("La Cañada Flintridge", "Española").
  const csv = new TextDecoder("windows-1252").decode(await download(SUB_EST_URL));
  const [headers, ...records] = parseCsv(csv);
  const columns = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));
  const required = ["SUMLEV", "STATE", "COUNTY", "NAME", "POPESTIMATE2024"];
  const missing = required.filter((column) => columns[column] === undefined);
  if (missing.length) throw new Error(`Census subcounty file is missing columns: ${missing.join(", ")}`);

  for (const record of records) {
    if (record[columns.SUMLEV]?.trim() !== COUNTY_PLACE_PART) continue;

    const rawName = record[columns.NAME]?.trim() ?? "";
    // "Balance of Autauga County" is the unincorporated remainder, not a place.
    // It carries FUNCSTAT S as often as F, so the name is the reliable signal.
    if (!rawName || rawName.startsWith("Balance of ")) continue;

    const name = cleanPlaceName(rawName);
    const population = Number(record[columns.POPESTIMATE2024]);
    if (!name || !Number.isSafeInteger(population) || population <= 0) continue;

    const state = record[columns.STATE].trim().padStart(2, "0");
    const fips = `${state}${record[columns.COUNTY].trim().padStart(3, "0")}`;
    // Connecticut's rows are keyed by planning region; its towns come from the
    // Gazetteer instead. The names still count towards the ambiguity signal.
    if (state === CONNECTICUT) connecticutPopulations.set(name, population);
    else addPlace(fips, name, population);
    noteState(name, state);
  }
}

/**
 * Connecticut towns, mapped to the legacy counties the site is organised by.
 * Ranked by the population the subcounty file reports for the same town.
 */
async function loadConnecticutTowns() {
  const archive = await download(GAZETTEER_COUSUBS_URL);
  const text = extractZipEntry(archive, (name) => name.endsWith(".txt")).toString("utf8");

  for (const line of eachLine(text)) {
    const columns = line.split("\t");
    if (columns[0]?.trim() !== "CT") continue;

    const geoid = columns[1]?.trim() ?? "";
    const name = cleanPlaceName(columns[3]?.trim() ?? "");
    if (geoid.length < 5 || !name || name.startsWith("County subdivisions")) continue;

    addPlace(geoid.slice(0, 5), name, connecticutPopulations.get(name) ?? 0);
    noteState(name, CONNECTICUT);
  }
}

/**
 * Land area of every Census place, keyed by state FIPS and name. The counties
 * GNIS has to fill have no population figures, and GNIS lists a ghost town the
 * same way it lists a county seat. Being a Census place at all, and how much
 * ground it covers, is the only prominence signal available for them — without
 * it Hawaii County led with "Elevenmile Homestead" instead of Hilo.
 */
async function loadGazetteerPlaces() {
  const archive = await download(GAZETTEER_PLACES_URL);
  const text = extractZipEntry(archive, (name) => name.endsWith(".txt")).toString("utf8");

  const areas = new Map();
  let first = true;
  for (const line of eachLine(text)) {
    if (first) {
      first = false;
      continue;
    }
    const columns = line.split("\t");
    const geoid = columns[1]?.trim() ?? "";
    const name = cleanPlaceName(columns[3]?.trim() ?? "");
    const land = Number(columns[6]?.trim());
    if (geoid.length < 2 || !name || !Number.isFinite(land)) continue;
    areas.set(`${geoid.slice(0, 2)}|${name}`, Math.max(areas.get(`${geoid.slice(0, 2)}|${name}`) ?? 0, land));
  }
  return areas;
}

/**
 * Every populated place in the country, for the ambiguity signal and to fill
 * the counties the Census files leave empty.
 */
async function loadGnis() {
  const archive = await download(GNIS_URL);
  const text = extractZipEntry(archive, (name) => name.endsWith(".txt")).toString("utf8");

  const places = new Map();
  let first = true;
  for (const line of eachLine(text)) {
    if (first) {
      first = false;
      continue;
    }
    // feature_id|feature_name|feature_class|state_name|state_numeric|county_name|county_numeric|...
    const columns = line.split("|");
    if (columns[2] !== "Populated Place") continue;

    const name = columns[1]?.trim();
    const state = columns[4]?.trim();
    const county = columns[6]?.trim();
    // GNIS keeps ghost towns and razed settlements, flagged in the name itself.
    if (!name || !state || !county || name.includes("(historical)")) continue;

    noteState(name, state);
    const fips = `${state.padStart(2, "0")}${county.padStart(3, "0")}`;
    const existing = places.get(fips);
    if (existing) existing.push(name);
    else places.set(fips, [name]);
  }
  return places;
}

function fillGapsFromGnis(gnisByCounty, censusPlaceArea) {
  for (const [fips, names] of gnisByCounty) {
    if (byCounty.get(fips)?.size) continue;
    if (fips.slice(0, 2) === CONNECTICUT) continue;

    const state = fips.slice(0, 2);
    const ranked = unique(names)
      .map((name, order) => ({ name, order, area: censusPlaceArea.get(`${state}|${name}`) ?? 0 }))
      // Recognised Census places first, largest first; then whatever GNIS listed
      // in the order it listed them, which front-loads the prominent ones.
      .sort((left, right) => right.area - left.area || left.order - right.order)
      .slice(0, GNIS_PLACES_PER_COUNTY);

    for (const { name } of ranked) addPlace(fips, name, 0);
  }
}

function addPlace(fips, name, population) {
  const places = byCounty.get(fips) ?? new Map();
  const existing = places.get(name);
  // A place split across county lines appears once per part; within one county
  // the parts belong to the same town, so add them together.
  places.set(name, {
    population: (existing?.population ?? 0) + population,
    order: existing?.order ?? places.size,
  });
  byCounty.set(fips, places);
}

/**
 * Most populous first where a population is known. Unranked entries — the GNIS
 * fill, which has none — keep the order the source listed them in, which
 * front-loads the prominent places; sorting them alphabetically instead dropped
 * Hilo from Hawaii County in favour of "Elevenmile Homestead".
 */
function rankedPlaces(places, limit) {
  return [...places.entries()]
    .sort(([leftName, left], [rightName, right]) =>
      right.population - left.population || left.order - right.order || leftName.localeCompare(rightName),
    )
    .slice(0, limit)
    .map(([name]) => name);
}

function noteState(name, state) {
  const seen = statesByName.get(name) ?? new Set();
  seen.add(state.padStart(2, "0"));
  statesByName.set(name, seen);
}

async function download(url) {
  const response = await fetch(url, { headers: { "user-agent": "TheCountyPost places updater" } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Iterates lines without materialising a multi-million entry array. */
function* eachLine(text) {
  let start = 0;
  while (start < text.length) {
    const end = text.indexOf("\n", start);
    const stop = end === -1 ? text.length : end;
    const line = text.charCodeAt(stop - 1) === 13 ? text.slice(start, stop - 1) : text.slice(start, stop);
    if (line) yield line;
    if (end === -1) break;
    start = end + 1;
  }
}

function unique(values) {
  return [...new Set(values)];
}

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
