import { attendanceStatusFor, resolveRooting } from '../rooting';

const phillies = { id: 't-phi', franchise_id: 'mlb-143' };
const mets = { id: 't-nym', franchise_id: 'mlb-121' };
const expos = { id: 't-mon', franchise_id: 'mlb-120' };
const nationals = { id: 't-wsh', franchise_id: 'mlb-120' }; // same franchise as the Expos

describe('resolveRooting', () => {
  it('picks the one favorite with basis favorite', () => {
    expect(resolveRooting({ home: phillies, away: mets, favorites: [phillies] })).toEqual({
      teamId: 't-phi',
      basis: 'favorite',
      needsChoice: false,
      bothFavorites: false,
    });
    expect(resolveRooting({ home: phillies, away: mets, favorites: [mets] })).toMatchObject({
      teamId: 't-nym',
      basis: 'favorite',
    });
  });

  it('is neutral when the user follows neither team', () => {
    expect(resolveRooting({ home: phillies, away: mets, favorites: [] })).toEqual({
      teamId: null,
      basis: null,
      needsChoice: false,
      bothFavorites: false,
    });
  });

  it('asks for a side when both teams are favorites', () => {
    const r = resolveRooting({ home: phillies, away: mets, favorites: [phillies, mets] });
    expect(r).toEqual({ teamId: null, basis: null, needsChoice: true, bothFavorites: true });
  });

  it('records the chosen side with basis chosen', () => {
    const r = resolveRooting({
      home: phillies,
      away: mets,
      favorites: [phillies, mets],
      chosenTeamId: 't-nym',
    });
    expect(r).toEqual({
      teamId: 't-nym',
      basis: 'chosen',
      needsChoice: false,
      bothFavorites: true,
    });
  });

  it('ignores a chosen side that is not one of the two teams', () => {
    const r = resolveRooting({
      home: phillies,
      away: mets,
      favorites: [phillies, mets],
      chosenTeamId: 't-bos',
    });
    expect(r.needsChoice).toBe(true);
    expect(r.teamId).toBeNull();
  });

  it('matches favorites by franchise so relocated teams count', () => {
    const r = resolveRooting({ home: expos, away: mets, favorites: [nationals] });
    expect(r).toMatchObject({ teamId: 't-mon', basis: 'favorite' });
  });
});

describe('attendanceStatusFor', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  it('is attended for final games regardless of date', () => {
    expect(
      attendanceStatusFor({ status: 'final', scheduled_start: '2026-09-20T00:00:00Z' }, now),
    ).toBe('attended');
  });
  it('is going for games that have not started', () => {
    expect(
      attendanceStatusFor({ status: 'scheduled', scheduled_start: '2026-09-20T00:00:00Z' }, now),
    ).toBe('going');
  });
  it('is attended for past games that never went final', () => {
    expect(
      attendanceStatusFor({ status: 'postponed', scheduled_start: '2019-08-01T00:00:00Z' }, now),
    ).toBe('attended');
  });
});
