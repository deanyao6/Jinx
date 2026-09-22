/** Read-only runner probe. Needs no database access or secrets. */
import { MlsProvider, isMlsLeagueEvent, parseMlsEvent } from '@jinx/core';

const provider = new MlsProvider();
const now = new Date();
const year = now.getUTCFullYear();
if (year > 2026) throw new Error('MLS 2027+ season mapping requires verification');
const teams = await provider.rawTeams();
if (teams.length !== 30) throw new Error(`Review changed MLS membership: ${teams.length}`);
const board = await provider.month(year, now.getUTCMonth() + 1, true);
const games = board.events.filter(isMlsLeagueEvent).map(parseMlsEvent);
console.log(JSON.stringify({ year, teams: teams.length, games: games.length }));
