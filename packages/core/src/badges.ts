/**
 * The badge catalog (docs/prompts/social/04, section 5; 00_repo_reality.md R6). Every criteria
 * is a `GoalDefinition`, evaluated by the same predicate evaluator as goals and bucket lists
 * (SPEC 6.13) so badges are a data change, not a code change, once seeded.
 *
 * This file is the source both `supabase/functions/evaluate-badges` seeds from
 * (`ingest/src/social/seedBadges.ts`) and `badges.test.ts` runs fixtures against. Adding a new
 * badge after launch can be a plain SQL insert into `public.badges`; this catalog only needs to
 * stay in sync for the ones shipped here.
 *
 * Eight badges (`is_secret: true`) are the easter eggs in `features/eggs/flags.ts`. Four of them
 * (`curse_breaker`, `golden_stamps`, `worn_stamps`, `certified_jinx`) have a faithful data
 * predicate. The other four (`record_rewind`, `rally_cap`, `stretch_confetti`,
 * `secret_handshake`) are live or UI-gesture eggs with nothing persisted to evaluate against, so
 * their criteria is a best-effort proxy for "you could have found this" rather than "you did";
 * the egg's own trigger is unchanged. Said plainly in docs/COMMUNITIES.md.
 */
import type { GoalDefinition } from './goals.js';
import type { Sport } from './types.js';

export type BadgeTier = 'standard' | 'rare' | 'legendary';

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  criteria: GoalDefinition;
  tier: BadgeTier;
  sport: Sport | null;
  isSecret: boolean;
}

