import { CensusAcsProvider } from "./census-acs.js";
import type { AtlasProviderAdapter } from "../types.js";

const adapters: Record<string, AtlasProviderAdapter> = {
  "census-acs": new CensusAcsProvider(),
};

export function getProviderAdapter(id: string) {
  return adapters[id];
}
