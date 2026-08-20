import type {
  CountyAtlasCounty,
  CountyAtlasDomain,
  CountyAtlasDomainDocument,
  CountyAtlasManifest,
  CountyAtlasMetric,
  CountyAtlasOverview,
} from "../../src/types.js";

export type AtlasWave = 1 | 2 | 3;
export type AtlasProviderStatus = "implemented" | "planned";

export type AtlasProviderDefinition = {
  id: string;
  wave: AtlasWave;
  status: AtlasProviderStatus;
  domains: CountyAtlasDomain[];
  cadence: string;
  credentialEnv?: string;
  notes: string;
};

export type AtlasProviderContext = {
  retrievedAt: string;
  censusYear: number;
  censusApiKey?: string;
  fixturePath?: string;
  countyRoster?: CountyAtlasCounty[];
  farsYear?: number;
  fetchJson: (url: URL) => Promise<unknown>;
  fetchBytes: (url: URL) => Promise<Uint8Array>;
};

export type AtlasCountyRecord = {
  county: CountyAtlasCounty;
  metrics: CountyAtlasMetric[];
};

export type AtlasProviderResult = {
  providerId: string;
  vintage: string;
  geographyVintage: string;
  retrievedAt: string;
  counties: AtlasCountyRecord[];
};

export interface AtlasProviderAdapter {
  readonly id: string;
  ingest(context: AtlasProviderContext): Promise<AtlasProviderResult>;
}

export type AtlasSnapshotObject = {
  key: string;
  body: CountyAtlasOverview | CountyAtlasDomainDocument | CountyAtlasManifest;
};

export type AtlasSnapshot = {
  manifest: CountyAtlasManifest;
  objects: AtlasSnapshotObject[];
};
