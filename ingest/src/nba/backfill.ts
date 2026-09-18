/**
 * NBA schedule + finals backfill, resumable per season (SPEC.md 4.5).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx ingest/src/nba/backfill.ts --from 2000 --to 2026 [--force]
 *
 * A past season is the stats.nba.com game log (preseason, regular season, play-in, playoffs
 * and the Cup final) joined to ESPN's monthly scoreboards for tip-off times, venues and
 * attendance. The season the CDN schedule describes comes from the CDN, future games included.
 * Detail is not fetched here (detail.ts and the queue do that for logged games only).
 *
 * A historical game ESPN has no venue for (the Grizzlies at GM Place, the Rockets at the Compaq
 * Center) takes the home team's arena of that season from seed/nba_venues.json.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nbaProviderTeamId, type CanonicalGame } from '@jinx/core';

import { createDb, getProgress, loadTeamMap, loadVenueMaps, setProgress } from '../db.js';
import { upsertGames } from '../games.js';
import { nbaProvider } from './provider.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

type SeedVenue = { key: string; home_by_season?: { abbr: string; first: number; last: number }[] };
type SeedTeam = { abbr: string; provider_team_id: string; home_venue_key: string | null; first: number; last: number | null };

/** provider team id + season -> venue key, from the seeds: the current arena, or the era's. */
export async function homeArenaRule(): Promise<(providerTeamId: string, season: number) => string | null> {
  const seed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../seed');
  const venues = JSON.parse(await readFile(path.join(seed, 'nba_venues.json'), 'utf8')).venues as SeedVenue[];
  const teams = JSON.parse(await readFile(path.join(seed, 'nba_teams.json'), 'utf8')).teams as SeedTeam[];
  const byAbbr = new Map<string, SeedTeam[]>();
  for (const t of teams) byAbbr.set(t.abbr, [...(byAbbr.get(t.abbr) ?? []), t]);
  const eras: { providerTeamId: string; first: number; last: number; key: string }[] = [];
  for (const v of venues) {
    for (const h of v.home_by_season ?? []) {
      // The abbreviation names an identity; the Bobcats and the Hornets both print CHA, so the
      // season decides which row.
      const team = (byAbbr.get(h.abbr) ?? []).find((t) => h.first >= t.first && (t.last == null || h.first <= t.last));
      if (team) eras.push({ providerTeamId: team.provider_team_id, first: h.first, last: h.last, key: v.key });
    }
  }
  const current = new Map<string, string>();
  for (const t of teams) if (t.home_venue_key) current.set(t.provider_team_id, t.home_venue_key);
  return (providerTeamId, season) => {
    const era = eras.find((e) => e.providerTeamId === providerTeamId && season >= e.first && season <= e.last);
    return era?.key ?? current.get(providerTeamId) ?? null;
  };
}

async function main(): Promise<void> {
  const from = Number(arg('from', '2000'));
  const to = Number(arg('to', String(new Date().getUTCFullYear())));
  const force = process.argv.includes('--force');
  const db = createDb();
  const provider = nbaProvider();
  const venueMaps = await loadVenueMaps(db);
  const ctx = { teamMap: await loadTeamMap(db, 'nba'), venueMaps, venueLookup: 'nba' as const };
  const homeArena = await homeArenaRule();
  const job = 'nba_backfill';
  const current = await provider.currentSeason();

  for (let season = from; season <= to; season++) {
    const key = String(season);
    if (!force && (await getProgress(db, job, key)) === 'done') {
      console.log(`season ${season}: already done, skipping`);
      continue;
    }
    await setProgress(db, job, key, 'running');
    try {
      const games = await provider.fetchSeason(season);
      const known = games.filter(
        (g) => ctx.teamMap.has(g.homeProviderTeamId) && ctx.teamMap.has(g.awayProviderTeamId),
      );
      let filled = 0;
      let unresolved = 0;
      const withVenues: CanonicalGame[] = known.map((g) => {
        const resolved =
          g.providerVenueId &&
          ((g.providerVenueId.startsWith('espn:') && venueMaps.byEspnVenueId.has(g.providerVenueId.slice(5))) ||
            (g.providerVenueId.startsWith('name:') && venueMaps.byAlias.has(g.providerVenueId.slice(5).toLowerCase())));
        if (resolved || g.isNeutralSite) {
          if (!resolved) unresolved += 1;
          return g;
        }
        const homeKey = homeArena(g.homeProviderTeamId, season);
        const venueId = homeKey ? venueMaps.byKey.get(homeKey) : undefined;
        if (!venueId) {
          // Unknown arena: the game is kept with no venue rather than dropped.
          unresolved += 1;
          return { ...g, providerVenueId: null };
        }
        filled += 1;
        return { ...g, providerVenueId: `venue:${venueId}` };
      });
      await upsertGames(db, withVenues, ctx);
      const finals = known.filter((g) => g.status === 'final').length;
      const detail = {
        games: known.length,
        finals,
        skipped_unknown_teams: games.length - known.length,
        venue_from_home_arena: filled,
        venue_unresolved: unresolved,
        source: season === current ? 'cdn' : 'gamelog+espn',
      };
      await setProgress(db, job, key, 'done', detail);
      console.log(`season ${season}: ${JSON.stringify(detail)}`);
    } catch (err) {
      await setProgress(db, job, key, 'failed', { error: String(err) });
      throw err;
    }
  }
  console.log('nba backfill done. Provider team ids are seeded by season, see providers/nba/ids.ts; use', nbaProviderTeamId('1610612760', 2005), 'for the 2005 Sonics.');
}

const isEntrypoint = process.argv[1] != null && /[\\/]backfill\.ts$/.test(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
