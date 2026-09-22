// Generates apps/mobile/src/features/onboarding/ui/wall/teamFills.ts from the two palette seeds.
//
// The welcome wall's game cards arrive as a weekly payload that names each side by
// `provider:provider_team_id` (the one key that is the same on local and hosted, where team
// uuids differ) and never by colour. The colour is looked up here, from the same seed that
// loads the team_colors table, so a bad payload cannot change what the app draws. Only the
// fill is needed: the wall tints a card with the team's `--tf`.
//
//   node scripts/design/build-team-fills.mjs
//
// `features/onboarding/ui/wall/__tests__/teamFills.test.ts` fails when this file is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function buildTeamFills(root = process.cwd()) {
  const files = ['seed/team_colors.json', 'seed/mls_colors.json'];
  const rows = files.flatMap(
    (f) => JSON.parse(readFileSync(resolve(root, f), 'utf8')).teams,
  );
  const entries = rows
    .map((r) => [`${r.provider}:${r.provider_team_id}`, r.fill_hex.toUpperCase(), r.team ?? r.abbr])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const lines = entries.map(([key, fill, name]) => `  '${key}': '${fill}', // ${name}`);
  return [
    '// GENERATED FILE. Do not edit by hand.',
    '//',
    '// Built from seed/team_colors.json and seed/mls_colors.json by',
    '// scripts/design/build-team-fills.mjs. Re-run it after a palette changes.',
    '//',
    '// Every team fill (`--tf`), keyed by `provider:provider_team_id`, which is what the weekly',
    '// welcome-wall payload names a side by. Team uuids differ between local and hosted; these',
    '// keys do not. The wall resolves colour here and never from the payload.',
    '',
    'export const TEAM_FILLS: Readonly<Record<string, string>> = {',
    ...lines,
    '};',
    '',
    '/** The team fill for a payload team key, or null when the key is not one we know. */',
    'export function teamFill(teamKey: string): string | null {',
    '  return TEAM_FILLS[teamKey] ?? null;',
    '}',
    '',
  ].join('\n');
}

const OUT = 'apps/mobile/src/features/onboarding/ui/wall/teamFills.ts';

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const out = buildTeamFills();
  writeFileSync(resolve(process.cwd(), OUT), out);
  console.log(`wrote ${OUT}: ${out.split('\n').filter((l) => l.startsWith("  '")).length} teams`);
}
