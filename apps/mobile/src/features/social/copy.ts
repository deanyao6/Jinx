/** Plain-copy builders for the Friends tab: feed events, overlap sentences, rivalry labels. */

import type { Json } from '@/lib/database.types';
import { sportLabel } from '@/lib/format';

export type FeedGame = {
  sport_id: string;
  scheduled_start: string;
  status: string;
  home: string;
  away: string;
  /** Short names ("Phillies") when the server sends them; full names otherwise. */
  home_nickname?: string | null;
  away_nickname?: string | null;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
};

export type FeedEventType =
  | 'logged_game'
  | 'pledge_won'
  | 'pledge_lost'
  | 'new_stamp'
  | 'goal_completed'
  | 'milestone'
  | 'wrapped_published'
  | 'famous_game'
  | 'badge_earned';

export type FeedEvent = {
  id: string;
  actor_user_id: string;
  actor_handle: string;
  actor_display_name: string;
  /** `profiles.avatar_path` of the actor, or null for the generated default. */
  actor_avatar_path?: string | null;
  type: FeedEventType | string;
  game_id: string | null;
  payload: Record<string, Json | undefined> | null;
  created_at: string;
  game: FeedGame | null;
  reactions: Record<string, number>;
  my_reaction: string | null;
};

export const REACTION_EMOJI = ['🔥', '👏', '😭', '🤝', '🏟️', '🍀'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** Spells out whole numbers up to twenty ("eleven"); larger or fractional values stay digits. */
export function numberWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (Number.isInteger(abs) && abs <= 20) {
    const word = ONES[abs] as string;
    return n < 0 ? `minus ${word}` : word;
  }
  return String(n);
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function actorName(e: { actor_display_name: string | null; actor_handle: string }): string {
  return e.actor_display_name?.trim() || `@${e.actor_handle}`;
}

function str(v: Json | undefined): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function num(v: Json | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Short team names for copy: the nickname when present, else the full name. */
export function shortNames(g: FeedGame): { home: string; away: string } {
  return {
    home: g.home_nickname?.trim() || g.home,
    away: g.away_nickname?.trim() || g.away,
  };
}

/** "Maya logged Phillies 5, Mets 2 at Citizens Bank Park" style headline for a feed row. */
export function feedEventCopy(e: FeedEvent): string {
  const name = actorName(e);
  const p = e.payload ?? {};
  switch (e.type) {
    case 'logged_game': {
      const g = e.game;
      if (!g) return `${name} logged a game`;
      const { home, away } = shortNames(g);
      const final = g.status === 'final' && g.home_score != null && g.away_score != null;
      let matchup: string;
      if (final) {
        const homeFirst = (g.home_score as number) >= (g.away_score as number);
        matchup = homeFirst
          ? `${home} ${g.home_score}, ${away} ${g.away_score}`
          : `${away} ${g.away_score}, ${home} ${g.home_score}`;
      } else {
        matchup = `${away} at ${home}`;
      }
      return `${name} logged ${matchup}${g.venue ? ` at ${g.venue}` : ''}`;
    }
    case 'pledge_won':
    case 'pledge_lost': {
      const team = str(p['team_name']) ?? 'their team';
      const possessive = name.endsWith('s') ? `${name}’` : `${name}’s`;
      return `${possessive} pledge to the ${team} ${e.type === 'pledge_won' ? 'won' : 'lost'}`;
    }
    case 'new_stamp':
      return `New stamp: ${str(p['venue_name']) ?? 'a new venue'}`;
    case 'goal_completed':
      return `Goal completed: ${str(p['title']) ?? 'a goal'}`;
    case 'milestone': {
      const games = num(p['games']);
      return games ? `${ordinal(games)} game` : 'A milestone game';
    }
    case 'wrapped_published': {
      const season = num(p['season']);
      const sport = str(p['sport_id']);
      return `${season ? `${season} ` : ''}${sport ? `${sportLabel(sport)} ` : ''}Wrapped is ready`;
    }
    case 'famous_game':
      // "Dean was at Super Bowl LIX." The title is the famous row's, carried in the payload.
      return `${name} was at ${str(p['title']) ?? 'a famous game'}`;
    case 'badge_earned':
      return `${name} earned ${str(p['name']) ?? 'a badge'}`;
    default:
      return `${name} did something`;
  }
}

/** Secondary line under a feed headline: venue and date for game events, nothing otherwise. */
export function feedEventDetail(e: FeedEvent, now = new Date()): string | null {
  const g = e.game;
  if (!g) return null;
  const d = new Date(g.scheduled_start);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
  if (e.type === 'logged_game') return date;
  const { home, away } = shortNames(g);
  return [`${away} at ${home}`, date].join(' · ');
}

/** "2m", "3h", "5d", then a short date. */
export function relativeTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (sec < 60) return 'now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export type OverlapRow = {
  other_display_name: string | null;
  other_handle: string;
  home_team_name: string;
  away_team_name: string;
  scheduled_start: string;
  section_gap: number | null;
};

export function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * "You and Maya were both at Phillies vs Mets in August 2019, eleven sections apart."
 * The section clause appears only when both users share seats (server sends null otherwise).
 */
export function overlapSentence(o: OverlapRow): string {
  const who = o.other_display_name?.trim() || `@${o.other_handle}`;
  const when = monthYear(o.scheduled_start);
  let s = `You and ${who} were both at ${o.home_team_name} vs ${o.away_team_name}`;
  if (when) s += ` in ${when}`;
  if (o.section_gap != null) {
    if (o.section_gap === 0) s += ', in the same section';
    else if (o.section_gap === 1) s += ', one section apart';
    else s += `, ${numberWords(o.section_gap)} sections apart`;
  }
  return `${s}.`;
}

/** "Jordan, Cowboys fan" / "Jordan, Cowboys and Bears fan" / "Jordan". */
export function rivalLabel(name: string, teams: string[]): string {
  if (teams.length === 0) return name;
  if (teams.length === 1) return `${name}, ${teams[0]} fan`;
  if (teams.length === 2) return `${name}, ${teams[0]} and ${teams[1]} fan`;
  return `${name}, ${teams.slice(0, -1).join(', ')}, and ${teams[teams.length - 1]} fan`;
}

/** Companion record as "7–1" or "7–1–2" with ties, and which color it should take. */
export function recordText(wins: number, losses: number, ties = 0): string {
  return ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}

export function recordTone(wins: number, losses: number): 'good' | 'bad' | 'even' {
  if (wins + losses === 0) return 'even';
  if (wins > losses) return 'good';
  if (losses > wins) return 'bad';
  return 'even';
}

export function gamesLabel(n: number): string {
  return n === 1 ? '1 game' : `${n} games`;
}
