import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAtlasIngestion } from "../scripts/atlas/cli.js";
import { publishSnapshot } from "../scripts/atlas/publish.js";

const fixturePath = path.resolve("tests/fixtures/atlas/census-acs.json");
const temporaryDirectories: string[] = [];

describe("atlas ingestion", () => {
  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
    vi.restoreAllMocks();
  });

  it("normalizes fixture ACS data and atomically emits versioned county documents", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "county-atlas-"));
    temporaryDirectories.push(outputDir);

    const snapshot = await runAtlasIngestion({
      fixturePath,
      outputDir,
      censusYear: 2024,
      generatedAt: "2026-08-17T18:30:00.000Z",
      minCountyCount: 2,
      maxCountyCount: 2,
    });
    const current = JSON.parse(await readFile(path.join(outputDir, "manifest/current.json"), "utf8"));
    const economy = JSON.parse(
      await readFile(
        path.join(outputDir, snapshot.manifest.activePrefix, "counties/05113/domains/economy.json"),
        "utf8",
      ),
    );
    const housing = JSON.parse(
      await readFile(
        path.join(outputDir, snapshot.manifest.activePrefix, "counties/48381/domains/housing.json"),
        "utf8",
      ),
    );

    expect(current).toEqual(snapshot.manifest);
    expect(snapshot.manifest).toMatchObject({
      version: "atlas-20260817T183000000Z",
      countyCount: 2,
      sources: [{ id: "census-acs", vintage: "2024 ACS 5-year", status: "current" }],
    });
    expect(economy.county).toMatchObject({ fips: "05113", stateSlug: "arkansas", slug: "polk" });
    expect(economy.metrics.find((item: { key: string }) => item.key === "poverty-rate")).toMatchObject({
      value: 26.32,
      coverageNumerator: 5000,
      coverageDenominator: 19000,
      vintage: "2024 ACS 5-year",
      source: { id: "census-acs" },
    });
    expect(economy.metrics.find((item: { key: string }) => item.key === "median-household-income")).toMatchObject({
      marginOfError: 2600,
      benchmarks: [
        { geography: "state", label: "Arkansas", value: 56300 },
        { geography: "nation", label: "United States", value: 80500 },
      ],
    });
    expect(housing.metrics.find((item: { key: string }) => item.key === "median-gross-rent")).toMatchObject({
      suppressed: true,
      suppressionReason: "Not available",
    });
  });

  it("uploads every immutable version object before switching the S3 current manifest", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "county-atlas-"));
    temporaryDirectories.push(outputDir);
    const snapshot = await runAtlasIngestion({
      fixturePath,
      outputDir,
      generatedAt: "2026-08-17T18:30:00.000Z",
      minCountyCount: 2,
      maxCountyCount: 2,
    });
    const keys: string[] = [];
    const s3Client = {
      send: vi.fn(async (command: { input?: { Key?: string } }) => {
        keys.push(command.input?.Key || "");
        return {};
      }),
    };

    await publishSnapshot(snapshot, {
      bucket: "atlas-bucket",
      prefix: "production",
      concurrency: 3,
      s3Client: s3Client as never,
    });

    expect(keys.at(-1)).toBe("production/manifest/current.json");
    expect(keys.slice(0, -1)).toHaveLength(snapshot.objects.length);
    expect(keys.slice(0, -1).every((key) => key.startsWith(`production/${snapshot.manifest.activePrefix}/`))).toBe(true);
  });

  it("does not run planned providers as if data were available", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "county-atlas-"));
    temporaryDirectories.push(outputDir);
    await expect(
      runAtlasIngestion({
        providerIds: ["cdc-places"],
        fixturePath,
        outputDir,
      }),
    ).rejects.toThrow("configured for Wave 2 but is not implemented");
  });

  it("requires a free Census API key for live ingestion", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "county-atlas-"));
    temporaryDirectories.push(outputDir);
    await expect(runAtlasIngestion({ outputDir, censusApiKey: "" })).rejects.toThrow(
      "CENSUS_API_KEY is required",
    );
  });

  it("fails validation when county coverage is implausibly low", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "county-atlas-"));
    temporaryDirectories.push(outputDir);
    await expect(
      runAtlasIngestion({
        fixturePath,
        outputDir,
        minCountyCount: 3,
        maxCountyCount: 4,
      }),
    ).rejects.toThrow("returned 2 counties; expected 3-4");
  });
});
