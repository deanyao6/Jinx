/**
 * Fits NBA_WP_MODEL.marginScale (docs/elo-backtest.md, "NBA in-game model"): every play state
 * of 160 games from 2018-19 labelled by who won, scored against the model with the prior at
 * 0.5, and against ESPN's own line for reference. Reads ESPN through the disk cache.
 *
 *   npx tsx ingest/src/nba/fit_wp.ts
 */
import {
  NbaClient,
  modelHomeWp,
  parseEspnScoreboard,
  clockToSeconds,
  secondsLeftInGame,
} from '@jinx/core';
import { diskCache } from './cache.js';
const client = new NbaClient({ cache: diskCache(), espnIntervalMs: 250 });
const samples: { margin: number; left: number; won: number }[] = [];
const espnLoss: number[] = [];
let games = 0;
for (const ym of ['201811', '201812', '201901', '201902']) {
  const doc = await client.espnScoreboardMonth(ym);
  const infos = parseEspnScoreboard(doc.events ?? []).filter(
    (i) => i.final && i.homeScore != null && i.awayScore != null,
  );
  for (const info of infos.slice(0, 40)) {
    const s = await client.espnSummary(info.eventId);
    const won = info.homeScore! > info.awayScore! ? 1 : 0;
    const wp = new Map((s.winprobability ?? []).map((w) => [w.playId, w.homeWinPercentage]));
    for (const p of s.plays ?? []) {
      if (!p.period?.number) continue;
      const left = secondsLeftInGame(p.period.number, clockToSeconds(p.clock?.displayValue));
      samples.push({ margin: (p.homeScore ?? 0) - (p.awayScore ?? 0), left, won });
      const e = wp.get(p.id);
      if (typeof e === 'number') {
        const c = Math.min(Math.max(e, 1e-4), 1 - 1e-4);
        espnLoss.push(won ? -Math.log(c) : -Math.log(1 - c));
      }
    }
    games++;
  }
}
console.log(
  games,
  'games,',
  samples.length,
  'play states; ESPN log loss',
  (espnLoss.reduce((a, b) => a + b, 0) / espnLoss.length).toFixed(4),
);
for (const scale of [0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.24]) {
  let sum = 0;
  for (const s of samples) {
    const p = Math.min(
      Math.max(modelHomeWp(s.margin, s.left, 0.5, { marginScale: scale, priorWeight: 1 }), 1e-4),
      1 - 1e-4,
    );
    sum += s.won ? -Math.log(p) : -Math.log(1 - p);
  }
  console.log(`marginScale=${scale}: ${(sum / samples.length).toFixed(4)}`);
}
