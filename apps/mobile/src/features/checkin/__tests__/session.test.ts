import { inOpenSession } from '../session';

describe('inOpenSession', () => {
  const started = '2026-09-24T19:00:00Z';

  it('is false before a check-in', () => {
    expect(inOpenSession({ checked_in_at: null, checkin: null })).toBe(false);
    expect(inOpenSession(null)).toBe(false);
  });

  it('is true while the session is open', () => {
    expect(
      inOpenSession({
        checked_in_at: started,
        checkin: { started_at: started, ended_at: null, end_reason: null, open: true, visibility: 'mutuals' },
      }),
    ).toBe(true);
  });

  it('is false once the session has ended', () => {
    expect(
      inOpenSession({
        checked_in_at: started,
        checkin: { started_at: started, ended_at: '2026-09-24T22:00:00Z', end_reason: 'left', open: false, visibility: 'mutuals' },
      }),
    ).toBe(false);
  });

  it('treats a server without sessions as open, as a check-in always was', () => {
    expect(inOpenSession({ checked_in_at: started })).toBe(true);
  });
});
