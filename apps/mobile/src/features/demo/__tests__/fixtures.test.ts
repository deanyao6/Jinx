import {
  AVATARS,
  GAMES,
  GAME_LOGS,
  METAL,
  PASSPORT,
  PASSPORT_PILLS,
  STAMPS,
  stampsFor,
} from '../fixtures';

/**
 * SPEC.md 8.9 requires the demo fixtures to reproduce the reference's sample data
 * *exactly*, because that is what makes a parity diff meaningful. A typo in a score or a
 * hyphen where the reference uses an en-dash would show up as a layout failure and send
 * the next person looking in the wrong place.
 *
 * So rather than trusting the transcription, this asserts each value appears in
 * design/reference.html verbatim.
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const html = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', '..', 'design', 'reference.html'),
  'utf8',
);

const inReference = (value: string) => expect(html.includes(value)).toBe(true);

describe('demo fixtures', () => {
  it('has the pills the reference shows', () => {
    expect(PASSPORT_PILLS.map((p) => p.label)).toEqual(['All Teams', 'Phillies', 'Eagles']);
    for (const pill of PASSPORT_PILLS) {
      inReference(`>${pill.label}<span class="n">${pill.count}</span>`);
    }
  });

  it.each(Object.keys(PASSPORT))('passport "%s" matches the reference', (key) => {
    const p = PASSPORT[key];
    if (!p) throw new Error(`missing fixture ${key}`);
    for (const value of [
      p.label,
      p.badge,
      p.record,
      p.winRate,
      p.streak,
      p.lastGame,
      p.stampCount,
    ]) {
      inReference(value);
    }
    for (const card of p.cards) {
      inReference(card.name);
      inReference(card.record);
      inReference(card.pct);
    }
    for (const s of p.superlatives) {
      inReference(s.label);
      inReference(s.value);
      inReference(s.chip);
    }
  });

  it('uses the reference en-dash in every record, not a hyphen', () => {
    for (const p of Object.values(PASSPORT)) {
      expect(p.record).toContain('–');
      for (const card of p.cards) expect(card.record).toContain('–');
    }
  });

  it('has the stamps the reference draws, in order', () => {
    expect(STAMPS).toHaveLength(6);
    for (const s of STAMPS) {
      inReference(`name:'${s.name}'`);
      inReference(`ring:'${s.ring}'`);
      inReference(`shape:'${s.shape}'`);
    }
  });

  it('filters stamps per pill the way the reference does', () => {
    // The reference filters STAMPS by `teams.indexOf(k) > -1`.
    expect(stampsFor('all')).toHaveLength(6);
    expect(stampsFor('phi').map((s) => s.name)).toEqual([
      'Citizens Bank',
      'Citi Field',
      'Dodger Stadium',
    ]);
    expect(stampsFor('phl').map((s) => s.name)).toEqual([
      'Lincoln Financial',
      'SoFi Stadium',
      'MetLife Stadium',
    ]);
    // The counts on the pills' "View All" links must agree with the filter.
    expect(PASSPORT.phi?.stampCount).toBe('View All (4)');
  });

  it('has the metal gradients the reference uses', () => {
    inReference(`brass:['${METAL.brass[0]}','${METAL.brass[1]}','${METAL.brass[2]}']`);
    inReference(`silver:['${METAL.silver[0]}','${METAL.silver[1]}','${METAL.silver[2]}']`);
  });

  it('has the games list the reference renders', () => {
    expect(GAMES).toHaveLength(5);
    for (const g of GAMES) {
      inReference(`title:'${g.title}'`);
      inReference(`meta:'${g.meta}'`);
    }
  });

  it('has every game log, including the aliased record cards', () => {
    // The reference aliases phiHome/phiRoad/dad onto the Phillies log and
    // phlHome/phlRoad/phlPost onto the Eagles log.
    for (const key of ['phiHome', 'phiRoad', 'dad']) {
      expect(GAME_LOGS[key]).toBe(GAME_LOGS.phi);
    }
    for (const key of ['phlHome', 'phlRoad', 'phlPost']) {
      expect(GAME_LOGS[key]).toBe(GAME_LOGS.phl);
    }
    // Every record card on every pill must open a log that exists.
    for (const p of Object.values(PASSPORT)) {
      for (const card of p.cards) expect(GAME_LOGS[card.log]).toBeDefined();
    }
  });

  it.each(Object.keys(GAME_LOGS))('game log "%s" rows match the reference', (key) => {
    const log = GAME_LOGS[key];
    if (!log) throw new Error(`missing log ${key}`);
    inReference(log.sub);
    inReference(log.meta);
    inReference(log.more);
    for (const row of log.rows) {
      inReference(row.title);
      inReference(row.meta);
    }
  });

  it('has the avatar palettes the reference generates', () => {
    for (const [key, colors] of Object.entries(AVATARS)) {
      inReference(`${key}:['${colors[0]}','${colors[1]}','${colors[2]}']`);
    }
  });
});
