import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSeasonGameCounts, useStreak } from '@/features/communities/queries';
import { streakFloorLabel } from '@jinx/core';
import { TeamTheme } from '@/theme/reference/TeamTheme';
import { useTheme } from '@/theme/ThemeProvider';

/** The detail behind a Passport streak patch (docs/prompts/social/04, section 3): every season
 * in the run and its game count, computed, not set by the user. */
export default function StreakDetailRoute() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  return (
    <TeamTheme team={teamId as string}>
      <StreakDetailBody teamId={teamId as string} />
    </TeamTheme>
  );
}

function StreakDetailBody({ teamId }: { teamId: string }) {
  const theme = useTheme();
  const streak = useStreak(teamId);
  const counts = useSeasonGameCounts(teamId);

  if (streak.isPending || counts.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (streak.isError) {
    return (
      <Screen>
        <ErrorNotice error={streak.error} onRetry={streak.refetch} />
      </Screen>
    );
  }
  if (!streak.data) {
    return (
      <Screen>
        <Notice>No streak here yet.</Notice>
      </Screen>
    );
  }

  const s = streak.data;
  const seasons = (counts.data ?? []).filter((c) => c.season >= s.start_season && c.season <= s.end_season);

  return (
    <Screen>
      <Card tone="solid" style={{ marginBottom: theme.spacing.md }}>
        <Text variant="kicker" style={{ color: theme.accent.onFill }}>
          {s.team_name.toUpperCase()}
        </Text>
        <Text variant="h1" style={{ color: theme.accent.onFill, marginTop: 4 }}>
          {s.seasons} season{s.seasons === 1 ? '' : 's'}
        </Text>
        <Text variant="sub" style={{ color: theme.accent.onFill, opacity: 0.72, marginTop: 4 }}>
          {streakFloorLabel({
            startSeason: s.start_season,
            endSeason: s.end_season,
            seasons: s.seasons,
            minGames: s.min_games,
            isActive: s.is_active,
          })}
        </Text>
      </Card>

      <Notice>
        {`Computed, not set by you: consecutive seasons with at least one ${s.team_name} game. The floor is your worst season inside the run, so it rises on its own.`}
      </Notice>

      {seasons.map((row) => (
        <View
          key={row.season}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.accent.wash,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" color="accent" weight={750}>
              {String(row.season).slice(2)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{row.season}</Text>
            <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
              {row.games} game{row.games === 1 ? '' : 's'}
              {row.season === s.end_season && s.is_active && !seasons.some((c) => c.season > s.end_season)
                ? ', in progress'
                : ''}
            </Text>
          </View>
        </View>
      ))}

      {!s.is_active ? (
        <Notice tone="error" style={{ marginTop: theme.spacing.md }}>
          {`Broken: the season after this run ended with no ${s.team_name} games.`}
        </Notice>
      ) : null}
    </Screen>
  );
}
