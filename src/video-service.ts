import { XMLParser } from "fast-xml-parser";
import { cachedShared } from "./cache.js";
import { config } from "./config.js";

/**
 * Featured news video for the site-wide video desk: recent uploads from ITM
 * Trading's YouTube channel and Patriots in Action TV's Vimeo channel, plus
 * whichever of them is streaming live right now.
 *
 * Recent uploads come from each channel's public feed and change slowly. Live
 * status is checked on a much shorter clock so the desk can open when a stream
 * starts. Both are stored in the shared cache, so readers never wait on the
 * channels and the channels see about one request per interval in total.
 *
 * While neither channel is live, a stand-in news stream fills the live slot
 * (see STANDBY). It never opens the desk on its own.
 */

export type VideoPlatform = "youtube" | "vimeo";

export type FeaturedChannel = {
  id: string;
  name: string;
  platform: VideoPlatform;
  url: string;
};

export type FeaturedVideo = {
  id: string;
  channelId: string;
  platform: VideoPlatform;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  watchUrl: string;
  /** Plays on request, so it starts with sound. */
  embedUrl: string;
  durationSeconds?: number;
};

export type LiveStream = {
  channelId: string;
  platform: VideoPlatform;
  videoId: string;
  title?: string;
  startedAt?: string;
  watchUrl: string;
  /** Starts muted: the desk opens to it without a reader asking. */
  embedUrl: string;
};

/** Live news shown in the live slot while none of the featured channels is on the air. */
export type StandbyStream = { channel: FeaturedChannel; stream: LiveStream };

export type FeaturedVideosResponse = {
  channels: FeaturedChannel[];
  videos: FeaturedVideo[];
  live: LiveStream[];
  /** Present only while `live` is empty. */
  standby?: StandbyStream;
  fetchedAt: string;
  /** Live checks that could not run, such as Vimeo without an access token. */
  liveUnchecked: string[];
  partial?: boolean;
  stale?: boolean;
};

type RecentVideos = { videos: FeaturedVideo[]; fetchedAt: string; partial?: boolean; stale?: boolean };
type LiveStatus = { live: LiveStream[]; liveUnchecked: string[]; checkedAt: string };
type StandbyStatus = { stream: LiveStream | null; checkedAt: string; failed?: boolean };

const ITM = { id: "itm-trading", name: "ITM Trading", platform: "youtube", url: "https://www.youtube.com/@ITMTrading" } as const;
const PIA_TV = { id: "patriots-in-action-tv", name: "Patriots in Action TV", platform: "vimeo", url: "https://vimeo.com/patriotsinactiontv" } as const;
const ITM_YOUTUBE_CHANNEL_ID = "UCom1i7_NVeSUNyJyuR_NbMQ";
const PIA_VIMEO_USER = "patriotsinactiontv";

export const featuredChannels: FeaturedChannel[] = [ITM, PIA_TV];

/**
 * The stand-in until The County Post streams its own: Newsmax's free NEWSMAX2
 * channel, on the air around the clock. Newsmax's /live page points at
 * whichever show it is featuring, so NEWSMAX2 is picked from the channel's
 * Live tab by title, then confirmed on its own page.
 */
const STANDBY = { id: "newsmax2", name: "Newsmax2", platform: "youtube", url: "https://www.youtube.com/@NewsmaxTV" } as const;
const STANDBY_YOUTUBE_CHANNEL_ID = "UCx6h-dWzJ5NpAlja1YsApdg";
const STANDBY_TITLE = /\bNEWSMAX\s*2\b/i;

const VIDEOS_PER_CHANNEL = 8;
const USER_AGENT = "Mozilla/5.0 (compatible; TheCountyPost/1.0; +https://thecountypost.com)";
// Keep tag values as text: an all-digit video ID or title must not become a number.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false });

export class VideoServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "VideoServiceError";
  }
}

