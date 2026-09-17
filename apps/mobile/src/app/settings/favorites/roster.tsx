import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { rosterMeta } from '@/features/favorites/meta';
import { PickRow } from '@/features/account/ui/PickRow';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import {
  useFavoritePlayers,
  useTeamRoster,
  useToggleFavoritePlayer,
} from '@/features/players/queries';
import { TeamTheme } from '@/theme/reference/TeamTheme';

/**
 * Step three of the player picker: choose a player.
 *
 * The list is everyone who has ever appeared for this team, most appearances first, which
 * is as close to "the players you would recognise" as this database can honestly get. See
 * the `team_roster` migration for why it is derived from appearances rather than stored.
 *
 * The search goes to the database rather than filtering what arrived, because the roster is
 * capped at 200 rows and a long-serving franchise has more players than that. Typing a name
 * that is not in the first 200 still finds them.
 *
 * The whole list is in the team's colours: a slim mark on every row, and the fill on the
 * players you follow.
 */
export default function RosterRoute() {
  const { teamId, name, sport } = useLocalSearchParams<{
    teamId?: string;
    name?: string;
    sport?: string;
  }>();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // The roster query hits an RPC, so it waits for a pause in typing rather than firing per
  // keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  const roster = useTeamRoster(teamId, debounced);
  const favorites = useFavoritePlayers();
  const toggle = useToggleFavoritePlayer();

  const favoriteIds = React.useMemo(
    () => new Set((favorites.data ?? []).map((p) => p.id)),
    [favorites.data],
  );

  const list = roster.data ?? [];

  const rows = list.map((p) => {
    const on = favoriteIds.has(p.id);
    return (
      <PickRow
        key={p.id}
        mark
        title={p.full_name}
        meta={rosterMeta(p)}
        selected={on}
        accessibilityLabel={`${p.full_name}, ${on ? 'remove from' : 'add to'} favorites`}
        onPress={() => toggle.mutate({ player: { id: p.id, full_name: p.full_name }, on: !on })}
      />
    );
  });

  return (
    <SettingsFrame
      title={name ?? 'Players'}
      fallback={`/settings/favorites/players?sport=${sport ?? 'mlb'}`}
    >
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search players"
        accessibilityLabel="Search players"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <SectionHeader title="Choose a player" />
      {roster.isPending ? (
        <Loading label="Loading players…" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="i-search"
          title="No players"
          body={
            debounced.trim()
              ? `No players match "${debounced.trim()}".`
              : 'No players recorded for this team yet. Lineups arrive with a game’s detail.'
          }
        />
      ) : teamId ? (
        <TeamTheme team={teamId}>{rows}</TeamTheme>
      ) : (
        rows
      )}
    </SettingsFrame>
  );
}
