import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Loading } from '@/components/Loading';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { shortTeamName } from '@/features/data/names';
import {
  useFavoritePlayers,
  useTeamRoster,
  useToggleFavoritePlayer,
  type RosterPlayer,
} from '@/features/players/queries';
import type { Team } from '@/features/teams/queries';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

import { RosterRow } from './RosterRow';

/** A roster longer than this gets a search field; shorter ones are quicker to scan. */
export const ROSTER_SEARCH_THRESHOLD = 30;

/** What the section says when there is no roster to show, for whatever reason. */
export const NO_ROSTER_NOTE = 'Rosters arrive with the next update';

/**
 * Players you have seen first, keeping the RPC's order otherwise. The RPC already sorts
 * this way; doing it here too means the section reads the same if that ever changes.
 */
export function seenFirst(list: RosterPlayer[]): RosterPlayer[] {
  return [...list].sort((a, b) => Number(b.seen_by_you > 0) - Number(a.seen_by_you > 0));
}

/**
 * One favourite team's current roster as a section of selectable rows, in that team's
 * colours. Picking a player calls the same toggle the settings picker uses, so nothing is
 * held back for a save: leaving the screen loses nothing.
 *
 * It never blocks: a roster that fails to load or comes back empty is a one-line note, and
 * the person continues.
 */
export function TeamRosterSection({ team }: { team: Team }) {
  const theme = useTheme();
  const roster = useTeamRoster(team.id, '');
  const favorites = useFavoritePlayers();
  const toggle = useToggleFavoritePlayer();
  const [query, setQuery] = useState('');

  const favoriteIds = useMemo(
    () => new Set((favorites.data ?? []).map((p) => p.id)),
    [favorites.data],
  );
  const all = useMemo(() => seenFirst(roster.data ?? []), [roster.data]);
  const searchable = all.length > ROSTER_SEARCH_THRESHOLD;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((p) => p.full_name.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const nick = shortTeamName(team.name, team);
  const picked = all.filter((p) => favoriteIds.has(p.id)).length;

  return (
    <TeamTheme team={team.id}>
      <View style={{ marginBottom: theme.spacing.xl }} testID={`roster-section-${team.id}`}>
        <SectionHeader title={nick} />
        {roster.isPending ? (
          <Loading />
        ) : roster.isError || all.length === 0 ? (
          <Text variant="sub" color="muted">
            {NO_ROSTER_NOTE}
          </Text>
        ) : (
          <>
            {picked > 0 ? (
              <Text variant="caption" color="accent" weight={750} style={{ marginBottom: 10 }}>
                {picked === 1 ? '1 picked' : `${picked} picked`}
              </Text>
            ) : null}
            {searchable ? (
              <TextField
                placeholder={`Search ${nick}`}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                accessibilityLabel={`Search ${nick}`}
              />
            ) : null}
            {list.map((p) => {
              const on = favoriteIds.has(p.id);
              return (
                <RosterRow
                  key={p.id}
                  player={p}
                  selected={on}
                  onToggle={() =>
                    toggle.mutate({ player: { id: p.id, full_name: p.full_name }, on: !on })
                  }
                />
              );
            })}
            {searchable && list.length === 0 ? (
              <Text variant="sub" color="muted">
                No players match “{query.trim()}”.
              </Text>
            ) : null}
          </>
        )}
      </View>
    </TeamTheme>
  );
}