export const BADGE_CATALOG: readonly BadgeDef[] = [
  {
    key: 'three_parks_weekend',
    name: 'Three parks in one weekend',
    description: 'Games at three different stadiums within a three-day span.',
    criteria: { type: 'distinct_venues_in_window', target: 3, windowDays: 3 },
    tier: 'rare',
    sport: null,
    isSecret: false,
  },
  {
    key: 'walk_off_witnessed',
    name: 'Walk-off witnessed',
    description: 'The home team won it in their last at-bat, live.',
    criteria: { type: 'exists', filter: { event: 'walk_off' } },
    tier: 'standard',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'opening_day_x3',
    name: 'Opening Day regular',
    description: 'Three Opening Days, any team.',
    criteria: { type: 'count', target: 3, filter: { opening_day: true } },
    tier: 'standard',
    sport: null,
    isSecret: false,
  },
  {
    key: 'three_time_zones',
    name: 'Three time zones',
    description: 'Games attended across three different time zones.',
    criteria: { type: 'distinct_timezones', target: 3 },
    tier: 'rare',
    sport: null,
    isSecret: false,
  },
  {
    key: 'arctic_game',
    name: 'Arctic game',
    description: '19°F or colder at first pitch or kickoff.',
    criteria: { type: 'exists', filter: { temperature_max: 19 } },
    tier: 'standard',
    sport: null,
    isSecret: false,
  },
  {
    key: 'undefeated_companion',
    name: 'Undefeated together',
    description: 'Five or more games with one companion, never a loss.',
    criteria: { type: 'companion_record', minGames: 5, minWinPct: 1 },
    tier: 'rare',
    sport: null,
    isSecret: false,
  },
  {
    key: 'no_hitter_witnessed',
    name: 'No-hitter',
    description: 'One of the rarest things in baseball, live.',
    criteria: { type: 'exists', filter: { event: 'no_hitter' } },
    tier: 'legendary',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'extra_innings_road',
    name: 'Extra innings on the road',
    description: 'Free baseball, away from home.',
    criteria: { type: 'exists', filter: { event: 'extra_innings', venue_not_home: true } },
    tier: 'standard',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'doubleheader',
    name: 'Doubleheader',
    description: 'Both games, one day.',
    criteria: { type: 'exists', filter: { doubleheader: true } },
    tier: 'standard',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'new_stadium_new_state',
    name: 'New stadium, new state',
    description: 'A first visit to both the venue and the state it is in.',
    criteria: { type: 'exists', filter: { new_venue: true, new_state: true } },
    tier: 'standard',
    sport: null,
    isSecret: false,
  },
  {
    key: 'thousand_mile_road_game',
    name: 'Road warrior',
    description: "Your team's road game, 1,000 or more miles from home.",
    criteria: { type: 'exists', filter: { venue_not_home: true, min_distance_miles: 1000 } },
    tier: 'rare',
    sport: null,
    isSecret: false,
  },
  {
    key: 'grand_slam_witnessed',
    name: 'Grand slam',
    description: 'Bases loaded, gone.',
    criteria: { type: 'exists', filter: { event: 'grand_slam' } },
    tier: 'rare',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'cycle_witnessed',
    name: 'The cycle',
    description: 'Single, double, triple and home run, one player, one game.',
    criteria: { type: 'exists', filter: { event: 'cycle' } },
    tier: 'legendary',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'perfect_game_witnessed',
    name: 'Perfect game',
    description: '27 up, 27 down.',
    criteria: { type: 'exists', filter: { event: 'perfect_game' } },
    tier: 'legendary',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'immaculate_inning_witnessed',
    name: 'Immaculate inning',
    description: 'Nine pitches, three strikeouts.',
    criteria: { type: 'exists', filter: { event: 'immaculate_inning' } },
    tier: 'legendary',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'shutout_witnessed',
    name: 'Shutout',
    description: 'Nine innings, zero runs allowed.',
    criteria: { type: 'exists', filter: { event: 'shutout' } },
    tier: 'standard',
    sport: 'mlb',
    isSecret: false,
  },
  {
    key: 'buzzer_beater_witnessed',
    name: 'Buzzer-beater',
    description: 'A shot that beat the clock.',
    criteria: { type: 'exists', filter: { event: 'buzzer_beater' } },
    tier: 'rare',
    sport: 'nba',
    isSecret: false,
  },
  {
    key: 'nba_overtime_win',
    name: 'Overtime win',
    description: 'Your side survived the extra period.',
    criteria: { type: 'exists', filter: { event: 'overtime', result: 'win' } },
    tier: 'standard',
    sport: 'nba',
    isSecret: false,
  },
  {
    key: 'nfl_overtime_win',
    name: 'Overtime win',
    description: 'Your side survived sudden death.',
    criteria: { type: 'exists', filter: { event: 'overtime', result: 'win' } },
    tier: 'standard',
    sport: 'nfl',
    isSecret: false,
  },
  {
    key: 'nfl_big_comeback',
    name: 'Big comeback',
    description: 'Down 14, your side won it.',
    criteria: { type: 'exists', filter: { event: 'comeback_14', result: 'win' } },
    tier: 'rare',
    sport: 'nfl',
    isSecret: false,
  },
  {
    key: 'nba_big_comeback',
    name: 'Big comeback',
    description: 'Down 20, your side won it.',
    criteria: { type: 'exists', filter: { event: 'comeback_20', result: 'win' } },
    tier: 'rare',
    sport: 'nba',
    isSecret: false,
  },
  {
    key: 'hat_trick_witnessed',
    name: 'Hat trick',
    description: 'Three goals, one player, one match.',
    criteria: { type: 'exists', filter: { event: 'hat_trick' } },
    tier: 'rare',
    sport: 'mls',
    isSecret: false,
  },
  {
    key: 'mls_shootout_witnessed',
    name: 'Shootout',
    description: 'Level after extra time, decided from the spot.',
    criteria: { type: 'exists', filter: { event: 'shootout' } },
    tier: 'standard',
    sport: 'mls',
    isSecret: false,
  },
  {
    key: 'ten_stadiums',
    name: 'Ten stadiums',
    description: 'Ten different venues, any sport.',
    criteria: { type: 'distinct_venues', target: 10 },
    tier: 'standard',
    sport: null,
    isSecret: false,
  },
  {
    key: 'hundred_games',
    name: 'Century club',
    description: '100 games attended, lifetime.',
    criteria: { type: 'count', target: 100 },
    tier: 'rare',
    sport: null,
    isSecret: false,
  },
  // -- The eight easter eggs, is_secret (00_repo_reality.md R6) --------------------------------
  {
    key: 'worn_stamps',
    name: 'Regular',
    description: 'Five or more visits to one stadium.',
    criteria: { type: 'max_venue_visits', target: 5 },
    tier: 'standard',
    sport: null,
    isSecret: true,
  },
  {
    key: 'golden_stamps',
    name: 'Something to tell',
    description: 'A rare moment, live: a no-hitter, a cycle, a walk-off, an overtime win, a buzzer-beater.',
    criteria: {
      type: 'any_of',
      items: [
        { type: 'exists', filter: { event: 'no_hitter' } },
        { type: 'exists', filter: { event: 'perfect_game' } },
        { type: 'exists', filter: { event: 'cycle' } },
        { type: 'exists', filter: { event: 'walk_off' } },
        { type: 'exists', filter: { event: 'walk_off_home_run' } },
        { type: 'exists', filter: { event: 'immaculate_inning' } },
        { type: 'exists', filter: { event: 'buzzer_beater' } },
        { type: 'exists', filter: { event: 'overtime', result: 'win' } },
      ],
    },
    tier: 'rare',
    sport: null,
    isSecret: true,
  },
  {
    key: 'record_rewind',
    name: 'Record rewind',
    description: 'Hold your record on the Passport.',
    criteria: { type: 'count', target: 1 },
    tier: 'standard',
    sport: null,
    isSecret: true,
  },
  {
    key: 'curse_breaker',
    name: 'Curse breaker',
    description: 'Ended a losing streak of five or more.',
    criteria: { type: 'streak_break', minLosses: 5 },
    tier: 'rare',
    sport: null,
    isSecret: true,
  },
  {
    key: 'rally_cap',
    name: 'Rally cap',
    description: "Behind late, checked in, and your side came back.",
    criteria: {
      type: 'any_of',
      items: [
        { type: 'exists', filter: { event: 'walk_off', result: 'win' } },
        { type: 'exists', filter: { event: 'comeback_14', result: 'win' } },
        { type: 'exists', filter: { event: 'comeback_20', result: 'win' } },
        { type: 'exists', filter: { event: 'comeback_2', result: 'win' } },
      ],
    },
    tier: 'standard',
    sport: null,
    isSecret: true,
  },
  {
    key: 'stretch_confetti',
    name: 'Stretch',
    description: "Open the app at the sport's signature break, checked in.",
    criteria: { type: 'count', target: 1 },
    tier: 'standard',
    sport: null,
    isSecret: true,
  },
  {
    key: 'certified_jinx',
    name: 'Certified jinx',
    description: 'A companion with a losing record with you, five or more games.',
    criteria: { type: 'companion_record', minGames: 5, maxWinPct: 0.3 },
    tier: 'standard',
    sport: null,
    isSecret: true,
  },
  {
    key: 'secret_handshake',
    name: 'Secret handshake',
    description: 'Checked in at the same game as someone you tagged.',
    criteria: { type: 'distinct_people', target: 1 },
    tier: 'standard',
    sport: null,
    isSecret: true,
  },
];
