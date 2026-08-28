import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CoverageRow = {
  fips: string;
  state: string;
  stateAbbr: string;
  stateSlug: string;
  county: string;
  countySlug: string;
  status: string;
  articleCount: number;
  coverageBand: string;
  uniquePublishers: number;
  dominantPublisher?: string;
  dominantPublisherShare: number;
  publishedWithin14Days: number;
  marketTierUsed: boolean;
  nearbyTierUsed: boolean;
  directSourceCount: number;
  publisherBalanceUsed: boolean;
  missingImages: number;
  responseMs: number;
};

type StateSummary = {
  state: string;
  stateAbbr: string;
  stateSlug: string;
  countyCount: number;
  articleCount: {
    mean: number;
    median: number;
    min: number;
    max: number;
  };
  below12Count: number;
  below25Count: number;
  targetCount: number;
  averageUniquePublishers: number;
  marketTierRate: number;
  nearbyTierRate: number;
};

type CoverageReport = {
  metadata: {
    generatedAt: string;
    startedAt: string;
    durationMs: number;
  };
  summary: {
    rosterCount: number;
    successfulCount: number;
    errorCount: number;
    totalArticlesReturned: number;
    articleCount: {
      mean: number;
      median: number;
    };
    byBand: Record<string, number>;
    below12Count: number;
    below25Count: number;
    targetCount: number;
    averageUniquePublishers: number;
    articlesPublishedWithin14Days: number;
    exactDuplicateTitles: number;
    duplicateCanonicalUrls: number;
    invalidArticles: number;
    countiesWithDominantPublisherOver50Percent: number;
    countiesUsingMarketTier: number;
    countiesUsingNearbyTier: number;
    countiesUsingDirectSources: number;
    stateSummaries: StateSummary[];
  };
  counties: CoverageRow[];
};

async function main() {
  const args = process.argv.slice(2);
  const reportPath = requiredOption(args, "report");
  const canvasPath = requiredOption(args, "canvas");
  const report = JSON.parse(await readFile(reportPath, "utf8")) as CoverageReport;
  const canvas = await readFile(canvasPath, "utf8");
  const bands: Array<[string, number]> = [
    ["empty", report.summary.byBand.empty || 0],
    ["critical", report.summary.byBand.critical || 0],
    ["sparse", report.summary.byBand.sparse || 0],
    ["thin", report.summary.byBand.thin || 0],
    ["partial", report.summary.byBand.partial || 0],
    ["target", report.summary.byBand.target || 0],
  ];
  const data = {
    summary: {
      generatedAt: report.metadata.generatedAt,
      startedAt: report.metadata.startedAt,
      durationMs: report.metadata.durationMs,
      rosterCount: report.summary.rosterCount,
      successfulCount: report.summary.successfulCount,
      errorCount: report.summary.errorCount,
      totalArticlesReturned: report.summary.totalArticlesReturned,
      mean: report.summary.articleCount.mean,
      median: report.summary.articleCount.median,
      below12Count: report.summary.below12Count,
      below25Count: report.summary.below25Count,
      targetCount: report.summary.targetCount,
      averageUniquePublishers: report.summary.averageUniquePublishers,
      within14Days: report.summary.articlesPublishedWithin14Days,
      exactDuplicateTitles: report.summary.exactDuplicateTitles,
      duplicateCanonicalUrls: report.summary.duplicateCanonicalUrls,
      invalidArticles: report.summary.invalidArticles,
      dominantPublisherOver50Count:
        report.summary.countiesWithDominantPublisherOver50Percent,
      publisherBalanceCountyCount: report.counties.filter(
        (county) => county.publisherBalanceUsed,
      ).length,
      marketTierCount: report.summary.countiesUsingMarketTier,
      nearbyTierCount: report.summary.countiesUsingNearbyTier,
      directSourceCountyCount: report.summary.countiesUsingDirectSources,
    },
    bands: bands.filter(([, count]) => count > 0),
    states: report.summary.stateSummaries.map((state) => [
      state.state,
      state.stateAbbr,
      state.stateSlug,
      state.countyCount,
      state.articleCount.mean,
      state.articleCount.median,
      state.articleCount.min,
      state.articleCount.max,
      state.below12Count,
      state.below25Count,
      state.targetCount,
      state.averageUniquePublishers,
      state.marketTierRate,
      state.nearbyTierRate,
    ]),
    counties: report.counties.map((county) => [
      county.fips,
      county.state,
      county.stateAbbr,
      county.stateSlug,
      county.county,
      county.countySlug,
      county.articleCount,
      county.coverageBand,
      county.uniquePublishers,
      county.dominantPublisher || "",
      county.dominantPublisherShare,
      county.publishedWithin14Days,
      county.marketTierUsed,
      county.nearbyTierUsed,
      county.directSourceCount,
      county.missingImages,
      county.responseMs,
      county.status,
    ]),
  };
  const marker = /\/\* REPORT_DATA_START \*\/[\s\S]*?\/\* REPORT_DATA_END \*\//;
  if (!marker.test(canvas)) {
    throw new Error("Canvas report data markers were not found.");
  }
  const replacement = `/* REPORT_DATA_START */ ${JSON.stringify(data)} /* REPORT_DATA_END */`;
  await writeFile(canvasPath, canvas.replace(marker, replacement), "utf8");
  console.log(
    `canvas_data_generated counties=${data.counties.length} states=${data.states.length} output=${path.resolve(canvasPath)}`,
  );
}

function requiredOption(args: string[], name: string) {
  const inline = args.find((argument) => argument.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required --${name} option.`);
  }
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
