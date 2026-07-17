import { cached } from "./cache.js";
import { config } from "./config.js";
import type { NewsFeedItem } from "./types.js";

const IMAGE_CACHE_TTL_SECONDS = 60 * 60;
const IMAGE_LOOKUP_CONCURRENCY = 4;

export async function enrichArticleImages(items: NewsFeedItem[]) {
  const candidates = items.filter((item) => !item.imageUrl && isHttpUrl(item.link)).slice(0, config.articleImageLookupLimit);
  if (!candidates.length) return items;

  const resolved = await mapLimited(candidates, IMAGE_LOOKUP_CONCURRENCY, async (item) => ({
    id: item.id,
    imageUrl: await getArticleImage(item.link),
  }));
  const imageUrls = new Map(resolved.filter((result): result is { id: string; imageUrl: string } => Boolean(result.imageUrl)).map((result) => [result.id, result.imageUrl]));

  return items.map((item) => (imageUrls.has(item.id) ? { ...item, imageUrl: imageUrls.get(item.id) } : item));
}

function getArticleImage(articleUrl: string) {
  return cached(`article-image:${articleUrl}`, IMAGE_CACHE_TTL_SECONDS, () => fetchArticleImage(articleUrl));
}

async function fetchArticleImage(articleUrl: string) {
  try {
    const publisherUrl = isGoogleNewsUrl(articleUrl) ? await resolveGoogleNewsUrl(articleUrl) : articleUrl;
    if (!publisherUrl) return "";

    const html = await fetchText(publisherUrl);
    return imageFromHtml(html, publisherUrl);
  } catch {
    return "";
  }
}

async function resolveGoogleNewsUrl(articleUrl: string) {
  const articlePage = await fetchText(articleUrl);
  const articleId = articleUrl.split("/").pop()?.split("?")[0] || "";
  const timestamp = attribute(articlePage, "data-n-a-ts");
  const signature = attribute(articlePage, "data-n-a-sg");
  if (!articleId || !timestamp || !signature) return "";

  const request = [
    [
      [
        "Fbv4je",
        JSON.stringify([
          "garturlreq",
          [
            ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
            "X",
            "X",
            1,
            [1, 1, 1],
            1,
            1,
            null,
            0,
            0,
            null,
            0,
          ],
          articleId,
          Number(timestamp),
          signature,
        ]),
        null,
        "generic",
      ],
    ],
  ];
  const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      referer: "https://news.google.com/",
      "user-agent": "county-post-news-api/1.0",
    },
    body: `f.req=${encodeURIComponent(JSON.stringify(request))}`,
  });
  if (!response.ok) return "";

  const responseText = await response.text();
  let body = responseText.replace(/^\)\]\}'\s*/, "").trimStart();
  if (/^\d+\s*$/.test(body.split("\n", 1)[0])) body = body.slice(body.indexOf("\n") + 1);
  const envelopes = JSON.parse(body);
  const envelope = envelopes.find((entry: unknown) => Array.isArray(entry) && entry[0] === "wrb.fr" && entry[1] === "Fbv4je");
  if (!envelope || !Array.isArray(envelope) || typeof envelope[2] !== "string") return "";

  const result = JSON.parse(envelope[2]);
  return Array.isArray(result) && result[0] === "garturlres" && typeof result[1] === "string" ? result[1] : "";
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; CountyPostNewsBot/1.0)",
      },
    });
    if (!response.ok) throw new Error(`Article fetch failed: ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function imageFromHtml(html: string, pageUrl: string) {
  const image = metaContent(html, "property", "og:image") || metaContent(html, "name", "twitter:image") || metaContent(html, "name", "twitter:image:src");
  if (!image) return "";
  try {
    return new URL(image, pageUrl).toString();
  } catch {
    return "";
  }
}

function metaContent(html: string, attributeName: "property" | "name", attributeValue: string) {
  const tagPattern = /<meta\b[^>]*>/gi;
  for (const tag of html.match(tagPattern) || []) {
    if (attribute(tag, attributeName)?.toLowerCase() === attributeValue && attribute(tag, "content")) {
      return decodeHtml(attribute(tag, "content")!);
    }
  }
  return "";
}

function attribute(html: string, name: string) {
  const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(html);
  return match?.[1] || "";
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/");
}

function isGoogleNewsUrl(value: string) {
  try {
    return new URL(value).hostname === "news.google.com";
  } catch {
    return false;
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function mapLimited<T, R>(items: T[], concurrency: number, load: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await load(items[index]);
      }
    }),
  );
  return results;
}