export async function getFeaturedVideos(): Promise<FeaturedVideosResponse> {
  const [recent, live, standby] = await Promise.allSettled([getRecentVideos(), getLiveStatus(), getStandbyStatus()]);
  if (recent.status === "rejected") logFailure("videos.recent_failed", recent.reason);
  if (standby.status === "rejected") logFailure("videos.standby_check_failed", standby.reason, STANDBY.id);
  const videos = recent.status === "fulfilled" ? recent.value : undefined;
  const status = live.status === "fulfilled" ? live.value : { live: [], liveUnchecked: featuredChannels.map((channel) => channel.id) };
  const standbyStream = !status.live.length && standby.status === "fulfilled" ? standby.value.stream : null;
  return {
    channels: featuredChannels,
    videos: videos?.videos ?? [],
    live: status.live,
    ...(standbyStream ? { standby: { channel: STANDBY, stream: standbyStream } } : {}),
    liveUnchecked: status.liveUnchecked,
    fetchedAt: videos?.fetchedAt ?? new Date().toISOString(),
    ...(!videos || videos.partial ? { partial: true } : {}),
    ...(videos?.stale ? { stale: true } : {}),
  };
}

function getRecentVideos() {
  return cachedShared<RecentVideos>("videos:featured:recent", config.videoFeedTtlSeconds, async () => {
    const feeds = await Promise.allSettled([fetchYouTubeUploads(), fetchVimeoUploads()]);
    feeds.forEach((feed, index) => {
      if (feed.status === "rejected") logFailure("videos.feed_failed", feed.reason, featuredChannels[index].id);
    });
    const lists = feeds.map((feed) => (feed.status === "fulfilled" ? feed.value : []));
    if (!lists.some((list) => list.length)) throw new VideoServiceError(502, "Featured video channels are unavailable.");
    return { videos: interleave(lists), fetchedAt: new Date().toISOString(), partial: lists.some((list) => !list.length) };
  }, {
    revalidate: true,
    staleTtlSeconds: 86400,
    staleIfError: (previous) => ({ ...previous, stale: true }),
    // Keep a complete list rather than replace it with one missing a channel.
    shouldReplace: (before, after) => !(after as RecentVideos).partial || Boolean((before as RecentVideos).partial),
    ttlForValue: (value) => (value.partial ? 120 : config.videoFeedTtlSeconds),
  });
}

function getLiveStatus() {
  return cachedShared<LiveStatus>("videos:featured:live", config.videoLiveTtlSeconds, async () => {
    const checks = await Promise.allSettled([findYouTubeLive(), findVimeoLive()]);
    const live: LiveStream[] = [];
    const liveUnchecked: string[] = [];
    checks.forEach((check, index) => {
      const channelId = featuredChannels[index].id;
      if (check.status === "rejected") {
        logFailure("videos.live_check_failed", check.reason, channelId);
        liveUnchecked.push(channelId);
      } else if (check.value === "unchecked") {
        liveUnchecked.push(channelId);
      } else if (check.value) {
        live.push(check.value);
      }
    });
    return { live, liveUnchecked, checkedAt: new Date().toISOString() };
  }, { revalidate: true, staleTtlSeconds: 300 });
}

/** Checked less often than the featured channels: the stand-in only fills the slot, it never opens the desk. */
function getStandbyStatus() {
  return cachedShared<StandbyStatus>("videos:standby:live", config.videoStandbyTtlSeconds, async () => {
    try {
      return { stream: await findStandbyLive(), checkedAt: new Date().toISOString() };
    } catch (error) {
      logFailure("videos.standby_check_failed", error, STANDBY.id);
      return { stream: null, checkedAt: new Date().toISOString(), failed: true };
    }
  }, {
    revalidate: true,
    staleTtlSeconds: 1800,
    // A failed check keeps the last stream found (for up to half an hour) and is retried after a minute.
    shouldReplace: (before, after) => !(after as StandbyStatus).failed || Boolean((before as StandbyStatus).failed),
    ttlForValue: (value) => (value.failed ? 60 : config.videoStandbyTtlSeconds),
  });
}

/* YouTube --------------------------------------------------------------- */

