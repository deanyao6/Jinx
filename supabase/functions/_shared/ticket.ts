/**
 * Ticket extraction (Anthropic, from an Edge Function only) and matching (SPEC.md 7.2-7.4).
 * Model and input shapes are verified in docs/verification.md.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import {
  rankCandidates,
  selectAll,
  type CandidateGame,
  type MatchContext,
  type MatchResult,
  type MinimalDb,
  type ParsedTicket,
  type TeamRef,
  type VenueRef,
} from './core/index.ts';

export const TICKET_MODEL = 'claude-haiku-4-5';

export const TicketSchema = z.object({
  sport: z.enum(['mlb', 'nfl', 'nba', 'unknown']),
  home_team: z.string(),
  away_team: z.string(),
  date_local: z.string().nullable(),
  time_local: z.string().nullable(),
  venue: z.string(),
  section: z.string(),
  row: z.string(),
  seat: z.string(),
  price: z.number().nullable(),
  ticketing_platform: z.string(),
  confidence: z.number().min(0).max(1),
});

export const ExtractionSchema = z.object({
  tickets: z.array(TicketSchema),
});

export type TicketInput =
  | {
      kind: 'image';
      mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
      base64: string;
    }
  | { kind: 'pdf'; base64: string }
  | { kind: 'text'; text: string };

const SYSTEM_PROMPT = `You extract sports ticket details from ticket screenshots, PDFs, and confirmation emails for MLB (baseball), NFL (football) and NBA (basketball) games.
Return one entry per distinct game found. A season-ticket or multi-game confirmation yields several entries; a single ticket yields one.
Rules:
- home_team and away_team: the team names exactly as printed. If the document prints "A vs B" or "A at B", the team after "at" is the home team; for "vs" keep the printed order and set confidence lower.
- date_local: the event date printed on the ticket as YYYY-MM-DD in the venue's local time. time_local: HH:MM 24-hour local, or null if not printed.
- venue: the venue name as printed. section/row/seat: as printed, empty strings when absent. price: a number in dollars or null.
- ticketing_platform: Ticketmaster, SeatGeek, StubHub, TickPick, team site, or other text you see; empty string if unknown.
- sport: "mlb", "nfl", "nba", or "unknown". confidence: 0 to 1 for how sure you are the entry is a real game ticket with correct fields.
- Never invent fields. If the document is not a sports ticket, return an empty tickets list.`;

function userContent(input: TicketInput): Anthropic.Messages.ContentBlockParam[] {
  const ask = { type: 'text' as const, text: 'Extract every game ticket in this document.' };
  if (input.kind === 'image') {
    return [
      {
        type: 'image',
        source: { type: 'base64', media_type: input.mediaType, data: input.base64 },
      },
      ask,
    ];
  }
  if (input.kind === 'pdf') {
    return [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: input.base64 },
      },
      ask,
    ];
  }
  return [{ type: 'text', text: `Document text:\n\n${input.text.slice(0, 60_000)}` }, ask];
}

/** Calls the model with structured output; retries once on a parse failure (SPEC 7.2.3). */
export async function extractTickets(
  client: Anthropic,
  input: TicketInput,
): Promise<ParsedTicket[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: TICKET_MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent(input) }],
        output_config: { format: zodOutputFormat(ExtractionSchema) },
      });
      if (response.stop_reason === 'refusal') return [];
      if (response.parsed_output) return response.parsed_output.tickets;
      lastError = new Error('model returned no parsable output');
    } catch (err) {
      lastError = err;
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.BadRequestError)
        throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ---------------------------------------------------------------------------
// Matching against the database
// ---------------------------------------------------------------------------

interface TeamRow {
  id: string;
  sport_id: 'mlb' | 'nfl' | 'nba';
  name: string;
  city: string;
  abbreviation: string;
}
interface AliasRow {
  team_id?: string;
  venue_id?: string;
  alias: string;
}
interface VenueRow {
  id: string;
  name: string;
  tz: string | null;
}

