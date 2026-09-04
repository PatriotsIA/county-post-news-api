/**
 * Stage 2 of county outlet discovery: turn observed publishers into usable feeds.
 *
 * Reads the discovery checkpoint, works out which hosts are county-native and
 * which are regional, then looks for a working RSS or Atom feed on each and
 * checks that it actually carries recent local coverage.
 *
 * The native/regional split is the point of the whole exercise. A county-native
 * source bypasses the locality filter entirely, which is right for the Mena
 * Star — it only ever writes about Polk County — and badly wrong for KLTV,
 * which covers twenty East Texas counties and would flood any one of them. The
 * signal that separates them is how many counties a host was observed in.
 *
 *   npm run probe:sources
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchRssItems } from "../../src/rss.js";
import { EXCLUDED_PUBLISHER_HOSTS } from "./shared.js";
import type { CountyDiscovery, ProbedFeed, ProbedHost } from "./shared.js";

const DEFAULT_OUTPUT = path.resolve("scripts/discover-sources/.out");

/**
 * A host seen in more counties than this covers a region, not a county. Set
 * from the observed shape of the data: county weeklies appear for one or two
 * neighbouring counties, regional television for a dozen or more.
 */
const MAX_COUNTIES_FOR_NATIVE = 3;

/** Below this a host is noise — one incidental mention, not a beat. */
const MIN_LOCAL_ITEMS = 3;

/** Feed paths worth trying when a page advertises none. */
const FEED_PATHS = [
  "/feed/",
  "/rss",
  "/rss.xml",
  "/feed.xml",
  "/index.xml",
  "/atom.xml",
  "/?feed=rss2",
  "/feeds/all.rss",
  "/arc/outboundfeeds/rss/?outputType=xml",
  // Section feeds. Local newsrooms very often publish these and nothing at the
  // site root — myhighplains.com serves /news/feed/ and no homepage feed at all.
  "/news/feed/",
  "/news/local/feed/",
  "/local-news/feed/",
  "/local/feed/",
  "/category/news/feed/",
  "/category/local-news/feed/",
  "/news/rss",
  "/news/rss.xml",
  "/feeds/syndication/rss/news",
  "/rss/local",
  "/rss/news",
];

const RECENT_DAYS = 120;
const USER_AGENT = "TheCountyPost source discovery (contact@thecountypost.com)";

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(options.outputDir, { recursive: true });

  const discoveries = await readDiscoveries(path.join(options.outputDir, "discovered.jsonl"));
  if (!discoveries.length) throw new Error("No discovery checkpoint found. Run discover:sources first.");

  const hosts = aggregateHosts(discoveries);
  const candidates = [...hosts.values()]
    .filter((host) => host.totalLocal >= MIN_LOCAL_ITEMS && !EXCLUDED_PUBLISHER_HOSTS.has(host.host))
    .sort((left, right) => right.totalLocal - left.totalLocal);

  console.log(
    `${discoveries.length} counties, ${hosts.size} hosts observed, ${candidates.length} worth probing ` +
      `(>= ${MIN_LOCAL_ITEMS} local items).`,
  );

  const results: ProbedHost[] = [];
  const queue = [...candidates];
  let done = 0;

  const workers = Array.from({ length: Math.max(1, options.concurrency) }, async () => {
    for (;;) {
      const candidate = queue.shift();
      if (!candidate) return;
      const probed = await probeHost(candidate);
      results.push(probed);
      done += 1;
      const feeds = probed.feeds.length ? `${probed.feeds.length} feed(s)` : probed.status;
      console.log(`[${done}/${candidates.length}] ${candidate.host}: ${feeds} (${candidate.counties.length} counties)`);
    }
  });
  await Promise.all(workers);

  const output = path.join(options.outputDir, "probed.json");
  results.sort((left, right) => right.feeds.length - left.feeds.length || left.host.localeCompare(right.host));
  await writeFile(output, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const withFeeds = results.filter((host) => host.feeds.length);
  const native = withFeeds.filter((host) => host.counties.length <= MAX_COUNTIES_FOR_NATIVE);
  console.log(
    `\n${withFeeds.length} hosts have a working feed; ${native.length} of those look county-native ` +
      `(<= ${MAX_COUNTIES_FOR_NATIVE} counties).\nWrote ${output}`,
  );
}

type HostAggregate = {
  host: string;
  publisher: string;
  totalLocal: number;
  /** county key -> local item count, strongest first when read back out. */
  counties: string[];
  localByCounty: Record<string, number>;
  topics: Record<string, number>;
};

