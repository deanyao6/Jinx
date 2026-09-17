import { eggs } from './flags';

/**
 * The certified jinx (Dean, 2026-09-17). The app is called Jinx: the companion you keep losing
 * with is yours.
 *
 * Pure rules only. The cat is `features/eggs/JinxBadge`; the rows that wear it are the Friends
 * panel, the older "Your record with" list and the companion page. It is about the signed-in
 * person's own companion records and nothing else: never another person's page, never the feed.
 */

/** Decided games (wins + losses, ties ignored) before anybody is called anything. */
export const LUCK_MIN_DECIDED = 4;
/** A win rate at or under this, over enough games, is a jinx. 1–3 is exactly on it. */
export const JINX_MAX_RATE = 0.25;
/** A win rate at or over this, over enough games, is a good luck charm. 3–1 is exactly on it. */
export const CHARM_MIN_RATE = 0.75;

export const JINX_LABEL = 'Certified jinx';
export const CHARM_LABEL = 'Good luck charm';

export type CompanionLuck = 'jinx' | 'charm';

/** A companion, as far as the rule needs to know them. */
export type CompanionTally = {
  id: string;
  name: string;
  wins: number;
  losses: number;
};

type Flags = { readonly certifiedJinx: boolean };

function decided(c: CompanionTally): number {
  return Math.max(0, c.wins) + Math.max(0, c.losses);
}

function rate(c: CompanionTally): number {
  const n = decided(c);
  return n === 0 ? 0 : Math.max(0, c.wins) / n;
}

function sane(c: CompanionTally): boolean {
  return Number.isFinite(c.wins) && Number.isFinite(c.losses);
}

/** Enough decided games together, and a win rate of .250 or worse. */
export function isJinxCandidate(c: CompanionTally): boolean {
  return sane(c) && decided(c) >= LUCK_MIN_DECIDED && rate(c) <= JINX_MAX_RATE;
}

/** Enough decided games together, and a win rate of .750 or better. */
export function isCharmCandidate(c: CompanionTally): boolean {
  return sane(c) && decided(c) >= LUCK_MIN_DECIDED && rate(c) >= CHARM_MIN_RATE;
}

/** More games first, then the name, then the id so two "Dad"s still sort one way. */
function tieBreak(a: CompanionTally, b: CompanionTally): number {
  return decided(b) - decided(a) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/**
 * The one certified jinx: the worst candidate. Only one at a time. A tie on the rate goes to
 * whoever it has happened with more often, then to the name.
 */
export function certifiedJinxId(
  companions: readonly CompanionTally[],
  flags: Flags = eggs,
): string | null {
  if (!flags.certifiedJinx) return null;
  const worst = companions
    .filter(isJinxCandidate)
    .sort((a, b) => rate(a) - rate(b) || tieBreak(a, b))[0];
  return worst?.id ?? null;
}

/** The quieter inverse: the one best candidate. Same switch, same tie-break. */
export function goodLuckCharmId(
  companions: readonly CompanionTally[],
  flags: Flags = eggs,
): string | null {
  if (!flags.certifiedJinx) return null;
  const best = companions
    .filter(isCharmCandidate)
    .sort((a, b) => rate(b) - rate(a) || tieBreak(a, b))[0];
  return best?.id ?? null;
}

/** Who is what, by companion id. Empty when the egg is switched off. */
export function companionLuck(
  companions: readonly CompanionTally[],
  flags: Flags = eggs,
): ReadonlyMap<string, CompanionLuck> {
  const out = new Map<string, CompanionLuck>();
  const jinx = certifiedJinxId(companions, flags);
  const charm = goodLuckCharmId(companions, flags);
  if (jinx) out.set(jinx, 'jinx');
  if (charm) out.set(charm, 'charm');
  return out;
}

/** "Certified jinx. You are 0–4 together." The en dash in a record is correct. */
export function luckSentence(luck: CompanionLuck, wins: number, losses: number): string {
  const label = luck === 'jinx' ? JINX_LABEL : CHARM_LABEL;
  return `${label}. You are ${wins}–${losses} together.`;
}

/** Rows from `companion_records` (or anything shaped like them) as tallies. */
export function talliesFromRecords(
  rows: readonly { person_id: string; display_name: string; wins: number; losses: number }[],
): CompanionTally[] {
  return rows.map((r) => ({
    id: r.person_id,
    name: r.display_name,
    wins: r.wins,
    losses: r.losses,
  }));
}
