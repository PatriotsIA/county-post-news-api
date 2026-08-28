import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCountyByState, type UsCounty } from "@nickgraffis/us-counties";
import { states } from "../../src/geo.js";

type FeedItem = {
  title?: unknown;
  link?: unknown;
  source?: unknown;
  publishedAt?: unknown;
  imageUrl?: unknown;
};

type FeedPayload = {
  items?: unknown;
  meta?: {
    count?: unknown;
    sourcesUsed?: unknown;
    fetchedAt?: unknown;
  };
};

type CountyTarget = {
  key: string;
  fips: string;
  state: string;
  stateAbbr: string;
  stateSlug: string;
  county: string;
  countySlug: string;
};

type SampleArticle = {
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
};

type PublisherCount = {
  publisher: string;
  count: number;
};

type CoverageStatus = "ok" | "http-error" | "network-error" | "invalid-response";

type CountyCoverageRow = CountyTarget & {
  status: CoverageStatus;
  endpoint: string;
  auditedAt: string;
  attempts: number;
  httpStatus?: number;
  responseMs: number;
  articleCount: number;
  metaCount?: number;
  metaCountMismatch: boolean;
  coverageBand: CoverageBand;
  targetFillPercent: number;
  uniquePublishers: number;
  dominantPublisher?: string;
  dominantPublisherCount: number;
  dominantPublisherShare: number;
  topPublishers: PublisherCount[];
  publishedWithin14Days: number;
  publishedWithin30Days: number;
  publishedWithin90Days: number;
  olderThan183Days: number;
  missingPublishedAt: number;
  futurePublishedAt: number;
  newestPublishedAt?: string;
  oldestPublishedAt?: string;
  missingImages: number;
  exactDuplicateTitles: number;
  duplicateCanonicalUrls: number;
  invalidArticles: number;
  primaryTierUsed: boolean;
  marketTierUsed: boolean;
  nearbyTierUsed: boolean;
  localSourceSearchUsed: boolean;
  publisherDiversityExpansionUsed: boolean;
  publisherBalanceUsed: boolean;
  directSourceCount: number;
  sourcesUsed: string[];
  samples: SampleArticle[];
  error?: string;
};

type CoverageBand = "empty" | "critical" | "sparse" | "thin" | "partial" | "target";

type AuditOptions = {
  baseUrl: string;
  outputDir: string;
  limit: number;
  concurrency: number;
  requestTimeoutMs: number;
  retries: number;
  requestStartIntervalMs: number;
  sampleSize: number;
  progressEvery: number;
  fresh: boolean;
  stateSlugs: Set<string>;
  maxCounties?: number;
};

type NumericSummary = {
  mean: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
};

type StateCoverageSummary = {
  state: string;
  stateAbbr: string;
  stateSlug: string;
  countyCount: number;
  successfulCount: number;
  errorCount: number;
  articleCount: NumericSummary;
  emptyCount: number;
  below12Count: number;
  below25Count: number;
  targetCount: number;
  averageUniquePublishers: number;
  marketTierRate: number;
  nearbyTierRate: number;
};

