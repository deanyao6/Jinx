/** MLS schedules/finals, resumable by month. Never overwrites attendance or fetches detail. */
import {
  MLS_PROVIDER,
  isMlsLeagueEvent,
  parseMlsEvent,
  type MlsEvent,
  type CanonicalGame,
} from '@jinx/core';
import {
  createDb,
  getProgress,
  loadTeamMap,
  loadVenueMaps,
  setProgress,
  upsertRows,
} from '../db.js';
import { upsertGames } from '../games.js';
import { mlsProvider } from './provider.js';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const value = i < 0 ? fallback : Number(process.argv[i + 1]);
  if (!Number.isInteger(value) || value < 2016 || value > 2026)
    throw new Error(`${name} must be 2016-2026; later season identities need verification`);
  return value;
}

async function main() {
  const from = arg('from', 2026),
    to = arg('to', 2026);
  if (from > to) throw new Error('--from must not exceed --to');
  const db = createDb();
  const provider = mlsProvider();
  const force = process.argv.includes('--force');
  const teamMap = await loadTeamMap(db, MLS_PROVIDER);
  let venueMaps = await loadVenueMaps(db);
  const now = new Date();
  for (let year = from; year <= to; year++) {
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      // Current/future seasons always refresh; only completed historical years skip.
      if (
        !force &&
        year < now.getUTCFullYear() &&
        (await getProgress(db, 'mls_schedule', key)) === 'done'
      )
        continue;
      await setProgress(db, 'mls_schedule', key, 'running');
      try {
        const raw = await provider.month(year, month, force);
        const games = new Map<string, CanonicalGame>();
        const included = raw.events.filter(isMlsLeagueEvent);
        for (const event of included) {
          const game = parseMlsEvent(event);
          if (!teamMap.has(game.homeProviderTeamId) || !teamMap.has(game.awayProviderTeamId))
            throw new Error(`Unseeded MLS team in ${game.providerGameId}`);
          games.set(game.providerGameId, game);
        }
        // A venue with no verified coordinates is still loggable. Do not invent a geofence.
        const added = new Map<string, NonNullable<MlsEvent['competitions'][number]['venue']>>();
        for (const e of included) {
          const v = e.competitions[0]?.venue;
          if (
            v &&
            !venueMaps.byEspnVenueId.has(v.id) &&
            !venueMaps.byAlias.has(v.fullName.toLowerCase())
          )
            added.set(v.id, v);
        }
        if (added.size) {
          await upsertRows(
            db,
            'venues',
            [...added.values()].map((v) => ({
              key: `mls-espn-${v.id}`,
              name: v.fullName,
              city: v.address?.city ?? null,
              country: v.address?.country ?? null,
              provider_ids: { espn_venue_ids: [v.id] },
            })),
            'key',
          );
          venueMaps = await loadVenueMaps(db);
          await upsertRows(
            db,
            'venue_aliases',
            [...added.values()].map((v) => ({
              venue_id: venueMaps.byEspnVenueId.get(v.id),
              alias: v.fullName,
            })),
            'venue_id,alias',
          );
        }
        for (const game of games.values()) {
          if (
            game.providerVenueId &&
            !venueMaps.byEspnVenueId.has(game.providerVenueId.slice(5)) &&
            game.venueName
          ) {
            const id = venueMaps.byAlias.get(game.venueName.toLowerCase());
            if (id) game.providerVenueId = `venue:${id}`;
          }
        }
        await upsertGames(db, [...games.values()], { teamMap, venueMaps, venueLookup: 'mls' });
        // Scores alone are sufficient to refresh Passport records and convert Going entries.
        for (const g of games.values())
          if (g.status === 'final') {
            const { data, error } = await db
              .from('games')
              .select('id')
              .eq('provider', MLS_PROVIDER)
              .eq('provider_game_id', g.providerGameId)
              .single();
            if (error || !data) throw new Error(error?.message ?? 'MLS game missing after write');
            const { error: finalError } = await db.rpc('process_game_final', {
              p_game_id: (data as { id: string }).id,
            });
            if (finalError) throw new Error(finalError.message);
          }
        const report = {
          games: games.size,
          finals: [...games.values()].filter((g) => g.status === 'final').length,
          unmapped_venues: [...games.values()].filter((g) => !g.providerVenueId).length,
          new_venues: added.size,
        };
        await setProgress(db, 'mls_schedule', key, 'done', report);
        console.log(`${key}: ${JSON.stringify(report)}`);
      } catch (e) {
        await setProgress(db, 'mls_schedule', key, 'failed', { error: String(e) });
        throw e;
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