async function fetchYouTubeUploads(): Promise<FeaturedVideo[]> {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${ITM_YOUTUBE_CHANNEL_ID}`);
  return parseYouTubeFeed(xml).slice(0, VIDEOS_PER_CHANNEL);
}

export function parseYouTubeFeed(xml: string, channelId: string = ITM.id): FeaturedVideo[] {
  const document = parser.parse(xml) as { feed?: { entry?: unknown } };
  if (!document.feed) throw new Error("Response is not a YouTube channel feed");
  return asArray(document.feed.entry).flatMap((raw) => {
    const entry = raw as Record<string, unknown>;
    const id = text(entry["yt:videoId"]);
    if (!/^[\w-]{11}$/.test(id)) return [];
    return [{
      id,
      channelId,
      platform: "youtube" as const,
      title: text(entry.title) || "Untitled video",
      publishedAt: isoDate(text(entry.published)),
      // hqdefault always exists; the desk crops its letterbox to 16:9.
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: youTubeEmbed(id, { autoplay: true }),
    }];
  });
}

async function findYouTubeLive(): Promise<LiveStream | null> {
  return parseYouTubeLivePage(await fetchText(`https://www.youtube.com/channel/${ITM_YOUTUBE_CHANNEL_ID}/live`));
}

/**
 * A channel's /live page shows its current broadcast, or its channel page when
 * nothing is on. A scheduled stream also takes over the page before it starts,
 * so only a broadcast on the air now counts: `isLiveNow` in its broadcast
 * details, or the player's own `isLive`, which some live pages carry alone.
 * The same holds for a stream's watch page.
 */
export function parseYouTubeLivePage(html: string, channelId: string = ITM.id): LiveStream | null {
  const videoId = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
  if (!videoId) return null;
  const details = html.match(/"liveBroadcastDetails":\{([^}]*)\}/)?.[1] ?? "";
  const onAir = /"isLiveNow":true/.test(details) || new RegExp(`"videoDetails":\\{"videoId":"${videoId}"[^{}]*"isLive":true`).test(html);
  // A stream whose owner has turned embedding off cannot play on the site.
  if (!onAir || /"playableInEmbed":false/.test(html)) return null;
  const title = html.match(/<meta name="title" content="([^"]*)"/)?.[1];
  return {
    channelId,
    platform: "youtube",
    videoId,
    title: title ? decodeHtml(title) : undefined,
    startedAt: isoDate(details.match(/"startTimestamp":"([^"]+)"/)?.[1]),
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: youTubeEmbed(videoId, { autoplay: true, muted: true }),
  };
}

async function findStandbyLive(): Promise<LiveStream | null> {
  const tab = await fetchText(`https://www.youtube.com/channel/${STANDBY_YOUTUBE_CHANNEL_ID}/streams`);
  for (const videoId of parseYouTubeLiveTab(tab, STANDBY_TITLE).slice(0, 2)) {
    const stream = parseYouTubeLivePage(await fetchText(`https://www.youtube.com/watch?v=${videoId}`), STANDBY.id);
    if (stream?.videoId === videoId) return stream;
  }
  return null;
}

/**
 * The videos a channel's Live tab marks as on the air now, among those whose
 * titles match. The tab is page markup rather than a feed, so callers confirm
 * each one on the video's own page.
 */
export function parseYouTubeLiveTab(html: string, title: RegExp): string[] {
  const ids: string[] = [];
  for (const card of html.split(/"(?:lockupViewModel|videoRenderer)":\{/).slice(1)) {
    const id = card.match(/"(?:contentId|videoId)":"([\w-]{11})"/)?.[1];
    const name = card.match(/"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/)?.[1]
      ?? card.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)?.[1];
    const onAir = /THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE|BADGE_STYLE_TYPE_LIVE_NOW/.test(card);
    if (id && name && onAir && !ids.includes(id) && title.test(jsonString(name))) ids.push(id);
  }
  return ids;
}

function youTubeEmbed(id: string, { autoplay = false, muted = false }) {
  const params = new URLSearchParams({ rel: "0", playsinline: "1", ...(autoplay ? { autoplay: "1" } : {}), ...(muted ? { mute: "1" } : {}) });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

/* Vimeo ----------------------------------------------------------------- */

async function fetchVimeoUploads(): Promise<FeaturedVideo[]> {
  const xml = await fetchText(`https://vimeo.com/${PIA_VIMEO_USER}/videos/rss`);
  return parseVimeoFeed(xml).slice(0, VIDEOS_PER_CHANNEL);
}

export function parseVimeoFeed(xml: string, channelId: string = PIA_TV.id): FeaturedVideo[] {
  const document = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  if (!document.rss?.channel) throw new Error("Response is not a Vimeo channel feed");
  return asArray(document.rss.channel.item).flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const link = text(item.link);
    const id = link.match(/vimeo\.com\/(\d+)/)?.[1];
    const media = (item["media:content"] ?? {}) as Record<string, unknown>;
    const player = attribute(media["media:player"], "url");
    if (!id || !player.startsWith("https://player.vimeo.com/video/")) return [];
    const duration = Number(attribute(media, "duration"));
    return [{
      id,
      channelId,
      platform: "vimeo" as const,
      title: decodeHtml(text(item.title)) || "Untitled video",
      publishedAt: isoDate(text(item.pubDate)),
      thumbnailUrl: attribute(media["media:thumbnail"], "url") || undefined,
      watchUrl: `https://vimeo.com/${id}`,
      embedUrl: vimeoEmbed(player, { autoplay: true }),
      ...(Number.isFinite(duration) && duration > 0 ? { durationSeconds: duration } : {}),
    }];
  });
}

