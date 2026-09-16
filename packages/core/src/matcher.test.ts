import { describe, expect, it } from 'vitest';

import {
  aliasSimilarity,
  editDistance,
  localParts,
  matchTeams,
  normalizeText,
  rankCandidates,
  type CandidateGame,
  type MatchContext,
  type ParsedTicket,
  type TeamRef,
  type VenueRef,
} from './matcher.js';

// ---------------------------------------------------------------------------
// A small universe: MLB Phillies/Mets/Yankees/Dodgers/White Sox, NFL Eagles/Rams/Bears/Packers/Cowboys
// ---------------------------------------------------------------------------
const team = (
  id: string,
  sport: 'mlb' | 'nfl',
  city: string,
  name: string,
  abbr: string,
  aliases: string[] = [],
): TeamRef => ({
  id,
  sport,
  name: `${city} ${name}`,
  city,
  abbreviation: abbr,
  aliases: [name, city, abbr, ...aliases],
});
const teams: TeamRef[] = [
  team('phi', 'mlb', 'Philadelphia', 'Phillies', 'PHI', ['Phils', 'Philly']),
  team('nym', 'mlb', 'New York', 'Mets', 'NYM', ['NY Mets']),
  team('nyy', 'mlb', 'New York', 'Yankees', 'NYY', ['NY Yankees', 'Yanks']),
  team('lad', 'mlb', 'Los Angeles', 'Dodgers', 'LAD', ['LA Dodgers']),
  team('cws', 'mlb', 'Chicago', 'White Sox', 'CWS', ['Sox', 'ChiSox']),
  team('chc', 'mlb', 'Chicago', 'Cubs', 'CHC', ['Cubbies']),
  team('eagles', 'nfl', 'Philadelphia', 'Eagles', 'PHI', ['Birds', 'Philly']),
  team('rams', 'nfl', 'Los Angeles', 'Rams', 'LA', ['LAR', 'LA Rams']),
  team('bears', 'nfl', 'Chicago', 'Bears', 'CHI', ['Da Bears']),
  team('packers', 'nfl', 'Green Bay', 'Packers', 'GB', ['GNB', 'Pack']),
  team('cowboys', 'nfl', 'Dallas', 'Cowboys', 'DAL'),
];
const venues: VenueRef[] = [
  { id: 'cbp', name: 'Citizens Bank Park', aliases: ['CBP', 'The Bank'], tz: 'America/New_York' },
  { id: 'citi', name: 'Citi Field', aliases: [], tz: 'America/New_York' },
  { id: 'ys', name: 'Yankee Stadium', aliases: [], tz: 'America/New_York' },
  { id: 'dodger', name: 'Dodger Stadium', aliases: ['Chavez Ravine'], tz: 'America/Los_Angeles' },
  {
    id: 'rate',
    name: 'Rate Field',
    aliases: ['Guaranteed Rate Field', 'U.S. Cellular Field', 'Comiskey Park', 'The Cell'],
    tz: 'America/Chicago',
  },
  { id: 'wrigley', name: 'Wrigley Field', aliases: [], tz: 'America/Chicago' },
  { id: 'linc', name: 'Lincoln Financial Field', aliases: ['The Linc'], tz: 'America/New_York' },
  { id: 'sofi', name: 'SoFi Stadium', aliases: [], tz: 'America/Los_Angeles' },
  { id: 'soldier', name: 'Soldier Field', aliases: [], tz: 'America/Chicago' },
  {
    id: 'att',
    name: 'AT&T Stadium',
    aliases: ['Jerry World', 'Cowboys Stadium'],
    tz: 'America/Chicago',
  },
];
const ctx: MatchContext = { teams, venues };

let seq = 0;
const game = (
  p: Partial<CandidateGame> & {
    scheduledStart: string;
    homeTeamId: string;
    awayTeamId: string;
    venueId: string;
    sport: 'mlb' | 'nfl';
  },
): CandidateGame => ({
  id: p.id ?? `g${++seq}`,
  status: 'final',
  doubleheaderNumber: null,
  rescheduledToGameId: null,
  ...p,
});

