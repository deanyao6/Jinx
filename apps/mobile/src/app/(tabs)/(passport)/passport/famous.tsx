import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { IconChevR } from '@/components/reference/icons';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import {
  famousCountLabel,
  famousKicker,
  famousTitle,
  groupFamous,
  type FamousListItem,
} from '@/features/famous/format';
import { useMyFamousGames } from '@/features/famous/queries';
import { SideTheme } from '@/features/games/ui/SideTheme';
import { formatGameDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Every famous game you were at, and every personal badge your favourite players gave you,
 * by league and then by team. Each row opens its game. The way in is the "Famous games" row
 * among the Passport's fan superlatives.
 */
export default function FamousGamesScreen() {
  const router = useRouter();
  const famous = useMyFamousGames();
  const items = useMemo(() => famous.data ?? [], [famous.data]);
  const groups = useMemo(() => groupFamous(items), [items]);
  // The same count as the Passport row: games, each once, personal badges included.
  const games = new Set(items.map((i) => i.gameId)).size;
  const personal = items.filter((i) => i.personal).length;

  return (
    <Screen>
      {famous.isPending ? <Loading /> : null}
      {famous.isError ? <ErrorNotice error={famous.error} onRetry={famous.refetch} /> : null}
      {famous.data && items.length === 0 ? (
        <EmptyState
          icon="i-spark"
          title="No famous games yet"
          body="Championships, the games before them, and the great nights in each league count. So does a favourite player's debut, first touchdown or first days with a new team, when you were there."
        />
      ) : null}
      {items.length > 0 ? (
        <PageIntro
          kicker="Famous games"
          title={String(games)}
          body={
            personal > 0
              ? `${famousCountLabel(games)} you were at, with ${personal} personal ${personal === 1 ? 'badge' : 'badges'} from your favourite players.`
              : `${famousCountLabel(games)} you were at.`
          }
        />
      ) : null}
      {groups.map((league) => (
        <View key={league.sportId}>
          <SectionHeader title={league.title} />
          {league.teams.map((team) => (
            <SideTheme key={team.teamId ?? 'league'} team={team.teamId}>
              <Card label={team.title} style={{ paddingVertical: 10 }}>
                {team.items.map((item, i) => (
                  <FamousRow
                    key={`${item.gameId}:${item.kind}:${item.playerName ?? ''}:${i}`}
                    item={item}
                    onPress={() => router.push(`/games/${item.gameId}`)}
                  />
                ))}
              </Card>
            </SideTheme>
          ))}
        </View>
      ))}
    </Screen>
  );
}

function FamousRow({ item, onPress }: { item: FamousListItem; onPress: () => void }) {
  const theme = useTheme();
  const title = famousTitle(item);
  const score =
    item.awayScore != null && item.homeScore != null
      ? `${item.away} ${item.awayScore} at ${item.home} ${item.homeScore}`
      : `${item.away} at ${item.home}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${score}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <IconTile icon="i-spark" gold size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="kicker" color={item.personal ? 'accent' : 'muted'}>
          {famousKicker(item)}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {formatGameDate(item.scheduledStart, { withYear: true })} · {score}
        </Text>
      </View>
      <IconChevR size={16} color={theme.colors.muted} />
    </Pressable>
  );
}
