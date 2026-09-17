import { SEAL_SLATE } from '@/components/reference/palettes';
import type { SealMetal, SealTint } from '@/components/reference/sealColors';
import { eggs } from '@/features/eggs/flags';
import { stampWear, type StampWear } from '@/features/eggs/stamps';
import type { TeamTokens } from '@/theme/reference/teams';

/**
 * Which colours a stadium's stamp is struck in (Dean, 2026-09-17: "silver doesn't look
 * right, maybe it should be the colour of the team").
 *
 * Pure rules. The data they need is fetched in ./queries and put together in ./useSealLooks.
 */

/** A team that calls a stadium home: a row of `teams` with its `home_venue_id`. */
export type HomeTeam = {
  id: string;
  name: string;
  franchise_id: string;
  home_venue_id: string | null;
  active: boolean;
};

/** One of the person's favourite teams. The franchise is what survives a relocation. */
export type FavouriteTeam = { id: string; franchise_id?: string | null };

/**
 * The team whose colours a stadium takes, or null when it has none.
 *
 * 1. A favourite team that plays there. At MetLife a Jets fan gets green and a Giants fan blue.
 * 2. Otherwise the team that plays there.
 * 3. Two teams and no favourite (MetLife, SoFi): the first by name, so it never flips.
 * 4. No current team (a closed park, a neutral site): null, and the seal is slate.
 *
 * Only active teams count as playing anywhere. A favourite is matched by franchise as well as
 * by id, so someone who follows the Oakland Raiders row still gets Allegiant in their colours.
 */
export function teamForVenue(
  venueId: string,
  teams: readonly HomeTeam[],
  favourites: readonly FavouriteTeam[],
): string | null {
  const tenants = teams
    .filter((t) => t.active && t.home_venue_id === venueId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (tenants.length === 0) return null;
  const favouriteIds = new Set(favourites.map((f) => f.id));
  const favouriteFranchises = new Set(
    favourites.map((f) => f.franchise_id).filter((id): id is string => !!id),
  );
  const mine = tenants.find(
    (t) => favouriteIds.has(t.id) || favouriteFranchises.has(t.franchise_id),
  );
  return (mine ?? (tenants[0] as HomeTeam)).id;
}

/** A team's palette as a seal tint, for the appearance in force. */
export function teamTint(tokens: TeamTokens, scheme: 'light' | 'dark'): SealTint {
  const p = scheme === 'dark' ? tokens.dark : tokens.light;
  return { fill: p.fill, second: p.second, onFill: p.onFill };
}

/** The neutral dark slate of a stadium with no team to colour it. */
export function slateTint(scheme: 'light' | 'dark'): SealTint {
  return { fill: SEAL_SLATE.fill, second: SEAL_SLATE.second[scheme], onFill: SEAL_SLATE.onFill };
}

export type SealLook = {
  metal: SealMetal;
  wear: StampWear;
  /** The team the colours came from. Null for slate, and for gold with no team. */
  teamId: string | null;
  golden: boolean;
};

type Flags = { readonly wornStamps: boolean; readonly goldenStamps: boolean };

/**
 * Everything a stamp's look depends on, decided in one place: gold wins over the team's
 * colour, wear goes on top of either, and each egg disappears when its flag is off.
 */
export function sealLook(input: {
  teamId: string | null;
  /** The team's palette, when it has loaded. Without one the seal is slate, never grey-neutral. */
  tokens: TeamTokens | null | undefined;
  scheme: 'light' | 'dark';
  visits: number | null | undefined;
  golden: boolean;
  flags?: Flags;
}): SealLook {
  const flags = input.flags ?? eggs;
  const golden = flags.goldenStamps && input.golden;
  const tinted = input.teamId != null && input.tokens != null;
  return {
    metal: golden
      ? 'gold'
      : tinted
        ? teamTint(input.tokens as TeamTokens, input.scheme)
        : slateTint(input.scheme),
    wear: stampWear(input.visits, flags),
    teamId: input.teamId,
    golden,
  };
}