/**
 * Vimeo publishes no public live signal; its API answers only with an access
 * token. Without one the check is reported as unchecked rather than "not live".
 */
async function findVimeoLive(): Promise<LiveStream | null | "unchecked"> {
  if (!config.vimeoAccessToken) return "unchecked";
  const url = new URL(`https://api.vimeo.com/users/${PIA_VIMEO_USER}/videos`);
  url.searchParams.set("per_page", "10");
  url.searchParams.set("sort", "date");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("fields", "uri,name,link,player_embed_url,created_time,live.status");
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.vimeo.*+json;version=3.4",
      authorization: `bearer ${config.vimeoAccessToken}`,
      "user-agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(config.videoTimeoutMs),
  });
  if (!response.ok) throw new Error(`Vimeo API returned ${response.status}`);
  return parseVimeoLiveVideos(await response.json());
}

type VimeoApiVideo = { uri?: string; name?: string; link?: string; player_embed_url?: string; created_time?: string; live?: { status?: string } };

export function parseVimeoLiveVideos(body: unknown, channelId: string = PIA_TV.id): LiveStream | null {
  const videos = ((body as { data?: VimeoApiVideo[] })?.data ?? []);
  const streaming = videos.find((video) => video.live?.status === "streaming");
  const videoId = streaming?.uri?.match(/\/videos\/(\d+)/)?.[1];
  if (!streaming || !videoId || !streaming.player_embed_url?.startsWith("https://player.vimeo.com/video/")) return null;
  return {
    channelId,
    platform: "vimeo",
    videoId,
    title: streaming.name,
    startedAt: isoDate(streaming.created_time),
    watchUrl: streaming.link || `https://vimeo.com/${videoId}`,
    embedUrl: vimeoEmbed(streaming.player_embed_url, { autoplay: true, muted: true }),
  };
}

function vimeoEmbed(playerUrl: string, { autoplay = false, muted = false }) {
  const url = new URL(playerUrl);
  url.searchParams.set("dnt", "1");
  if (autoplay) url.searchParams.set("autoplay", "1");
  if (muted) url.searchParams.set("muted", "1");
  return url.toString();
}

/* Helpers --------------------------------------------------------------- */

/** Alternate channels so a busy uploader cannot crowd the other off the desk. */
export function interleave<T>(lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, index) => lists.flatMap((list) => (index < list.length ? [list[index]] : []))).flat();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(config.videoTimeoutMs),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.text();
}

/** A JSON string's contents as text: `\u0026` → `&`. */
function jsonString(raw: string) {
  try { return JSON.parse(`"${raw}"`) as string; } catch { return raw; }
}

function asArray(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && "#text" in value) return text((value as { "#text": unknown })["#text"]);
  return "";
}

function attribute(value: unknown, name: string): string {
  const node = Array.isArray(value) ? value[0] : value;
  return node && typeof node === "object" ? text((node as Record<string, unknown>)[`@_${name}`]) : "";
}

function isoDate(value?: string) {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function logFailure(event: string, error: unknown, channelId?: string) {
  console.warn(JSON.stringify({ event, ...(channelId ? { channelId } : {}), error: error instanceof Error ? error.message : String(error) }));
}
