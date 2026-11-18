import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearCache } from "../src/cache.js";
import { config } from "../src/config.js";
import { handleRequest } from "../src/http.js";
import { interleave, parseVimeoFeed, parseVimeoLiveVideos, parseYouTubeFeed, parseYouTubeLivePage, parseYouTubeLiveTab } from "../src/video-service.js";

const youTubeFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>ITM TRADING, INC.</title>
 <entry><id>yt:video:AAAAAAAAAA1</id><yt:videoId>AAAAAAAAAA1</yt:videoId><title>Gold &amp; the Dollar</title><published>2026-11-17T16:05:06+00:00</published></entry>
 <entry><id>yt:video:12345678901</id><yt:videoId>12345678901</yt:videoId><title>2026</title><published>2026-11-16T15:50:18+00:00</published></entry>
 <entry><yt:videoId>bad</yt:videoId><title>Malformed</title></entry>
</feed>`;

const vimeoFeed = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Vimeo / Patriots in Action TV’s videos</title>
<item><title>WORD ON THE STREET</title><pubDate>Wed, 11 Nov 2026 11:14:50 -0500</pubDate><link>https://vimeo.com/1245870309</link>
<media:content medium="video" duration="2307"><media:player url="https://player.vimeo.com/video/1245870309?h=102c9b52a0"/>
<media:thumbnail height="540" width="960" url="https://i.vimeocdn.com/video/2225131579-d_960?region=us"/></media:content></item>
<item><title>No player</title><link>https://vimeo.com/1</link></item>
</channel></rss>`;

const livePage = (canonical: string, details: string, { title = "Live: Gold &amp; Silver Q&amp;A", extra = "" } = {}) =>
  `<html><head><link rel="canonical" href="${canonical}"><meta name="title" content="${title}"></head>
  <script>var ytInitialPlayerResponse = {${extra}"microformat":{"liveBroadcastDetails":{${details}}}};</script></html>`;

// A channel's Live tab, as YouTube marks it up: one lockup per stream.
const liveCard = (id: string, title: string, onAir: boolean) =>
  `"lockupViewModel":{"contentImage":{"thumbnailViewModel":{"overlays":[{"thumbnailBottomOverlayViewModel":{"badges":[{"thumbnailBadgeViewModel":{"text":"${onAir ? "LIVE" : "1:02:03"}","badgeStyle":"${onAir ? "THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE" : "THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT"}"}}]}}]}},"metadata":{"lockupMetadataViewModel":{"title":{"content":"${title}"}}},"contentId":"${id}","contentType":"LOCKUP_CONTENT_TYPE_VIDEO"}`;
const newsmaxTab = `<script>var ytInitialData = {"contents":[{${[
  liveCard("ROBCARSON01", "The Rob Carson Show LIVE (11/18/2026) | NEWSMAX Podcasts", true),
  liveCard("NEWSMAXOLD1", "NEWSMAX2 LIVE replay", false),
  liveCard("NEWSMAX2ON1", "NEWSMAX2 LIVE | Real News for Real People", true),
].join("},{")}}]};</script>`;
const newsmaxWatch = livePage("https://www.youtube.com/watch?v=NEWSMAX2ON1", `"isLiveNow":true,"startTimestamp":"2026-11-12T21:30:24+00:00"`, {
  title: "NEWSMAX2 LIVE | Real News for Real People", extra: `"playabilityStatus":{"status":"OK","playableInEmbed":true},`,
});

beforeEach(() => {
  clearCache();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); config.vimeoAccessToken = ""; });

it("reads YouTube uploads with text IDs, privacy-enhanced embeds and 16:9-croppable thumbnails", () => {
  const videos = parseYouTubeFeed(youTubeFeed);
  expect(videos.map((video) => [video.id, video.title])).toEqual([["AAAAAAAAAA1", "Gold & the Dollar"], ["12345678901", "2026"]]);
  expect(videos[0]).toMatchObject({
    channelId: "itm-trading", platform: "youtube", publishedAt: "2026-11-17T16:05:06.000Z",
    thumbnailUrl: "https://i.ytimg.com/vi/AAAAAAAAAA1/hqdefault.jpg",
    watchUrl: "https://www.youtube.com/watch?v=AAAAAAAAAA1",
    embedUrl: "https://www.youtube-nocookie.com/embed/AAAAAAAAAA1?rel=0&playsinline=1&autoplay=1",
  });
});

it("reads Vimeo uploads with their private-link hash kept in the embed", () => {
  expect(parseVimeoFeed(vimeoFeed)).toEqual([{
    id: "1245870309", channelId: "patriots-in-action-tv", platform: "vimeo", title: "WORD ON THE STREET",
    publishedAt: "2026-11-11T16:14:50.000Z", thumbnailUrl: "https://i.vimeocdn.com/video/2225131579-d_960?region=us",
    watchUrl: "https://vimeo.com/1245870309", durationSeconds: 2307,
    embedUrl: "https://player.vimeo.com/video/1245870309?h=102c9b52a0&dnt=1&autoplay=1",
  }]);
});

