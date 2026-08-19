export type Topic =
  | "general"
  | "sports"
  | "politics"
  | "economy"
  | "crime"
  | "weather"
  | "obituaries"
  | "opinion"
  | "monetary-policy"
  | "markets-investing"
  | "jobs-business"
  | "property-taxes"
  | "municipal-bonds"
  | "budgets-levies"
  | "voting-systems"
  | "election-administration"
  | "audits-recounts"
  | "open-records";

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

export type WeatherMeasurement = {
  value: number | null;
  unit: "F" | "mph" | "percent" | "degrees" | "Pa";
  source: {
    value: number | null;
    unitCode?: string;
    rawValue?: number | string | null;
  };
};

export type WeatherForecastPeriod = {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: WeatherMeasurement;
  windSpeed: WeatherMeasurement;
  windDirection?: string;
  precipitationProbability?: WeatherMeasurement;
  shortForecast?: string;
  detailedForecast?: string;
  icon?: string;
};

export type WeatherObservation = {
  stationId: string;
  stationName?: string;
  observedAt?: string;
  textDescription?: string;
  icon?: string;
  temperature?: WeatherMeasurement;
  relativeHumidity?: WeatherMeasurement;
  windSpeed?: WeatherMeasurement;
  windGust?: WeatherMeasurement;
  windDirection?: WeatherMeasurement;
  barometricPressure?: WeatherMeasurement;
};

export type WeatherAlert = {
  id: string;
  event: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  effective?: string;
  expires?: string;
  link?: string;
};

export type WeatherZone = {
  id: string;
  link: string;
};

export type CountyWeatherResponse = {
  county: {
    name: string;
    displayName: string;
    slug: string;
    fips: string;
    stateName: string;
    stateSlug: string;
    stateAbbr: string;
  };
  location: {
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    gridOffice?: string;
    gridX?: number;
    gridY?: number;
    timeZone?: string;
  };
  zones: {
    forecast?: WeatherZone;
    county?: WeatherZone;
  };
  currentObservation?: WeatherObservation;
  forecast: WeatherForecastPeriod[];
  hourly: WeatherForecastPeriod[];
  alerts: WeatherAlert[];
  warnings: string[];
  meta: {
    fetchedAt: string;
    partial: boolean;
    cacheTtlSeconds: number;
    alertsCacheTtlSeconds: number;
    pointsCacheTtlSeconds: number;
    units: {
      temperature: "F";
      windSpeed: "mph";
      precipitationProbability: "percent";
    };
    source: {
      name: "National Weather Service";
      documentation: string;
      alertsDocumentation: string;
      links: {
        points: string;
        forecast?: string;
        hourly?: string;
        observationStations?: string;
        latestObservation?: string;
        alerts: string[];
      };
    };
  };
};

export const countyAtlasDomains = [
  "demographics",
  "economy",
  "housing",
  "jobs-business",
  "education",
  "health",
  "civic-elections",
  "public-safety",
  "agriculture",
  "environment-disasters",
  "government-finance",
  "infrastructure",
] as const;

export type CountyAtlasDomain = (typeof countyAtlasDomains)[number];
export type CountyAtlasValueKind = "number" | "percent" | "currency" | "index" | "duration" | "text";
export type CountyAtlasChartKind = "trend" | "comparison" | "distribution" | "composition" | "none";

export type CountyAtlasSource = {
  id: string;
  name: string;
  agency: string;
  url: string;
  cadence: string;
  methodology?: string;
  licenseNote?: string;
};

export type CountyAtlasObservation = {
  date: string;
  value: number;
};

export type CountyAtlasBenchmark = {
  geography: "state" | "nation";
  label: string;
  value: number;
};

export type CountyAtlasDistributionItem = {
  key: string;
  label: string;
  value: number;
  unit?: string;
};

export type CountyAtlasMetric = {
  key: string;
  domain: CountyAtlasDomain;
  label: string;
  description: string;
  unit: string;
  valueKind: CountyAtlasValueKind;
  chart: CountyAtlasChartKind;
  value?: number;
  displayValue?: string;
  date?: string;
  vintage?: string;
  retrievedAt?: string;
  geographyVintage?: string;
  marginOfError?: number;
  suppressed?: boolean;
  suppressionReason?: string;
  modeledEstimate?: boolean;
  preliminary?: boolean;
  revisionStatus?: "preliminary" | "revised" | "final" | "not-applicable";
  coveragePercent?: number;
  coverageNumerator?: number;
  coverageDenominator?: number;
  source: CountyAtlasSource;
  observations?: CountyAtlasObservation[];
  benchmarks?: CountyAtlasBenchmark[];
  distribution?: CountyAtlasDistributionItem[];
};

export type CountyAtlasDomainInfo = {
  slug: CountyAtlasDomain;
  label: string;
  shortLabel: string;
  description: string;
  sourceIds: string[];
  metricKeys: string[];
};

export type CountyAtlasCounty = {
  name: string;
  displayName: string;
  slug: string;
  fips: string;
  stateName: string;
  stateSlug: string;
  stateAbbr: string;
};

export type CountyAtlasDomainDocument = {
  county: CountyAtlasCounty;
  domain: CountyAtlasDomainInfo;
  metrics: CountyAtlasMetric[];
  warnings: string[];
  meta: {
    version: string;
    generatedAt: string;
    retrievedAt: string;
    sources: CountyAtlasSource[];
    partial: boolean;
    cacheTtlSeconds: number;
  };
};

export type CountyAtlasOverview = {
  county: CountyAtlasCounty;
  domains: Array<{
    domain: CountyAtlasDomainInfo;
    featuredMetrics: CountyAtlasMetric[];
    available: boolean;
    warnings: string[];
  }>;
  meta: {
    version: string;
    generatedAt: string;
    retrievedAt: string;
    sources: CountyAtlasSource[];
    partial: boolean;
    cacheTtlSeconds: number;
  };
};

export type CountyAtlasManifest = {
  version: string;
  generatedAt: string;
  geographyVintage: string;
  activePrefix: string;
  domains: CountyAtlasDomain[];
  sources: Array<{
    id: string;
    vintage: string;
    retrievedAt: string;
    status: "current" | "stale" | "partial";
  }>;
  countyCount: number;
};
