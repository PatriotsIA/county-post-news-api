export const countyRateTiers = {
  "under-5000": { label: "Under 5,000", colorCardMonthlyCents: 2500, sectionSponsorMonthlyCents: 5000 },
  "5000-20000": { label: "5,000–20,000", colorCardMonthlyCents: 7500, sectionSponsorMonthlyCents: 15000 },
  "20000-100000": { label: "20,000–100,000", colorCardMonthlyCents: 15000, sectionSponsorMonthlyCents: 30000 },
  "100000-250000": { label: "100,000–250,000", colorCardMonthlyCents: 25000, sectionSponsorMonthlyCents: 50000 },
  "250000-500000": { label: "250,000–500,000", colorCardMonthlyCents: 40000, sectionSponsorMonthlyCents: 80000 },
  "500000-750000": { label: "500,000–750,000", colorCardMonthlyCents: 55000, sectionSponsorMonthlyCents: 110000 },
  "750000-1000000": { label: "750,000–1,000,000", colorCardMonthlyCents: 75000, sectionSponsorMonthlyCents: 150000 },
  "1000000-2500000": { label: "1,000,000–2,500,000", colorCardMonthlyCents: 100000, sectionSponsorMonthlyCents: 200000 },
  "over-2500000": { label: "Over 2,500,000", colorCardMonthlyCents: 125000, sectionSponsorMonthlyCents: 250000 },
} as const;

export type CountyRateTierKey = keyof typeof countyRateTiers;
export type CountyPlacement = "color-card" | "section-sponsorship";
export type StatePlacement = "state-ad" | "state-feed-sponsorship";
export type BillingCadence = "monthly" | "annual";
export const sponsorableFeeds = [
  "general",
  "sports",
  "obituaries",
  "politics",
  "economy",
  "crime",
  "opinion",
  "weather",
] as const;
export type SponsorableFeed = (typeof sponsorableFeeds)[number];
export const STATE_AD_RATE_PER_COUNTY_CENTS = 1_000;
export const STATE_FEED_SPONSOR_RATE_PER_COUNTY_CENTS = 2_000;
export const ANNUAL_BILLED_MONTHS = 10;

export function isCountyRateTierKey(value: unknown): value is CountyRateTierKey {
  return typeof value === "string" && value in countyRateTiers;
}

export function isCountyPlacement(value: unknown): value is CountyPlacement {
  return value === "color-card" || value === "section-sponsorship";
}

export function isStatePlacement(value: unknown): value is StatePlacement {
  return value === "state-ad" || value === "state-feed-sponsorship";
}

export function isSponsorableFeed(value: unknown): value is SponsorableFeed {
  return typeof value === "string" && sponsorableFeeds.includes(value as SponsorableFeed);
}

export function isBillingCadence(value: unknown): value is BillingCadence {
  return value === "monthly" || value === "annual";
}

export function monthlyRateFor(placement: CountyPlacement, tier: CountyRateTierKey) {
  const rate = countyRateTiers[tier];
  return placement === "color-card" ? rate.colorCardMonthlyCents : rate.sectionSponsorMonthlyCents;
}

export function monthlyStateRateFor(countyCount: number, placement: StatePlacement, feedCount = 0) {
  if (placement === "state-ad") return countyCount * STATE_AD_RATE_PER_COUNTY_CENTS;
  return countyCount * STATE_FEED_SPONSOR_RATE_PER_COUNTY_CENTS * feedCount;
}

export function countyRateTierForPopulation(population: number): CountyRateTierKey {
  if (population < 5_000) return "under-5000";
  if (population < 20_000) return "5000-20000";
  if (population < 100_000) return "20000-100000";
  if (population < 250_000) return "100000-250000";
  if (population < 500_000) return "250000-500000";
  if (population < 750_000) return "500000-750000";
  if (population < 1_000_000) return "750000-1000000";
  if (population < 2_500_000) return "1000000-2500000";
  return "over-2500000";
}
