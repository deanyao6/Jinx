import { checkInOffers } from '../ui/GamesSessionCards';
import { sessionEndCopy } from '../ui/SessionPanel';
import type { TodayGame } from '../queries';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-location', () => ({}));

describe('the session panel copy', () => {
  const base = { final_at: null, scheduled_start: '2026-09-24T23:05:00Z' };
  const c = (end_reason: 'left' | 'final' | 'timeout' | null, open: boolean) => ({
    ...base,
    checkin: { started_at: '2026-09-24T23:00:00Z', ended_at: open ? null : '2026-09-25T02:00:00Z', end_reason, open, visibility: 'mutuals' as const },
  });
  it('says how the session ends, or how it ended', () => {
    expect(sessionEndCopy(c(null, true))).toBe('Session ends 30 minutes after the final, or when you say you have left.');
    expect(sessionEndCopy(c('left', false))).toBe('You left the game. Prompts have stopped.');
    expect(sessionEndCopy(c('final', false))).toBe('The session ended 30 minutes after the final.');
    expect(sessionEndCopy(c('timeout', false))).toBe('The session ended six hours after it started.');
  });
});

describe('the check-in offer on Games', () => {
  const now = Date.parse('2026-09-24T22:30:00Z');
  const game = (id: string, over: Partial<TodayGame> = {}): TodayGame =>
    ({ id, sport_id: 'mlb', season: 2026, game_type: 'regular', scheduled_start: '2026-09-24T23:05:00Z', status: 'scheduled', venue_id: 'v1', home_team_id: 'h', away_team_id: 'a', home_score: null, away_score: null, winner_team_id: null, is_tie: false, doubleheader_number: null, rescheduled_from_game_id: null, rescheduled_to_game_id: null, temperature_f: null, duration_minutes: null, attendance: null, innings_or_periods: null, home: null, away: null, venue: null, ...over }) as TodayGame;
  const venues = new Map([['v1', { lat: 39.906, lng: -75.166, geofence_m: 400 }]]);

  it('offers a logged game and a ticket-matched game without a location, and a favorite’s game only when the phone is inside', () => {
    const offers = checkInOffers({
      today: [game('logged'), game('ticket'), game('fav'), game('far', { venue_id: 'v2' })],
      loggedIds: new Set(['logged']),
      ticketIds: new Set(['ticket']),
      here: { lat: 39.9062, lng: -75.1661, accuracyM: 30 },
      venues,
      nowMs: now,
    });
    expect(offers.map((o) => [o.game.id, o.reason])).toEqual([
      ['logged', 'logged'],
      ['ticket', 'ticket'],
      ['fav', 'nearby'],
    ]);
    expect(checkInOffers({ today: [game('fav')], loggedIds: new Set(), ticketIds: new Set(), here: null, venues, nowMs: now })).toEqual([]);
    expect(checkInOffers({ today: [game('fav')], loggedIds: new Set(), ticketIds: new Set(), here: { lat: 40.5, lng: -75.1, accuracyM: 30 }, venues, nowMs: now })).toEqual([]);
  });

  it('never outside the check-in window, or for a game that is off', () => {
    expect(checkInOffers({ today: [game('logged', { scheduled_start: '2026-09-25T12:00:00Z' })], loggedIds: new Set(['logged']), ticketIds: new Set(), here: null, venues, nowMs: now })).toEqual([]);
    expect(checkInOffers({ today: [game('logged', { status: 'postponed' })], loggedIds: new Set(['logged']), ticketIds: new Set(), here: null, venues, nowMs: now })).toEqual([]);
  });
});
