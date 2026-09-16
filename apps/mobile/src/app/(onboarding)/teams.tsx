import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TeamPicker } from '@/components/TeamPicker';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useFavoriteTeams, useSetFavoriteTeams } from '@/features/profile/queries';
import type { Team } from '@/features/teams/queries';
import { useTheme } from '@/theme/ThemeProvider';

function TeamsForm({ initial }: { initial: Team[] }) {
  const theme = useTheme();
  const router = useRouter();
  const save = useSetFavoriteTeams();
  const [selected, setSelected] = useState<Team[]>(initial);

  const onNext = async () => {
    try {
      await save.mutateAsync(selected);
      router.push('/(onboarding)/city');
    } catch {
      // surfaced below
    }
  };

  return (
    <Screen>
      <Button
        title="Back"
        variant="ghost"
        small
        onPress={() => router.back()}
        style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.md }}
      />
      <StepHeader
        step={2}
        title="Your teams"
        subtitle="Pick as many as you like. Games with your teams count toward your record. You can change these later."
      />
      {save.error ? <Notice tone="error">{errorMessage(save.error)}</Notice> : null}
      <TeamPicker selected={selected} onChange={setSelected} />
      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
        <Button
          title={
            selected.length
              ? `Next with ${selected.length} team${selected.length === 1 ? '' : 's'}`
              : 'Next'
          }
          onPress={onNext}
          loading={save.isPending}
        />
      </View>
    </Screen>
  );
}

export default function TeamsStep() {
  const favorites = useFavoriteTeams();
  if (!favorites.data) return <Loading />;
  return <TeamsForm initial={favorites.data} />;
}