it("treats only a broadcast that is on air now as live", () => {
  const watch = "https://www.youtube.com/watch?v=LIVEVIDEO01";
  expect(parseYouTubeLivePage(livePage(watch, `"isLiveNow":true,"startTimestamp":"2026-11-17T15:00:00+00:00"`))).toEqual({
    channelId: "itm-trading", platform: "youtube", videoId: "LIVEVIDEO01", title: "Live: Gold & Silver Q&A",
    startedAt: "2026-11-17T15:00:00.000Z", watchUrl: watch,
    embedUrl: "https://www.youtube-nocookie.com/embed/LIVEVIDEO01?rel=0&playsinline=1&autoplay=1&mute=1",
  });
  // A scheduled stream takes over the /live page before it starts.
  expect(parseYouTubeLivePage(livePage(watch, `"isLiveNow":false,"startTimestamp":"2026-11-18T15:00:00+00:00"`))).toBeNull();
  // Nothing on: the page is the channel itself.
  expect(parseYouTubeLivePage(livePage("https://www.youtube.com/channel/UCom1i7_NVeSUNyJyuR_NbMQ", ""))).toBeNull();
  // Some live pages carry only the player's own flag, without broadcast details.
  const playerOnly = livePage(watch, "", { extra: `"videoDetails":{"videoId":"LIVEVIDEO01","title":"Show","lengthSeconds":"0","isLive":true,"keywords":["x"]},` })
    .replace(`"liveBroadcastDetails":{}`, `"embed":{}`);
  expect(parseYouTubeLivePage(playerOnly)).toMatchObject({ videoId: "LIVEVIDEO01", startedAt: undefined });
  expect(parseYouTubeLivePage(livePage(watch, "", { extra: `"videoDetails":{"videoId":"OTHERVIDEO1","isLive":true},` }))).toBeNull();
  // A stream that cannot be embedded cannot play on the site.
  expect(parseYouTubeLivePage(livePage(watch, `"isLiveNow":true`, { extra: `"playabilityStatus":{"playableInEmbed":false},` }))).toBeNull();
});

it("picks the on-air streams with a matching title from a channel's Live tab", () => {
  expect(parseYouTubeLiveTab(newsmaxTab, /\bNEWSMAX\s*2\b/i)).toEqual(["NEWSMAX2ON1"]);
  expect(parseYouTubeLiveTab(newsmaxTab, /Rob Carson/)).toEqual(["ROBCARSON01"]);
  expect(parseYouTubeLiveTab("<html>no tab</html>", /./)).toEqual([]);
});

it("finds a streaming Vimeo session and starts it muted", () => {
  const body = { data: [
    { uri: "/videos/111", name: "Archived show", live: { status: "done" }, player_embed_url: "https://player.vimeo.com/video/111?h=a" },
    { uri: "/videos/222", name: "WATCHERS LIVE", link: "https://vimeo.com/222", live: { status: "streaming" }, player_embed_url: "https://player.vimeo.com/video/222?h=b", created_time: "2026-11-17T15:00:00+00:00" },
  ] };
  expect(parseVimeoLiveVideos(body)).toMatchObject({ videoId: "222", title: "WATCHERS LIVE", embedUrl: "https://player.vimeo.com/video/222?h=b&dnt=1&autoplay=1&muted=1" });
  expect(parseVimeoLiveVideos({ data: [body.data[0]] })).toBeNull();
});

it("alternates channels so one uploader cannot crowd out the other", () => {
  expect(interleave<number | string>([[1, 2, 3, 4], ["a"]])).toEqual([1, "a", 2, 3, 4]);
  expect(interleave([])).toEqual([]);
});

it("serves both channels and live status, and reports Vimeo's live check as unchecked without a token", async () => {
  const fetcher = vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("feeds/videos.xml")) return new Response(youTubeFeed);
    if (url.includes("vimeo.com/patriotsinactiontv/videos/rss")) return new Response(vimeoFeed);
    if (url.endsWith("/live")) return new Response(livePage("https://www.youtube.com/watch?v=LIVEVIDEO01", `"isLiveNow":true`));
    if (url.endsWith("/streams")) return new Response(newsmaxTab);
    if (url.endsWith("/watch?v=NEWSMAX2ON1")) return new Response(newsmaxWatch);
    return new Response("unexpected", { status: 500 });
  });
  vi.stubGlobal("fetch", fetcher);

  const response = await handleRequest({ method: "GET", path: "/v1/videos/featured", query: new URLSearchParams() });
  const body = JSON.parse(response.body);
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("public, max-age=60, s-maxage=60");
  expect(body.channels.map((channel: { id: string }) => channel.id)).toEqual(["itm-trading", "patriots-in-action-tv"]);
  expect(body.videos.map((video: { id: string }) => video.id)).toEqual(["AAAAAAAAAA1", "1245870309", "12345678901"]);
  expect(body.live.map((stream: { videoId: string }) => stream.videoId)).toEqual(["LIVEVIDEO01"]);
  expect(body.liveUnchecked).toEqual(["patriots-in-action-tv"]);
  // A featured channel is on the air, so the stand-in steps aside.
  expect(body.standby).toBeUndefined();
  expect(body.partial).toBeUndefined();
  expect(fetcher.mock.calls.some(([url]) => String(url).includes("api.vimeo.com"))).toBe(false);

  // Cached: a second reader does not reach the channels again.
  await handleRequest({ method: "GET", path: "/v1/videos/featured", query: new URLSearchParams() });
  expect(fetcher).toHaveBeenCalledTimes(5);
});