const DAY_MS = 86_400_000;
const DEFAULT_BASE_URL = process.env.NEWS_COVERAGE_BASE_URL || "";

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const roster = buildRoster(options);
  if (!roster.length) {
    throw new Error("No counties matched the requested audit scope.");
  }

  await mkdir(options.outputDir, { recursive: true });
  const checkpointPath = path.join(options.outputDir, "county-results.jsonl");
  if (options.fresh) {
    await rm(checkpointPath, { force: true });
  }

  const priorResults = options.fresh
    ? new Map<string, CountyCoverageRow>()
    : await readCheckpoint(checkpointPath);
  const pending = roster.filter((county) => priorResults.get(county.key)?.status !== "ok");
  const startedAt = new Date();
  const sessionStartedMs = Date.now();
  const rateGate = createRateGate(options.requestStartIntervalMs);
  let nextIndex = 0;
  let sessionCompleted = 0;
  let writeQueue = Promise.resolve();

  await writeFile(
    path.join(options.outputDir, "audit-config.json"),
    `${JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        baseUrl: options.baseUrl,
        route: "/v1/feeds/counties/:stateSlug/:countySlug/general",
        limit: options.limit,
        rosterCount: roster.length,
        pendingCount: pending.length,
        resumedSuccessfulCount: roster.length - pending.length,
        concurrency: options.concurrency,
        requestTimeoutMs: options.requestTimeoutMs,
        retries: options.retries,
        requestStartIntervalMs: options.requestStartIntervalMs,
        stateSlugs: [...options.stateSlugs],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `audit_started counties=${roster.length} pending=${pending.length} concurrency=${options.concurrency} limit=${options.limit}`,
  );

  const workers = Array.from(
    { length: Math.min(options.concurrency, Math.max(pending.length, 1)) },
    (_, workerIndex) =>
      runWorker(workerIndex, async () => {
        const index = nextIndex++;
        if (index >= pending.length) return false;

        const county = pending[index];
        await rateGate();
        const row = await auditCounty(county, options);
        priorResults.set(county.key, row);
        writeQueue = writeQueue.then(() => appendFile(checkpointPath, `${JSON.stringify(row)}\n`, "utf8"));
        await writeQueue;

        sessionCompleted += 1;
        if (
          sessionCompleted % options.progressEvery === 0 ||
          sessionCompleted === pending.length ||
          row.status !== "ok"
        ) {
          const elapsedMs = Date.now() - sessionStartedMs;
          const rate = sessionCompleted > 0 ? elapsedMs / sessionCompleted : 0;
          const remainingMs = rate * (pending.length - sessionCompleted);
          console.log(
            `audit_progress completed=${sessionCompleted}/${pending.length} county=${county.key} status=${row.status} articles=${row.articleCount} eta=${formatDuration(remainingMs)}`,
          );
        }

        return true;
      }),
  );

  await Promise.all(workers);
  await writeQueue;

  const rows = roster
    .map((county) => priorResults.get(county.key))
    .filter((row): row is CountyCoverageRow => Boolean(row));
  const finishedAt = new Date();
  const report = buildReport(rows, roster.length, options, startedAt, finishedAt);
  const reportPath = path.join(options.outputDir, "county-news-coverage.json");
  const csvPath = path.join(options.outputDir, "county-news-coverage.csv");
  const summaryPath = path.join(options.outputDir, "summary.json");

  await Promise.all([
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(csvPath, toCsv(rows), "utf8"),
    writeFile(summaryPath, `${JSON.stringify(report.summary, null, 2)}\n`, "utf8"),
  ]);

  console.log(
    `audit_complete successful=${report.summary.successfulCount} errors=${report.summary.errorCount} below12=${report.summary.below12Count} target=${report.summary.targetCount} output=${options.outputDir}`,
  );

  if (rows.length !== roster.length) {
    process.exitCode = 1;
  }
}

function parseOptions(args: string[]): AuditOptions {
  const values = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      values.set(rawName, [...(values.get(rawName) || []), inlineValue]);
      continue;
    }
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(rawName, [...(values.get(rawName) || []), next]);
      index += 1;
    } else {
      flags.add(rawName);
    }
  }

  const baseUrl = option(values, "base-url") || DEFAULT_BASE_URL;
  if (!baseUrl) {
    throw new Error("Pass --base-url or set NEWS_COVERAGE_BASE_URL.");
  }

  const stateSlugs = new Set(
    (values.get("state") || [])
      .flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  return {
    baseUrl: baseUrl.replace(/\/+$/g, ""),
    outputDir: path.resolve(option(values, "output-dir") || "coverage/county-news-production"),
    limit: positiveInteger(option(values, "limit"), 50, "limit"),
    concurrency: positiveInteger(option(values, "concurrency"), 3, "concurrency"),
    requestTimeoutMs: positiveInteger(
      option(values, "request-timeout-ms"),
      90_000,
      "request-timeout-ms",
    ),
    retries: nonNegativeInteger(option(values, "retries"), 2, "retries"),
    requestStartIntervalMs: nonNegativeInteger(
      option(values, "request-start-interval-ms"),
      250,
      "request-start-interval-ms",
    ),
    sampleSize: nonNegativeInteger(option(values, "sample-size"), 3, "sample-size"),
    progressEvery: positiveInteger(option(values, "progress-every"), 25, "progress-every"),
    fresh: flags.has("fresh"),
    stateSlugs,
    maxCounties: optionalPositiveInteger(option(values, "max-counties"), "max-counties"),
  };
}

function option(values: Map<string, string[]>, name: string) {
  return values.get(name)?.at(-1);
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value: string | undefined, fallback: number, name: string) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return parsed;
}

function optionalPositiveInteger(value: string | undefined, name: string) {
  if (value === undefined) return undefined;
  return positiveInteger(value, 1, name);
}

function buildRoster(options: AuditOptions) {
  const unknownStates = [...options.stateSlugs].filter(
    (slug) => !states.some((state) => state.slug === slug),
  );
  if (unknownStates.length) {
    throw new Error(`Unknown state slug(s): ${unknownStates.join(", ")}`);
  }

  const counties = states
    .filter((state) => !options.stateSlugs.size || options.stateSlugs.has(state.slug))
    .flatMap((state) =>
      getCountyByState(state.name).map((county: UsCounty) => {
        const countySlug = slugify(county.name);
        return {
          key: `${state.slug}/${countySlug}`,
          fips: county.FIPS,
          state: state.name,
          stateAbbr: state.abbr,
          stateSlug: state.slug,
          county: county.name,
          countySlug,
        } satisfies CountyTarget;
      }),
    )
    .sort((a, b) => a.fips.localeCompare(b.fips));

  return options.maxCounties ? counties.slice(0, options.maxCounties) : counties;
}

async function readCheckpoint(checkpointPath: string) {
  const rows = new Map<string, CountyCoverageRow>();
  let contents: string;
  try {
    contents = await readFile(checkpointPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return rows;
    throw error;
  }

  for (const line of contents.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as CountyCoverageRow;
      if (row.key) rows.set(row.key, row);
    } catch {
      console.warn("checkpoint_warning ignored_malformed_line=true");
    }
  }
  return rows;
}

async function runWorker(workerIndex: number, next: () => Promise<boolean>) {
  while (await next()) {
    // Keep each worker alive until the shared queue is exhausted.
  }
  console.log(`audit_worker_complete worker=${workerIndex + 1}`);
}

function createRateGate(intervalMs: number) {
  let gate = Promise.resolve();
  let nextStartMs = Date.now();

  return async () => {
    let release = () => {};
    const previous = gate;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const waitMs = Math.max(0, nextStartMs - Date.now());
    if (waitMs) await delay(waitMs);
    nextStartMs = Date.now() + intervalMs;
    release();
  };
}

async function auditCounty(county: CountyTarget, options: AuditOptions): Promise<CountyCoverageRow> {
  const endpoint = `${options.baseUrl}/v1/feeds/counties/${county.stateSlug}/${county.countySlug}/general?limit=${options.limit}`;
  const requestStartedMs = Date.now();
  let attempts = 0;
  let lastError: unknown;

  while (attempts <= options.retries) {
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        headers: {
          accept: "application/json",
          "user-agent": "TheCountyPost-CoverageAudit/1.0",
        },
        signal: controller.signal,
      });
      const body = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
        if (shouldRetryStatus(response.status) && attempts <= options.retries) {
          await retryDelay(attempts, response.headers.get("retry-after"));
          continue;
        }
        return errorRow(
          county,
          endpoint,
          "http-error",
          requestStartedMs,
          attempts,
          lastError,
          response.status,
        );
      }

      let payload: FeedPayload;
      try {
        payload = JSON.parse(body) as FeedPayload;
      } catch (error) {
        if (attempts <= options.retries) {
          lastError = error;
          await retryDelay(attempts);
          continue;
        }
        return errorRow(
          county,
          endpoint,
          "invalid-response",
          requestStartedMs,
          attempts,
          error,
          response.status,
        );
      }

      if (!Array.isArray(payload.items)) {
        if (attempts <= options.retries) {
          lastError = new Error("Response did not contain an items array.");
          await retryDelay(attempts);
          continue;
        }
        return errorRow(
          county,
          endpoint,
          "invalid-response",
          requestStartedMs,
          attempts,
          new Error("Response did not contain an items array."),
          response.status,
        );
      }

      return analyzePayload(
        county,
        endpoint,
        payload,
        requestStartedMs,
        attempts,
        response.status,
        options,
      );
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempts <= options.retries) {
        await retryDelay(attempts);
        continue;
      }
    }
  }

  return errorRow(
    county,
    endpoint,
    "network-error",
    requestStartedMs,
    attempts,
    lastError || new Error("Unknown request error."),
  );
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function retryDelay(attempt: number, retryAfter: string | null = null) {
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;
  const exponentialMs = Math.min(15_000, 750 * 2 ** (attempt - 1));
  await delay(Math.max(retryAfterMs, exponentialMs) + Math.floor(Math.random() * 250));
}

function analyzePayload(
  county: CountyTarget,
  endpoint: string,
  payload: FeedPayload,
  requestStartedMs: number,
  attempts: number,
  httpStatus: number,
  options: AuditOptions,
): CountyCoverageRow {
  const auditedAt = new Date();
  const rawItems = payload.items as FeedItem[];
  const validItems = rawItems.map(normalizeItem);
  const articleCount = validItems.length;
  const metaCount = finiteNumber(payload.meta?.count);
  const sourcesUsed = stringArray(payload.meta?.sourcesUsed);
  const publisherCounts = countPublishers(validItems);
  const dominant = publisherCounts[0];
  const dates = validItems
    .map((item) => parseDate(item.publishedAt))
    .filter((value): value is number => value !== undefined);
  const nowMs = auditedAt.getTime();
  const ages = dates.map((date) => (nowMs - date) / DAY_MS);
  const titleKeys = validItems
    .map((item) => normalizeTitle(item.title, item.source))
    .filter(Boolean);
  const urlKeys = validItems.map((item) => canonicalUrl(item.link)).filter(Boolean);
  const directSources = sourcesUsed.filter((source) => source.startsWith("direct:"));

  return {
    ...county,
    status: "ok",
    endpoint,
    auditedAt: auditedAt.toISOString(),
    attempts,
    httpStatus,
    responseMs: Date.now() - requestStartedMs,
    articleCount,
    metaCount,
    metaCountMismatch: metaCount !== undefined && metaCount !== articleCount,
    coverageBand: coverageBand(articleCount, options.limit),
    targetFillPercent: round(percent(articleCount, options.limit), 1),
    uniquePublishers: publisherCounts.length,
    dominantPublisher: dominant?.publisher,
    dominantPublisherCount: dominant?.count || 0,
    dominantPublisherShare: round(percent(dominant?.count || 0, articleCount), 1),
    topPublishers: publisherCounts.slice(0, 5),
    publishedWithin14Days: ages.filter((age) => age >= -1 && age <= 14).length,
    publishedWithin30Days: ages.filter((age) => age >= -1 && age <= 30).length,
    publishedWithin90Days: ages.filter((age) => age >= -1 && age <= 90).length,
    olderThan183Days: ages.filter((age) => age > 183).length,
    missingPublishedAt: articleCount - dates.length,
    futurePublishedAt: ages.filter((age) => age < -1).length,
    newestPublishedAt: dates.length ? new Date(Math.max(...dates)).toISOString() : undefined,
    oldestPublishedAt: dates.length ? new Date(Math.min(...dates)).toISOString() : undefined,
    missingImages: validItems.filter((item) => !item.imageUrl).length,
    exactDuplicateTitles: duplicateCount(titleKeys),
    duplicateCanonicalUrls: duplicateCount(urlKeys),
    invalidArticles: validItems.filter((item) => !item.title || !item.link).length,
    primaryTierUsed: sourcesUsed.includes("county:primary"),
    marketTierUsed: sourcesUsed.includes("county:market"),
    nearbyTierUsed: sourcesUsed.includes("county:fallback-nearby"),
    localSourceSearchUsed: sourcesUsed.includes("county:local-source-search"),
    publisherDiversityExpansionUsed: sourcesUsed.includes("county:publisher-diversity"),
    publisherBalanceUsed: sourcesUsed.includes("county:publisher-balanced"),
    directSourceCount: directSources.length,
    sourcesUsed,
    samples: validItems.slice(0, options.sampleSize).map((item) => ({
      title: item.title,
      link: item.link,
      source: item.source || undefined,
      publishedAt: item.publishedAt || undefined,
    })),
  };
}

function normalizeItem(item: FeedItem): Required<Pick<SampleArticle, "title" | "link">> &
  Pick<SampleArticle, "source" | "publishedAt"> & { imageUrl?: string } {
  return {
    title: stringValue(item?.title),
    link: stringValue(item?.link),
    source: optionalString(item?.source),
    publishedAt: optionalString(item?.publishedAt),
    imageUrl: optionalString(item?.imageUrl),
  };
}

function errorRow(
  county: CountyTarget,
  endpoint: string,
  status: Exclude<CoverageStatus, "ok">,
  requestStartedMs: number,
  attempts: number,
  error: unknown,
  httpStatus?: number,
): CountyCoverageRow {
  return {
    ...county,
    status,
    endpoint,
    auditedAt: new Date().toISOString(),
    attempts,
    httpStatus,
    responseMs: Date.now() - requestStartedMs,
    articleCount: 0,
    metaCountMismatch: false,
    coverageBand: "empty",
    targetFillPercent: 0,
    uniquePublishers: 0,
    dominantPublisherCount: 0,
    dominantPublisherShare: 0,
    topPublishers: [],
    publishedWithin14Days: 0,
    publishedWithin30Days: 0,
    publishedWithin90Days: 0,
    olderThan183Days: 0,
    missingPublishedAt: 0,
    futurePublishedAt: 0,
    missingImages: 0,
    exactDuplicateTitles: 0,
    duplicateCanonicalUrls: 0,
    invalidArticles: 0,
    primaryTierUsed: false,
    marketTierUsed: false,
    nearbyTierUsed: false,
    localSourceSearchUsed: false,
    publisherDiversityExpansionUsed: false,
    publisherBalanceUsed: false,
    directSourceCount: 0,
    sourcesUsed: [],
    samples: [],
    error: errorMessage(error),
  };
}

function buildReport(
  rows: CountyCoverageRow[],
  rosterCount: number,
  options: AuditOptions,
  startedAt: Date,
  finishedAt: Date,
) {
  const successful = rows.filter((row) => row.status === "ok");
  const articleCounts = successful.map((row) => row.articleCount);
  const stateSummaries = states
    .map((state) => summarizeState(successful, rows, state.slug, options.limit))
    .filter((summary): summary is StateCoverageSummary => Boolean(summary))
    .sort(
      (a, b) =>
        b.below12Count / b.countyCount - a.below12Count / a.countyCount ||
        a.articleCount.mean - b.articleCount.mean,
    );
  const byBand = Object.fromEntries(
    (["empty", "critical", "sparse", "thin", "partial", "target"] as CoverageBand[]).map(
      (band) => [band, successful.filter((row) => row.coverageBand === band).length],
    ),
  );

  return {
    metadata: {
      generatedAt: finishedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      baseUrl: options.baseUrl,
      route: "/v1/feeds/counties/:stateSlug/:countySlug/general",
      targetArticlesPerCounty: options.limit,
      rosterCount,
      completedRowCount: rows.length,
      scope: options.stateSlugs.size ? [...options.stateSlugs] : ["all-directory-counties"],
      methodology: [
        "One deployed general-news feed request per county-equivalent in the frontend directory.",
        "Counts reflect items returned after API locality filtering, deduplication, age filtering, tier expansion, and final slicing.",
        "Publisher is inferred from the article source label, then from the article hostname when the source label is generic or absent.",
        "The audit detects exact normalized-title and canonical-URL duplicates; it does not claim automated editorial verification of every article's locality.",
      ],
      bands: {
        empty: "0 articles",
        critical: "1-4 articles",
        sparse: "5-11 articles (below the API's 12-item expansion threshold)",
        thin: "12-24 articles",
        partial: `25-${Math.max(25, options.limit - 1)} articles`,
        target: `${options.limit}+ articles`,
      },
    },
    summary: {
      rosterCount,
      completedRowCount: rows.length,
      successfulCount: successful.length,
      errorCount: rows.filter((row) => row.status !== "ok").length,
      totalArticlesReturned: sum(articleCounts),
      articleCount: summarizeNumbers(articleCounts),
      byBand,
      emptyCount: successful.filter((row) => row.articleCount === 0).length,
      below12Count: successful.filter((row) => row.articleCount < 12).length,
      below25Count: successful.filter((row) => row.articleCount < 25).length,
      targetCount: successful.filter((row) => row.articleCount >= options.limit).length,
      countiesWithOnePublisher: successful.filter(
        (row) => row.articleCount > 0 && row.uniquePublishers === 1,
      ).length,
      countiesWithDominantPublisherOver50Percent: successful.filter(
        (row) => row.articleCount > 0 && row.dominantPublisherShare > 50,
      ).length,
      averageUniquePublishers: round(
        average(successful.map((row) => row.uniquePublishers)),
        2,
      ),
      countiesUsingMarketTier: successful.filter((row) => row.marketTierUsed).length,
      countiesUsingNearbyTier: successful.filter((row) => row.nearbyTierUsed).length,
      countiesUsingDirectSources: successful.filter((row) => row.directSourceCount > 0).length,
      articlesPublishedWithin14Days: sum(
        successful.map((row) => row.publishedWithin14Days),
      ),
      articlesMissingPublishedAt: sum(successful.map((row) => row.missingPublishedAt)),
      exactDuplicateTitles: sum(successful.map((row) => row.exactDuplicateTitles)),
      duplicateCanonicalUrls: sum(successful.map((row) => row.duplicateCanonicalUrls)),
      invalidArticles: sum(successful.map((row) => row.invalidArticles)),
      metaCountMismatches: successful.filter((row) => row.metaCountMismatch).length,
      stateSummaries,
      sparseCounties: successful
        .filter((row) => row.articleCount < 12)
        .sort((a, b) => a.articleCount - b.articleCount || a.fips.localeCompare(b.fips))
        .map(compactCountyRow),
      errorCounties: rows
        .filter((row) => row.status !== "ok")
        .sort((a, b) => a.fips.localeCompare(b.fips))
        .map(compactCountyRow),
    },
    counties: rows.sort((a, b) => a.fips.localeCompare(b.fips)),
  };
}

function summarizeState(
  successful: CountyCoverageRow[],
  allRows: CountyCoverageRow[],
  stateSlug: string,
  target: number,
): StateCoverageSummary | undefined {
  const rows = allRows.filter((row) => row.stateSlug === stateSlug);
  if (!rows.length) return undefined;
  const ok = successful.filter((row) => row.stateSlug === stateSlug);
  const first = rows[0];

  return {
    state: first.state,
    stateAbbr: first.stateAbbr,
    stateSlug,
    countyCount: rows.length,
    successfulCount: ok.length,
    errorCount: rows.length - ok.length,
    articleCount: summarizeNumbers(ok.map((row) => row.articleCount)),
    emptyCount: ok.filter((row) => row.articleCount === 0).length,
    below12Count: ok.filter((row) => row.articleCount < 12).length,
    below25Count: ok.filter((row) => row.articleCount < 25).length,
    targetCount: ok.filter((row) => row.articleCount >= target).length,
    averageUniquePublishers: round(average(ok.map((row) => row.uniquePublishers)), 2),
    marketTierRate: round(percent(ok.filter((row) => row.marketTierUsed).length, ok.length), 1),
    nearbyTierRate: round(percent(ok.filter((row) => row.nearbyTierUsed).length, ok.length), 1),
  };
}

function compactCountyRow(row: CountyCoverageRow) {
  return {
    fips: row.fips,
    county: row.county,
    countySlug: row.countySlug,
    state: row.state,
    stateAbbr: row.stateAbbr,
    stateSlug: row.stateSlug,
    status: row.status,
    articleCount: row.articleCount,
    uniquePublishers: row.uniquePublishers,
    dominantPublisher: row.dominantPublisher,
    dominantPublisherShare: row.dominantPublisherShare,
    marketTierUsed: row.marketTierUsed,
    nearbyTierUsed: row.nearbyTierUsed,
    directSourceCount: row.directSourceCount,
    error: row.error,
  };
}

function toCsv(rows: CountyCoverageRow[]) {
  const headers = [
    "fips",
    "state",
    "state_abbr",
    "state_slug",
    "county",
    "county_slug",
    "status",
    "article_count",
    "coverage_band",
    "target_fill_percent",
    "unique_publishers",
    "dominant_publisher",
    "dominant_publisher_count",
    "dominant_publisher_share",
    "published_within_14_days",
    "published_within_30_days",
    "published_within_90_days",
    "older_than_183_days",
    "missing_published_at",
    "missing_images",
    "exact_duplicate_titles",
    "duplicate_canonical_urls",
    "invalid_articles",
    "market_tier_used",
    "nearby_tier_used",
    "direct_source_count",
    "response_ms",
    "attempts",
    "http_status",
    "error",
    "sample_titles",
  ];
  const body = rows.map((row) =>
    [
      row.fips,
      row.state,
      row.stateAbbr,
      row.stateSlug,
      row.county,
      row.countySlug,
      row.status,
      row.articleCount,
      row.coverageBand,
      row.targetFillPercent,
      row.uniquePublishers,
      row.dominantPublisher || "",
      row.dominantPublisherCount,
      row.dominantPublisherShare,
      row.publishedWithin14Days,
      row.publishedWithin30Days,
      row.publishedWithin90Days,
      row.olderThan183Days,
      row.missingPublishedAt,
      row.missingImages,
      row.exactDuplicateTitles,
      row.duplicateCanonicalUrls,
      row.invalidArticles,
      row.marketTierUsed,
      row.nearbyTierUsed,
      row.directSourceCount,
      row.responseMs,
      row.attempts,
      row.httpStatus || "",
      row.error || "",
      row.samples.map((sample) => sample.title).join(" | "),
    ]
      .map(csvCell)
      .join(","),
  );

  return `${headers.join(",")}\n${body.join("\n")}\n`;
}

function countPublishers(items: ReturnType<typeof normalizeItem>[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const publisher = publisherKey(item);
    counts.set(publisher, (counts.get(publisher) || 0) + 1);
  }
  return [...counts]
    .map(([publisher, count]) => ({ publisher, count }))
    .sort((a, b) => b.count - a.count || a.publisher.localeCompare(b.publisher));
}

function publisherKey(item: ReturnType<typeof normalizeItem>) {
  const source = item.source?.trim();
  const targetHostname = bingTargetHostname(item.link);
  if (targetHostname) return targetHostname;
  if (
    source &&
    !/^(google news|bing news|news|rss)$/i.test(source) &&
    !/bingnews$/i.test(source) &&
    !source.startsWith("(") &&
    !source.startsWith('"')
  ) {
    return source;
  }
  try {
    return new URL(item.link).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return source || "unknown";
  }
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("bing.com") && url.pathname.endsWith("/news/apiclick.aspx")) {
      const targetUrl = url.searchParams.get("url");
      if (targetUrl) return canonicalUrl(targetUrl);
    }
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/g, "") || "/";
    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function bingTargetHostname(value: string) {
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith("bing.com") || !url.pathname.endsWith("/news/apiclick.aspx")) {
      return undefined;
    }
    const targetUrl = url.searchParams.get("url");
    return targetUrl
      ? new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, "")
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeTitle(value: string, source?: string) {
  const sourceSuffix = source ? ` - ${source}`.toLowerCase() : "";
  const withoutSource =
    sourceSuffix && value.toLowerCase().endsWith(sourceSuffix)
      ? value.slice(0, -sourceSuffix.length)
      : value;
  const headline = withoutSource.split(/\s[-–—]\s/)[0] || withoutSource;
  return headline
    .toLowerCase()
    .replace(/&(?:amp|#38);/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function duplicateCount(keys: string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
  return sum([...counts.values()].map((count) => Math.max(0, count - 1)));
}

function coverageBand(count: number, target: number): CoverageBand {
  if (count === 0) return "empty";
  if (count < 5) return "critical";
  if (count < 12) return "sparse";
  if (count < 25) return "thin";
  if (count < target) return "partial";
  return "target";
}

function summarizeNumbers(values: number[]): NumericSummary {
  if (!values.length) {
    return { mean: 0, median: 0, p25: 0, p75: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: round(average(sorted), 2),
    median: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    min: sorted[0],
    max: sorted.at(-1) || 0,
  };
}

function percentile(sorted: number[], fraction: number) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower), 2);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown) {
  const string = stringValue(value);
  return string || undefined;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "Request timed out." : error.message;
  }
  return String(error);
}

function csvCell(value: unknown) {
  const string = String(value ?? "");
  return /[",\n\r]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function percent(numerator: number, denominator: number) {
  return denominator ? (numerator / denominator) * 100 : 0;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}m`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
