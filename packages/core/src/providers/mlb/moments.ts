/**
 * MLB moment detectors (SPEC.md 6.7). Pure functions over CanonicalGameDetail.
 * Each detector returns zero or more GameEvents; `detectMlbMoments` runs them all.
 */
import type { CanonicalGameDetail, GameEvent, MlbPlay, Side } from '../../types.js';

const REGULATION_INNINGS = 9;

function mlbPlays(detail: CanonicalGameDetail): MlbPlay[] {
  return detail.plays.sport === 'mlb' ? detail.plays.items : [];
}

function scoreBefore(plays: MlbPlay[], i: number): { home: number; away: number } {
  const prev = plays[i - 1];
  return prev ? { home: prev.homeScore, away: prev.awayScore } : { home: 0, away: 0 };
}

function pitchingSide(battingSide: Side): Side {
  return battingSide === 'home' ? 'away' : 'home';
}

function scheduledInnings(detail: CanonicalGameDetail): number {
  // 2020-2021 doubleheaders were scheduled for seven innings.
  if (detail.doubleheaderNumber !== null && (detail.season === 2020 || detail.season === 2021))
    return 7;
  return REGULATION_INNINGS;
}

export function detectWalkOff(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.status !== 'final') return [];
  const plays = mlbPlays(detail);
  const last = plays[plays.length - 1];
  if (!last || last.half !== 'bottom' || !last.isScoringPlay) return [];
  const before = scoreBefore(plays, plays.length - 1);
  if (before.home > before.away) return [];
  if (last.homeScore <= last.awayScore) return [];
  if (last.inning < scheduledInnings(detail)) return [];
  const base = {
    side: 'home' as const,
    providerPlayerId: last.batterId || null,
    playerName: last.batterName || null,
    occurredAt: last.endTime,
  };
  const events: GameEvent[] = [
    {
      type: 'walk_off',
      ...base,
      detail: { inning: last.inning, event: last.event, description: last.description },
    },
  ];
  if (last.eventType === 'home_run') {
    events.push({
      type: 'walk_off_home_run',
      ...base,
      detail: { inning: last.inning, rbi: last.rbi, description: last.description },
    });
  }
  return events;
}

export function detectHomeRuns(detail: CanonicalGameDetail): GameEvent[] {
  const events: GameEvent[] = [];
  for (const p of mlbPlays(detail)) {
    if (p.eventType !== 'home_run') continue;
    events.push({
      type: 'home_run',
      side: p.battingSide,
      providerPlayerId: p.batterId || null,
      playerName: p.batterName || null,
      occurredAt: p.endTime,
      detail: { inning: p.inning, half: p.half, rbi: p.rbi, description: p.description },
    });
    if (p.rbi === 4) {
      events.push({
        type: 'grand_slam',
        side: p.battingSide,
        providerPlayerId: p.batterId || null,
        playerName: p.batterName || null,
        occurredAt: p.endTime,
        detail: { inning: p.inning, half: p.half, description: p.description },
      });
    }
  }
  return events;
}

export function detectCycle(detail: CanonicalGameDetail): GameEvent[] {
  const byBatter = new Map<
    string,
    { name: string; side: Side; types: Set<string>; last: MlbPlay }
  >();
  for (const p of mlbPlays(detail)) {
    if (!['single', 'double', 'triple', 'home_run'].includes(p.eventType)) continue;
    const rec = byBatter.get(p.batterId) ?? {
      name: p.batterName,
      side: p.battingSide,
      types: new Set<string>(),
      last: p,
    };
    rec.types.add(p.eventType);
    rec.last = p;
    byBatter.set(p.batterId, rec);
  }
  const events: GameEvent[] = [];
  for (const [id, rec] of byBatter) {
    if (rec.types.size === 4) {
      events.push({
        type: 'cycle',
        side: rec.side,
        providerPlayerId: id,
        playerName: rec.name,
        occurredAt: rec.last.endTime,
        detail: {},
      });
    }
  }
  return events;
}

const REACHED_BASE_EVENTS = new Set([
  'walk',
  'intent_walk',
  'hit_by_pitch',
  'field_error',
  'catcher_interf',
  'fielders_choice',
  'fielders_choice_out',
  'single',
  'double',
  'triple',
  'home_run',
  'strikeout_double_play',
]);

