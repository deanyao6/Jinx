/**
 * The NFL upgrade path (docs/prompts/social/03, section 3.2, with R1: the live half reads
 * ESPN's free scoreboard, not a paid feed). A live NFL prompt only knows the score changed:
 * "Touchdown, Eagles". When nflverse play-by-play lands overnight, the prompt is rewritten to
 * the real play ("Saquon Barkley's 90-yard touchdown run"), its significance recomputed from
 * nflverse's own win probability, and it is pinned to the point on the line. `label` keeps the
 * coarse words; `label_final` gets these.
 */
import { quarterLabel } from '../providers/nfl/winprob.js';

/** The play-by-play columns the relabel reads (a subset of NflversePbpRow). */
export interface RelabelPlay {
  qtr: number | null;
  desc: string | null;
  sp: number | null;
  home_wp: number | null;
  total_home_score: number | null;
  total_away_score: number | null;
  play_type?: string | null;
  yards_gained?: number | null;
  td_player_name?: string | null;
  return_touchdown?: number | null;
  interception?: number | null;
  fumble?: number | null;
  safety?: number | null;
  field_goal_result?: string | null;
  kick_distance?: number | null;
  touchdown?: number | null;
}

export interface RelabelPrompt {
  homeScore: number;
  awayScore: number;
}

export interface Relabel {
  labelFinal: string;
  significance: number;
  /** The index of the scoring play among the rows with a probability, 1-based: `game_wp_timeline.seq`. */
  wpSeq: number;
  periodLabel: string;
}

/** "Saquon Barkley's 90-yard touchdown run", from the columns rather than the raw description. */
export function playLabel(p: RelabelPlay): string {
  const yards = p.yards_gained != null ? `${p.yards_gained}-yard` : null;
  const who = p.td_player_name ? `${p.td_player_name}'s` : null;
  if (p.touchdown === 1) {
    if (p.return_touchdown === 1) {
      const how = p.interception === 1 ? 'pick-six' : p.fumble === 1 ? 'fumble return touchdown' : 'return touchdown';
      return [who, yards, how].filter(Boolean).join(' ');
    }
    const how = p.play_type === 'pass' ? 'touchdown catch' : p.play_type === 'run' ? 'touchdown run' : 'touchdown';
    return [who, yards, how].filter(Boolean).join(' ');
  }
  if (p.safety === 1) return 'Safety';
  if (p.field_goal_result === 'made') {
    return p.kick_distance != null ? `${p.kick_distance}-yard field goal` : 'Field goal';
  }
  const d = (p.desc ?? '').replace(/\s+/g, ' ').trim();
  return d.length > 110 ? `${d.slice(0, 109).trimEnd()}…` : d || 'Score';
}

/**
 * The scoring play a coarse prompt was about: the first scoring play after which the totals
 * read what the prompt stored. Null when the play-by-play has no such play (the score the
 * board showed was corrected later).
 */
export function relabelPrompt(prompt: RelabelPrompt, rows: readonly RelabelPlay[]): Relabel | null {
  let seq = 0;
  let prevWp: number | null = null;
  for (const r of rows) {
    const usable = typeof r.home_wp === 'number' && Number.isFinite(r.home_wp) && !!r.qtr;
    if (usable) seq += 1;
    const wp = usable ? (r.home_wp as number) : null;
    if (
      r.sp === 1 &&
      r.total_home_score === prompt.homeScore &&
      r.total_away_score === prompt.awayScore
    ) {
      const significance =
        wp != null && prevWp != null ? Math.round(Math.abs(wp - prevWp) * 1000) / 10 : 0;
      return {
        labelFinal: playLabel(r),
        significance,
        wpSeq: Math.max(1, seq),
        periodLabel: quarterLabel(r.qtr ?? 4),
      };
    }
    if (wp != null) prevWp = wp;
  }
  return null;
}
