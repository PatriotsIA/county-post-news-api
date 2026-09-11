export type PublicNotice = {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  countyFips: string[];
  coverage: "county" | "regional";
  geographyLabel: string;
  category: "meeting" | "hearing" | "procurement" | "tax" | "legal" | "other";
  eventDate?: string;
  publishedAt?: string;
};

export type NoticeSource = {
  id: string;
  name: string;
  url: string;
  kind: "government" | "newspaper-directory";
  status: "current" | "stale" | "unavailable" | "link-only";
  checkedAt?: string;
};

export type PublicNoticesResponse = {
  county: { state: string; county: string; fips: string; displayName: string };
  items: PublicNotice[];
  sources: NoticeSource[];
  meta: {
    rollout: "texas" | "not-yet-supported";
    status: "current" | "partial" | "unavailable" | "not-yet-supported";
    count: number;
    totalAvailable: number;
    hasMore: boolean;
    offset: number;
    checkedAt: string;
    lookbackDays: number;
    cacheTtlSeconds: number;
  };
};

export type CountyNoticeSource = {
  county: string;
  evidenceUrl: string;
  websiteUrl?: string;
  noticeUrl?: string;
  feeds: { url: string; dateKind: "event" | "published" }[];
};
