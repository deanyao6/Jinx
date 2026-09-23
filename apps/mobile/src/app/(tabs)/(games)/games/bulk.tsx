import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import {
  useBulkLogAttendances,
  useMyAttendances,
  type BulkRow,
} from '@/features/attendances/queries';
import { attendanceStatusFor, resolveRooting } from '@/features/attendances/rooting';
import { useTeamSeasonGames } from '@/features/games/queries';
import { SideTheme } from '@/features/games/ui/SideTheme';
import { useDebounced } from '@/features/games/ui/useDebounced';
import { useFavoriteTeams } from '@/features/profile/queries';
import { useSearchTeams, useTeamsById, type Team } from '@/features/teams/queries';
import {
  currentSeason,
  doubleheaderLabel,
  formatGameDate,
  formatScore,
  gameTypeLabel,
  seasonOptions,
} from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function BulkLogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const favorites = useFavoriteTeams();
  const { byId } = useTeamsById();
  const [team, setTeam] = useState<Team | null>(null);
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState<number>(currentSeason());
  const [homeOnly, setHomeOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<number | null>(null);

  const debounced = useDebounced(query);
  const hits = useSearchTeams(debounced, null);
  const games = useTeamSeasonGames(team?.id ?? null, season, homeOnly);
  const attendances = useMyAttendances();
  const bulk = useBulkLogAttendances();

  const loggedIds = useMemo(
    () => new Set((attendances.data ?? []).map((a) => a.game_id)),
    [attendances.data],
  );
  const list = useMemo(
    () => (games.data ?? []).filter((g) => g.status !== 'cancelled' && g.status !== 'postponed'),
    [games.data],
  );
  const selectable = useMemo(() => list.filter((g) => !loggedIds.has(g.id)), [list, loggedIds]);

  // Reset the selection whenever the list inputs change.
  const listKey = `${team?.id ?? ''}|${season}|${homeOnly}`;
  const [seenKey, setSeenKey] = useState(listKey);
  if (listKey !== seenKey) {
    setSeenKey(listKey);
    setSelected(new Set());
    setDone(null);
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSave = async () => {
    const favs = favorites.data ?? [];
    const rows: BulkRow[] = [];
    for (const g of selectable) {
      if (!selected.has(g.id)) continue;
      const home = byId.get(g.home_team_id);
      const away = byId.get(g.away_team_id);
      const rooting =
        home && away
          ? resolveRooting({ home, away, favorites: favs })
          : { teamId: null, basis: null };
      rows.push({
        gameId: g.id,
        status: attendanceStatusFor(g),
        rootingTeamId: rooting.teamId,
        rootingBasis: rooting.basis,
      });
    }
    try {
      const n = await bulk.mutateAsync(rows);
      setDone(n);
      setSelected(new Set());
    } catch {
      // surfaced below
    }
  };

  const pickTeam = (t: Team) => {
    setTeam(t);
    setQuery('');
  };

  // Once a team is picked the page is about that team, so it takes that team's colours.
  return (
    <SideTheme team={team?.id}>
      <Screen>
        <PageIntro
          kicker={team ? `${team.name} · ${season}` : String(season)}
          title="Log a season"
          body="Pick a team and season, then check every game you went to. Games already on your passport are skipped."
        />

        <Card label="Team">
          {team ? (
            <Chip label={team.name} selected onPress={() => setTeam(null)} />
          ) : (
            <>
              {favorites.data?.length ? (
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.xs }}
                >
                  {favorites.data.map((t) => (
                    <Chip key={t.id} label={t.name} onPress={() => pickTeam(t)} />
                  ))}
                </View>
              ) : null}
              <TextField
                placeholder="Search any team"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={{ marginBottom: 0 }}
                accessibilityLabel="Search teams"
              />
              {hits.data?.length && query.trim().length >= 2 ? (
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.sm }}
                >
                  {hits.data.map((h) => {
                    const full = byId.get(h.id);
                    return full ? (
                      <Chip key={h.id} label={h.name} onPress={() => pickTeam(full)} />
                    ) : null;
                  })}
                </View>
              ) : null}
            </>
          )}
        </Card>

        <Card label="Season">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {seasonOptions().map((y) => (
              <Chip
                key={y}
                label={String(y)}
                selected={season === y}
                onPress={() => setSeason(y)}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', marginTop: theme.spacing.sm }}>
            <Chip
              label="Home games only"
              selected={homeOnly}
              accent="green"
              onPress={() => setHomeOnly((v) => !v)}
            />
          </View>
        </Card>

        {done != null ? (
          <Notice tone="success">
            <Text variant="sub" color="green" style={{ marginBottom: theme.spacing.sm }}>
              Logged {done} game{done === 1 ? '' : 's'}.
            </Text>
            <Button
              title="See your history"
              variant="secondary"
              small
              onPress={() => router.replace('/games?segment=history')}
              style={{ alignSelf: 'flex-start' }}
            />
          </Notice>
        ) : null}
        {bulk.error ? <Notice tone="error">{errorMessage(bulk.error)}</Notice> : null}

        {!team ? (
          <EmptyState icon="i-flag" title="Pick a team to start" />
        ) : games.isPending ? (
          <Loading label={`Loading ${season} games`} />
        ) : list.length === 0 ? (
          <EmptyState
            icon="i-search"
            title="No games"
            body={`No ${season} games for the ${team.name} yet.`}
          />
        ) : (
          <>
            <SectionHeader title={`${season} games`} />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.md }}>
              <StatTile label="Games" value={String(list.length)} />
              <StatTile label="Logged" value={String(list.length - selectable.length)} />
              <StatTile label="Selected" value={String(selected.size)} accent />
            </View>
            <Card style={{ paddingVertical: theme.spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.xs,
                  marginBottom: theme.spacing.xs,
                }}
              >
                <Button
                  title="Select all"
                  variant="secondary"
                  small
                  onPress={() => setSelected(new Set(selectable.map((g) => g.id)))}
                />
                <Button
                  title="Clear"
                  variant="ghost"
                  small
                  onPress={() => setSelected(new Set())}
                />
              </View>
              {list.map((g, i) => {
                const home = byId.get(g.home_team_id);
                const away = byId.get(g.away_team_id);
                const isHome = g.home_team_id === team.id;
                const opp = isHome ? away : home;
                const logged = loggedIds.has(g.id);
                const dh = doubleheaderLabel(g.doubleheader_number);
                return (
                  <CheckRow
                    key={g.id}
                    first={i === 0}
                    title={`${isHome ? 'vs' : 'at'} ${opp?.name ?? 'TBD'}`}
                    subtitle={[
                      formatGameDate(g.scheduled_start, { withYear: false }),
                      gameTypeLabel(g.game_type),
                      dh,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      logged
                        ? 'Logged'
                        : formatScore({
                            homeScore: g.home_score,
                            awayScore: g.away_score,
                            status: g.status,
                          })
                    }
                    checked={logged || selected.has(g.id)}
                    disabled={logged}
                    onToggle={() => toggle(g.id)}
                  />
                );
              })}
            </Card>
          </>
        )}

        {team && selected.size > 0 ? (
          <Button
            title={`Log ${selected.size} game${selected.size === 1 ? '' : 's'}`}
            onPress={onSave}
            loading={bulk.isPending}
          />
        ) : null}
      </Screen>
    </SideTheme>
  );
}
