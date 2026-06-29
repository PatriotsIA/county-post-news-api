import { config } from "./config.js";
import type { NewsFeedItem } from "./types.js";

type GdeltResponse = {
  articles?: {
    url?: string;
    title?: string;
    seendate?: string;
    domain?: string;
    sourceCountry?: string;
    socialimage?: string;
  }[];
};

export async function fetchGdeltItems(query: string) {
  if (!config.gdeltEnabled) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const url = new URL(config.gdeltDocApi);
    url.searchParams.set("query", `${query} sourcecountry:US`);
    url.searchParams.set("mode", "ArtList");
    url.searchParams.set("format", "json");
    url.searchParams.set("sort", "datedesc");
    url.searchParams.set("timespan", `${config.articleMaxAgeDays}d`);
    url.searchParams.set("maxrecords", String(config.gdeltMaxRecords));

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "county-post-news-api/1.0" },
    });
    if (!response.ok) throw new Error(`GDELT fetch failed: ${response.status}`);

    const json = (await response.json()) as GdeltResponse;
    return (json.articles || [])
      .filter((article) => article.url && article.title)
      .map((article, index): NewsFeedItem => ({
        id: article.url || `${article.title}-${index}`,
        title: article.title || "Untitled update",
        link: article.url || "#",
        source: article.domain || article.sourceCountry || "GDELT",
        publishedAt: parseGdeltDate(article.seendate),
        description: "",
        imageUrl: article.socialimage || "",
      }));
  } finally {
    clearTimeout(timeout);
  }
}

function parseGdeltDate(value?: string) {
  if (!value) return undefined;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})(?:T?(\d{2})(\d{2})(\d{2}))?/);
  if (!compact) return value;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = compact;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}
