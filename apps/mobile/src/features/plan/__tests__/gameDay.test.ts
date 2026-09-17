import type { TeamRef } from '@/features/data/names';

import {
  gameDayFromUpcoming,
  nextUpcoming,
  timeline,
  whenLine,
  type UpcomingGame,
} from '../gameDay';

/** Everything is pinned to Eastern time, so these do not change with the machine running them. */
const TZ = 'America/New_York';
const HOUR = 3_600_000;

const PHI = 'team-phi';
const NYM = 'team-nym';
const TEAMS = new Map<string, TeamRef>([
  [PHI, { id: PHI, name: 'Philadelphia Phillies', city: 'Philadelphia', abbreviation: 'PHI' }],
  [NYM, { id: NYM, name: 'New York Mets', city: 'New York', abbreviation: 'NYM' }],
]);

/** Friday 2026-09-18, 9:00 AM Eastern. */
const NOW = Date.parse('2026-09-18T13:00:00Z');

function going(over: {
  start: string;
  status?: string;
  sport?: string;
  rooting?: string | null;
  seat?: UpcomingGame['seat'];
  companions?: string[];
  id?: string;
}): UpcomingGame {
  return {
    rooting_team_id: over.rooting === undefined ? PHI : over.rooting,
    seat: over.seat ?? null,
    companions: (over.companions ?? []).map((name, i) => ({
      person: { id: `p${i}`, display_name: name },
    })),
    game: {
      id: over.id ?? 'g1',
      sport_id: over.sport ?? 'mlb',
      status: over.status ?? 'scheduled',
      scheduled_start: over.start,
      home: { id: PHI, name: 'Philadelphia Phillies' },
      away: { id: NYM, name: 'New York Mets' },
      venue: { name: 'Citizens Bank Park' },
    },
  };
}

// 7:05 PM Eastern, on the same Friday as NOW.
const TONIGHT = '2026-09-18T23:05:00Z';

describe('nextUpcoming', () => {
  it('picks the soonest game you are going to, not the first one logged', () => {
    const later = going({ id: 'later', start: '2026-09-25T23:05:00Z' });
    const sooner = going({ id: 'sooner', start: TONIGHT });
    expect(nextUpcoming([later, sooner], NOW)?.game.id).toBe('sooner');
  });

  it('skips a game that will not be played', () => {
    const off = [
      going({ id: 'final', start: TONIGHT, status: 'final' }),
      going({ id: 'ppd', start: TONIGHT, status: 'postponed' }),
      going({ id: 'cxl', start: TONIGHT, status: 'cancelled' }),
    ];
    expect(nextUpcoming(off, NOW)).toBeNull();
  });

  it('keeps a game while you are still in the building', () => {
    // Started two hours ago and not final yet: this is exactly when you want the plan.
    const inProgress = going({ start: new Date(NOW - 2 * HOUR).toISOString() });
    expect(nextUpcoming([inProgress], NOW)).not.toBeNull();
  });

  it('drops a game once its check-in window would have closed', () => {
    // SPEC 6.3: six hours after the start when the final time is not known.
    const long = going({ start: new Date(NOW - 7 * HOUR).toISOString() });
    expect(nextUpcoming([long], NOW)).toBeNull();
  });
});

describe('whenLine', () => {
  it('says today and tomorrow where a weekday would be less clear', () => {
    expect(whenLine(Date.parse(TONIGHT), NOW, TZ)).toBe('Today, 7:05 PM');
    expect(whenLine(Date.parse('2026-09-19T23:05:00Z'), NOW, TZ)).toBe('Tomorrow, 7:05 PM');
  });

  it('uses a weekday inside the coming week', () => {
    expect(whenLine(Date.parse('2026-09-21T23:05:00Z'), NOW, TZ)).toBe('Monday, 7:05 PM');
  });

  it('spells out the date past a week, where "Sunday" would be ambiguous', () => {
    expect(whenLine(Date.parse('2026-10-04T17:25:00Z'), NOW, TZ)).toBe('Sun, Oct 4, 1:25 PM');
  });

  it('decides today by the calendar in the time zone, not by 24 hours', () => {
    // 11:30 PM Friday and 12:30 AM Saturday are an hour apart and on different days.
    const lateFriday = Date.parse('2026-09-19T03:30:00Z');
    const earlySaturday = Date.parse('2026-09-19T04:30:00Z');
    expect(whenLine(earlySaturday, lateFriday, TZ)).toBe('Tomorrow, 12:30 AM');
  });
});

