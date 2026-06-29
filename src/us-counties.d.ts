declare module "@nickgraffis/us-counties" {
  export type UsCounty = {
    name: string;
    FIPS: string;
    state: string;
    stateName?: string;
    stateAbbr?: string;
    contiguous?: boolean;
  };

  export function getCountyByState(state: string): UsCounty[];
}
