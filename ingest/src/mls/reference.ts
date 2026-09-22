/** Generate MLS reference snapshots from ESPN. Does not write to any database. */
import { mkdir, writeFile } from 'node:fs/promises';
import { MLS_PROVIDER, type MlsEvent } from '@jinx/core';
import { mlsProvider } from './provider.js';

const provider = mlsProvider();
const teams = await provider.rawTeams();
if (teams.length !== 30) throw new Error(`Review changed MLS membership: ${teams.length} teams`);
const events: MlsEvent[] = [];
for (let month = 1; month <= 12; month++) {
  const board = await provider.month(2026, month);
  events.push(...board.events);
  console.log(`2026-${month}: ${board.events.length} matches`);
}
const venues = new Map<string, NonNullable<MlsEvent['competitions'][number]['venue']>>();
const homeVenues = new Map<string, Map<string, number>>();
for (const event of events) {
  const c = event.competitions[0]!;
  if (!c.venue) continue;
  venues.set(c.venue.id, c.venue);
  const home = c.competitors.find((t) => t.homeAway === 'home')!;
  const counts = homeVenues.get(home.team.id) ?? new Map<string, number>();
  counts.set(c.venue.id, (counts.get(c.venue.id) ?? 0) + 1);
  homeVenues.set(home.team.id, counts);
}
const draftDir = 'ingest/.cache/mls/reference-drafts';
await mkdir(draftDir, { recursive: true });
const write = (file: string, data: unknown) =>
  writeFile(file, JSON.stringify(data, null, 2) + '\n');
await write(`${draftDir}/mls_teams.json`, {
  source: 'ESPN usa.1 teams and 2026 scoreboards; names/IDs only, no marks',
  teams: teams.map((t) => ({
    provider: MLS_PROVIDER,
    provider_team_id: t.id,
    name: t.displayName,
    nickname: t.shortDisplayName ?? t.displayName,
    abbr: t.abbreviation,
    city: '',
    franchise: `mls-${t.id}`,
    active: true,
    color: `#${t.color ?? '374151'}`,
    alternate_color: `#${t.alternateColor ?? 'ffffff'}`,
    aliases: [t.displayName, t.shortDisplayName ?? t.displayName, t.abbreviation],
    home_venue_key: `mls-espn-${[...(homeVenues.get(t.id) ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0]}`,
  })),
});
await write(`${draftDir}/mls_venues.json`, {
  source:
    'ESPN 2026 scoreboards. Coordinates unknown until independently verified; check-in unavailable at unmapped venues.',
  venues: [...venues.values()].map((v) => ({
    key: `mls-espn-${v.id}`,
    name: v.fullName,
    city: v.address?.city ?? null,
    country: v.address?.country ?? null,
    state: null,
    lat: null,
    lng: null,
    geofence_m: 400,
    sports: ['mls'],
    aliases: [v.fullName],
    provider_ids: { espn_soccer_venue_ids: [v.id] },
  })),
});
await mkdir('ingest/fixtures/mls', { recursive: true });
// Keep only the documented schedule fields, never logos, articles or betting payloads.
const fixture = (e: MlsEvent) => ({
  id: e.id,
  date: e.date,
  season: e.season,
  competitions: e.competitions.map((c) => ({
    date: c.date,
    leg: c.leg,
    venue: c.venue,
    status: c.status,
    competitors: c.competitors.map((t) => ({
      homeAway: t.homeAway,
      aggregateScore: t.aggregateScore,
      score: t.score,
      shootoutScore: t.shootoutScore,
      winner: t.winner,
      team: { id: t.team.id, displayName: t.team.displayName, abbreviation: t.team.abbreviation },
    })),
  })),
});
const cup = await provider.get<{ events: MlsEvent[] }>('scoreboard?dates=20221105&limit=100');
await write(
  `${draftDir}/schedules.json`,
  [
    ...events.filter((e) => e.competitions[0]?.status.type.completed).slice(0, 5),
    ...events.filter((e) => e.competitions[0]?.status.type.state === 'pre').slice(0, 2),
    ...cup.events,
  ].map(fixture),
);
console.log(
  `${teams.length} teams, ${venues.size} venues, ${events.length} schedule rows; reference snapshots generated`,
);
