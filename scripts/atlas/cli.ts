import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { atlasProviderCatalog, implementedProviderIds } from "./provider-catalog.js";
import { publishSnapshot } from "./publish.js";
import { getProviderAdapter } from "./providers/index.js";
import { buildSnapshot } from "./snapshot.js";
import type { AtlasSnapshot } from "./types.js";
import { validateProviderResult } from "./validate.js";

export type AtlasIngestionOptions = {
  providerIds?: string[];
  fixturePath?: string;
  censusYear?: number;
  censusApiKey?: string;
  generatedAt?: string;
  minCountyCount?: number;
  maxCountyCount?: number;
  cacheTtlSeconds?: number;
  farsYear?: number;
  outputDir?: string;
  bucket?: string;
  prefix?: string;
  region?: string;
};

export async function runAtlasIngestion(options: AtlasIngestionOptions = {}): Promise<AtlasSnapshot> {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const providerIds = options.providerIds || (options.fixturePath ? ["census-acs"] : implementedProviderIds());
  const selected = providerIds.map((id) => {
    const definition = atlasProviderCatalog.find((candidate) => candidate.id === id);
    if (!definition) throw new Error(`Unknown atlas provider: ${id}.`);
    if (definition.status !== "implemented") {
      throw new Error(`Atlas provider ${id} is configured for Wave ${definition.wave} but is not implemented.`);
    }
    const adapter = getProviderAdapter(id);
    if (!adapter) throw new Error(`Implemented atlas provider ${id} has no registered adapter.`);
    return adapter;
  });

  const context = {
    retrievedAt: generatedAt,
    censusYear: options.censusYear || 2024,
    censusApiKey: options.censusApiKey,
    fetchJson,
    fetchBytes,
    farsYear: options.farsYear || Number(process.env.ATLAS_FARS_YEAR || 2024),
  };
  const census = selected.find((adapter) => adapter.id === "census-acs");
  const dependentProviders = selected.filter((adapter) => adapter.id !== "census-acs");
  if (dependentProviders.length && !census) {
    throw new Error("County-level Atlas providers require census-acs to establish the validated county roster.");
  }
  const censusResult = census
    ? await census.ingest({ ...context, fixturePath: options.fixturePath })
    : undefined;
  const countyRoster = censusResult?.counties.map((record) => record.county);
  const dependentResults = await Promise.all(
    dependentProviders.map((adapter) => adapter.ingest({ ...context, countyRoster })),
  );
  const results = [...(censusResult ? [censusResult] : []), ...dependentResults];
  const minCountyCount = options.minCountyCount ?? (options.fixturePath ? 1 : 3_100);
  const maxCountyCount = options.maxCountyCount ?? (options.fixturePath ? 5_000 : 3_250);
  results.forEach((result) => validateProviderResult(result, { minCountyCount, maxCountyCount }));

  const snapshot = buildSnapshot(results, {
    generatedAt,
    cacheTtlSeconds: options.cacheTtlSeconds || 86_400,
  });
  await publishSnapshot(snapshot, {
    outputDir: options.outputDir,
    bucket: options.bucket,
    prefix: options.prefix,
    region: options.region,
  });
  return snapshot;
}

async function fetchJson(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "county-post-news-api-atlas/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.json().catch(() => undefined)) as unknown;
  if (!response.ok) {
    const details = body && typeof body === "object" ? JSON.stringify(body) : response.statusText;
    throw new Error(`Official data request failed (${response.status}): ${details}`);
  }
  return body;
}

async function fetchBytes(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8", "user-agent": "county-post-news-api-atlas/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Official data download failed (${response.status}): ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

function parseArguments(argv: string[]): AtlasIngestionOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected atlas argument: ${argument}.`);
    const [name, inlineValue] = argument.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      values.set(name, inlineValue);
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      values.set(name, argv[++index]);
    } else {
      flags.add(name);
    }
  }

  const fixturePath = values.get("fixture") || process.env.ATLAS_FIXTURE_PATH;
  const publish = flags.has("publish");
  const bucket = values.get("bucket") || (publish ? process.env.ATLAS_DATA_BUCKET : undefined);
  if (publish && !bucket) throw new Error("--publish requires --bucket or ATLAS_DATA_BUCKET.");
  return {
    providerIds: csv(values.get("providers") || process.env.ATLAS_PROVIDERS) || undefined,
    fixturePath,
    censusYear: numberValue(values.get("year") || process.env.ATLAS_CENSUS_YEAR),
    censusApiKey: process.env.CENSUS_API_KEY,
    generatedAt: process.env.ATLAS_GENERATED_AT,
    minCountyCount: numberValue(process.env.ATLAS_EXPECTED_MIN_COUNTIES),
    maxCountyCount: numberValue(process.env.ATLAS_EXPECTED_MAX_COUNTIES),
    cacheTtlSeconds: numberValue(process.env.ATLAS_PUBLIC_CACHE_TTL_SECONDS),
    farsYear: numberValue(process.env.ATLAS_FARS_YEAR),
    outputDir: values.get("output") || (!publish ? process.env.ATLAS_OUTPUT_DIR || ".atlas-output" : undefined),
    bucket,
    prefix: values.get("prefix") || process.env.ATLAS_DATA_PREFIX,
    region: process.env.AWS_REGION,
  };
}

function csv(value: string | undefined) {
  const result = (value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return result.length ? result : undefined;
}

function numberValue(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a numeric atlas option, received ${value}.`);
  return parsed;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runAtlasIngestion(parseArguments(process.argv.slice(2)))
    .then((snapshot) => {
      console.log(
        JSON.stringify({
          event: "atlas.publish.succeeded",
          version: snapshot.manifest.version,
          countyCount: snapshot.manifest.countyCount,
          objectCount: snapshot.objects.length + 1,
          domains: snapshot.manifest.domains,
        }),
      );
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "atlas.publish.failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exitCode = 1;
    });
}
