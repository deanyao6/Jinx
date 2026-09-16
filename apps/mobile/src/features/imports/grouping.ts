/** Ticket import inbox grouping (SPEC.md 7.2, 8.3). Pure so it can be unit-tested. */

export type ImportStatus =
  'pending' | 'parsed' | 'needs_review' | 'matched' | 'failed' | 'discarded';

export type ImportLike = {
  id: string;
  status: string;
  matched_attendance_id: string | null;
  created_at: string;
};

export type ImportGroup = 'confirm' | 'review' | 'failed' | 'processing' | 'done';

/** Which inbox section an import belongs to. `matched` with no attendance is waiting for confirmation. */
export function importGroup(i: ImportLike): ImportGroup {
  switch (i.status) {
    case 'matched':
      return i.matched_attendance_id ? 'done' : 'confirm';
    case 'needs_review':
      return 'review';
    case 'failed':
      return 'failed';
    case 'pending':
    case 'parsed':
      return 'processing';
    default:
      return 'done';
  }
}

export function groupImports<T extends ImportLike>(
  imports: readonly T[],
): Record<ImportGroup, T[]> {
  const out: Record<ImportGroup, T[]> = {
    confirm: [],
    review: [],
    failed: [],
    processing: [],
    done: [],
  };
  for (const i of [...imports].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    out[importGroup(i)].push(i);
  }
  return out;
}

/** Badge count for the Games tab: pending + needs_review + matched-unconfirmed. */
export function importBadgeCount(imports: readonly ImportLike[]): number {
  return imports.filter((i) => {
    const g = importGroup(i);
    return g === 'confirm' || g === 'review' || (g === 'processing' && i.status === 'pending');
  }).length;
}

export type ParsedTicket = {
  sport?: 'mlb' | 'nfl' | 'unknown' | null;
  home_team?: string | null;
  away_team?: string | null;
  date_local?: string | null;
  time_local?: string | null;
  venue?: string | null;
  section?: string | null;
  row?: string | null;
  seat?: string | null;
  price?: number | string | null;
  ticketing_platform?: string | null;
  confidence?: number | null;
  candidates?: { game_id: string; score: number; reasons: string[] }[] | null;
  makeup_game_id?: string | null;
  doubleheader_ambiguous?: boolean | null;
};

export function readParsed(raw: unknown): ParsedTicket {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as ParsedTicket;
}

export function seatLabel(p: ParsedTicket): string | null {
  const parts = [
    p.section ? `Section ${p.section}` : null,
    p.row ? `Row ${p.row}` : null,
    p.seat ? `Seat ${p.seat}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** "Phillies vs Mets, Sep 15" from the parsed fields, for cards that have no matched game yet. */
export function parsedSummary(p: ParsedTicket): string {
  const teams = [p.away_team, p.home_team].filter(Boolean);
  const matchup =
    teams.length === 2 ? `${p.away_team} at ${p.home_team}` : (teams[0] ?? 'Unknown teams');
  return p.date_local ? `${matchup}, ${p.date_local}` : matchup;
}

/** Search prefill for the Log segment when an import failed to match. */
export function searchPrefill(p: ParsedTicket): { q: string; date: string | null } {
  const q = [p.away_team, p.home_team].filter(Boolean).join(' ').trim();
  const date = p.date_local && /^\d{4}-\d{2}-\d{2}$/.test(p.date_local) ? p.date_local : null;
  return { q, date };
}
