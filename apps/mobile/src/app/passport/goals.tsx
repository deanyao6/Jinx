import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
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
import { GoalRow } from '@/features/goals/ui/GoalRow';
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
      <Text variant="h1">{year} goals</Text>
      <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Progress updates as your games go final. Hold a goal to remove it.
      </Text>
      {goals.isPending || games.isPending ? <Loading /> : null}
      {goals.isError ? <ErrorNotice error={goals.error} onRetry={goals.refetch} /> : null}
      {games.isError ? <ErrorNotice error={games.error} onRetry={games.refetch} /> : null}
      {create.isError ? <ErrorNotice error={create.error} /> : null}
      {remove.isError ? <ErrorNotice error={remove.error} /> : null}

      {suggestion ? (
        <Card label="Suggested">
          <Text variant="bodyStrong">{suggestion.title}</Text>
          <Text variant="sub" color="muted">
            You went to {lastYear.data} {lastYear.data === 1 ? 'game' : 'games'} last year. Try{' '}
            {suggestion.definition.type === 'count' ? suggestion.definition.target : ''}?
          </Text>
          <Button
            title="Add"
            variant="secondary"
            small
            loading={create.isPending}
            onPress={() => create.mutate(suggestion)}
            style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }}
          />
        </Card>
      ) : null}

      {goals.data && goals.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No goals yet"
            body="Attend more games, visit new stadiums, see your team on the road, or build your own."
            actionTitle="New goal"
            onAction={() => router.push('/passport/new-goal')}
          />
        </Card>
      ) : null}

      {active.length > 0 ? (
        <Card label="In progress">
          {active.map(({ goal, definition, progress }, i) => (
            <GoalRow
              key={goal.id}
              title={goal.title}
              definition={definition}
              progress={progress}
              last={i === active.length - 1}
              onLongPress={() => confirmDelete(goal.id, goal.title)}
            />
          ))}
        </Card>
      ) : null}

      {done.length > 0 ? (
        <Card label="Done">
          {done.map(({ goal, definition, progress }, i) => (
            <GoalRow
              key={goal.id}
              title={goal.title}
              definition={definition}
              progress={progress}
              last={i === done.length - 1}
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
        </Card>
      ) : null}

      {/* Bucket lists had no entry point once the old Passport tab left the bar. */}
      <Card>
        <Row
          title="Bucket lists"
          subtitle="Every ballpark, every stadium, or a list of your own"
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
