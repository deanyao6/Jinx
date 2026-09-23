import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Row } from '@/components/Row';
import { SectionHeader } from '@/components/SectionHeader';
import { Segmented } from '@/components/Segmented';
import { PickRow } from '@/features/account/ui/PickRow';
import { SettingsFrame } from '@/features/account/ui/SettingsFrame';
import { useFavoritePlayers, useToggleFavoritePlayer } from '@/features/players/queries';
import { useFavoriteTeams, useSetFavoriteTeams } from '@/features/profile/queries';
import { ThemeTeamPicker } from '@/features/teams/ui/ThemeTeamPicker';
import { sportLabel } from '@/lib/format';
import { TeamTheme } from '@/theme/reference/TeamTheme';

type Tab = 'teams' | 'players';

const TABS: { key: Tab; label: string }[] = [
  { key: 'teams', label: 'Teams' },
  { key: 'players', label: 'Players' },
];

/**
 * Settings > Favourites, with a tab each for teams and players (SPEC.md 5.1, 6.9).
 *
 * Favourite teams used to live inside Edit profile, next to your name and handle, as one
 * long checklist of all 62 teams. They are not profile fields: they decide what the
 * passport counts, which pills appear, and which games are yours. So they get their own
 * place, and players join them.
 *
 * Both tabs show what you have and send you to a picker to add more. Removing happens
 * here, adding happens in the picker, which is why a row on this screen is a toggle that
 * only ever turns things off.
 *
 * Each team is filled in its own colours, which is the point of the page: this is where the
 * colour of the rest of the app is chosen. With two or more teams, "App colour" under the list
 * picks which of them the app wears (`features/teams/themeStore.ts`).
 */
export default function FavoritesRoute() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  // The picker pushes back here with ?tab=players so you land where you left.
  const [tab, setTab] = React.useState<Tab>(params.tab === 'players' ? 'players' : 'teams');

  const teams = useFavoriteTeams();
  const setTeams = useSetFavoriteTeams();
  const players = useFavoritePlayers();
  const togglePlayer = useToggleFavoritePlayer();

  const teamList = teams.data ?? [];
  const playerList = players.data ?? [];

  return (
    <SettingsFrame title="Favorites" fallback="/settings">
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'teams' ? (
        <>
          <Card>
            <Row
              icon="i-plus"
              title="Add a team"
              subtitle="Pick a league, then a team"
              chevron
              accessibilityLabel="Add a team"
              onPress={() => router.push('/settings/favorites/league?mode=teams')}
            />
          </Card>
          <SectionHeader title={teamList.length === 1 ? '1 team' : `${teamList.length} teams`} />
          {teamList.length === 0 ? (
            <EmptyState
              icon="i-spark"
              title="No favorite teams yet"
              body="Your passport uses these to decide which games count as yours."
            />
          ) : (
            teamList.map((t) => (
              <TeamTheme key={t.id} team={t.id}>
                <PickRow
                  badge={t.abbreviation}
                  title={t.name}
                  meta={sportLabel(t.sport_id)}
                  selected
                  accessibilityLabel={`${t.name}, remove from favorites`}
                  onPress={() => setTeams.mutate(teamList.filter((other) => other.id !== t.id))}
                />
              </TeamTheme>
            ))
          )}
          <ThemeTeamPicker teams={teamList} />
        </>
      ) : (
        <>
          <Card>
            <Row
              icon="i-plus"
              title="Add a player"
              subtitle="Pick a league, then a team, then a player"
              chevron
              accessibilityLabel="Add a player"
              onPress={() => router.push('/settings/favorites/league?mode=players')}
            />
          </Card>
          <SectionHeader
            title={playerList.length === 1 ? '1 player' : `${playerList.length} players`}
          />
          {playerList.length === 0 ? (
            <EmptyState
              icon="i-user"
              title="No favorite players yet"
              body="Follow someone and your passport can tell you how many times you have seen them play."
            />
          ) : (
            playerList.map((p) => (
              <PickRow
                key={p.id}
                mark
                title={p.full_name}
                selected
                selectedTone="wash"
                accessibilityLabel={`${p.full_name}, remove from favorites`}
                onPress={() => togglePlayer.mutate({ player: p, on: false })}
              />
            ))
          )}
        </>
      )}
    </SettingsFrame>
  );
}
