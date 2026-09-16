// One command for the whole loop: reference shots, app shots, diff.
// Pass screen ids to narrow it: `npm run parity -- passport-all games`.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);

/**
 * The app must be in demo mode, or every shot measures the wrong thing.
 *
 * The reference draws one specific fixture account (31-17, the stamps, the storylines).
 * Since EXPO_PUBLIC_DEMO went in, the app shows the signed-in user's real data by default,
 * so without the flag the harness captures a real, mostly empty passport and diffs it
 * against the reference. That produces a large, confident and meaningless number.
 *
 * Metro reads apps/mobile/.env at startup and the harness only attaches to it, so this
 * cannot be fixed here: it has to fail loudly instead.
 */
function assertDemoMode() {
  let env = '';
  try {
    env = readFileSync('apps/mobile/.env', 'utf8');
  } catch {
    // No .env at all: the app cannot reach a backend either, so let the app step report it.
    return;
  }
  const line = env.split('\n').find((l) => l.trim().startsWith('EXPO_PUBLIC_DEMO='));
  const value = line?.split('=')[1]?.trim().toLowerCase() ?? '';
  if (['1', 'true', 'yes'].includes(value)) return;
  console.error(
    [
      '',
      'Refusing to run: the app is not in demo mode.',
      '',
      'design/reference.html draws one fixture account. Without EXPO_PUBLIC_DEMO the app',
      'shows real user data, and the diff would compare the reference against whatever is',
      'in your database. Set it, restart Metro so it is picked up, then re-run:',
      '',
      '  echo "EXPO_PUBLIC_DEMO=1" >> apps/mobile/.env',
      '  npm run ios',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

assertDemoMode();
const steps = [
  ['capture-reference.mjs', 'Reference'],
  ['capture-app.mjs', 'App'],
  ['diff.mjs', 'Diff'],
];

for (const [script, label] of steps) {
  console.log(`\n=== ${label} ===`);
  const code = await new Promise((resolve) => {
    const p = spawn(process.execPath, [`scripts/parity/${script}`, ...args], { stdio: 'inherit' });
    p.on('close', resolve);
  });
  // The app step exits non-zero when the app is not installed. Diffing is still useful
  // then (it reports every screen as "not built"), so only a reference failure is fatal.
  if (code !== 0 && script === 'capture-reference.mjs') {
    process.exitCode = code;
    break;
  }
}