// Candidate pool (the DB would normally narrow by date +/- 1 day; we pass the whole pool to be strict).
const G = {
  phiMets0915: game({
    id: 'phi-nym-0915',
    sport: 'mlb',
    scheduledStart: '2024-09-15T17:35:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
  }),
  phiMets0914: game({
    id: 'phi-nym-0914',
    sport: 'mlb',
    scheduledStart: '2024-09-14T22:05:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
  }),
  phiMets0913: game({
    id: 'phi-nym-0913',
    sport: 'mlb',
    scheduledStart: '2024-09-13T23:40:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
  }),
  metsPhi0520: game({
    id: 'nym-phi-0520',
    sport: 'mlb',
    scheduledStart: '2024-05-20T23:10:00Z',
    homeTeamId: 'nym',
    awayTeamId: 'phi',
    venueId: 'citi',
  }),
  yanksPhi0730: game({
    id: 'nyy-phi-0730',
    sport: 'mlb',
    scheduledStart: '2024-07-30T23:05:00Z',
    homeTeamId: 'nyy',
    awayTeamId: 'phi',
    venueId: 'ys',
  }),
  dodgersPhi0806: game({
    id: 'lad-phi-0806',
    sport: 'mlb',
    scheduledStart: '2024-08-07T02:10:00Z',
    homeTeamId: 'lad',
    awayTeamId: 'phi',
    venueId: 'dodger',
  }), // 7:10 PM PT on Aug 6
  cwsCubs0610: game({
    id: 'cws-chc-0610',
    sport: 'mlb',
    scheduledStart: '2024-06-10T23:40:00Z',
    homeTeamId: 'cws',
    awayTeamId: 'chc',
    venueId: 'rate',
  }),
  dh1: game({
    id: 'phi-nym-dh1',
    sport: 'mlb',
    scheduledStart: '2024-06-22T17:05:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
    doubleheaderNumber: 1,
  }),
  dh2: game({
    id: 'phi-nym-dh2',
    sport: 'mlb',
    scheduledStart: '2024-06-22T22:35:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
    doubleheaderNumber: 2,
  }),
  postponed: game({
    id: 'phi-nym-0328',
    sport: 'mlb',
    scheduledStart: '2024-03-28T19:05:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
    status: 'postponed',
    rescheduledToGameId: 'phi-nym-0329',
  }),
  makeup: game({
    id: 'phi-nym-0329',
    sport: 'mlb',
    scheduledStart: '2024-03-29T19:05:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
  }),
  eaglesRams1124: game({
    id: 'rams-eagles-1124',
    sport: 'nfl',
    scheduledStart: '2024-11-24T21:25:00Z',
    homeTeamId: 'rams',
    awayTeamId: 'eagles',
    venueId: 'sofi',
  }),
  eaglesCowboys1229: game({
    id: 'eagles-dal-1229',
    sport: 'nfl',
    scheduledStart: '2024-12-29T18:00:00Z',
    homeTeamId: 'eagles',
    awayTeamId: 'cowboys',
    venueId: 'linc',
  }),
  bearsPackers1117: game({
    id: 'bears-gb-1117',
    sport: 'nfl',
    scheduledStart: '2024-11-17T18:00:00Z',
    homeTeamId: 'bears',
    awayTeamId: 'packers',
    venueId: 'soldier',
  }),
  cowboysEagles1110: game({
    id: 'dal-eagles-1110',
    sport: 'nfl',
    scheduledStart: '2024-11-10T21:25:00Z',
    homeTeamId: 'cowboys',
    awayTeamId: 'eagles',
    venueId: 'att',
  }),
  eaglesPre0809: game({
    id: 'eagles-pre',
    sport: 'nfl',
    scheduledStart: '2024-08-09T23:00:00Z',
    homeTeamId: 'eagles',
    awayTeamId: 'rams',
    venueId: 'linc',
  }),
  phiMetsPost1004: game({
    id: 'phi-nym-nlds1',
    sport: 'mlb',
    scheduledStart: '2024-10-05T20:08:00Z',
    homeTeamId: 'phi',
    awayTeamId: 'nym',
    venueId: 'cbp',
  }),
};
const pool = Object.values(G);

const ticket = (p: Partial<ParsedTicket>): ParsedTicket => ({
  sport: 'unknown',
  home_team: '',
  away_team: '',
  date_local: null,
  time_local: null,
  venue: '',
  section: '',
  row: '',
  seat: '',
  price: null,
  ticketing_platform: '',
  confidence: 0.9,
  ...p,
});

interface Case {
  name: string;
  ticket: ParsedTicket;
  expect: string | null;
  decision: 'matched' | 'needs_review' | 'failed';
  makeup?: string;
}

