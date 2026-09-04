import { ambiguousPlaceNames } from "./county-places.js";
import { getCountyLocalPlaces } from "./geo.js";
import type { CountySite, FeedScope, NewsFeedItem, StateSite, Topic } from "./types.js";
import { isTrustedCountySource, isTrustedMarketSource, type DirectSource } from "./source-registry.js";

const obituaryTerms = ["obituary", "obituaries", "death notice", "funeral", "memorial service", "celebration of life", "passed away", "died"];
const sportsTerms = ["sports", "football", "basketball", "baseball", "softball", "volleyball", "soccer", "athletics", "score"];

const categoryRules: Record<Topic, { include?: string[]; exclude?: string[] }> = {
  general: { exclude: [...obituaryTerms, ...sportsTerms] },
  sports: { include: sportsTerms, exclude: obituaryTerms },
  politics: { include: ["politics", "election", "council", "commission", "ballot", "mayor", "governor", "legislature", "congress"], exclude: [...obituaryTerms, ...sportsTerms] },
  economy: { include: ["economy", "business", "jobs", "unemployment", "housing", "development", "market", "employer", "industry"], exclude: [...obituaryTerms, ...sportsTerms] },
  crime: { include: ["crime", "police", "sheriff", "court", "arrest", "charged", "indicted", "trial", "sentenced"], exclude: obituaryTerms },
  weather: {
    include: ["weather", "forecast", "storm", "thunderstorm", "tornado", "hurricane", "flood", "snow", "blizzard", "heat", "drought", "temperature", "warning", "advisory"],
    exclude: obituaryTerms,
  },
  obituaries: { include: obituaryTerms, exclude: ["arrest", "charged", "crime", "police", "sheriff", "election", "sports", "football", "basketball"] },
  opinion: { include: ["opinion", "editorial", "column", "letter to the editor", "commentary", "op-ed", "op ed"], exclude: obituaryTerms },
  "monetary-policy": { include: ["inflation", "interest rate", "federal reserve", "central bank", "currency", "monetary policy"], exclude: obituaryTerms },
  "markets-investing": { include: ["market", "markets", "commodity", "commodities", "stock", "stocks", "bond", "bonds", "investing"], exclude: obituaryTerms },
  "jobs-business": { include: ["job", "jobs", "employment", "employer", "business", "industry", "economic development"], exclude: obituaryTerms },
  "property-taxes": { include: ["property tax", "property taxes", "assessment", "appraisal", "tax levy", "homestead exemption"], exclude: obituaryTerms },
  "municipal-bonds": { include: ["municipal bond", "school bond", "bond election", "bond proposal", "public debt"], exclude: obituaryTerms },
  "budgets-levies": { include: ["public budget", "county budget", "city budget", "school budget", "tax rate", "public finance"], exclude: obituaryTerms },
  "voting-systems": { include: ["voting system", "ballot processing", "voting equipment", "ballot certification", "election technology"], exclude: obituaryTerms },
  "election-administration": { include: ["election administration", "election office", "polling place", "voter registration", "election date"], exclude: obituaryTerms },
  "audits-recounts": { include: ["election audit", "recount", "canvass", "post-election review", "election results certification"], exclude: obituaryTerms },
  "open-records": { include: ["public records", "open records", "freedom of information", "foia", "government transparency"], exclude: obituaryTerms },
};

const stateNames = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida",
  "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska",
  "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas",
  "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming",
];

export function filterItems(items: NewsFeedItem[], topic: Topic, scope: FeedScope, trustedSources: DirectSource[] = []) {
  return items.filter((item) => matchesCategory(item, topic) && matchesScope(item, scope, trustedSources));
}

export function filterCountyFallbackItems(
  items: NewsFeedItem[],
  topic: Topic,
  scope: Extract<FeedScope, { level: "county" }>,
  nearbyCounties: CountySite[],
) {
  return items.filter((item) => matchesCategory(item, topic) && matchesCountyScope(item, scope.state, nearbyCounties));
}

export function filterMarketItems(
  items: NewsFeedItem[],
  topic: Topic,
  scope: Extract<FeedScope, { level: "county" }>,
  places: string[],
  trustedSources: DirectSource[],
) {
  return items.filter((item) => matchesCategory(item, topic) && matchesMarketScope(item, scope, places, trustedSources));
}

function matchesCategory(item: NewsFeedItem, topic: Topic) {
  const rules = categoryRules[topic];
  const fullHaystack = itemHaystack(item);
  if (rules.exclude?.some((term) => includesTerm(fullHaystack, term))) return false;
  if (rules.include?.length && !rules.include.some((term) => includesTerm(fullHaystack, term))) return false;
  return true;
}

