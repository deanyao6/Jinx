import { assertEquals } from 'jsr:@std/assert@1';
import { ExtractionSchema } from './ticket.ts';

Deno.test('MLS ticket extraction retains the league, local date and printed venue', () => {
  const ticket = {
    sport: 'mls' as const,
    home_team: 'LAFC',
    away_team: 'Philadelphia Union',
    date_local: '2022-11-05',
    time_local: '13:00',
    venue: 'Banc of California Stadium',
    section: '101',
    row: '2',
    seat: '3',
    price: null,
    ticketing_platform: 'Ticketmaster',
    confidence: 0.95,
  };
  assertEquals(ExtractionSchema.parse({ tickets: [ticket] }).tickets, [ticket]);
});
