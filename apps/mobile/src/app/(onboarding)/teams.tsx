import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { StepIntro } from '@/features/onboarding/ui/StepIntro';
import { TeamTiles } from '@/features/onboarding/ui/TeamTiles';
import { useFavoriteTeams, useSetFavoriteTeams } from '@/features/profile/queries';
import type { Team } from '@/features/teams/queries';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { NEUTRAL_TEAM_KEY } from '@/theme/reference/teams';
import { useTheme } from '@/theme/ThemeProvider';

function TeamsForm({ initial }: { initial: Team[] }) {
  const router = useRouter();
  const save = useSetFavoriteTeams();
  const [selected, setSelected] = useState<Team[]>(initial);

  const onNext = async () => {
    try {
      await save.mutateAsync(selected);
      // The players step lists the picked teams' rosters, so with no team there is nothing
      // for it to ask.
      router.push(selected.length > 0 ? '/(onboarding)/players' : '/(onboarding)/city');
    } catch {
      // surfaced below
    }
  };

  return (
    // This is the step where colour arrives. The first team picked is the one the rest of the app
    // will lean on (features/teams/AccentRoot), so the page takes it on the moment it is chosen
    // rather than after the save. The wrapper is always here, neutral until then, so picking the
    // first team does not remount the list and lose the search or the scroll position.
    <TeamTheme team={selected[0]?.id ?? NEUTRAL_TEAM_KEY}>
      <TeamsPage
        selected={selected}
        onChange={setSelected}
        onBack={() => router.back()}
        onNext={onNext}
        saving={save.isPending}
        error={save.error ? errorMessage(save.error) : null}
      />
    </TeamTheme>
  );
}

function TeamsPage({
  selected,
  onChange,
  onBack,
  onNext,
  saving,
  error,
}: {
  selected: Team[];
  onChange: (teams: Team[]) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
  error: string | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.screen }}>
      <Screen>
        <StepIntro
          step={2}
          title="Your teams"
          body="Pick as many as you like. Games with your teams count toward your record. You can change these later."
          onBack={onBack}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TeamTiles selected={selected} onChange={onChange} />
      </Screen>
      {/* Sixty teams is a long scroll, so the one action stays in reach under it. */}
      <View
        style={{
          backgroundColor: theme.colors.screen,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.md,
        }}
      >
        <Button
          title={
            selected.length
              ? `Continue with ${selected.length} team${selected.length === 1 ? '' : 's'}`
              : 'Continue'
          }
          onPress={onNext}
          loading={saving}
        />
      </View>
    </View>
  );
}

export default function TeamsStep() {
  const favorites = useFavoriteTeams();
  if (!favorites.data) return <Loading />;
  return <TeamsForm initial={favorites.data} />;
}