const cases: Case[] = [
  {
    name: 'clean Ticketmaster',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Philadelphia Phillies',
      away_team: 'New York Mets',
      date_local: '2024-09-15',
      time_local: '13:35',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'nickname only',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-09-15',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'misspelled team',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Philies',
      away_team: 'Mets',
      date_local: '2024-09-15',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'abbreviations',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'PHI',
      away_team: 'NYM',
      date_local: '2024-09-15',
      venue: 'CBP',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'swapped orientation "Mets vs Phillies"',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Mets',
      away_team: 'Phillies',
      date_local: '2024-09-15',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'city-only names with venue',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Philadelphia',
      away_team: 'New York',
      date_local: '2024-09-15',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'no venue, unknown sport',
    ticket: ticket({ home_team: 'Phillies', away_team: 'Mets', date_local: '2024-09-15' }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'date one day late (email dated next morning)',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-09-16',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0915',
    decision: 'matched',
  },
  {
    name: 'west coast night game, UTC date is next day',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Dodgers',
      away_team: 'Phillies',
      date_local: '2024-08-06',
      time_local: '19:10',
      venue: 'Dodger Stadium',
    }),
    expect: 'lad-phi-0806',
    decision: 'matched',
  },
  {
    name: 'old naming-rights venue name',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'White Sox',
      away_team: 'Cubs',
      date_local: '2024-06-10',
      venue: 'Guaranteed Rate Field',
    }),
    expect: 'cws-chc-0610',
    decision: 'matched',
  },
  {
    name: 'ancient venue name',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Chicago White Sox',
      away_team: 'Chicago Cubs',
      date_local: '2024-06-10',
      venue: 'Comiskey Park',
    }),
    expect: 'cws-chc-0610',
    decision: 'matched',
  },
  {
    name: 'ambiguous Chicago vs Chicago without nicknames',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Chicago',
      away_team: 'Chicago',
      date_local: '2024-06-10',
      venue: 'Rate Field',
    }),
    expect: 'cws-chc-0610',
    decision: 'matched',
  },
  {
    name: 'doubleheader game 1 by time',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-06-22',
      time_local: '13:05',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-dh1',
    decision: 'matched',
  },
  {
    name: 'doubleheader game 2 by time',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-06-22',
      time_local: '18:35',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-dh2',
    decision: 'matched',
  },
  {
    name: 'doubleheader without time asks',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-06-22',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-dh1',
    decision: 'needs_review',
  },
  {
    name: 'postponed game suggests makeup',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-03-28',
      time_local: '15:05',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-0328',
    decision: 'matched',
    makeup: 'phi-nym-0329',
  },
  {
    name: 'postseason game',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-10-05',
      time_local: '16:08',
      venue: 'Citizens Bank Park',
    }),
    expect: 'phi-nym-nlds1',
    decision: 'matched',
  },
  {
    name: 'Yankees vs Phillies at the Stadium',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'New York Yankees',
      away_team: 'Philadelphia Phillies',
      date_local: '2024-07-30',
      venue: 'Yankee Stadium',
    }),
    expect: 'nyy-phi-0730',
    decision: 'matched',
  },
  {
    name: 'NY ambiguity resolved by venue',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'New York',
      away_team: 'Philadelphia',
      date_local: '2024-05-20',
      venue: 'Citi Field',
    }),
    expect: 'nym-phi-0520',
    decision: 'matched',
  },
  {
    name: 'NY ambiguity with no venue resolved by date',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'New York',
      away_team: 'Philadelphia',
      date_local: '2024-05-20',
    }),
    expect: 'nym-phi-0520',
    decision: 'matched',
  },
  {
    name: 'NFL clean',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Los Angeles Rams',
      away_team: 'Philadelphia Eagles',
      date_local: '2024-11-24',
      time_local: '13:25',
      venue: 'SoFi Stadium',
    }),
    expect: 'rams-eagles-1124',
    decision: 'matched',
  },
  {
    name: 'NFL "Eagles at Rams" phrasing',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Rams',
      away_team: 'Eagles',
      date_local: '2024-11-24',
      venue: 'SoFi',
    }),
    expect: 'rams-eagles-1124',
    decision: 'matched',
  },
  {
    name: 'NFL misspelled Eagels',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Eagels',
      away_team: 'Cowboys',
      date_local: '2024-12-29',
      venue: 'Lincoln Financial Field',
    }),
    expect: 'eagles-dal-1229',
    decision: 'matched',
  },
  {
    name: 'NFL nickname venue Jerry World',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Dallas Cowboys',
      away_team: 'Philadelphia Eagles',
      date_local: '2024-11-10',
      venue: 'Jerry World',
    }),
    expect: 'dal-eagles-1110',
    decision: 'matched',
  },
  {
    name: 'NFL preseason',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Eagles',
      away_team: 'Rams',
      date_local: '2024-08-09',
      venue: 'Lincoln Financial Field',
    }),
    expect: 'eagles-pre',
    decision: 'matched',
  },
  {
    name: 'Philly ambiguity resolved by sport',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Philly',
      away_team: 'Dallas',
      date_local: '2024-12-29',
    }),
    expect: 'eagles-dal-1229',
    decision: 'matched',
  },
  {
    name: 'Bears Packers with The Linc typo-free',
    ticket: ticket({
      sport: 'nfl',
      home_team: 'Chicago Bears',
      away_team: 'Green Bay Packers',
      date_local: '2024-11-17',
      time_local: '12:00',
      venue: 'Soldier Field',
    }),
    expect: 'bears-gb-1117',
    decision: 'matched',
  },
  {
    name: 'GNB abbreviation',
    ticket: ticket({ sport: 'nfl', home_team: 'CHI', away_team: 'GNB', date_local: '2024-11-17' }),
    expect: 'bears-gb-1117',
    decision: 'matched',
  },
  {
    name: 'wrong date entirely',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Phillies',
      away_team: 'Mets',
      date_local: '2024-01-15',
      venue: 'Citizens Bank Park',
    }),
    expect: null,
    decision: 'failed',
  },
  {
    name: 'unknown teams',
    ticket: ticket({
      sport: 'mlb',
      home_team: 'Springfield Isotopes',
      away_team: 'Shelbyville',
      date_local: '2024-09-15',
    }),
    expect: null,
    decision: 'failed',
  },
  {
    name: 'concert ticket',
    ticket: ticket({
      sport: 'unknown',
      home_team: '',
      away_team: '',
      date_local: '2024-09-15',
      venue: 'Citizens Bank Park',
    }),
    expect: null,
    decision: 'failed',
  },
  {
    name: 'only a date and venue',
    ticket: ticket({ sport: 'mlb', date_local: '2024-09-15', venue: 'Citizens Bank Park' }),
    expect: null,
    decision: 'failed',
  },
];

