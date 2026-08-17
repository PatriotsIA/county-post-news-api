import { afterEach, describe, expect, it, vi } from "vitest";
import { atlasDomains, atlasSources } from "../src/atlas-registry.js";
import { setAtlasObjectReaderForTests } from "../src/atlas-service.js";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { handleRequest } from "../src/http.js";
import type { CountyAtlasDomainDocument, CountyAtlasManifest, CountyAtlasOverview } from "../src/types.js";

const defaultBucket = config.atlasDataBucket;
const defaultPrefix = config.atlasDataPrefix;
const defaultFredApiKey = config.fredApiKey;

const county = {
  name: "Polk",
  displayName: "Polk County",
  slug: "polk",
  fips: "05113",
  stateName: "Arkansas",
  stateSlug: "arkansas",
  stateAbbr: "AR",
};

const meta = {
  version: "atlas-test",
  generatedAt: "2026-08-17T12:00:00.000Z",
  retrievedAt: "2026-08-17T11:00:00.000Z",
  sources: [atlasSources["census-acs"]],
  partial: false,
  cacheTtlSeconds: 86_400,
};

const metric = {
  key: "median-household-income",
  domain: "economy" as const,
  label: "Median household income",
  description: "Estimated household income at the midpoint.",
  unit: "Dollars",
  valueKind: "currency" as const,
  chart: "comparison" as const,
  value: 48_200,
  date: "2024-12-31",
  vintage: "2024 ACS 5-year",
  geographyVintage: "2024 ACS county geography",
  marginOfError: 2_600,
  source: atlasSources["census-acs"],
};

const manifest: CountyAtlasManifest = {
  version: "atlas-test",
  generatedAt: meta.generatedAt,
  geographyVintage: "2024 ACS county geography",
  activePrefix: "versions/atlas-test",
  domains: ["economy"],
  sources: [{ id: "census-acs", vintage: "2024 ACS 5-year", retrievedAt: meta.retrievedAt, status: "current" }],
  countyCount: 3_144,
};