function aggregateHosts(discoveries: CountyDiscovery[]) {
  const hosts = new Map<string, HostAggregate>();

  for (const discovery of discoveries) {
    for (const publisher of discovery.publishers) {
      const entry = hosts.get(publisher.host) ?? {
        host: publisher.host,
        publisher: publisher.publisher,
        totalLocal: 0,
        counties: [],
        localByCounty: {},
        topics: {},
      };
      entry.totalLocal += publisher.localItems;
      entry.localByCounty[discovery.key] = (entry.localByCounty[discovery.key] ?? 0) + publisher.localItems;
      for (const [topic, count] of Object.entries(publisher.localByTopic ?? {})) {
        entry.topics[topic] = (entry.topics[topic] ?? 0) + count;
      }
      // Prefer a real masthead over a bare hostname when both were seen.
      if (entry.publisher === entry.host && publisher.publisher !== publisher.host) {
        entry.publisher = publisher.publisher;
      }
      hosts.set(publisher.host, entry);
    }
  }

  for (const entry of hosts.values()) {
    entry.counties = Object.entries(entry.localByCounty)
      .sort(([, left], [, right]) => right - left)
      .map(([key]) => key);
  }

  return hosts;
}

async function probeHost(candidate: HostAggregate): Promise<ProbedHost> {
  const websiteUrl = `https://${candidate.host}/`;
  const base: Omit<ProbedHost, "status" | "feeds"> = {
    host: candidate.host,
    publisher: candidate.publisher,
    websiteUrl,
    counties: candidate.counties,
    probedAt: new Date().toISOString(),
  };

  // A homepage that blocks us says nothing about whether the site has a feed:
  // myhighplains.com refused the request while serving a perfectly good
  // /news/feed/ the registry was already using. Failure here only costs us the
  // advertised links; the known paths are still worth trying.
  let advertised: string[] = [];
  let note: string | undefined;
  try {
    advertised = await advertisedFeeds(websiteUrl);
  } catch (error) {
    note = `homepage unreachable: ${String(error).slice(0, 90)}`;
  }

  // Advertised feeds first: a page that declares its own feed is more reliable
  // than a guessed path, which often returns a themed 200 that parses as empty.
  const seen = new Set<string>();
  const urls = [...advertised, ...FEED_PATHS.map((suffix) => new URL(suffix, websiteUrl).toString())].filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  const feeds: ProbedFeed[] = [];
  for (const url of urls.slice(0, 24)) {
    const feed = await validateFeed(url);
    if (feed) feeds.push(feed);
    if (feeds.length >= 3) break;
  }

  if (!feeds.length) return { ...base, status: note ? "unreachable" : "no-feed", feeds: [], note };
  return { ...base, status: "ok", feeds, note };
}

async function advertisedFeeds(websiteUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(websiteUrl, { signal: controller.signal, headers: { "user-agent": USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = (await response.text()).slice(0, 400_000);

    const links = [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter((match) => /rel=["']?alternate/i.test(match[0]) && /application\/(rss|atom)\+xml/i.test(match[0]))
      .map((match) => match[0].match(/href=["']([^"']+)["']/i)?.[1])
      .filter((href): href is string => Boolean(href))
      .map(decodeHtmlEntities);

    return links.map((href) => new URL(href, websiteUrl).toString());
  } finally {
    clearTimeout(timeout);
  }
}

/** Feed hrefs come out of HTML, so their entities are still encoded. */
function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

async function validateFeed(url: string): Promise<ProbedFeed | undefined> {
  try {
    const items = await fetchRssItems(url);
    if (items.length < 3) return undefined;

    const cutoff = Date.now() - RECENT_DAYS * 86_400_000;
    const recentItems = items.filter((item) => {
      const published = item.publishedAt ? Date.parse(item.publishedAt) : Number.NaN;
      return Number.isFinite(published) && published >= cutoff;
    }).length;
    // A feed frozen years ago is worse than none: it would pin stale stories to
    // the top of a county desk that is already short of coverage.
    if (!recentItems) return undefined;

    return { url, items: items.length, recentItems, localItems: 0 };
  } catch {
    return undefined;
  }
}

type ProbeOptions = { outputDir: string; concurrency: number };

function parseOptions(argv: string[]): ProbeOptions {
  const options: ProbeOptions = { outputDir: DEFAULT_OUTPUT, concurrency: 6 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (argv[index] === "--concurrency" && value) {
      options.concurrency = Number(value);
      index += 1;
    }
  }
  return options;
}

async function readDiscoveries(checkpoint: string): Promise<CountyDiscovery[]> {
  try {
    const contents = await readFile(checkpoint, "utf8");
    return contents.split("\n").filter(Boolean).map((line) => JSON.parse(line) as CountyDiscovery);
  } catch {
    return [];
  }
}

await main();
