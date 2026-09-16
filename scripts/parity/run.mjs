// One command for the whole loop: reference shots, app shots, diff.
// Pass screen ids to narrow it: `npm run parity -- passport-all games`.
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
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
