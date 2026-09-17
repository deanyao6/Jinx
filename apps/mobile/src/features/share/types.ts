/** Share card templates (SPEC.md 6.17). Every template carries plain-text team names only. */
import type { WeWereThereData } from '@/features/eggs/WeWereThere';
import type { StatsPledge, StatsTotals, WinLossRecord } from '@/features/passport/types';
import type { WrappedCard } from '@/features/wrapped/types';

export type ShareRecord = {
  kind: 'record';
  overall: WinLossRecord;
  teams: { name: string; record: WinLossRecord }[];
  pledge: StatsPledge;
  totals: StatsTotals;
};

export type ShareGame = {
  kind: 'game';
  sport: string;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  status: string;
  venue: string | null;
  /** ISO start time. */
  date: string;
  /** Team the user rooted for, or null when neutral. */
  side: string | null;
  result: 'win' | 'loss' | 'tie' | null;
  verified: boolean;
};

export type SharePledge = {
  kind: 'pledge';
  team: string;
  away: string;
  home: string;
  date: string;
  result: 'win' | 'loss' | 'tie' | 'void' | 'pending';
  winProb: number;
};

export type ShareStamp = {
  kind: 'stamp';
  venue: string;
  place: string | null;
  visits: number;
  firstVisit: string | null;
  /** Total stamps so far, for "stamp #14". */
  stampCount: number | null;
};

export type ShareCompanion = {
  kind: 'companion';
  name: string;
  wins: number;
  losses: number;
  ties: number;
  games: number;
};

export type ShareGoal = { kind: 'goal'; title: string; year: number; label: string };

export type ShareWrapped = { kind: 'wrapped'; sport: string; season: number; card: WrappedCard };

/**
 * The secret handshake's "We were there" card (`features/eggs/handshake`). `team` is the side the
 * sharer was on, or null for a neutral: the card is drawn in that team's colours.
 */
export type ShareHandshake = { kind: 'handshake'; team: string | null } & WeWereThereData;

export type ShareTemplate =
  | ShareRecord
  | ShareGame
  | SharePledge
  | ShareStamp
  | ShareCompanion
  | ShareGoal
  | ShareWrapped
  | ShareHandshake;

export type ShareKind = ShareTemplate['kind'];

export const SHARE_KINDS: ShareKind[] = [
  'record',
  'game',
  'pledge',
  'stamp',
  'companion',
  'goal',
  'wrapped',
  'handshake',
];

export function isShareKind(s: string | undefined): s is ShareKind {
  return !!s && (SHARE_KINDS as string[]).includes(s);
}

/** Card size in points; captured at 3x for the 1080x1920 PNG. */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;
export const CARD_SCALE = 3;

/** Decodes the `payload` route param. Null when it does not match the route's template. */
export function parseShareTemplate(kind: string | undefined, payload: string | undefined) {
  if (!isShareKind(kind) || !payload) return null;
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const t = parsed as ShareTemplate;
    return t.kind === kind ? t : null;
  } catch {
    return null;
  }
}
