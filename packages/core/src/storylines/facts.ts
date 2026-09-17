/**
 * The facts a storyline may be built from (SPEC 6.18).
 *
 * Everything the model is allowed to say comes out of this module, and nothing else does. That
 * is the whole design: the facts are computed here from the schedule and results, handed to the
 * model as JSON, and every sentence that comes back is checked against them in validate.ts. A
 * claim that is not in a `Facts` object is, by construction, a claim the validator rejects.
 *
 * Only facts from results and the schedule. The spec also names injury reports and probable
 * pitchers; neither is ingested, so neither appears, and no storyline can pretend otherwise.
 */
import { gameResult, tally, type WinLossRecord } from '../records.js';
import type { GameStatus } from '../types.js';

/** One game from the schedule, enough to compute records and streaks from. */
export interface ScheduleGame {
  gameId: string;
  gameType: string;
  status: GameStatus;
  scheduledStart: string;
  season: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface TeamFacts {
  /** The team's display name, e.g. "Phillies". Given so the model names them correctly. */
  team: string;
  opponent: string;
  /** Whether this team is at home in the upcoming game. */
  atHome: boolean;
  season: number;
  seasonRecord: WinLossRecord;
  /** Positive for a winning streak, negative for a losing one, 0 when there is none. */
  streak: number;
  /** Record over the team's last ten decided games this season. Absent before ten games. */
  lastTen?: WinLossRecord;
  /** This season's record at home, or on the road, matching where this game is. */
  venueRecord: WinLossRecord;
  /** This season's record against today's opponent. Absent when they have not met. */
  vsOpponent?: WinLossRecord;
  /** The most recent final between these two teams, in any season. */
  lastMeeting?: {
    season: number;
    teamScore: number;
    opponentScore: number;
    result: 'win' | 'loss' | 'tie';
  };
}

function isFinal(g: ScheduleGame): boolean {
  return g.status === 'final' && g.homeScore !== null && g.awayScore !== null;
}

function resultFor(g: ScheduleGame, teamId: string) {
  return gameResult(
    {
      gameId: g.gameId,
      status: g.status,
      scheduledStart: g.scheduledStart,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      rootingTeamId: teamId,
      rootingBasis: null,
    },
    teamId,
  );
}

/** Most recent first. */
function byRecent(a: ScheduleGame, b: ScheduleGame): number {
  return b.scheduledStart.localeCompare(a.scheduledStart);
}

/**
 * The streak going into a game: consecutive wins (positive) or losses (negative), counted back
 * from the most recent final. A tie ends a streak, because it is neither.
 */
export function currentStreak(
  finalsMostRecentFirst: readonly ScheduleGame[],
  teamId: string,
): number {
  let n = 0;
  let kind: 'win' | 'loss' | null = null;
  for (const g of finalsMostRecentFirst) {
    const r = resultFor(g, teamId);
    if (r === null) continue;
    if (r === 'tie') break;
    if (kind === null) kind = r;
    if (r !== kind) break;
    n++;
  }
  return kind === 'loss' ? -n : n;
}

/**
 * Facts for one side of an upcoming game, from games strictly before it.
 *
 * "Before" is by scheduled start, so a doubleheader's first game counts toward the second and a
 * game cannot count toward itself. Preseason is excluded throughout: a spring-training streak is
 * not a streak anyone means.
 */
export function teamFacts(
  game: ScheduleGame,
  teamId: string,
  names: { team: string; opponent: string },
  history: readonly ScheduleGame[],
): TeamFacts {
  const opponentId = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
  const atHome = game.homeTeamId === teamId;

  const involving = history
    .filter((g) => g.gameId !== game.gameId)
    .filter((g) => g.scheduledStart < game.scheduledStart)
    .filter((g) => g.gameType !== 'preseason')
    .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
    .filter(isFinal)
    .sort(byRecent);

  const thisSeason = involving.filter((g) => g.season === game.season);
  const record = tally(thisSeason.map((g) => resultFor(g, teamId)));

  const facts: TeamFacts = {
    team: names.team,
    opponent: names.opponent,
    atHome,
    season: game.season,
    seasonRecord: record,
    streak: currentStreak(thisSeason, teamId),
    venueRecord: tally(
      thisSeason
        .filter((g) => (atHome ? g.homeTeamId === teamId : g.awayTeamId === teamId))
        .map((g) => resultFor(g, teamId)),
    ),
  };

  const decided = thisSeason.filter((g) => {
    const r = resultFor(g, teamId);
    return r === 'win' || r === 'loss';
  });
  if (decided.length >= 10) {
    facts.lastTen = tally(decided.slice(0, 10).map((g) => resultFor(g, teamId)));
  }

  const vs = thisSeason.filter((g) => g.homeTeamId === opponentId || g.awayTeamId === opponentId);
  if (vs.length > 0) facts.vsOpponent = tally(vs.map((g) => resultFor(g, teamId)));

  const last = involving.find((g) => g.homeTeamId === opponentId || g.awayTeamId === opponentId);
  if (last) {
    const home = last.homeTeamId === teamId;
    const result = resultFor(last, teamId);
    if (result) {
      facts.lastMeeting = {
        season: last.season,
        teamScore: (home ? last.homeScore : last.awayScore) as number,
        opponentScore: (home ? last.awayScore : last.homeScore) as number,
        result,
      };
    }
  }

  return facts;
}

/**
 * Whether a side has anything worth a sentence.
 *
 * Opening week has a 0-0 record, no streak and possibly no meeting on file. A storyline written
 * from that would be "The Phillies are 0-0", which is true and says nothing, so the generator is
 * not asked for one.
 */
export function hasSomethingToSay(f: TeamFacts): boolean {
  const played = f.seasonRecord.wins + f.seasonRecord.losses + f.seasonRecord.ties;
  return played > 0 || f.lastMeeting !== undefined;
}
