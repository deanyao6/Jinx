import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { useGoBack } from '@/components/reference/BackHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { PickRow } from '@/features/account/ui/PickRow';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import { rosterMeta } from '@/features/favorites/meta';
import {
  useFavoritePlayers,
  useTeamRoster,
  useToggleFavoritePlayer,
} from '@/features/players/queries';
import { NO_ROSTER_NOTE } from '@/features/players/ui/TeamRosterSection';
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
 *
 * Opened with `prompt=1`, it is also the question asked the moment a team is added to your
 * favourites (Dean, 2026-09-17): "Any favorite Phillies?" over the same list, with Done and
 * Not now underneath. Both only go back; every pick was saved as it was tapped.
 */
export default function RosterRoute() {
  const { teamId, name, nick, sport, prompt } = useLocalSearchParams<{
    teamId?: string;
    name?: string;
    /** The short name, for the prompt's question. */
    nick?: string;
    sport?: string;
    prompt?: string;
  }>();
  const asPrompt = prompt === '1';
  const goBack = useGoBack('/settings/favorites');
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
  /** The prompt's question and its buttons wear the team's colours, like the rows. */
  const themed = (node: React.ReactNode) =>
    teamId ? <TeamTheme team={teamId}>{node}</TeamTheme> : node;

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
      fallback={
        asPrompt ? '/settings/favorites' : `/settings/favorites/players?sport=${sport ?? 'mlb'}`
      }
      footer={
        asPrompt
          ? themed(
              <>
                <Button title="Done" onPress={goBack} />
                <Button title="Not now" variant="ghost" onPress={goBack} />
              </>,
            )
          : undefined
      }
    >
      {asPrompt
        ? themed(
            <PageIntro
              title={`Any favorite ${nick ?? name ?? 'players'}?`}
              body="Pick from the current roster."
            />,
          )
        : null}
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search players"
        accessibilityLabel="Search players"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {asPrompt ? null : <SectionHeader title="Choose a player" />}
      {roster.isPending ? (
        <Loading label="Loading players…" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="i-search"
          title="No players"
          body={
            debounced.trim()
              ? `No players match "${debounced.trim()}".`
              : asPrompt
                ? `${NO_ROSTER_NOTE}.`
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