export function detectNoHitter(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.status !== 'final' || !detail.hits) return [];
  if ((detail.inningsOrPeriods ?? 0) < REGULATION_INNINGS) return [];
  const plays = mlbPlays(detail);
  const events: GameEvent[] = [];
  for (const battingSide of ['home', 'away'] as const) {
    if (detail.hits[battingSide] !== 0) continue;
    const side = pitchingSide(battingSide);
    const sidePlays = plays.filter((p) => p.battingSide === battingSide);
    if (sidePlays.length === 0) continue;
    const last = sidePlays[sidePlays.length - 1];
    const pitchers = [...new Set(sidePlays.map((p) => p.pitcherName).filter(Boolean))];
    events.push({
      type: 'no_hitter',
      side,
      providerPlayerId: pitchers.length === 1 ? (sidePlays[0]?.pitcherId ?? null) : null,
      playerName: pitchers.length === 1 ? (pitchers[0] ?? null) : null,
      occurredAt: last?.endTime ?? null,
      detail: { pitchers, combined: pitchers.length > 1 },
    });
    const perfect =
      sidePlays.every((p) => p.isOut && !REACHED_BASE_EVENTS.has(p.eventType)) &&
      sidePlays.length === 3 * REGULATION_INNINGS &&
      sidePlays.every((p) => p.runnersOnStart === 0);
    if (perfect) {
      events.push({
        type: 'perfect_game',
        side,
        providerPlayerId: pitchers.length === 1 ? (sidePlays[0]?.pitcherId ?? null) : null,
        playerName: pitchers.length === 1 ? (pitchers[0] ?? null) : null,
        occurredAt: last?.endTime ?? null,
        detail: { pitchers },
      });
    }
  }
  return events;
}

export function detectExtraInnings(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.status !== 'final') return [];
  const innings = detail.inningsOrPeriods ?? 0;
  if (innings <= REGULATION_INNINGS) return [];
  const plays = mlbPlays(detail);
  return [
    {
      type: 'extra_innings',
      side: null,
      providerPlayerId: null,
      playerName: null,
      occurredAt: plays[plays.length - 1]?.endTime ?? null,
      detail: { innings },
    },
  ];
}

export function detectShutout(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.status !== 'final' || detail.homeScore === null || detail.awayScore === null)
    return [];
  if ((detail.inningsOrPeriods ?? 0) < REGULATION_INNINGS) return [];
  const events: GameEvent[] = [];
  const plays = mlbPlays(detail);
  const last = plays[plays.length - 1]?.endTime ?? null;
  if (detail.awayScore === 0 && detail.homeScore > 0) {
    events.push({
      type: 'shutout',
      side: 'home',
      providerPlayerId: null,
      playerName: null,
      occurredAt: last,
      detail: { score: `${detail.homeScore}-0` },
    });
  }
  if (detail.homeScore === 0 && detail.awayScore > 0) {
    events.push({
      type: 'shutout',
      side: 'away',
      providerPlayerId: null,
      playerName: null,
      occurredAt: last,
      detail: { score: `${detail.awayScore}-0` },
    });
  }
  return events;
}

export function detectImmaculateInnings(detail: CanonicalGameDetail): GameEvent[] {
  const plays = mlbPlays(detail);
  const byHalf = new Map<string, MlbPlay[]>();
  for (const p of plays) {
    const key = `${p.inning}-${p.half}`;
    const arr = byHalf.get(key) ?? [];
    arr.push(p);
    byHalf.set(key, arr);
  }
  const events: GameEvent[] = [];
  for (const [, half] of byHalf) {
    if (half.length !== 3) continue;
    if (!half.every((p) => p.eventType === 'strikeout' && p.pitchCount === 3 && p.allStrikes))
      continue;
    const pitcherIds = new Set(half.map((p) => p.pitcherId));
    if (pitcherIds.size !== 1) continue;
    const first = half[0];
    const last = half[2];
    if (!first || !last) continue;
    events.push({
      type: 'immaculate_inning',
      side: pitchingSide(first.battingSide),
      providerPlayerId: first.pitcherId || null,
      playerName: first.pitcherName || null,
      occurredAt: last.endTime,
      detail: { inning: first.inning, half: first.half },
    });
  }
  return events;
}

export function detectMlbMoments(detail: CanonicalGameDetail): GameEvent[] {
  if (detail.sport !== 'mlb') return [];
  return [
    ...detectWalkOff(detail),
    ...detectHomeRuns(detail),
    ...detectCycle(detail),
    ...detectNoHitter(detail),
    ...detectExtraInnings(detail),
    ...detectShutout(detail),
    ...detectImmaculateInnings(detail),
  ];
}
