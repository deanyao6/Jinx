/** Shape of `wrapped_snapshots.payload` / `my_wrapped()` (SPEC.md 6.15). */
import type { WinLossRecord } from '@/features/passport/types';

export type WrappedTeamRecord = { team_id: string; name: string; record: WinLossRecord };

export type WrappedCompanion = { person_id: string; name: string; record: WinLossRecord };

export type WrappedSuperlatives = {
  coldest?: { game_id: string; value: number };
  hottest?: { game_id: string; value: number };
  longest?: { game_id: string; minutes: number | null; periods: number | null };
  highest_scoring?: { game_id: string; total: number };
};

export type WrappedCard =
  | { kind: 'games'; games: number }
  | { kind: 'record'; record: WinLossRecord; teams: WrappedTeamRecord[] }
  | { kind: 'pledge'; pledge: { record: WinLossRecord; vs_expected: number } | null }
  | { kind: 'stamps'; stamps: { venues: number; new: { venue_id: string; name: string }[] } }
  | { kind: 'player'; player: { player_id: string; name: string; count: number } | null }
  | {
      kind: 'moment';
      moment: {
        type: string;
        game_id: string;
        player: string | null;
        occurred_at: string | null;
      } | null;
    }
  | { kind: 'companions'; best: WrappedCompanion | null; worst: WrappedCompanion | null }
  | { kind: 'miles'; km: number | null }
  | { kind: 'superlative'; superlatives: WrappedSuperlatives }
  | { kind: 'goals'; goals: { goal_id: string; title: string }[] };

export type WrappedCardKind = WrappedCard['kind'];

export type WrappedPayload = {
  sport_id: string;
  season: number;
  cards: WrappedCard[];
  generated_at: string | null;
};