function matchesScope(item: NewsFeedItem, scope: FeedScope, trustedSources: DirectSource[]) {
  if (scope.level === "national") return true;

  const contentHaystack = itemContent(item);
  const fullHaystack = itemHaystack(item);
  const state = scope.state;
  const mentionsOtherState = stateNames.some((stateName) => stateName !== state.name.toLowerCase() && includesTerm(contentHaystack, stateName));
  if (mentionsOtherState) return false;

  if (scope.level === "state") {
    return includesTerm(fullHaystack, state.name.toLowerCase()) || includesTerm(fullHaystack, state.abbr.toLowerCase());
  }

  return matchesCountyScope(item, state, [scope.county]) || isTrustedCountySource(item, trustedSources, scope.county);
}

function matchesCountyScope(item: NewsFeedItem, state: StateSite, counties: CountySite[]) {
  const contentHaystack = itemContent(item);
  const fullHaystack = itemHaystack(item);
  const mentionsOtherState = stateNames.some((stateName) => stateName !== state.name.toLowerCase() && includesTerm(contentHaystack, stateName));
  if (mentionsOtherState) return false;

  // The state is normally established by its full name. A bare postal
  // abbreviation is too noisy to accept on its own — "OR", "IN" and "ME" are
  // ordinary words — but inside a dateline it is unambiguous, so "Miami, TX"
  // establishes both the town and the state at once.
  const namesState = includesTerm(fullHaystack, state.name.toLowerCase());

  // A story is county-local if it names the county, or names a town inside it.
  // Requiring the literal "briscoe county" discarded every Silverton story —
  // local reporting names the town. The towns come from the Census subcounty
  // file and are strictly inside the county, so this cannot readmit the nearby
  // media markets the county tier is meant to exclude.
  return counties.some(
    (county) =>
      (namesState && includesTerm(fullHaystack, `${county.name.toLowerCase()} county`)) ||
      getCountyLocalPlaces(county).some((place) => mentionsPlace(fullHaystack, place, state, namesState)),
  );
}

/**
 * Town names that are also ordinary English words. Generated ambiguity covers
 * names shared across states; this catches the rest, where the collision is
 * with normal prose rather than another town.
 */
const COMMON_WORD_PLACE_NAMES = new Set([
  "bath", "bell", "best", "blue", "cedar", "center", "central", "commerce", "energy", "enterprise",
  "fair", "friendly", "gold", "grand", "home", "industry", "mount", "normal", "oak", "point",
  "progress", "rich", "silver", "summit", "sun", "surprise",
]);

const ambiguousPlaces = new Set(ambiguousPlaceNames);

/**
 * A town name only counts as evidence when it actually points at this county.
 *
 * Distinctive names are trusted on their own, which matters: the strongest
 * local stories never name the state — "Mena Police Reports" is a Polk County,
 * Arkansas headline in full. Names shared by three or more states, and names
 * that are ordinary English words, need the dateline form instead. Without that
 * split, Arthur County, Nebraska matched "James Arthur Vineyard" and Roberts
 * County, Texas matched "Miami Dolphins CUT Bradley Chubb".
 */
function mentionsPlace(haystack: string, place: string, state: StateSite, namesState: boolean) {
  const name = place.toLowerCase();
  const ambiguous = place.length <= 4 || ambiguousPlaces.has(place) || COMMON_WORD_PLACE_NAMES.has(name);
  if (!ambiguous) return namesState && includesTerm(haystack, name);
  return (
    includesTerm(haystack, `${name}, ${state.name.toLowerCase()}`) ||
    includesTerm(haystack, `${name}, ${state.abbr.toLowerCase()}`)
  );
}

function matchesMarketScope(
  item: NewsFeedItem,
  scope: Extract<FeedScope, { level: "county" }>,
  places: string[],
  trustedSources: DirectSource[],
) {
  const contentHaystack = itemContent(item);
  const fullHaystack = itemHaystack(item);
  const stateName = scope.state.name.toLowerCase();
  const mentionsOtherState = stateNames.some((stateNameCandidate) => stateNameCandidate !== stateName && includesTerm(contentHaystack, stateNameCandidate));
  if (mentionsOtherState) return false;

  if (!includesTerm(fullHaystack, stateName)) return false;
  const hasCounty = includesTerm(fullHaystack, `${scope.county.name.toLowerCase()} county`);
  const hasPlace = places.some((place) => includesTerm(fullHaystack, place.toLowerCase()));
  return hasCounty || hasPlace || isTrustedMarketSource(item, trustedSources);
}

function itemContent(item: NewsFeedItem) {
  return `${item.title} ${item.description || ""} ${(item.categories || []).join(" ")}`.toLowerCase();
}

function itemHaystack(item: NewsFeedItem) {
  return `${itemContent(item)} ${item.source || ""}`.toLowerCase();
}

function includesTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value);
}