describe('normalization', () => {
  it('normalizes punctuation and accents', () => {
    expect(normalizeText('Estadio Alfredo Harp Helú!')).toBe('estadio alfredo harp helu');
    expect(normalizeText('AT&T Stadium')).toBe('at and t stadium');
  });
  it('edit distance', () => {
    expect(editDistance('philies', 'phillies')).toBe(1);
    expect(editDistance('eagels', 'eagles')).toBe(1);
  });
  it('alias similarity tolerates misspellings and containment', () => {
    expect(aliasSimilarity('Philadelphia Phillies', 'Phillies')).toBeGreaterThan(0.8);
    expect(aliasSimilarity('Philies', 'Phillies')).toBeGreaterThan(0.6);
    expect(aliasSimilarity('Cowboys', 'Phillies')).toBe(0);
  });
  it('matchTeams respects the sport hint', () => {
    const m = matchTeams('Philly', teams, 'nfl');
    expect(m[0]?.team.id).toBe('eagles');
  });
  it('localParts renders venue-local date and time', () => {
    expect(localParts('2024-08-07T02:10:00Z', 'America/Los_Angeles')).toEqual({
      date: '2024-08-06',
      minutes: 19 * 60 + 10,
    });
  });
});

describe('rankCandidates fixture suite', () => {
  it('has at least 30 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });
  for (const c of cases) {
    it(c.name, () => {
      const r = rankCandidates(c.ticket, pool, ctx);
      expect(r.decision).toBe(c.decision);
      if (c.expect) expect(r.candidates[0]?.game.id).toBe(c.expect);
      if (c.makeup) expect(r.makeupGameId).toBe(c.makeup);
      if (c.name.startsWith('doubleheader without time'))
        expect(r.doubleheaderAmbiguous).toBe(true);
    });
  }
});
