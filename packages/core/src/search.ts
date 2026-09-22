/** Bounded sports search interpretation. Catalog candidates come from the database. */
export type SearchFilters = {
  sport?: string;
  season?: number;
  from?: string;
  to?: string;
  teamId?: string;
  venueId?: string;
  time?: 'past' | 'upcoming';
};
export type SearchCandidate = {
  phrase: string;
  id: string;
  kind: 'team' | 'venue';
  name: string;
  label: string;
  alias: string;
  tier: number;
  quality: number;
};
export type SearchEntity = SearchCandidate & { start: number; end: number };
export type SearchPlan = {
  entities: SearchEntity[];
  teamIds: string[];
  venueId?: string;
  awayId?: string;
  homeId?: string;
  tier: number;
  quality: number;
};
export type ParsedSearch = {
  query: string;
  words: string[];
  phrases: string[];
  filters: SearchFilters;
  error?: string;
};

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const SEPARATORS = new Set(['vs', 'at']);
const FILLER = new Set(['the', 'game', 'games', 'in', 'on']);

export function validSearchDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function parseSearch(query: string, selected: SearchFilters = {}): ParsedSearch {
  const filters = { ...selected };
  const result: ParsedSearch = { query, words: [], phrases: [], filters };
  const fail = (error: string) => ({ ...result, error });
  if (query.length > 160) return fail('Use a shorter search (up to 160 characters).');
  if (filters.sport && !['mlb', 'nfl', 'nba', 'mls'].includes(filters.sport))
    return fail('Choose a supported league.');
  if (
    filters.season != null &&
    (!Number.isInteger(filters.season) || filters.season < 1900 || filters.season > 2100)
  )
    return fail('Choose a valid season.');
  if ([filters.from, filters.to].some((d) => d && !validSearchDate(d)))
    return fail('Use a valid date in YYYY-MM-DD format.');
  let text = query
    .toLowerCase()
    .replace(/@/g, ' at ')
    .replace(/\bvs\./g, 'vs');
  if (/\d[/.]\d/.test(text)) return fail('Use YYYY-MM-DD for dates, or a month and year.');
  const sports = [...text.matchAll(/\b(mlb|nfl|nba|mls)\b/g)].map((m) => m[1]!);
  if (new Set([...sports, ...(filters.sport ? [filters.sport] : [])]).size > 1)
    return fail('The query and league filter disagree. Choose one league.');
  if (sports[0]) filters.sport = sports[0];
  text = text.replace(/\b(mlb|nfl|nba|mls)\b/g, ' ');
  const seasons = [...text.matchAll(/\b(\d{4})\s+season\b|\bseason\s+(\d{4})\b/g)];
  if (seasons.length > 1) return fail('Choose one season.');
  if (seasons[0]) {
    const season = Number(seasons[0][1] ?? seasons[0][2]);
    if (filters.season != null && filters.season !== season)
      return fail('The query and season filter disagree.');
    filters.season = season;
    text = text.replace(seasons[0][0], ' ');
  }
  let from: string | undefined;
  let to: string | undefined;
  const dates = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)];
  if (dates.length > 1) return fail('Use the From and To filters for a date range.');
  if (dates[0]) {
    if (!validSearchDate(dates[0][0])) return fail('That date does not exist.');
    from = to = dates[0][0];
    text = text.replace(dates[0][0], ' ');
  }
  const monthPattern = new RegExp(
    `\\b(${MONTHS.join('|')}|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\s+(\\d{4})\\b`,
    'g',
  );
  const months = [...text.matchAll(monthPattern)];
  if (months.length > 1 || (months.length && from))
    return fail('Choose one date or month, or use the date filters.');
  if (months[0]) {
    const m = months[0];
    const month = MONTHS.findIndex((name) => name.startsWith(m[1]!)) + 1;
    const year = Number(m[2]);
    from = `${year}-${String(month).padStart(2, '0')}-01`;
    to = `${year}-${String(month).padStart(2, '0')}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
    text = text.replace(m[0], ' ');
  }
  const years = [...text.matchAll(/\b\d{4}\b/g)];
  if (years.length > 1 || (years.length && from))
    return fail('Choose one year, or use the date filters.');
  if (years[0]) {
    from = `${years[0][0]}-01-01`;
    to = `${years[0][0]}-12-31`;
    text = text.replace(years[0][0], ' ');
  }
  if (from) {
    if ((filters.from && from !== filters.from) || (filters.to && to !== filters.to))
      return fail('The query and date filters disagree. Edit or clear the date filters.');
    filters.from = from;
    if (to) filters.to = to;
  }
  if (filters.from && filters.to && filters.from > filters.to)
    return fail('From must be on or before To.');
  if (
    (filters.season != null && (filters.season < 1900 || filters.season > 2100)) ||
    [filters.from, filters.to].some(
      (d) => d && (Number(d.slice(0, 4)) < 1900 || Number(d.slice(0, 4)) > 2100),
    )
  )
    return fail('Use a year between 1900 and 2100.');
  const words = normalizeSearch(text)
    .split(' ')
    .filter((w) => w && !FILLER.has(w));
  if (words.length > 10) return fail('Try a team, opponent, venue and date using fewer words.');
  if (query.trim() && !words.length && !from && !seasons.length && !sports.length)
    return fail('Enter a team, venue or date.');
  const phrases = new Set<string>();
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= Math.min(words.length, start + 6); end++) {
      const span = words.slice(start, end);
      phrases.add(span.join(' '));
    }
  }
  return { ...result, words, phrases: [...phrases] };
}

function comparePlans(a: SearchPlan, b: SearchPlan): number {
  const exactCoverage = (p: SearchPlan) =>
    p.entities.reduce((n, e) => n + (e.tier === 0 ? e.end - e.start : 0), 0);
  return (
    a.tier - b.tier ||
    exactCoverage(b) - exactCoverage(a) ||
    b.quality - a.quality ||
    a.entities.length - b.entities.length
  );
}

/** Complete phrase coverage, at most two distinct teams and one venue; bounded beam search. */
export function resolveSearch(parsed: ParsedSearch, candidates: SearchCandidate[]): SearchPlan[] {
  if (parsed.error) return [];
  const { words } = parsed;
  const states: SearchPlan[][] = Array.from({ length: words.length + 1 }, () => []);
  states[0] = [{ entities: [], teamIds: [], tier: 0, quality: 1000 }];
  for (let start = 0; start < words.length; start++) {
    const current = states[start]!.sort(comparePlans).slice(0, 32);
    if (SEPARATORS.has(words[start]!)) {
      states[start + 1]!.push(...current);
    }
    for (let end = start + 1; end <= Math.min(words.length, start + 6); end++) {
      const phrase = words.slice(start, end).join(' ');
      const matches = candidates.filter((c) => c.phrase === phrase);
      // Exact names are authoritative; a miss on games must not substitute another entity.
      const exact = matches.some((c) => c.tier === 0);
      for (const c of matches.filter((c) => !exact || c.tier === 0)) {
        // Venue names can contain "at" (AT&T Stadium, Ballpark at ...).
        // Only a venue phrase may consume a matchup separator as part of its name.
        if (c.kind !== 'venue' && words.slice(start, end).some((w) => SEPARATORS.has(w))) continue;
        for (const state of current) {
          if (state.entities.some((e) => e.id === c.id && e.kind === c.kind)) continue;
          if (c.kind === 'team' && state.teamIds.length === 2) continue;
          if (c.kind === 'venue' && state.venueId) continue;
          states[end]!.push({
            ...state,
            entities: [...state.entities, { ...c, start, end }],
            teamIds: c.kind === 'team' ? [...state.teamIds, c.id] : state.teamIds,
            ...(c.kind === 'venue' ? { venueId: c.id } : {}),
            tier: Math.max(state.tier, c.tier),
            quality: Math.min(state.quality, c.quality),
          });
        }
      }
      states[end] = states[end]!.sort(comparePlans).slice(0, 32);
    }
  }
  const seen = new Set<string>();
  const plans = states[words.length]!.filter((plan) => {
    const separators = words.flatMap((w, index) =>
      SEPARATORS.has(w) &&
      !plan.entities.some((e) => e.kind === 'venue' && e.start <= index && e.end > index)
        ? [index]
        : [],
    );
    if (separators.length > 1) return false;
    const separator = separators[0] ?? -1;
    if (separator >= 0) {
      const teams = plan.entities.filter((e) => e.kind === 'team');
      if (teams.length !== 2 || teams[0]!.end > separator || teams[1]!.start <= separator)
        return false;
      if (words[separator] === 'at') {
        plan.awayId = teams[0]!.id;
        plan.homeId = teams[1]!.id;
      }
    }
    const key = JSON.stringify([plan.teamIds.slice().sort(), plan.venueId, plan.awayId]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort(comparePlans);
  const best = plans[0];
  // Keep alternatives only within the strongest tier/phrase interpretation.
  const exactCoverage = (p: SearchPlan) =>
    p.entities.reduce((n, e) => n + (e.tier === 0 ? e.end - e.start : 0), 0);
  return best
    ? plans
        .filter(
          (p) =>
            p.tier === best.tier &&
            exactCoverage(p) === exactCoverage(best) &&
            (p.tier === 2
              ? p.quality >= best.quality - 80
              : p.entities.length === best.entities.length),
        )
        .slice(0, 8)
    : [];
}

export function planLabel(plan: SearchPlan): string {
  return plan.entities.map((e) => e.label).join(' + ');
}