it("fills the live slot with Newsmax2 while no featured channel is live, and keeps it through a failed check", async () => {
  let youTubeDown = false;
  const fetcher = vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("feeds/videos.xml")) return new Response(youTubeFeed);
    if (url.includes("videos/rss")) return new Response(vimeoFeed);
    if (url.endsWith("/live")) return new Response(livePage("https://www.youtube.com/channel/UCom1i7_NVeSUNyJyuR_NbMQ", ""));
    if (youTubeDown) throw new TypeError("fetch failed");
    if (url === "https://www.youtube.com/channel/UCx6h-dWzJ5NpAlja1YsApdg/streams") return new Response(newsmaxTab);
    if (url === "https://www.youtube.com/watch?v=NEWSMAX2ON1") return new Response(newsmaxWatch);
    return new Response("unexpected", { status: 500 });
  });
  vi.stubGlobal("fetch", fetcher);
  const request = async () => JSON.parse((await handleRequest({ method: "GET", path: "/v1/videos/featured", query: new URLSearchParams() })).body);

  const body = await request();
  expect(body.live).toEqual([]);
  expect(body.standby).toEqual({
    channel: { id: "newsmax2", name: "Newsmax2", platform: "youtube", url: "https://www.youtube.com/@NewsmaxTV" },
    stream: {
      channelId: "newsmax2", platform: "youtube", videoId: "NEWSMAX2ON1", title: "NEWSMAX2 LIVE | Real News for Real People",
      startedAt: "2026-11-12T21:30:24.000Z", watchUrl: "https://www.youtube.com/watch?v=NEWSMAX2ON1",
      embedUrl: "https://www.youtube-nocookie.com/embed/NEWSMAX2ON1?rel=0&playsinline=1&autoplay=1&mute=1",
    },
  });
  // The Rob Carson show is live on the same tab but is not NEWSMAX2, so its page is never fetched.
  expect(fetcher.mock.calls.some(([url]) => String(url).includes("ROBCARSON01"))).toBe(false);
  // Newsmax2 is not one of the featured channels.
  expect(body.channels.map((channel: { id: string }) => channel.id)).toEqual(["itm-trading", "patriots-in-action-tv"]);

  // Once the check is due again and YouTube fails, the stream already found stays up.
  youTubeDown = true;
  vi.useFakeTimers({ now: Date.now() + (config.videoStandbyTtlSeconds + 1) * 1000, toFake: ["Date"] });
  try {
    expect((await request()).standby?.stream.videoId).toBe("NEWSMAX2ON1");
  } finally { vi.useRealTimers(); }
});

it("keeps answering when a channel fails, and checks Vimeo live status once a token is configured", async () => {
  config.vimeoAccessToken = "test-token";
  const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("feeds/videos.xml")) return new Response("down", { status: 503 });
    if (url.includes("videos/rss")) return new Response(vimeoFeed);
    if (url.endsWith("/live")) throw new TypeError("fetch failed");
    if (url.startsWith("https://api.vimeo.com/users/patriotsinactiontv/videos")) {
      expect(new Headers(init?.headers).get("authorization")).toBe("bearer test-token");
      return Response.json({ data: [{ uri: "/videos/222", name: "Live now", live: { status: "streaming" }, player_embed_url: "https://player.vimeo.com/video/222?h=b" }] });
    }
    return new Response("unexpected", { status: 500 });
  });
  vi.stubGlobal("fetch", fetcher);

  const body = JSON.parse((await handleRequest({ method: "GET", path: "/v1/videos/featured", query: new URLSearchParams() })).body);
  expect(body.videos.map((video: { channelId: string }) => video.channelId)).toEqual(["patriots-in-action-tv"]);
  expect(body.partial).toBe(true);
  expect(body.live.map((stream: { channelId: string }) => stream.channelId)).toEqual(["patriots-in-action-tv"]);
  expect(body.liveUnchecked).toEqual(["itm-trading"]);
});
