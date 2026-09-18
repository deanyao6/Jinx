import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ErrorNotice, StaleNotice } from '@/components/ErrorNotice';
import { GameRow } from '@/components/GameRow';
import { Loading } from '@/components/Loading';
import { Text } from '@/components/Text';
import { useMyAttendances, type Attendance } from '@/features/attendances/queries';
import { formatScore, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { useMyFamousGameIds } from '@/features/famous/queries';

function attendanceTeams(a: Attendance): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  if (a.game.home) out.push({ id: a.game.home.id, name: a.game.home.name });
  if (a.game.away) out.push({ id: a.game.away.id, name: a.game.away.name });
  return out;
}

export function HistorySegment({ onLog }: { onLog: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const attendances = useMyAttendances();
  const famousIds = useMyFamousGameIds();
  const [sport, setSport] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const all = useMemo(
    () => (attendances.data ?? []).filter((a) => a.status === 'attended'),
    [attendances.data],
  );

  const sports = useMemo(() => [...new Set(all.map((a) => a.game.sport_id))].sort(), [all]);
  const teams = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; n: number }>();
    for (const a of all) {
      if (sport && a.game.sport_id !== sport) continue;
      for (const t of attendanceTeams(a)) {
        const cur = counts.get(t.id) ?? { ...t, n: 0 };
        cur.n += 1;
        counts.set(t.id, cur);
      }
    }
    return [...counts.values()]
      .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name))
      .slice(0, 12);
  }, [all, sport]);
  const seasons = useMemo(
    () => [...new Set(all.map((a) => a.game.season))].sort((x, y) => y - x),
    [all],
  );

  const filtered = useMemo(
    () =>
      all.filter(
        (a) =>
          (!sport || a.game.sport_id === sport) &&
          (!teamId || a.game.home_team_id === teamId || a.game.away_team_id === teamId) &&
          (!season || a.game.season === season) &&
          (!verifiedOnly || a.verified),
      ),
    [all, sport, teamId, season, verifiedOnly],
  );

  if (attendances.isPending) return <Loading label="Loading your games" />;
  if (attendances.isError && !attendances.data) {
    return (
      <ErrorNotice
        error={attendances.error}
        message="Could not load your games."
        onRetry={attendances.refetch}
      />
    );
  }

  if (all.length === 0) {
    return (
      <EmptyState
        title="No games yet"
        body="Every game you log lands here, newest first. Start with the one you remember best."
        actionTitle="Log a game"
        onAction={onLog}
      />
    );
  }

  const anyFilter = sport || teamId || season || verifiedOnly;

  return (
    <>
      {attendances.isError ? <StaleNotice onRetry={attendances.refetch} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {sports.length > 1
          ? sports.map((s) => (
              <Chip
                key={s}
                label={sportLabel(s)}
                selected={sport === s}
                onPress={() => {
                  setSport(sport === s ? null : s);
                  setTeamId(null);
                }}
              />
            ))
          : null}
        <Chip
          label="Verified"
          selected={verifiedOnly}
          accent="green"
          onPress={() => setVerifiedOnly((v) => !v)}
        />
      </View>
      {teams.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {teams.map((t) => (
            <Chip
              key={t.id}
              label={`${t.name} (${t.n})`}
              selected={teamId === t.id}
              onPress={() => setTeamId(teamId === t.id ? null : t.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      {seasons.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: theme.spacing.sm }}
        >
          {seasons.map((y) => (
            <Chip
              key={y}
              label={String(y)}
              selected={season === y}
              onPress={() => setSeason(season === y ? null : y)}
            />
          ))}
        </ScrollView>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title="Nothing matches" body="Clear a filter to see more." />
      ) : (
        <Card
          label={`${filtered.length} game${filtered.length === 1 ? '' : 's'}${anyFilter ? ` of ${all.length}` : ''}`}
        >
          {filtered.map((a, i) => (
            <GameRow
              key={a.id}
              first={i === 0}
              famous={famousIds.has(a.game.id)}
              game={{
                id: a.game.id,
                scheduled_start: a.game.scheduled_start,
                status: a.game.status,
                awayName: a.game.away?.name ?? 'Away',
                homeName: a.game.home?.name ?? 'Home',
                venueName: a.game.venue?.name,
                home_score: a.game.home_score,
                away_score: a.game.away_score,
                is_tie: a.game.is_tie,
                doubleheader_number: a.game.doubleheader_number,
              }}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {a.verified ? (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.green} />
                  ) : null}
                  <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatScore({
                      homeScore: a.game.home_score,
                      awayScore: a.game.away_score,
                      status: a.game.status,
                      isTie: a.game.is_tie,
                    })}
                  </Text>
                </View>
              }
              onPress={() => router.push(`/games/${a.game.id}`)}
            />
          ))}
        </Card>
      )}
    </>
  );
}
