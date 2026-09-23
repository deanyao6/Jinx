/**
 * Reactions: the BeReal mechanic for live games (docs/prompts/social/03_reactions.md, with
 * 00_repo_reality.md R1 and R3 applied). This folder is the rules and nothing else: when the
 * one scheduled prompt fires, which plays clear the event bar, how significant a play was, how
 * prompts are capped and spaced, and how a coarse NFL label is rewritten overnight.
 *
 * Everything is keyed by `sport_id`, four sports, and takes a sport-neutral picture of the game
 * so the same code runs on the phone (the NBA, MLS and NFL feeds it reads itself) and in the
 * `mlb-live` Edge Function (MLB stays server-side).
 */
import type { Side } from '../types.js';

/** What every live feed can say about a game, with the sport's words taken out. */
export interface LiveSnapshot {
  status: 'scheduled' | 'live' | 'final' | string;
  /** The inning, quarter, or half (3 and 4 extra time, 5 a shootout for MLS). */
  period: number | null;
  /** MLB: top | middle | bottom | end. NBA and NFL: live | halftime | end. MLS: live | halftime | end. */
  periodState: string | null;
  /**
   * Seconds left in the period for a clock sport (NBA, NFL); the elapsed minute for MLS;
   * null for MLB and when the feed carries no clock.
   */
  clockSeconds: number | null;
  homeScore: number;
  awayScore: number;
  /** The home side's chance to win, 0 to 1, when a model or feed gives one. */
  homeWp: number | null;
  fetchedAt: string;
}

export type PromptAudience = Side | 'all';

/** A play that cleared the whitelist and the significance gate: what `fire_reaction_prompt` takes. */
export interface EventCandidate {
  /** Dedupe key, stable across polls and phones: `mlb:ab:23`, `nba:score:4:118:2:45-47`. */
  key: string;
  /** Whitelist rule that let it through. */
  rule: string;
  /** Short, urgent, never scolding: "Quick, react to {label}". */
  label: string;
  audience: PromptAudience;
  /** Win probability swing in points, or 100 for a milestone. */
  significance: number;
  /** The side the play benefited, null for a game-level moment. */
  benefitSide: Side | null;
  /** True when the play was on the curated milestone list rather than the significance gate. */
  milestone: boolean;
  /** Home and away scores after the play, for the overnight relabel and the strip. */
  homeScore: number;
  awayScore: number;
  /** The scorebug label at the moment: "Bottom 8th", "Q4 1:52", "87'". */
  periodLabel: string;
}
