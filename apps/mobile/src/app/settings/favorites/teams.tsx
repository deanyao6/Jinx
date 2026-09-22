import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React from 'react';

import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { PickRow } from '@/features/account/ui/PickRow';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import { shortTeamName } from '@/features/data/names';
import { useFavoriteTeams, useSetFavoriteTeams } from '@/features/profile/queries';
import { useTeams, type Team } from '@/features/teams/queries';
import { sportLabel } from '@/lib/format';
import { TeamTheme } from '@/theme/reference/TeamTheme';

/** The roster picker as the "any favorite players?" question for one just-added team. */
export function rosterPromptHref(team: Team): Href {
  const name = encodeURIComponent(team.name);
  const nick = encodeURIComponent(shortTeamName(team.name, team));
  return `/settings/favorites/roster?teamId=${team.id}&name=${name}&nick=${nick}&sport=${team.sport_id}&prompt=1`;
}

/**
 * Step two of the team picker: choose a team in one league, and that is the whole flow.
 *
 * Tapping toggles immediately rather than collecting a selection behind a Save button.
 * There is nothing else on the screen to save, and the favourites list you came from
 * updates under you, so a Save would only be a way to lose the change by leaving.
 *
 * Every row sits in its own team's colours: a plain row with a coloured tile until you pick
 * it, and filled with the colour once you have.
 *
 * Adding a team asks straight away whether any of its players are favourites too (Dean,
 * 2026-09-17): the roster picker opens in its prompt form, and Back or Not now return here.
 * Removing a team asks nothing.
 */
export default function TeamsRoute() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  const teams = useTeams(true);
  const favorites = useFavoriteTeams();
  const setFavorites = useSetFavoriteTeams();

  const favoriteList = React.useMemo(() => favorites.data ?? [], [favorites.data]);
  const favoriteIds = React.useMemo(() => new Set(favoriteList.map((t) => t.id)), [favoriteList]);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teams.data ?? [])
      .filter((t) => t.sport_id === sport)
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.abbreviation.toLowerCase() === q,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams.data, sport, query]);

  const toggle = (team: Team) => {
    if (favoriteIds.has(team.id)) {
      setFavorites.mutate(favoriteList.filter((t) => t.id !== team.id));
    } else {
      setFavorites.mutate([...favoriteList, team]);
      if (team.sport_id !== 'mls') router.push(rosterPromptHref(team));
    }
  };

  return (
    <SettingsFrame
      title={sport ? sportLabel(sport) : 'Teams'}
      fallback="/settings/favorites/league?mode=teams"
    >
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search teams"
        accessibilityLabel="Search teams"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <SectionHeader title="Choose a team" />
      {teams.isPending ? (
        <Loading label="Loading teams…" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="i-search"
          title="No teams"
          body={query.trim() ? `No teams match "${query.trim()}".` : 'No teams in this league yet.'}
        />
      ) : (
        list.map((t) => {
          const on = favoriteIds.has(t.id);
          return (
            <TeamTheme key={t.id} team={t.id}>
              <PickRow
                badge={t.abbreviation}
                title={t.name}
                meta={t.city}
                selected={on}
                accessibilityLabel={`${t.name}, ${on ? 'remove from' : 'add to'} favorites`}
                onPress={() => toggle(t)}
              />
            </TeamTheme>
          );
        })
      )}
    </SettingsFrame>
  );
}
