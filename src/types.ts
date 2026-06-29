export type Topic = "general" | "sports" | "politics" | "economy" | "crime" | "obituaries" | "opinion";

export type ScopeLevel = "national" | "state" | "county";

export type NewsFeedItem = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string;
  mediaType?: "article" | "video" | "podcast";
};

export type StateSite = {
  name: string;
  abbr: string;
  slug: string;
};

export type CountySite = {
  name: string;
  slug: string;
  fips?: string;
  displayName: string;
  state: StateSite;
  primaryCity?: string;
  localCities: string[];
  latitude?: number;
  longitude?: number;
};

export type FeedScope =
  | { level: "national" }
  | { level: "state"; state: StateSite }
  | { level: "county"; state: StateSite; county: CountySite };

export type FeedResponse = {
  scope: Record<string, string>;
  topic: Topic;
  items: NewsFeedItem[];
  meta: {
    count: number;
    sourcesUsed: string[];
    fetchedAt: string;
    cacheTtlSeconds: number;
  };
};

export type PageResponse = {
  scope: Record<string, string>;
  sections: Record<string, FeedResponse>;
  meta: {
    count: number;
    fetchedAt: string;
    cacheTtlSeconds: number;
  };
};
