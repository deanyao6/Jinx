import { describe, expect, it } from 'vitest';

import { currentStreak, hasSomethingToSay, teamFacts, type ScheduleGame } from './facts.js';
import { significance } from './significance.js';
import { numbersIn, validateStoryline, type TeamName, type ValidationContext } from './validate.js';

const PHI = 'phi';
const NYM = 'nym';
const ATL = 'atl';

let seq = 0;
function game(
  over: Partial<ScheduleGame> & { home: string; away: string; start: string },
): ScheduleGame {
  seq++;
  return {
    gameId: over.gameId ?? `g${seq}`,
    gameType: over.gameType ?? 'regular',
    status: over.status ?? 'final',
    scheduledStart: over.start,
    season: over.season ?? 2026,
    homeTeamId: over.home,
    awayTeamId: over.away,
    homeScore: over.homeScore ?? null,
    awayScore: over.awayScore ?? null,
  };
}

/** A final where `winner` beats `loser`, with `winner` at home unless `winnerAway`. */
function won(winner: string, loser: string, start: string, winnerAway = false): ScheduleGame {
  return winnerAway
    ? game({ home: loser, away: winner, start, homeScore: 2, awayScore: 5 })
    : game({ home: winner, away: loser, start, homeScore: 5, awayScore: 2 });
}

const UPCOMING = game({
  gameId: 'up',
  home: PHI,
  away: NYM,
  start: '2026-06-01T23:05:00Z',
  status: 'scheduled',
});

describe('currentStreak', () => {
  it('counts consecutive wins back from the most recent', () => {
    const recentFirst = [
      won(PHI, ATL, '2026-05-30T00:00:00Z'),
      won(PHI, ATL, '2026-05-29T00:00:00Z'),
      won(PHI, ATL, '2026-05-28T00:00:00Z'),
      won(ATL, PHI, '2026-05-27T00:00:00Z'),
    ];
    expect(currentStreak(recentFirst, PHI)).toBe(3);
  });

  it('is negative for a losing streak', () => {
    const recentFirst = [
      won(ATL, PHI, '2026-05-30T00:00:00Z'),
      won(ATL, PHI, '2026-05-29T00:00:00Z'),
    ];
    expect(currentStreak(recentFirst, PHI)).toBe(-2);
  });

  it('ends at a tie, which is neither', () => {
    const recentFirst = [
      won(PHI, ATL, '2026-05-30T00:00:00Z'),
      game({ home: PHI, away: ATL, start: '2026-05-29T00:00:00Z', homeScore: 3, awayScore: 3 }),
      won(PHI, ATL, '2026-05-28T00:00:00Z'),
    ];
    expect(currentStreak(recentFirst, PHI)).toBe(1);
  });
});

