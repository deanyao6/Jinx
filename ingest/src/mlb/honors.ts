/**
 * MLB award winners into player_honors, for the superstar bar (docs/prompts/famous-games.md 3).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/mlb/honors.ts [--from 2021 --to 2026]
 *
 * From GET v1/awards/{id}/recipients?season=YYYY (verified 2026-09-17, docs/verification.md):
 * MVP, Cy Young and Rookie of the Year winners in both leagues, and both All-Star rosters.
 * Voting placements (top five) are not in the API, so the MLB bar is winners plus All-Stars.
 * Defaults to the current season and the three before it, which is every season that can
 * make someone a star today. Idempotent; runs daily from .github/workflows/daily-jobs.yml.
 */
import { upsertRows, type MlbAwardRecipientsResponse } from '@jinx/core';

import { createDb } from '../db.js';
import { arg, ensurePlayers, refreshAllStats } from '../famous/players.js';
import { MlbClient } from './client.js';

/** Stats API award id -> honor_kinds.honor. */
export const MLB_AWARDS: Readonly<Record<string, string>> = {
  ALMVP: 'mvp',
  NLMVP: 'mvp',
  ALCY: 'cy_young',
  NLCY: 'cy_young',
  ALROY: 'roy',
  NLROY: 'roy',
  ALAS: 'all_star',
  NLAS: 'all_star',
};

export interface HonorRow {
  providerPlayerId: string;
  fullName: string;
  season: number;
  honor: string;
}

/** The honor rows in one recipients response. A season with no award yet is just empty. */
export function honorsFromRecipients(awardId: string, season: number, res: MlbAwardRecipientsResponse): HonorRow[] {
  const honor = MLB_AWARDS[awardId];
  if (!honor) return [];
  const out: HonorRow[] = [];
  for (const r of res.awards ?? []) {
    if (!r.player?.id) continue;
    if (Number(r.season) !== season) continue;
    out.push({
      providerPlayerId: String(r.player.id),
      fullName: r.player.nameFirstLast ?? r.player.fullName ?? `Player ${r.player.id}`,
      season,
      honor,
    });
  }
  return out;
}

/**
 * An award with no recipients that season answers 404, not an empty list: there was no
 * All-Star Game in 2020, and this season's MVP is not known until November.
 */
async function recipients(client: MlbClient, awardId: string, season: number): Promise<MlbAwardRecipientsResponse> {
  try {
    return await client.awardRecipients(awardId, season);
  } catch (err) {
    if (String(err).includes('MLB 404')) return { awards: [] };
    throw err;
  }
}

async function main(): Promise<void> {
  const now = new Date().getUTCFullYear();
  const from = Number(arg('from') ?? now - 3);
  const to = Number(arg('to') ?? now);
  const db = createDb();
  const client = new MlbClient();

  const rows: HonorRow[] = [];
  for (let season = from; season <= to; season += 1) {
    const before = rows.length;
    for (const awardId of Object.keys(MLB_AWARDS)) {
      rows.push(...honorsFromRecipients(awardId, season, await recipients(client, awardId, season)));
    }
    console.log(`${season}: ${rows.length - before} honors`);
  }
  const ids = await ensurePlayers(
    db,
    'mlb',
    'mlb',
    rows.map((r) => ({ providerPlayerId: r.providerPlayerId, fullName: r.fullName })),
  );
  const dedup = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const playerId = ids.get(r.providerPlayerId)!;
    dedup.set(`${playerId}:${r.season}:${r.honor}`, {
      player_id: playerId,
      season: r.season,
      honor: r.honor,
      source: 'mlb-statsapi',
    });
  }
  await upsertRows(db, 'player_honors', [...dedup.values()], 'player_id,season,honor');
  console.log(`${dedup.size} honor rows for ${from}-${to}`);
  await refreshAllStats(db);
}

const isEntrypoint = process.argv[1] != null && /[\\/]mlb[\\/]honors\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
