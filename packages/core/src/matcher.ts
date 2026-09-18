/**
 * Ticket -> game matcher (SPEC.md 7.4). Pure: callers pass the parsed ticket, the candidate games
 * (already narrowed to date +/- 1 day by the database), and alias tables.
 */
import type { GameStatus, Sport } from './types.js';

export interface ParsedTicket {
  sport: 'mlb' | 'nfl' | 'nba' | 'unknown';
  home_team: string;
  away_team: string;
  /** YYYY-MM-DD in the venue's local time, or null. */
  date_local: string | null;
  /** HH:MM (24h) local, or null. */
  time_local: string | null;
  venue: string;
  section: string;
  row: string;
  seat: string;
  price: number | null;
  ticketing_platform: string;
  confidence: number;
}

export interface TeamRef {
  id: string;
  sport: Sport;
  name: string;
  city: string;
  abbreviation: string;
  aliases: string[];
}

export interface VenueRef {
  id: string;
  name: string;
  aliases: string[];
  /** IANA time zone, used to render a candidate's local date and time. */
  tz?: string | null | undefined;
}

export interface CandidateGame {
  id: string;
  sport: Sport;
  scheduledStart: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string | null;
  status: GameStatus;
  doubleheaderNumber: number | null;
  rescheduledToGameId: string | null;
}

export interface MatchContext {
  teams: TeamRef[];
  venues: VenueRef[];
}

export interface RankedCandidate {
  game: CandidateGame;
  score: number;
  reasons: string[];
}

export type MatchDecision = 'matched' | 'needs_review' | 'failed';

export interface MatchResult {
  decision: MatchDecision;
  candidates: RankedCandidate[];
  /** When the best match was postponed and has a makeup game, its id (SPEC 7.4.6). */
  makeupGameId: string | null;
  /** True when two doubleheader games tied and the ticket had no start time (SPEC 7.4.5). */
  doubleheaderAmbiguous: boolean;
}

// ---------------------------------------------------------------------------
// Text normalization and fuzzy matching
// ---------------------------------------------------------------------------

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions), small inputs only. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[m]![n]!;
}

/** 0..1 similarity between a ticket string and one alias. */
export function aliasSimilarity(text: string, alias: string): number {
  const t = normalizeText(text);
  const a = normalizeText(alias);
  if (!t || !a) return 0;
  if (t === a) return 1;
  const tTokens = t.split(' ');
  const aTokens = a.split(' ');
  // Whole-alias containment ("philadelphia phillies" contains "phillies").
  if (t.includes(a) && a.length >= 3) return 0.9;
  if (a.includes(t) && t.length >= 3) return 0.8;
  // Token-level fuzzy overlap tolerates misspellings ("philies", "eagels").
  let matched = 0;
  for (const at of aTokens) {
    if (at.length < 3) {
      if (tTokens.includes(at)) matched++;
      continue;
    }
    const best = Math.min(...tTokens.map((tt) => editDistance(tt, at)));
    const tolerance = at.length >= 8 ? 2 : 1;
    if (best <= tolerance) matched++;
  }
  const coverage = matched / aTokens.length;
  return coverage >= 0.99 ? 0.75 : coverage >= 0.5 && aTokens.length > 1 ? 0.5 : 0;
}

export interface TeamMatch {
  team: TeamRef;
  score: number;
}

