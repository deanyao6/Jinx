// Same shape as theme/reference/__tests__/tokens.test.ts: the mobile tsconfig carries no
// node types, so the three node APIs this needs are declared rather than imported.
declare const __dirname: string;
declare function require(id: string): unknown;

type Dirent = { name: string; isDirectory(): boolean };
const { readFileSync, readdirSync } = require('node:fs') as {
  readFileSync: (p: string, enc: string) => string;
  readdirSync: (p: string, opts: { withFileTypes: true }) => Dirent[];
};
const { join } = require('node:path') as { join: (...parts: string[]) => string };

// Built from its code point so this file does not itself contain the character it bans.
const EM_DASH = String.fromCharCode(0x2014);
const SRC = join(__dirname, '..', '..', '..');
/**
 * packages/core is scanned too. `formatWinRate` returned an em dash and every screen showing
 * a win rate with no games rendered it, which is exactly the kind of leak scanning only the
 * app would miss. Its `.js` import suffixes make it awkward to import here, so it is read
 * off disk like everything else.
 */
const CORE = join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'core', 'src');

/**
 * Strip comments so only real string literals and JSX text are left.
 *
 * Written as a small scanner rather than a regex because a regex cannot tell a `//` inside a
 * URL string from the start of a comment, and this rule is about what a USER sees. Comments,
 * commit messages and docs are free to use whatever punctuation they like.
 */
function stripComments(src: string): string {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  const blank = (s: string) => [...s].map((c) => (c === '\n' ? '\n' : ' ')).join('');
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const j = src.indexOf('\n', i);
      const end = j === -1 ? n : j;
      out.push(blank(src.slice(i, end)));
      i = end;
    } else if (c === '/' && next === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j === -1 ? n : j + 2;
      out.push(blank(src.slice(i, end)));
      i = end;
    } else if (c === '{' && src.startsWith('{/*', i)) {
      const j = src.indexOf('*/}', i);
      const end = j === -1 ? n : j + 3;
      out.push(blank(src.slice(i, end)));
      i = end;
    } else if (c === '"' || c === "'" || c === '`') {
      // Copied through whole, so a dash inside a string is still seen.
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          j += 1;
          break;
        }
        j += 1;
      }
      out.push(src.slice(i, j));
      i = j;
    } else {
      out.push(c as string);
      i += 1;
    }
  }
  return out.join('');
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // The tests themselves are not UI, and this file has to name the character to ban it.
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(path, found);
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      // packages/core keeps its tests beside the source rather than in __tests__.
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.test-helpers.ts')
    ) {
      found.push(path);
    }
  }
  return found;
}

/**
 * Dean's standing rule, 2026-09-16: "no em dashes on the ui, ever."
 *
 * En dashes are a different character and stay. The design reference writes records as
 * "31 – 17" and scores as "24–15", and those are correct. This bans the long one only.
 *
 * Where an em dash separated a label from its value, use the middot the app already uses
 * ("Home run · 42 yards"). Where it was parenthetical, use a comma or a full stop. Where it
 * stood in for a missing value, use an en dash.
 */
describe('UI copy', () => {
  it('contains no em dashes anywhere a user can read one', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(SRC), ...sourceFiles(CORE)]) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes(EM_DASH)) continue;
      const lines = stripComments(src).split('\n');
      lines.forEach((line, i) => {
        if (line.includes(EM_DASH)) {
          const root = file.startsWith(CORE) ? CORE : SRC;
          offenders.push(`${file.slice(root.length + 1)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
