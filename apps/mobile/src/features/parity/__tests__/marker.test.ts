import { hash16, markerBits, MARKER_BITS } from '../marker';
import { resolveParityScreen } from '../screens';

/**
 * The parity marker only works if the app and the harness agree byte for byte. They
 * cannot share a module: the harness is an ESM Node script outside the app's build, and
 * adding Node types to this app's tsconfig to bridge that would let `process` and
 * `Buffer` leak into application code.
 *
 * So the harness source is read as text at test time through Jest's Node environment,
 * with the two Node APIs needed declared locally rather than globally.
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const harness = (file: string) =>
  readFileSync(
    join(__dirname, '..', '..', '..', '..', '..', '..', 'scripts', 'parity', file),
    'utf8',
  );
describe('parity marker', () => {
  it('hashes the ids the harness expects', () => {
    // Pinned from scripts/parity/marker.mjs. If these change, both sides changed.
    expect(hash16('passport-all')).toBe(0x9a09);
    expect(hash16('games')).toBe(0xe5a2);
    expect(hash16('profile')).toBe(0x8c9a);
    expect(hash16('relive-mid')).toBe(0xa7aa);
    expect(hash16('parity-selftest')).toBe(0x45b5);
  });

  it('emits most significant bit first', () => {
    const bits = markerBits('passport-all');
    expect(bits).toHaveLength(MARKER_BITS);
    const rebuilt = bits.reduce((acc, bit) => (acc << 1) | (bit ? 1 : 0), 0);
    expect(rebuilt).toBe(hash16('passport-all'));
  });

  it('uses the same hash function as the harness', () => {
    const src = harness('marker.mjs');
    // Both implementations must use FNV-1a with these constants and the same fold.
    expect(src).toContain('0x811c9dc5');
    expect(src).toContain('0x01000193');
    expect(src).toContain('((h >>> 16) ^ (h & 0xffff)) & 0xffff');
  });

  it('covers every screen the harness asks for', () => {
    const src = harness('screens.mjs');
    const ids = [...src.matchAll(/^\s+id: '([a-z0-9-]+)',$/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(10);

    const routes = [...src.matchAll(/route: 'jinx:\/\/parity\/([^']+)'/g)].map((m) => m[1]);
    expect(routes).toHaveLength(ids.length);

    routes.forEach((route, i) => {
      const url = new URL(`jinx://parity/${route}`);
      const params = Object.fromEntries(url.searchParams);
      const path = url.pathname.replace(/^\//, '');
      expect(resolveParityScreen(path, params)).toBe(ids[i]);
    });
  });
});
