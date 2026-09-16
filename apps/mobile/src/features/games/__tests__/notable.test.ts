import type { ReliveStep } from '@/features/data/shapes';

import type { AppearanceRow, GameEventRow } from '../queries';
import { notablePlayers, othersLine } from '../notable';

const PHI = 'team-phi';
const NYM = 'team-nym';

function appearance(teamId: string, id: string, name: string): AppearanceRow {
  return { team_id: teamId, player: { id, full_name: name } };
}

function event(type: string, playerId: string, name: string, detail = {}): GameEventRow {
  return {
    id: `e-${playerId}-${type}`,
    type,
    team_id: PHI,
    occurred_at: null,
    detail,
    player: { id: playerId, full_name: name },
  } as GameEventRow;
}

describe('notablePlayers', () => {
  const appearances = [
    appearance(PHI, 'p-harper', 'Bryce Harper'),
    appearance(PHI, 'p-turner', 'Trea Turner'),
    appearance(PHI, 'p-bohm', 'Alec Bohm'),
    appearance(NYM, 'p-lindor', 'Francisco Lindor'),
  ];

  it('names only the players who did something, and counts the rest', () => {
    const groups = notablePlayers(appearances, [event('home_run', 'p-harper', 'Bryce Harper')]);
    const phi = groups.find((g) => g.teamId === PHI);
    expect(phi?.notable.map((n) => [n.name, n.did])).toEqual([['Bryce Harper', 'Home run']]);
    // The other two are counted, not printed. This is the whole point of the change.
    expect(phi?.others).toEqual(['Alec Bohm', 'Trea Turner']);
  });

  it('keeps a team with no moments as a pure count', () => {
    const groups = notablePlayers(appearances, []);
    const nym = groups.find((g) => g.teamId === NYM);
    expect(nym?.notable).toEqual([]);
    expect(nym?.others).toEqual(['Francisco Lindor']);
  });

  it('names a player once however many moments they had', () => {
    const groups = notablePlayers(appearances, [
      event('home_run', 'p-harper', 'Bryce Harper'),
      event('grand_slam', 'p-harper', 'Bryce Harper'),
    ]);
    const phi = groups.find((g) => g.teamId === PHI);
    expect(phi?.notable).toHaveLength(1);
    expect(phi?.notable[0]?.did).toBe('Home run, Grand slam');
  });

  it('does not repeat the same moment type for one player', () => {
    const groups = notablePlayers(appearances, [
      event('home_run', 'p-harper', 'Bryce Harper'),
      event('home_run', 'p-harper', 'Bryce Harper'),
    ]);
    expect(groups.find((g) => g.teamId === PHI)?.notable[0]?.did).toBe('Home run');
  });

  it('carries the detail a moment has, so a field goal says how long', () => {
    const groups = notablePlayers(
      [appearance(PHI, 'p-elliott', 'Jake Elliott')],
      [event('long_field_goal', 'p-elliott', 'Jake Elliott', { yards: 61 })],
    );
    expect(groups[0]?.notable[0]?.did).toBe('Long field goal · 61 yards');
  });

  it('ignores an appearance with no player join and a moment with no player', () => {
    const groups = notablePlayers(
      [...appearances, { team_id: PHI, player: null }],
      [{ ...event('overtime', 'x', 'x'), player: null } as GameEventRow],
    );
    const phi = groups.find((g) => g.teamId === PHI);
    expect(phi?.notable).toEqual([]);
    expect(phi?.others).toEqual(['Alec Bohm', 'Bryce Harper', 'Trea Turner']);
  });
});

describe('othersLine', () => {
  it('counts the unnamed players, and says nothing when there are none', () => {
    expect(othersLine(0)).toBeNull();
    expect(othersLine(1)).toBe('and 1 other player');
    expect(othersLine(23)).toBe('and 23 other players');
  });
});

describe('scoring plays as a source of notable players', () => {
  // The gap this closes: game_events holds only RARE moments, so an ordinary touchdown was
  // nowhere and every NFL game named nobody. Dean asked for "the players who like scored a
  // td or a home run"; the touchdown half lives on the story steps.
  const step = (scorerId: string | null): ReliveStep => ({
    wp: 1,
    score: '7 – 0',
    label: '1st quarter',
    text: 'D.Swift right guard for 3 yards, TOUCHDOWN.',
    scorerId,
    scorerName: 'D.Swift',
  });

  it('names a player who scored, with no moment recorded at all', () => {
    const groups = notablePlayers(
      [appearance(PHI, 'p-swift', 'David Montgomery'), appearance(PHI, 'p-bench', 'A Benchwarmer')],
      [],
      [step('p-swift')],
    );
    expect(groups[0]?.notable.map((n) => [n.name, n.did])).toEqual([
      ['David Montgomery', 'Scored'],
    ]);
    expect(groups[0]?.others).toEqual(['A Benchwarmer']);
  });

  it('says a scorer scored once, however many times they did it', () => {
    const groups = notablePlayers(
      [appearance(PHI, 'p-swift', 'David Montgomery')],
      [],
      [step('p-swift'), step('p-swift')],
    );
    expect(groups[0]?.notable[0]?.did).toBe('Scored');
  });

  it('combines a score with the rarer moment that describes it', () => {
    const groups = notablePlayers(
      [appearance(PHI, 'p-swift', 'David Montgomery')],
      [event('pick_six', 'p-swift', 'David Montgomery', { yards: 42 })],
      [step('p-swift')],
    );
    expect(groups[0]?.notable[0]?.did).toBe('Scored, Pick six · 42 yards');
  });

  it('ignores a step with no scorer, which is every MLB step and every pregame one', () => {
    const groups = notablePlayers([appearance(PHI, 'p-a', 'Someone')], [], [step(null)]);
    expect(groups[0]?.notable).toEqual([]);
    expect(groups[0]?.others).toEqual(['Someone']);
  });
});
