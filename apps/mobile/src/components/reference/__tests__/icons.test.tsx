import { ICONS } from '../icons';

/**
 * icons.tsx is generated from the sprite in design/reference.html (SPEC.md 8.4). This
 * checks the generated file still covers the sprite, so a reference revision that adds
 * or renames an icon fails here rather than rendering a blank square at parity time.
 */
declare const __dirname: string;
declare function require(id: string): unknown;

const { readFileSync } = require('node:fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const html = readFileSync(
  join(__dirname, '..', '..', '..', '..', '..', '..', 'design', 'reference.html'),
  'utf8',
);

describe('reference icons', () => {
  const spriteIds = [...html.matchAll(/<symbol id="(i-[a-z0-9-]+)"/g)].flatMap((m) =>
    m[1] ? [m[1]] : [],
  );

  it('finds the sprite', () => {
    expect(spriteIds.length).toBeGreaterThan(30);
  });

  it('generates a component for every sprite symbol', () => {
    expect(Object.keys(ICONS).sort()).toEqual([...spriteIds].sort());
  });

  it('covers every icon the reference actually uses', () => {
    const used = new Set(
      [...html.matchAll(/use href="#(i-[a-z0-9-]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : [])),
    );
    expect(used.size).toBeGreaterThan(10);
    for (const id of used) expect(ICONS).toHaveProperty(id);
  });
});
