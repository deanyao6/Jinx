import { eggs } from '@/features/eggs/flags';
import {
  HANDSHAKE_POLL_MS,
  canOfferHandshake,
  completedHandshakes,
  handshakeLine,
  handshakePollInterval,
  handshakeStates,
  newlyCompleted,
  offerRefusalCopy,
  parseOfferResult,
  type HandshakeRow,
} from '@/features/eggs/handshake';

const OFF = { secretHandshake: false } as const;

const row = (id: string, state: string, name: string | null = id): HandshakeRow => ({
  user_id: id,
  handle: id,
  display_name: name,
  avatar_path: null,
  state,
});

describe('the flag', () => {
  it('ships switched on', () => {
    expect(eggs.secretHandshake).toBe(true);
  });
});

describe('parseOfferResult', () => {
  it('reads an accepted offer, complete or not', () => {
    expect(parseOfferResult({ offered: true, complete: false })).toEqual({
      offered: true,
      complete: false,
    });
    expect(parseOfferResult({ offered: true, complete: true })).toEqual({
      offered: true,
      complete: true,
    });
  });

  it('reads a refusal with its reason', () => {
    expect(parseOfferResult({ offered: false, reason: 'not_mutual' })).toEqual({
      offered: false,
      reason: 'not_mutual',
    });
  });

  it('treats anything else as a refusal, never as a handshake', () => {
    for (const junk of [null, undefined, 'yes', 1, {}, { offered: 'true' }, { complete: true }]) {
      expect(parseOfferResult(junk)).toEqual({ offered: false, reason: 'unknown' });
    }
  });
});

describe('offerRefusalCopy', () => {
  it.each([
    'not_checked_in',
    'they_are_not_checked_in',
    'not_mutual',
    'outside_window',
    'self',
    '?',
  ])('has a plain sentence for %s and never says blocked', (reason) => {
    const copy = offerRefusalCopy(reason);
    expect(copy.length).toBeGreaterThan(10);
    expect(copy.toLowerCase()).not.toContain('block');
    expect(copy).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('states', () => {
  const rows = [row('maya', 'waiting'), row('sam', 'complete')];

  it('maps each person the caller offered to', () => {
    expect([...handshakeStates(rows).entries()]).toEqual([
      ['maya', 'waiting'],
      ['sam', 'complete'],
    ]);
    expect(handshakeStates(null).size).toBe(0);
  });

  it('keeps only the complete ones for the line', () => {
    expect(completedHandshakes(rows).map((r) => r.user_id)).toEqual(['sam']);
  });
});

describe('newlyCompleted', () => {
  it('is the handshakes that were waiting and are complete now', () => {
    const before = handshakeStates([row('maya', 'waiting'), row('sam', 'complete')]);
    const now = [row('maya', 'complete'), row('sam', 'complete')];
    expect(newlyCompleted(before, now).map((r) => r.user_id)).toEqual(['maya']);
  });

  it('is nothing on the first answer: one already complete is not news', () => {
    expect(newlyCompleted(null, [row('sam', 'complete')])).toEqual([]);
  });

  it('is nothing for a person the caller had not offered to', () => {
    expect(newlyCompleted(new Map(), [row('sam', 'complete')])).toEqual([]);
  });
});

describe('handshakePollInterval', () => {
  const waiting = [row('maya', 'waiting')];
  const on = { focused: true, windowOpen: true, rows: waiting };

  it('asks every 15 seconds while something is waiting', () => {
    expect(HANDSHAKE_POLL_MS).toBe(15_000);
    expect(handshakePollInterval(on)).toBe(15_000);
  });

  it('stops when the screen loses focus, the window closes, or nothing is waiting', () => {
    expect(handshakePollInterval({ ...on, focused: false })).toBe(false);
    expect(handshakePollInterval({ ...on, windowOpen: false })).toBe(false);
    expect(handshakePollInterval({ ...on, rows: [row('sam', 'complete')] })).toBe(false);
    expect(handshakePollInterval({ ...on, rows: [] })).toBe(false);
    expect(handshakePollInterval({ ...on, rows: undefined })).toBe(false);
  });

  it('never polls with the egg switched off', () => {
    expect(handshakePollInterval(on, OFF)).toBe(false);
  });
});

describe('handshakeLine', () => {
  it('names one person, or several', () => {
    expect(handshakeLine([])).toBeNull();
    expect(handshakeLine([row('maya', 'complete', 'Maya')])).toBe('Secret handshake with Maya.');
    expect(handshakeLine([row('maya', 'complete', 'Maya'), row('sam', 'complete', 'Sam')])).toBe(
      'Secret handshake with Maya and Sam.',
    );
  });

  it('falls back to the handle', () => {
    expect(handshakeLine([row('maya', 'complete', ' ')])).toBe('Secret handshake with @maya.');
  });
});

describe('canOfferHandshake', () => {
  const yes = {
    live: true,
    viewerCheckedIn: true,
    windowOpen: true,
    isCandidate: true,
    state: undefined,
  } as const;

  it('needs every condition at once', () => {
    expect(canOfferHandshake(yes)).toBe(true);
    expect(canOfferHandshake({ ...yes, live: false })).toBe(false);
    expect(canOfferHandshake({ ...yes, viewerCheckedIn: false })).toBe(false);
    expect(canOfferHandshake({ ...yes, windowOpen: false })).toBe(false);
    expect(canOfferHandshake({ ...yes, isCandidate: false })).toBe(false);
  });

  it('is one handshake per pair per game: no second tap', () => {
    expect(canOfferHandshake({ ...yes, state: 'waiting' })).toBe(false);
    expect(canOfferHandshake({ ...yes, state: 'complete' })).toBe(false);
  });

  it('is never with the egg switched off', () => {
    expect(canOfferHandshake(yes, OFF)).toBe(false);
  });
});