describe("county atlas API", () => {
  afterEach(() => {
    clearCache();
    setAtlasObjectReaderForTests();
    config.atlasDataBucket = defaultBucket;
    config.atlasDataPrefix = defaultPrefix;
    config.fredApiKey = defaultFredApiKey;
    vi.restoreAllMocks();
  });

  it("returns a published overview and deduplicates S3 reads", async () => {
    config.atlasDataBucket = "atlas-test-bucket";
    config.atlasDataPrefix = "production";
    const overview: CountyAtlasOverview = {
      county,
      domains: [
        {
          domain: atlasDomains.economy,
          featuredMetrics: [metric],
          available: true,
          warnings: [],
        },
      ],
      meta,
    };
    const objects = new Map([
      ["production/manifest/current.json", JSON.stringify(manifest)],
      ["production/versions/atlas-test/counties/05113/overview.json", JSON.stringify(overview)],
    ]);
    const reader = vi.fn(async (_bucket: string, key: string) => {
      const value = objects.get(key);
      if (!value) throw missingKey();
      return value;
    });
    setAtlasObjectReaderForTests(reader);

    const first = await request("/v1/counties/arkansas/polk/atlas");
    const second = await request("/v1/counties/arkansas/polk/atlas");

    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toContain("s-maxage=86400");
    const firstBody = JSON.parse(first.body);
    expect(firstBody).toMatchObject({
      county: { fips: "05113", displayName: "Polk County" },
      meta: { version: "atlas-test", partial: true },
    });
    expect(firstBody.domains).toHaveLength(12);
    expect(firstBody.domains.find((entry: { domain: { slug: string } }) => entry.domain.slug === "economy")).toMatchObject({
      available: true,
      featuredMetrics: [{ value: 48_200 }],
    });
    expect(second.statusCode).toBe(200);
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("returns a populated published domain document", async () => {
    config.atlasDataBucket = "atlas-test-bucket";
    const economy: CountyAtlasDomainDocument = {
      county,
      domain: atlasDomains.economy,
      metrics: [metric],
      warnings: [],
      meta,
    };
    const objects = new Map([
      ["manifest/current.json", JSON.stringify(manifest)],
      ["versions/atlas-test/counties/05113/domains/economy.json", JSON.stringify(economy)],
    ]);
    setAtlasObjectReaderForTests(async (_bucket, key) => {
      const value = objects.get(key);
      if (!value) throw missingKey();
      return value;
    });

    const response = await request("/v1/counties/arkansas/polk/atlas/economy");

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      county: { fips: "05113" },
      domain: { slug: "economy" },
      metrics: [{ key: "median-household-income", value: 48_200, marginOfError: 2_600 }],
      meta: { version: "atlas-test", partial: false },
    });
  });

  it("returns a valid domain document and preserves sparse published data", async () => {
    config.atlasDataBucket = "atlas-test-bucket";
    const sparse: CountyAtlasDomainDocument = {
      county,
      domain: atlasDomains.health,
      metrics: [],
      warnings: ["No validated health metrics were published."],
      meta: { ...meta, sources: [], partial: true },
    };
    const objects = new Map([
      ["manifest/current.json", JSON.stringify({ ...manifest, domains: ["health"] })],
      ["versions/atlas-test/counties/05113/domains/health.json", JSON.stringify(sparse)],
    ]);
    setAtlasObjectReaderForTests(async (_bucket, key) => {
      const value = objects.get(key);
      if (!value) throw missingKey();
      return value;
    });

    const response = await request("/v1/counties/arkansas/polk/atlas/health");
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.domain.slug).toBe("health");
    expect(body.metrics).toEqual([]);
    expect(body.meta.partial).toBe(true);
    expect(body.warnings).toContain("No validated health metrics were published.");
  });

  it("rejects unknown domains before reading S3", async () => {
    config.atlasDataBucket = "atlas-test-bucket";
    const reader = vi.fn();
    setAtlasObjectReaderForTests(reader);

    const response = await request("/v1/counties/arkansas/polk/atlas/not-a-domain");

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain("Unknown atlas domain");
    expect(reader).not.toHaveBeenCalled();
  });

  it("rejects unknown counties consistently", async () => {
    config.atlasDataBucket = "";
    const response = await request("/v1/counties/arkansas/not-a-county/atlas");

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error).toBe("Unknown county");
  });

  it("returns a safe upstream error for a malformed active manifest", async () => {
    config.atlasDataBucket = "atlas-test-bucket";
    setAtlasObjectReaderForTests(async (_bucket, key) => {
      if (key === "manifest/current.json") return JSON.stringify({ version: "broken" });
      throw missingKey();
    });

    const response = await request("/v1/counties/arkansas/polk/atlas");

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body).error).toBe("The atlas manifest is malformed.");
  });

  it("falls back to bundled population and live FRED data when no bucket is configured", async () => {
    config.atlasDataBucket = "";
    config.fredApiKey = "test-fred-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          observations: [
            { date: "2025-01-01", value: "52000" },
            { date: "2024-01-01", value: "50000" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await request("/v1/counties/arkansas/polk/atlas");
    const body = JSON.parse(response.body);
    const demographics = body.domains.find((entry: { domain: { slug: string } }) => entry.domain.slug === "demographics");
    const economy = body.domains.find((entry: { domain: { slug: string } }) => entry.domain.slug === "economy");
    const health = body.domains.find((entry: { domain: { slug: string } }) => entry.domain.slug === "health");

    expect(response.statusCode).toBe(200);
    expect(body.meta).toMatchObject({ version: "development-fallback", partial: true });
    expect(demographics.featuredMetrics[0]).toMatchObject({ key: "population", source: { id: "census-popest" } });
    expect(economy.available).toBe(true);
    expect(health).toMatchObject({ available: false, featuredMetrics: [] });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("returns an explicitly unavailable known domain when its S3 object is missing", async () => {
    config.atlasDataBucket = "atlas-test-bucket";
    config.fredApiKey = "";
    setAtlasObjectReaderForTests(async (_bucket, key) => {
      if (key === "manifest/current.json") return JSON.stringify(manifest);
      throw missingKey();
    });

    const response = await request("/v1/counties/arkansas/polk/atlas/agriculture");
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      domain: { slug: "agriculture" },
      metrics: [],
      meta: { version: "development-fallback", partial: true },
    });
    expect(body.warnings.join(" ")).toContain("No verified Agriculture data is available");
  });
});

function request(path: string) {
  return handleRequest({ method: "GET", path, query: new URLSearchParams() });
}

function missingKey() {
  return Object.assign(new Error("missing"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
}
