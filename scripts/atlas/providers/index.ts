import { CensusAcsProvider } from "./census-acs.js";
import { FemaDeclarationsProvider } from "./fema-declarations.js";
import { NhtsaFarsProvider } from "./nhtsa-fars.js";
import type { AtlasProviderAdapter } from "../types.js";

const adapters: Record<string, AtlasProviderAdapter> = {
  "census-acs": new CensusAcsProvider(),
  "fema-declarations": new FemaDeclarationsProvider(),
  "nhtsa-fars": new NhtsaFarsProvider(),
};

export function getProviderAdapter(id: string) {
  return adapters[id];
}