export async function loadMatchContext(db: MinimalDb): Promise<MatchContext> {
  const [teams, teamAliases, venues, venueAliases] = await Promise.all([
    selectAll<TeamRow>(db, 'teams', 'id, sport_id, name, city, abbreviation'),
    selectAll<AliasRow>(db, 'team_aliases', 'team_id, alias'),
    selectAll<VenueRow>(db, 'venues', 'id, name, tz'),
    selectAll<AliasRow>(db, 'venue_aliases', 'venue_id, alias'),
  ]);
  const ta = new Map<string, string[]>();
  for (const a of teamAliases) ta.set(a.team_id!, [...(ta.get(a.team_id!) ?? []), a.alias]);
  const va = new Map<string, string[]>();
  for (const a of venueAliases) va.set(a.venue_id!, [...(va.get(a.venue_id!) ?? []), a.alias]);
  const teamRefs: TeamRef[] = teams.map((t) => ({
    id: t.id,
    sport: t.sport_id,
    name: t.name,
    city: t.city,
    abbreviation: t.abbreviation,
    aliases: ta.get(t.id) ?? [],
  }));
  const venueRefs: VenueRef[] = venues.map((v) => ({
    id: v.id,
    name: v.name,
    aliases: va.get(v.id) ?? [],
    tz: v.tz,
  }));
  return { teams: teamRefs, venues: venueRefs };
}

interface GameRow {
  id: string;
  sport_id: 'mlb' | 'nfl' | 'nba';
  scheduled_start: string;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  status: CandidateGame['status'];
  doubleheader_number: number | null;
  rescheduled_to_game_id: string | null;
}

/** Candidate games within date +/- 1 day (in UTC, padded to cover any venue time zone). */
export async function loadCandidates(
  db: MinimalDb,
  ticket: ParsedTicket,
): Promise<CandidateGame[]> {
  if (!ticket.date_local || !/^\d{4}-\d{2}-\d{2}$/.test(ticket.date_local)) return [];
  const day = Date.parse(`${ticket.date_local}T00:00:00Z`);
  const from = new Date(day - 36 * 3_600_000).toISOString();
  const to = new Date(day + 60 * 3_600_000).toISOString();
  let q = db
    .from('games')
    .select(
      'id, sport_id, scheduled_start, home_team_id, away_team_id, venue_id, status, doubleheader_number, rescheduled_to_game_id',
    )
    .gte('scheduled_start', from)
    .lte('scheduled_start', to);
  if (ticket.sport !== 'unknown') q = q.eq('sport_id', ticket.sport);
  const { data, error } = await q.limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as GameRow[]).map((g) => ({
    id: g.id,
    sport: g.sport_id,
    scheduledStart: g.scheduled_start,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    venueId: g.venue_id,
    status: g.status,
    doubleheaderNumber: g.doubleheader_number,
    rescheduledToGameId: g.rescheduled_to_game_id,
  }));
}

export async function matchTicket(
  db: MinimalDb,
  ticket: ParsedTicket,
  ctx?: MatchContext,
): Promise<MatchResult> {
  const context = ctx ?? (await loadMatchContext(db));
  const candidates = await loadCandidates(db, ticket);
  return rankCandidates(ticket, candidates, context);
}

/** Writes the outcome of a match onto a ticket_imports row. */
export async function recordMatch(
  db: MinimalDb,
  importId: string,
  ticket: ParsedTicket,
  result: MatchResult,
): Promise<void> {
  const status =
    result.decision === 'matched'
      ? 'matched'
      : result.decision === 'needs_review'
        ? 'needs_review'
        : 'failed';
  const { error } = await db
    .from('ticket_imports')
    .update({
      parsed: {
        ...ticket,
        makeup_game_id: result.makeupGameId,
        doubleheader_ambiguous: result.doubleheaderAmbiguous,
        candidates: result.candidates.map((c) => ({
          game_id: c.game.id,
          score: c.score,
          reasons: c.reasons,
        })),
      },
      status,
      candidate_game_ids: result.candidates.map((c) => c.game.id),
      error: result.decision === 'failed' ? 'No matching game found' : null,
    })
    .eq('id', importId);
  if (error) throw new Error(error.message);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function mediaTypeFor(
  path: string,
  declared?: string | null,
): TicketInput['kind'] extends never
  ? never
  : 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/pdf' | null {
  const d = (declared ?? '').toLowerCase();
  if (
    d === 'image/png' ||
    d === 'image/jpeg' ||
    d === 'image/webp' ||
    d === 'image/gif' ||
    d === 'application/pdf'
  )
    return d;
  if (d === 'image/jpg') return 'image/jpeg';
  const ext = path.toLowerCase().split('.').pop() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  return null;
}

export function anthropicClient(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}
