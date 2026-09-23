import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { buildSuggestedGoal, progressLabel, sameDefinition } from '@/features/goals/builder';
import {
  evaluateGoals,
  useCreateGoal,
  useDeleteGoal,
  useGamesInYear,
  useGoalGames,
  useGoals,
  useSyncGoalProgress,
} from '@/features/goals/queries';
import { GoalCard } from '@/features/goals/ui/GoalCard';
import { openShare } from '@/features/share/navigate';
import { currentSeason } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const year = currentSeason();
  const goals = useGoals(year);
  const games = useGoalGames();
  const lastYear = useGamesInYear(year - 1);
  const create = useCreateGoal(year);
  const remove = useDeleteGoal(year);

  const evaluated = useMemo(
    () => evaluateGoals(goals.data ?? [], games.data ?? []),
    [goals.data, games.data],
  );
  useSyncGoalProgress(games.data ? evaluated : [], year);

  const active = evaluated.filter((e) => !e.progress?.completed);
  const done = evaluated.filter((e) => e.progress?.completed);

  const suggestion = useMemo(() => {
    const draft = lastYear.data != null ? buildSuggestedGoal(lastYear.data, year) : null;
    if (!draft) return null;
    const exists = (goals.data ?? []).some((g) => sameDefinition(g.definition, draft.definition));
    return exists ? null : draft;
  }, [lastYear.data, goals.data, year]);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Remove goal?', title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  return (
    <Screen>
      <PageIntro
        kicker={String(year)}
        title="Goals"
        body="Progress updates as your games go final. Hold a goal to remove it."
      />
      {goals.isPending || games.isPending ? <Loading /> : null}
      {goals.isError ? <ErrorNotice error={goals.error} onRetry={goals.refetch} /> : null}
      {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
      {create.isError ? <ErrorNotice error={create.error} /> : null}
      {remove.isError ? <ErrorNotice error={remove.error} /> : null}

      {evaluated.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.xl }}>
          <StatTile label="In progress" value={String(active.length)} />
          <StatTile label="Done" value={String(done.length)} accent />
        </View>
      ) : null}

      {/* The one way to add a goal is the button at the foot of the page, so this only points. */}
      {goals.data && goals.data.length === 0 ? (
        <EmptyState
          icon="i-target"
          title="No goals yet"
          body="Attend more games, visit new venues, see your team on the road, or build your own. Tap New goal below to start."
        />
      ) : null}

      {active.length > 0 ? (
        <View style={{ marginBottom: theme.spacing.sm }}>
          <SectionHeader title="In progress" />
          {active.map(({ goal, definition, progress }) => (
            <GoalCard
              key={goal.id}
              title={goal.title}
              definition={definition}
              progress={progress}
              onLongPress={() => confirmDelete(goal.id, goal.title)}
            />
          ))}
        </View>
      ) : null}

      {suggestion ? (
        <Card tone="accent" label="Suggested">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{suggestion.title}</Text>
              <Text variant="sub" color="muted" style={{ marginTop: 1 }}>
                You went to {lastYear.data} {lastYear.data === 1 ? 'game' : 'games'} last year. Try{' '}
                {suggestion.definition.type === 'count' ? suggestion.definition.target : ''}?
              </Text>
            </View>
            <Button
              title="Add"
              variant="secondary"
              small
              loading={create.isPending}
              onPress={() => create.mutate(suggestion)}
            />
          </View>
        </Card>
      ) : null}

      {done.length > 0 ? (
        <View style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
          <SectionHeader title="Done" />
          {done.map(({ goal, definition, progress }) => (
            <GoalCard
              key={goal.id}
              title={goal.title}
              definition={definition}
              progress={progress}
              onLongPress={() => confirmDelete(goal.id, goal.title)}
              onShare={() =>
                openShare(router, {
                  kind: 'goal',
                  title: goal.title,
                  year,
                  label: progress && definition ? progressLabel(progress, definition) : 'Done',
                })
              }
            />
          ))}
        </View>
      ) : null}

      {/* Bucket lists had no entry point once the old Passport tab left the bar. */}
      <Card style={{ paddingVertical: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        <Row
          icon="i-map"
          title="Bucket lists"
          subtitle="Every venue in a league, a division, or a list of your own"
          first
          chevron
          onPress={() => router.push('/passport/bucketlists')}
        />
      </Card>

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button title="New goal" onPress={() => router.push('/passport/new-goal')} />
      </View>
    </Screen>
  );
}
