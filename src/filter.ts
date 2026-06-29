import type { FeedScope, NewsFeedItem, Topic } from "./types.js";

const obituaryTerms = ["obituary", "obituaries", "death notice", "funeral", "memorial service", "celebration of life", "passed away", "died"];
const sportsTerms = ["sports", "football", "basketball", "baseball", "softball", "volleyball", "soccer", "athletics", "score"];

const categoryRules: Record<Topic, { include?: string[]; exclude?: string[] }> = {
  general: { exclude: [...obituaryTerms, ...sportsTerms] },
  sports: { include: sportsTerms, exclude: obituaryTerms },
  politics: { include: ["politics", "election", "council", "commission", "ballot", "mayor", "governor", "legislature", "congress"], exclude: [...obituaryTerms, ...sportsTerms] },
  economy: { include: ["economy", "business", "jobs", "unemployment", "housing", "development", "market", "employer", "industry"], exclude: [...obituaryTerms, ...sportsTerms] },
  crime: { include: ["crime", "police", "sheriff", "court", "arrest", "charged", "indicted", "trial", "sentenced"], exclude: obituaryTerms },
  obituaries: { include: obituaryTerms, exclude: ["arrest", "charged", "crime", "police", "sheriff", "election", "sports", "football", "basketball"] },
  opinion: { include: ["opinion", "editorial", "column", "letter to the editor", "commentary", "op-ed", "op ed"], exclude: obituaryTerms },
};

const stateNames = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida",
  "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska",
  "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas",
  "utah", "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming",
];

export function filterItems(items: NewsFeedItem[], topic: Topic, scope: FeedScope) {
  const rules = categoryRules[topic];
  return items.filter((item) => {
    const contentHaystack = `${item.title} ${item.description || ""}`.toLowerCase();
    const fullHaystack = `${contentHaystack} ${item.source || ""}`.toLowerCase();
    if (rules.exclude?.some((term) => includesTerm(fullHaystack, term))) return false;
    if (rules.include?.length && !rules.include.some((term) => includesTerm(fullHaystack, term))) return false;
    return matchesScope(contentHaystack, fullHaystack, scope);
  });
}

function matchesScope(contentHaystack: string, fullHaystack: string, scope: FeedScope) {
  if (scope.level === "national") return true;

  const state = scope.state;
  const mentionsOtherState = stateNames.some((stateName) => stateName !== state.name.toLowerCase() && includesTerm(contentHaystack, stateName));
  if (mentionsOtherState) return false;

  const terms =
    scope.level === "state"
      ? [state.name, state.abbr]
      : [
          scope.county.name,
          `${scope.county.name} county`,
          scope.county.displayName,
          scope.county.primaryCity,
          ...scope.county.localCities,
        ].filter((term): term is string => Boolean(term));

  return terms.some((term) => includesTerm(fullHaystack, term.toLowerCase()));
}

function includesTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value);
}
