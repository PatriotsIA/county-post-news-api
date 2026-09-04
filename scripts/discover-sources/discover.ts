/**
 * Stage 1 of county outlet discovery: which publishers actually write about a
 * county, observed from raw search results.
 *
 * This deliberately does not audit our own API. The audit reports the
 * publishers behind items that already passed the locality filter, so a county
 * with an empty feed reports no publishers — precisely the counties that need
 * outlets found. Reading the unfiltered search results instead breaks that
 * circularity: the publishers are there, we simply were not trusting them.
 *
 * Writes one JSON line per county so a long run can be resumed.
 *
 *   npm run discover:sources -- --states texas --max-counties 25
 */
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { buildCountyPrimaryPlan } from "../../src/feed-builders.js";
import { getCounty, getCountyLocalPlaces, states } from "../../src/geo.js";
import { textMentionsCounty } from "../../src/filter.js";
import { fetchRssItems } from "../../src/rss.js";
import { getCountyNativeSources } from "../../src/source-registry.js";
import { getCountyByState, slugify } from "./shared.js";
import type { CountyDiscovery, PublisherObservation } from "./shared.js";

const DEFAULT_OUTPUT = path.resolve("scripts/discover-sources/.out");

/** Aggregator and syndication hosts are never a county's local newsroom. */
const NON_PUBLISHER_HOSTS = [
  "google.com",
  "news.google.com",
  "bing.com",
  "msn.com",
  "yahoo.com",
  "news.yahoo.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "youtube.com",
  "apple.news",
  "flipboard.com",
  "newsbreak.com",
  "patch.com",
  "wikipedia.org",
  "gofundme.com",
  "legacy.com",
  "tributearchive.com",
  "dignitymemorial.com",
];

/** National outlets that cover everywhere and belong to nobody's county. */
const NATIONAL_HOSTS = [
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "usatoday.com",
  "cnn.com",
  "foxnews.com",
  "nbcnews.com",
  "abcnews.go.com",
  "cbsnews.com",
  "reuters.com",
  "apnews.com",
  "npr.org",
  "bloomberg.com",
  "forbes.com",
  "newsweek.com",
  "thehill.com",
  "politico.com",
  "breitbart.com",
  "dailymail.co.uk",
  "people.com",
  "espn.com",
  "yardbarker.com",
  "msn.com",
];

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(options.outputDir, { recursive: true });
  const checkpoint = path.join(options.outputDir, "discovered.jsonl");
  if (options.fresh) await rm(checkpoint, { force: true });

  const done = await readCheckpointKeys(checkpoint);
  const roster = buildRoster(options).filter((county) => !done.has(`${county.stateSlug}/${county.countySlug}`));
  console.log(`Discovering publishers for ${roster.length} counties (${done.size} already done).`);

  let index = 0;
  for (const target of roster) {
    index += 1;
    const county = getCounty(target.stateSlug, target.countySlug);
    if (!county) continue;

    try {
      const discovery = await discoverCounty(county, options);
      await appendFile(checkpoint, `${JSON.stringify(discovery)}\n`, "utf8");
      console.log(
        `[${index}/${roster.length}] ${discovery.key}: ${discovery.publishers.length} candidate publishers ` +
          `from ${discovery.itemsSeen} items`,
      );
    } catch (error) {
      console.warn(`[${index}/${roster.length}] ${target.stateSlug}/${target.countySlug} failed: ${String(error)}`);
    }
  }

  console.log(`\nCheckpoint: ${checkpoint}`);
}

async function discoverCounty(
  county: NonNullable<ReturnType<typeof getCounty>>,
  options: DiscoverOptions,
): Promise<CountyDiscovery> {
  const plan = buildCountyPrimaryPlan(county, "general");
  // All of them. Slicing took only the Bing URLs, which yield a handful of
  // items each, while the Google ones return dozens.
  const urls = options.feedsPerCounty ? plan.rssUrls.slice(0, options.feedsPerCounty) : plan.rssUrls;
  const known = new Set(getCountyNativeSources(county).map((source) => hostOf(source.websiteUrl)));

  const observations = new Map<string, PublisherObservation>();
  let itemsSeen = 0;

  const results = await Promise.allSettled(urls.map((url) => fetchRssItems(url)));
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      itemsSeen += 1;
      const host = hostOf(item.link);
      if (!host || isExcludedHost(host) || known.has(host)) continue;

      // Scored with the feed filter's own rule, so an ambiguous town name needs
      // a dateline here too. A plain substring test credited Anderson County,
      // Texas to Fox Carolina because a story mentioned Palestine.
      const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
      const local = textMentionsCounty(haystack, county, county.state);

      const existing = observations.get(host) ?? {
        host,
        publisher: item.source || host,
        items: 0,
        localItems: 0,
        sampleLinks: [],
      };
      existing.items += 1;
      if (local) existing.localItems += 1;
      if (existing.sampleLinks.length < 3) existing.sampleLinks.push(item.link);
      if (!existing.publisher && item.source) existing.publisher = item.source;
      observations.set(host, existing);
    }
  }

  return {
    key: `${county.state.slug}/${county.slug}`,
    stateSlug: county.state.slug,
    countySlug: county.slug,
    countyName: county.name,
    stateName: county.state.name,
    fips: county.fips,
    places: getCountyLocalPlaces(county),
    itemsSeen,
    discoveredAt: new Date().toISOString(),
    publishers: [...observations.values()]
      .filter((observation) => observation.localItems > 0)
      .sort((left, right) => right.localItems - left.localItems || right.items - left.items),
  };
}

function isExcludedHost(host: string) {
  return [...NON_PUBLISHER_HOSTS, ...NATIONAL_HOSTS].some(
    (excluded) => host === excluded || host.endsWith(`.${excluded}`),
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

type DiscoverOptions = {
  outputDir: string;
  stateSlugs: Set<string>;
  maxCounties?: number;
  feedsPerCounty: number;
  fresh: boolean;
};

function parseOptions(argv: string[]): DiscoverOptions {
  const options: DiscoverOptions = {
    outputDir: DEFAULT_OUTPUT,
    stateSlugs: new Set(),
    feedsPerCounty: 0,
    fresh: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--states" && value) {
      value.split(",").map((slug) => slug.trim()).filter(Boolean).forEach((slug) => options.stateSlugs.add(slugify(slug)));
      index += 1;
    } else if (flag === "--max-counties" && value) {
      options.maxCounties = Number(value);
      index += 1;
    } else if (flag === "--feeds-per-county" && value) {
      options.feedsPerCounty = Number(value);
      index += 1;
    } else if (flag === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (flag === "--fresh") {
      options.fresh = true;
    }
  }

  return options;
}

function buildRoster(options: DiscoverOptions) {
  const roster = states
    .filter((state) => !options.stateSlugs.size || options.stateSlugs.has(state.slug))
    .flatMap((state) =>
      getCountyByState(state.name).map((county) => ({
        stateSlug: state.slug,
        countySlug: slugify(county.name),
      })),
    );
  return options.maxCounties ? roster.slice(0, options.maxCounties) : roster;
}

async function readCheckpointKeys(checkpoint: string) {
  try {
    const contents = await readFile(checkpoint, "utf8");
    return new Set(
      contents
        .split("\n")
        .filter(Boolean)
        .map((line) => (JSON.parse(line) as CountyDiscovery).key),
    );
  } catch {
    return new Set<string>();
  }
}

await main();