describe('teamFacts', () => {
  it('uses only games before this one, never the game itself or later ones', () => {
    const history = [
      won(PHI, ATL, '2026-05-30T00:00:00Z'),
      // After the upcoming game: must not count.
      won(PHI, ATL, '2026-06-05T00:00:00Z'),
      // The upcoming game itself, somehow final in the data.
      { ...UPCOMING, status: 'final' as const, homeScore: 9, awayScore: 0 },
    ];
    const f = teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, history);
    expect(f.seasonRecord).toEqual({ wins: 1, losses: 0, ties: 0 });
  });

  it('leaves out spring training', () => {
    const history = [
      { ...won(PHI, ATL, '2026-03-01T00:00:00Z'), gameType: 'preseason' },
      won(PHI, ATL, '2026-04-01T00:00:00Z'),
    ];
    const f = teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, history);
    expect(f.seasonRecord.wins).toBe(1);
  });

  it('keeps the home record for a home game and the road record for a road game', () => {
    const history = [
      won(PHI, ATL, '2026-05-01T00:00:00Z'), // PHI wins at home
      won(ATL, PHI, '2026-05-02T00:00:00Z', true), // ATL wins in Philadelphia: PHI loses at home
      won(PHI, ATL, '2026-05-03T00:00:00Z', true), // PHI wins on the road, so it is not counted
    ];
    const home = teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, history);
    expect(home.atHome).toBe(true);
    expect(home.venueRecord).toEqual({ wins: 1, losses: 1, ties: 0 });

    const away = teamFacts(UPCOMING, NYM, { team: 'Mets', opponent: 'Phillies' }, []);
    expect(away.atHome).toBe(false);
  });

  it("finds the last meeting in any season, from this team's side", () => {
    const history = [{ ...won(NYM, PHI, '2025-09-20T00:00:00Z'), season: 2025 }];
    const f = teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, history);
    expect(f.lastMeeting).toEqual({ season: 2025, teamScore: 2, opponentScore: 5, result: 'loss' });
    // Last season's meeting is history, not this season's head to head.
    expect(f.vsOpponent).toBeUndefined();
  });

  it('only reports the last ten once there are ten', () => {
    const nine = Array.from({ length: 9 }, (_, i) =>
      won(PHI, ATL, `2026-05-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
    );
    expect(
      teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, nine).lastTen,
    ).toBeUndefined();
    const ten = [...nine, won(ATL, PHI, '2026-05-20T00:00:00Z')];
    expect(teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, ten).lastTen).toEqual({
      wins: 9,
      losses: 1,
      ties: 0,
    });
  });

  it('has nothing to say on opening day with no meeting on file', () => {
    const f = teamFacts(UPCOMING, PHI, { team: 'Phillies', opponent: 'Mets' }, []);
    expect(hasSomethingToSay(f)).toBe(false);
  });
});

describe('significance', () => {
  const names = { home: 'Phillies', away: 'Mets' };

  it('is null for an ordinary midseason game', () => {
    const history = [won(PHI, ATL, '2026-05-01T00:00:00Z'), won(NYM, ATL, '2026-05-01T01:00:00Z')];
    expect(significance(UPCOMING, names, history)).toBeNull();
  });

  it('marks a postseason game, with the series score from the home side', () => {
    const g = { ...UPCOMING, gameType: 'postseason' };
    const history = [
      { ...won(PHI, NYM, '2026-05-28T00:00:00Z'), gameType: 'postseason' },
      { ...won(NYM, PHI, '2026-05-29T00:00:00Z', true), gameType: 'postseason' },
      { ...won(PHI, NYM, '2026-05-30T00:00:00Z', true), gameType: 'postseason' },
    ];
    expect(significance(g, names, history)).toEqual({
      kind: 'postseason',
      home: 'Phillies',
      away: 'Mets',
      seriesRecordForHome: { wins: 2, losses: 1, ties: 0 },
    });
  });

  it('marks a season opener, from the schedule rather than a guess', () => {
    expect(significance(UPCOMING, names, [])).toEqual({
      kind: 'season_opener',
      team: 'Phillies',
      season: 2026,
    });
  });

  it('marks a home opener after a road trip', () => {
    const history = [
      won(ATL, PHI, '2026-04-01T00:00:00Z'), // PHI's first game, on the road
      won(NYM, ATL, '2026-04-01T01:00:00Z'),
    ];
    expect(significance(UPCOMING, names, history)).toEqual({
      kind: 'home_opener',
      team: 'Phillies',
      season: 2026,
    });
  });

  it('does not count spring training as having opened the season', () => {
    const history = [{ ...won(PHI, NYM, '2026-03-01T00:00:00Z'), gameType: 'preseason' }];
    expect(significance(UPCOMING, names, history)?.kind).toBe('season_opener');
  });
});

describe('numbersIn', () => {
  it('reads digits and words alike', () => {
    expect(numbersIn('won 5 straight').sort()).toEqual([5]);
    expect(numbersIn('their third straight win').sort()).toEqual([3]);
    expect(numbersIn('a 7-2 record').sort((a, b) => a - b)).toEqual([2, 7]);
  });
});

describe('validateStoryline', () => {
  const phillies: TeamName = { name: 'Philadelphia Phillies', city: 'Philadelphia' };
  const mets: TeamName = { name: 'New York Mets', city: 'New York' };
  const league: TeamName[] = [
    phillies,
    mets,
    { name: 'Atlanta Braves', city: 'Atlanta' },
    { name: 'New York Yankees', city: 'New York' },
    { name: 'Boston Red Sox', city: 'Boston' },
  ];
  const ctx: ValidationContext = { teams: [phillies, mets], league, subject: phillies };
  const facts = {
    team: 'Phillies',
    opponent: 'Mets',
    atHome: true,
    season: 2026,
    seasonRecord: { wins: 34, losses: 22, ties: 0 },
    streak: 5,
    venueRecord: { wins: 20, losses: 8, ties: 0 },
  };
  const ok = (text: string) => validateStoryline(text, facts, ctx);
  const reason = (text: string) => {
    const v = ok(text);
    return v.ok ? null : v.reason;
  };

  it('accepts a sentence built only from the facts', () => {
    expect(ok('The Phillies have won 5 straight and are 20-8 at home.')).toEqual({ ok: true });
    expect(ok("Philadelphia's 5-game winning streak comes home to face the Mets.")).toEqual({
      ok: true,
    });
  });

  it('rejects a number that is not in the facts', () => {
    // The failure this whole module exists for: five straight, reported as seven.
    expect(reason('The Phillies have won 7 straight.')).toBe(
      'It states 7, which is not in the facts.',
    );
    expect(reason('The Phillies have won seven straight.')).toMatch(/states 7/);
  });

  it('rejects a player, who is never in the facts', () => {
    expect(reason('Bryce Harper leads the Phillies into a 5-game streak.')).toMatch(/Harper/);
  });

  it('rejects a third team', () => {
    expect(reason('The Phillies, 5 straight, sit above the Braves.')).toMatch(/Braves/);
    // A shared city is not a third team; the Yankees' name is.
    expect(reason('The Phillies have won 5 straight, better than the Yankees.')).toMatch(/Yankees/);
  });

  it('rejects a storyline that is not about its team', () => {
    expect(reason('The Mets come to town.')).toBe('It does not name the Phillies.');
  });

  it('rejects the claims no fact here can support', () => {
    expect(reason('The Phillies can clinch with a win.')).toMatch(/clinch/);
    expect(reason('The Phillies have won 5 straight for the first time.')).toMatch(/first time/);
    expect(reason('The Phillies renew their rivalry with the Mets.')).toMatch(/rival/);
  });

  it('accepts "first" in its ordinary sense, which is not a count', () => {
    // Regression: "first" was read as the number 1, so this correct opener storyline, built
    // from facts that contain no 1, was rejected.
    const opener = { kind: 'home_opener', team: 'Phillies', season: 2026 };
    expect(
      validateStoryline('The Phillies play their first home game of 2026.', opener, {
        ...ctx,
        subject: null,
      }),
    ).toEqual({ ok: true });
  });

  it('tells a retry the real problem, not a number it never wrote', () => {
    // Regression: "for the first time" came back as "It states 1", which gives the model
    // nothing to fix.
    expect(reason('The Phillies have won 5 straight for the first time.')).toBe(
      '"first time" is a claim the facts cannot support.',
    );
    expect(reason('The Phillies are in first place.')).toMatch(/first place/);
  });

  it("holds Dean's em dash rule in model output too", () => {
    expect(reason('The Phillies — winners of 5 straight — host the Mets.')).toMatch(/em dash/);
  });

  it('rejects anything longer than one short sentence', () => {
    expect(reason('The Phillies have won 5 straight. They host the Mets.')).toBe(
      'It is more than one sentence.',
    );
    expect(reason('The Phillies have won 5 straight')).toBe('It does not end as a sentence.');
    expect(reason(`The Phillies ${'are very good '.repeat(20)}.`)).toMatch(/characters/);
  });

  it('does not mistake an abbreviation for a second sentence', () => {
    const cards: TeamName = { name: 'St. Louis Cardinals', city: 'St. Louis' };
    const v = validateStoryline(
      'The St. Louis Cardinals have won 5 straight.',
      { streak: 5 },
      {
        teams: [cards, mets],
        league: [cards, mets],
        subject: cards,
      },
    );
    expect(v).toEqual({ ok: true });
  });

  it('accepts a two-word nickname', () => {
    const sox: TeamName = { name: 'Boston Red Sox', city: 'Boston' };
    const v = validateStoryline(
      'The Red Sox have won 5 straight.',
      { streak: 5 },
      {
        teams: [sox, mets],
        league,
        subject: sox,
      },
    );
    expect(v).toEqual({ ok: true });
  });

  it('lets a significance storyline name either team, but still checks everything else', () => {
    const sig = {
      kind: 'postseason',
      home: 'Phillies',
      away: 'Mets',
      seriesRecordForHome: { wins: 2, losses: 1, ties: 0 },
    };
    const gameCtx: ValidationContext = { ...ctx, subject: null };
    expect(
      validateStoryline('The Phillies lead the Mets 2-1 in the series.', sig, gameCtx),
    ).toEqual({
      ok: true,
    });
    expect(validateStoryline('The series is tied.', sig, gameCtx)).toEqual({
      ok: false,
      reason: 'It names neither team in the game.',
    });
    expect(validateStoryline('The Phillies lead the series 3-1.', sig, gameCtx)).toMatchObject({
      ok: false,
    });
  });
});