describe('timeline', () => {
  const game = going({ start: TONIGHT }).game;

  it('holds only schedule facts and rules the app enforces', () => {
    const steps = timeline(game, 'Mets at Phillies', false, NOW, TZ);
    expect(steps.map((s) => [s.time, s.icon])).toEqual([
      ['4:05 PM', 'i-verified'], // SPEC 6.3: three hours before the start
      ['7:05 PM', 'i-flag'],
      ['Final', 'i-spark'],
    ]);
    // Nothing the reference invents: no drive time, lot, gate line or bar.
    const all = steps.map((s) => s.text).join(' ');
    expect(all).not.toMatch(/traffic|lot|gate|tailgate|bar|fans going/i);
  });

  it('adds the pick lock for a game you are neutral at, worded as SPEC 6.4 words it', () => {
    const mlb = timeline(game, 'Mets at Phillies', true, NOW, TZ);
    const lock = mlb.find((s) => s.icon === 'i-lock');
    expect(lock?.time).toBe('End of the 1st');
    expect(lock?.text).toBe(
      'Picks lock at the first run or the end of the 1st, whichever comes first.',
    );
    expect(mlb[0]?.text).toContain('then pick a side');

    const nfl = timeline({ ...game, sport_id: 'nfl' }, 'Bears at Eagles', true, NOW, TZ);
    expect(nfl.find((s) => s.icon === 'i-lock')?.text).toBe(
      'Picks lock at the first score or 10:00 in the 1st quarter.',
    );
    expect(nfl[1]?.text).toBe('Kickoff. Bears at Eagles.');
  });

  it('never shows a lock when you already have a side', () => {
    const steps = timeline(game, 'Mets at Phillies', false, NOW, TZ);
    expect(steps.some((s) => s.icon === 'i-lock')).toBe(false);
  });

  it('lights the next step that has not happened yet', () => {
    // 9 AM: check-in at 4:05 PM is next.
    expect(timeline(game, 'x', false, NOW, TZ).map((s) => s.now)).toEqual([true, false, false]);
    // 5 PM: check-in is open, first pitch is next.
    const five = Date.parse('2026-09-18T21:00:00Z');
    expect(timeline(game, 'x', false, five, TZ).map((s) => s.now)).toEqual([false, true, false]);
  });

  it('keeps one step lit after everything has passed', () => {
    const tomorrow = Date.parse('2026-09-19T13:00:00Z');
    const lit = timeline(game, 'x', false, tomorrow, TZ).filter((s) => s.now);
    expect(lit).toHaveLength(1);
  });
});

describe('gameDayFromUpcoming', () => {
  it('builds the ticket from a real going game', () => {
    const plan = gameDayFromUpcoming(
      [
        going({
          start: TONIGHT,
          seat: { section: '121', row: '14', seat: '7' },
          companions: ['Maya', 'Jordan'],
        }),
      ],
      TEAMS,
      NOW,
      TZ,
    );
    expect(plan).toMatchObject({
      team: PHI,
      matchup: 'Mets at Phillies',
      when: 'Today, 7:05 PM, Citizens Bank Park',
      seat: [
        { label: 'Section', value: '121' },
        { label: 'Row', value: '14' },
        { label: 'Seat', value: '7' },
      ],
      companionsText: 'Going with Maya and Jordan',
    });
    // The kickoff line and the ticket agree on the names, because they share one string.
    expect(plan?.timeline[1]?.text).toBe('First pitch. Mets at Phillies.');
  });

  it('shows only the seat fields you logged, and never a Gate', () => {
    const plan = gameDayFromUpcoming(
      [going({ start: TONIGHT, seat: { section: '121', row: null, seat: null } })],
      TEAMS,
      NOW,
      TZ,
    );
    expect(plan?.seat).toEqual([{ label: 'Section', value: '121' }]);
  });

  it('says nothing about companions when you are going alone', () => {
    const plan = gameDayFromUpcoming([going({ start: TONIGHT })], TEAMS, NOW, TZ);
    expect(plan?.companionsText).toBe('');
    expect(plan?.companions).toEqual([]);
  });

  it('themes a neutral game in the home team, and adds the lock', () => {
    const plan = gameDayFromUpcoming([going({ start: TONIGHT, rooting: null })], TEAMS, NOW, TZ);
    expect(plan?.team).toBe(PHI);
    expect(plan?.timeline.some((s) => s.icon === 'i-lock')).toBe(true);
  });

  it('is null when there is nothing coming up', () => {
    expect(gameDayFromUpcoming([], TEAMS, NOW, TZ)).toBeNull();
  });
});