export function matchTeams(text: string, teams: TeamRef[], sport?: Sport | 'unknown'): TeamMatch[] {
  if (!text.trim()) return [];
  const out: TeamMatch[] = [];
  for (const team of teams) {
    if (sport && sport !== 'unknown' && team.sport !== sport) continue;
    const names = [team.name, `${team.city} ${team.name}`, team.abbreviation, ...team.aliases];
    let best = 0;
    for (const n of names) best = Math.max(best, aliasSimilarity(text, n));
    if (best > 0) out.push({ team, score: best });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function matchVenues(
  text: string,
  venues: VenueRef[],
): { venue: VenueRef; score: number }[] {
  if (!text.trim()) return [];
  const out: { venue: VenueRef; score: number }[] = [];
  for (const venue of venues) {
    let best = 0;
    for (const n of [venue.name, ...venue.aliases]) best = Math.max(best, aliasSimilarity(text, n));
    if (best > 0) out.push({ venue, score: best });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Local date/time of a candidate
// ---------------------------------------------------------------------------

export function localParts(
  iso: string,
  tz: string | null | undefined,
): { date: string; minutes: number } {
  const d = new Date(iso);
  const zone = tz ?? 'America/New_York';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const hour = Number(parts['hour'] ?? '0') % 24;
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    minutes: hour * 60 + Number(parts['minute'] ?? '0'),
  };
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

function parseMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export const MATCH_THRESHOLD = 70;
export const REVIEW_THRESHOLD = 40;
export const MATCH_MARGIN = 15;

export function rankCandidates(
  ticket: ParsedTicket,
  candidates: CandidateGame[],
  ctx: MatchContext,
): MatchResult {
  const teamById = new Map(ctx.teams.map((t) => [t.id, t]));
  const venueById = new Map(ctx.venues.map((v) => [v.id, v]));
  const homeMatches = matchTeams(ticket.home_team, ctx.teams, ticket.sport);
  const awayMatches = matchTeams(ticket.away_team, ctx.teams, ticket.sport);
  const venueMatches = matchVenues(ticket.venue, ctx.venues);
  const homeScoreById = new Map(homeMatches.map((m) => [m.team.id, m.score]));
  const awayScoreById = new Map(awayMatches.map((m) => [m.team.id, m.score]));
  const venueScoreById = new Map(venueMatches.map((m) => [m.venue.id, m.score]));
  const ticketMinutes = parseMinutes(ticket.time_local);

  const ranked: RankedCandidate[] = candidates.map((game) => {
    const reasons: string[] = [];
    let score = 0;
    const home = teamById.get(game.homeTeamId);
    const away = teamById.get(game.awayTeamId);
    if (ticket.sport !== 'unknown' && game.sport !== ticket.sport) {
      score -= 30;
      reasons.push('sport mismatch');
    }
    // Teams in the ticket's orientation, or swapped (tickets often print "A vs B" regardless of home).
    const straight =
      (homeScoreById.get(game.homeTeamId) ?? 0) + (awayScoreById.get(game.awayTeamId) ?? 0);
    const swapped =
      (homeScoreById.get(game.awayTeamId) ?? 0) + (awayScoreById.get(game.homeTeamId) ?? 0);
    const teamPoints = Math.max(straight, swapped * 0.9);
    if (teamPoints === 0) {
      // No team evidence at all: never a candidate (a date and a venue alone match hundreds of games).
      return { game, score: 0, reasons: ['no team match'] };
    }
    if (teamPoints > 0) {
      score += Math.round(25 * teamPoints);
      reasons.push(
        straight >= swapped
          ? `teams ${home?.abbreviation} vs ${away?.abbreviation}`
          : 'teams matched (swapped orientation)',
      );
    }
    // Date proximity in the venue's local time.
    const venue = game.venueId ? venueById.get(game.venueId) : undefined;
    const local = localParts(game.scheduledStart, venue?.tz);
    if (ticket.date_local) {
      const diff = Math.abs(dayDiff(local.date, ticket.date_local));
      if (diff === 0) {
        score += 25;
        reasons.push('same date');
      } else if (diff === 1) {
        score += 5;
        reasons.push('one day off');
      } else {
        score -= 30;
        reasons.push(`${diff} days off`);
      }
    }
    // Venue.
    if (game.venueId) {
      const v = venueScoreById.get(game.venueId) ?? 0;
      if (v > 0) {
        score += Math.round(15 * v);
        reasons.push(`venue ${venue?.name ?? ''}`.trim());
      }
    }
    // Start time (doubleheader disambiguation).
    if (ticketMinutes !== null) {
      const delta = Math.abs(local.minutes - ticketMinutes);
      if (delta <= 30) {
        score += 10;
        reasons.push('start time matches');
      } else if (delta >= 120) {
        score -= 5;
      }
    }
    if (game.status === 'cancelled') {
      score -= 15;
      reasons.push('cancelled');
    }
    return { game, score, reasons };
  });

  ranked.sort(
    (a, b) => b.score - a.score || a.game.scheduledStart.localeCompare(b.game.scheduledStart),
  );
  const top = ranked[0];
  const second = ranked[1];
  let decision: MatchDecision = 'failed';
  let doubleheaderAmbiguous = false;
  if (top && top.score >= MATCH_THRESHOLD) {
    const margin = second ? top.score - second.score : Infinity;
    if (margin >= MATCH_MARGIN) decision = 'matched';
    else {
      decision = 'needs_review';
      doubleheaderAmbiguous =
        !!second &&
        top.game.doubleheaderNumber !== null &&
        second.game.doubleheaderNumber !== null &&
        top.game.homeTeamId === second.game.homeTeamId &&
        ticketMinutes === null;
    }
  } else if (top && top.score >= REVIEW_THRESHOLD) {
    decision = 'needs_review';
  }
  const makeupGameId = top && top.game.status === 'postponed' ? top.game.rescheduledToGameId : null;
  return {
    decision,
    candidates: ranked.filter((r) => r.score > 0).slice(0, 5),
    makeupGameId,
    doubleheaderAmbiguous,
  };
}
