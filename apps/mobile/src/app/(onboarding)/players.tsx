import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { StepIntro } from '@/features/onboarding/ui/StepIntro';
import { NO_ROSTER_NOTE, TeamRosterSection } from '@/features/players/ui/TeamRosterSection';
import { useFavoriteTeams } from '@/features/profile/queries';
import type { Team } from '@/features/teams/queries';
import { useTheme } from '@/theme/ThemeProvider';

/** The step after the teams one, so it is numbered from there. */
export const PLAYERS_STEP = 4;

/**
 * Favourite players, straight after favourite teams (Dean, 2026-09-17): a section per team
 * you picked, listing its current roster to choose from.
 *
 * Every pick is saved as it is made, through the same toggle the settings picker uses, so
 * Continue and Skip both only navigate. Neither waits on anything: a roster that has not
 * loaded, failed, or is empty never holds up onboarding.
 */
function PlayersPage({ teams }: { teams: Team[] }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const next = () => router.push('/(onboarding)/city');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.screen }}>
      <Screen>
        <StepIntro
          step={PLAYERS_STEP}
          title="Any favorite players?"
          body="Pick from your teams' current rosters. You can change this any time in Settings."
          onBack={() => router.back()}
        />
        {teams.length === 0 ? (
          <Text variant="sub" color="muted">
            {NO_ROSTER_NOTE}
          </Text>
        ) : (
          teams.map((t) => <TeamRosterSection key={t.id} team={t} />)
        )}
      </Screen>
      {/* Two rosters is a long scroll, so the actions stay in reach under it. */}
      <View
        style={{
          backgroundColor: theme.colors.screen,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <Button title="Continue" onPress={next} />
        <Button title="Skip for now" variant="ghost" onPress={next} />
      </View>
    </View>
  );
}

export default function PlayersStep() {
  const favorites = useFavoriteTeams();
  // A failed favourites query still gets a page with a way forward, not a spinner forever.
  if (favorites.isLoading) return <Loading />;
  return <PlayersPage teams={favorites.data ?? []} />;
}
