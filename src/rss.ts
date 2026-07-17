import { XMLParser } from "fast-xml-parser";
import { config } from "./config.js";
import type { NewsFeedItem } from "./types.js";

type RssOptions = {
  source?: string;
  mediaType?: NewsFeedItem["mediaType"];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

export async function fetchRssItems(feedUrl: string, options: RssOptions = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "user-agent": "county-post-news-api/1.0" },
    });
    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
    return parseRss(await response.text(), options);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRss(xml: string, options: RssOptions): NewsFeedItem[] {
  const document = parser.parse(xml) as {
    rss?: { channel?: { title?: string; item?: unknown } };
    feed?: { title?: unknown; entry?: unknown };
  };

  const rssItems = asArray(document.rss?.channel?.item);
  if (rssItems.length) {
    return rssItems.map((raw, index) => {
      const item = raw as RssItem;
      const description = textValue(item.description);
      const title = decodeEntities(stripHtml(textValue(item.title) || "Untitled update"));
      return {
        id: textValue(item.guid) || textValue(item.link) || `${textValue(item.title) || "item"}-${index}`,
        title,
        link: textValue(item.link) || "#",
        source: publicationSource(options.source || textValue(item.source) || textValue(document.rss?.channel?.title), title),
        publishedAt: textValue(item.pubDate),
        description: decodeEntities(stripHtml(description)).slice(0, 240),
        imageUrl: imageFromItem(item, description),
        mediaType: options.mediaType,
      };
    });
  }

  return asArray(document.feed?.entry).map((raw, index) => {
    const entry = raw as AtomEntry;
    const link = atomLink(entry.link);
    const description = textValue(entry.summary) || textValue(entry.content);
    const title = decodeEntities(stripHtml(textValue(entry.title) || "Untitled update"));
    return {
      id: textValue(entry.id) || link || `${textValue(entry.title) || "entry"}-${index}`,
      title,
      link: link || "#",
      source: publicationSource(options.source || textValue(entry.source?.title) || textValue(entry.author?.name) || textValue(document.feed?.title), title),
      publishedAt: textValue(entry.published) || textValue(entry.updated),
      description: decodeEntities(stripHtml(description)).slice(0, 240),
      imageUrl: "",
      mediaType: options.mediaType,
    };
  });
}

type RssItem = {
  guid?: unknown;
  link?: unknown;
  title?: unknown;
  source?: unknown;
  pubDate?: unknown;
  description?: unknown;
  enclosure?: { "@_url"?: string; "@_type"?: string };
};

type AtomEntry = {
  id?: unknown;
  title?: unknown;
  link?: unknown;
  source?: { title?: unknown };
  author?: { name?: unknown };
  published?: unknown;
  updated?: unknown;
  summary?: unknown;
  content?: unknown;
};

function asArray(value: unknown) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function atomLink(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return atomLink(value.find((entry) => entry?.["@_rel"] === "alternate") || value[0]);
  if (value && typeof value === "object" && "@_href" in value) return String(value["@_href"] || "");
  return "";
}

function textValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object" && "#text" in value) return textValue(value["#text"]);
  return "";
}

function imageFromItem(item: RssItem, description: string) {
  if (item.enclosure?.["@_type"]?.startsWith("image/")) return item.enclosure["@_url"] || "";
  return description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
}

function publicationSource(source: string, title: string) {
  if (source && !isAggregatorSource(source)) return source;
  const titleParts = title.split(/\s[-–—]\s/).map((part) => part.trim()).filter(Boolean);
  return titleParts.length > 1 ? titleParts.at(-1) || source : source;
}

function isAggregatorSource(source: string) {
  const normalized = source.toLowerCase();
  return normalized.includes("google news") || normalized.includes("bing news") || normalized.includes("news.google.com");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
