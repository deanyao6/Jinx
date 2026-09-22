import { honorCaption } from '@jinx/core';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import type { IconName } from '@/components/reference/icons';
import { momentDetail, momentLabel } from '@/features/attendances/moments';
import { useDeleteAttendance, useMyAttendanceForGame } from '@/features/attendances/queries';
import { isWithinCheckInWindow, pctLabel } from '@/features/checkin/lock';
import { usePledgeForGame } from '@/features/checkin/queries';
import { shortTeamName } from '@/features/data/names';
import { RallyCapWorked } from '@/features/eggs/RallyCapWorked';
import { notablePlayers, othersLine, type TeamPlayers } from '@/features/games/notable';
import {
  useGame,
  useGameAppearances,
  useGameEvents,
  useGameScoring,
  type GameTeam,
} from '@/features/games/queries';
import {
  Fact,
  QuietDangerButton,
  ResultPill,
  type ResultTone,
} from '@/features/games/ui/detailParts';
import { Scoreboard } from '@/features/games/ui/Scoreboard';
import { ScoringSection } from '@/features/games/ui/ScoringSection';
import { SideTheme } from '@/features/games/ui/SideTheme';
import { useGameStorySteps } from '@/features/relive/queries';
import { storylineCards, useStorylines } from '@/features/storylines/queries';
import {
  doubleheaderLabel,
  formatGameDateLong,
  formatGameTime,
  formatPriceCents,
  gameTypeLabel,
  sportLabel,
  statusLabel,
} from '@/lib/format';
import { openShare } from '@/features/share/navigate';
import { shareGameFor } from '@/features/share/fromGame';
import { ShareButton } from '@/features/share/ShareButton';
import { AlsoThere } from '@/features/social/ui/AlsoThere';
import { FamousCard } from '@/features/famous/ui/FamousCard';
import { useGameFamous, useGameStars } from '@/features/famous/queries';
import { useTheme } from '@/theme/ThemeProvider';

/** The icon a moment leads with. Anything not named here is a bolt. */
const MOMENT_ICONS: Record<string, IconName> = {
  no_hitter: 'i-spark',
  perfect_game: 'i-spark',
  cycle: 'i-spark',
  immaculate_inning: 'i-spark',
  extra_innings: 'i-clock',
  overtime: 'i-clock',
  late_go_ahead_score: 'i-trend',
  comeback_14: 'i-trend',
  long_field_goal: 'i-target',
  shutout: 'i-lock',
};

/** 187 minutes reads as "3:07". */
function durationLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export default function GameDetailScreen() {
  // Only spacing is read from here. The team in scope is set further down, inside the tree, so
  // anything that needs the accent is a component of its own and asks for the theme there.
  const theme = useTheme();
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useGame(gameId);
  const attendance = useMyAttendanceForGame(gameId);
  const events = useGameEvents(gameId);
  const appearances = useGameAppearances(gameId);
  // Who scored, play by play. Empty until the detail worker has been (SPEC.md 4.7).
  const scoring = useGameScoring(gameId);
  const pledge = usePledgeForGame(gameId);
  // Relive only exists for a game whose play-by-play has been turned into story steps.
  const story = useGameStorySteps(gameId);
  // Pregame only: once a game is final, Relive tells its story instead.
  const storylines = useStorylines(gameId);
  // Famous rows for this game, and my personal badges for it.
  const famous = useGameFamous(gameId);
  // Superstars who appeared, for Players seen.
  const stars = useGameStars(gameId);
  const remove = useDeleteAttendance();
  const [openedAt] = useState(() => Date.now());

  const g = game.data;
  const a = attendance.data;

  const teamName = (teamId: string | null) =>
    teamId === g?.home?.id ? g?.home?.name : teamId === g?.away?.id ? g?.away?.name : null;

  // Who to name and who to count. See features/games/notable.ts for why "star player" is
  // "did something in this game" rather than a reputation the database does not hold.
  const playersByTeam = useMemo(() => {
    const starCaptions = new Map(
      (stars.data ?? []).map((st) => [
        st.playerId,
        honorCaption({ label: st.label, season: st.season, seasonFirst: st.seasonFirst }),
      ]),
    );
    const groups = notablePlayers(
      appearances.data ?? [],
      events.data ?? [],
      story.data ?? [],
      starCaptions,
    );
    return new Map(groups.map((g) => [g.teamId, g]));
  }, [appearances.data, events.data, story.data, stars.data]);
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const onDelete = () => {
    if (!a) return;
    Alert.alert('Remove this game?', 'It comes off your passport. You can log it again later.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          remove.mutate({ attendanceId: a.id, gameId }, { onSuccess: () => router.back() });
        },
      },
    ]);
  };

  if (game.isPending) return <Loading label="Loading game" />;
  if (game.isError || !g) {
    return (
      <Screen>
        <ErrorNotice
          error={game.error}
          message="Could not load this game."
          onRetry={game.refetch}
        />
      </Screen>
    );
  }

  const final = g.status === 'final' && g.home_score != null && g.away_score != null;
  const winnerHome =
    final &&
    (g.winner_team_id ? g.winner_team_id === g.home_team_id : g.home_score! > g.away_score!);
  const winnerAway =
    final &&
    (g.winner_team_id ? g.winner_team_id === g.away_team_id : g.away_score! > g.home_score!);
  const dh = doubleheaderLabel(g.doubleheader_number);
  const labels = [sportLabel(g.sport_id), gameTypeLabel(g.game_type), dh]
    .filter(Boolean)
    .join(' · ');
  const rootedName = teamName(a?.rooting_team_id ?? null);
  const companions = (a?.companions ?? [])
    .map((x) => x.person?.display_name)
    .filter(Boolean) as string[];
  const seatParts = a?.seat
    ? [
        a.seat.section ? `Section ${a.seat.section}` : null,
        a.seat.row ? `Row ${a.seat.row}` : null,
        a.seat.seat ? `Seat ${a.seat.seat}` : null,
      ].filter(Boolean)
    : [];
  const priceLabel = formatPriceCents(a?.seat?.price_cents);
  // The window runs to an hour after the game ended (games.final_at, filled since 2026-09-22).
  // A final whose end is not known yet is treated as closed rather than left open for the
  // six-hour fallback.
  const canCheckIn =
    g.status !== 'postponed' &&
    g.status !== 'cancelled' &&
    (g.status !== 'final' || g.final_at != null) &&
    isWithinCheckInWindow(openedAt, g.scheduled_start, g.final_at ?? null);
  const pl = pledge.data;
  const pledgeTeam = teamName(pl?.team_id ?? null);
  const shareGame = () => openShare(router, shareGameFor(g, a));
  const sharePledge = () => {
    if (!pl) return;
    openShare(router, {
      kind: 'pledge',
      team: pledgeTeam ?? 'team',
      away: g.away?.name ?? 'Away',
      home: g.home?.name ?? 'Home',
      date: g.scheduled_start,
      result:
        pl.status === 'void'
          ? 'void'
          : pl.result === 'win' || pl.result === 'loss' || pl.result === 'tie'
            ? pl.result
            : 'pending',
      winProb: pl.win_prob_at_pledge,
    });
  };

  // The page takes the colour of the side this person was on, and the home team's otherwise.
  const pageTeam = a?.rooting_team_id ?? g.home?.id ?? g.home_team_id;
  const short = (t: GameTeam | null, fallback: string) =>
    t ? shortTeamName(t.name, { nickname: t.nickname }) : fallback;
  const hasStory = !!story.data && story.data.length > 0;

  // How the game came out for the side they were on. Nothing to say before the final.
  const rootedHome = !!a?.rooting_team_id && a.rooting_team_id === g.home?.id;
  const myResult: { label: string; tone: ResultTone } | null = !a
    ? null
    : !a.rooting_team_id
      ? { label: 'Neutral', tone: 'neutral' }
      : !final
        ? null
        : g.is_tie || (!winnerHome && !winnerAway)
          ? { label: 'Tie', tone: 'neutral' }
          : (rootedHome ? winnerHome : winnerAway)
            ? { label: 'Win', tone: 'win' }
            : { label: 'Loss', tone: 'loss' };
  const pledgeResult: { label: string; tone: ResultTone } | null = !pl
    ? null
    : pl.status === 'void'
      ? { label: 'Void', tone: 'neutral' }
      : pl.status === 'valid' && pl.result
        ? pl.result === 'win'
          ? { label: 'Won', tone: 'win' }
          : pl.result === 'loss'
            ? { label: 'Lost', tone: 'loss' }
            : { label: 'Tied', tone: 'neutral' }
        : { label: 'Pending', tone: 'neutral' };

  const context = [
    g.temperature_f != null ? { label: 'Temp', value: `${Math.round(g.temperature_f)}°F` } : null,
    g.duration_minutes != null
      ? { label: 'Duration', value: durationLabel(g.duration_minutes) }
      : null,
    g.attendance != null ? { label: 'Crowd', value: g.attendance.toLocaleString('en-US') } : null,
  ].filter((x): x is { label: string; value: string } => x !== null);

  const cards =
    g.status !== 'final' && storylines.data && storylines.data.length > 0
      ? storylineCards(storylines.data, { home: g.home?.id ?? null, away: g.away?.id ?? null })
      : [];

  return (
    <SideTheme team={pageTeam}>
      <Screen>
        <Stack.Screen
          options={{
            title: `${g.away?.abbreviation ?? ''} at ${g.home?.abbreviation ?? ''}`,
            headerRight: a
              ? () => <ShareButton label="Share this game" onPress={shareGame} />
              : undefined,
          }}
        />
        <Scoreboard
          away={{
            teamId: g.away?.id ?? g.away_team_id,
            abbreviation: g.away?.abbreviation ?? '',
            name: short(g.away, 'Away'),
            score: final ? String(g.away_score) : '–',
          }}
          home={{
            teamId: g.home?.id ?? g.home_team_id,
            abbreviation: g.home?.abbreviation ?? '',
            name: short(g.home, 'Home'),
            score: final ? String(g.home_score) : '–',
          }}
          winner={winnerHome ? 'home' : winnerAway ? 'away' : null}
          kicker={labels}
          status={`${final ? (g.is_tie ? 'Final, tie' : 'Final') : statusLabel(g.status)} · ${formatGameDateLong(g.scheduled_start)}, ${formatGameTime(g.scheduled_start)}`}
          venue={
            g.venue
              ? `${g.venue.name}, ${g.venue.city}${g.venue.state ? `, ${g.venue.state}` : ''}`
              : null
          }
        >
          {g.decision_method === 'aggregate_shootout' ? (
            <Text variant="bodyStrong" style={{ marginTop: theme.spacing.sm }}>
              {short(
                (g.home_shootout_score ?? 0) > (g.away_shootout_score ?? 0) ? g.home : g.away,
                'Winner',
              )}{' '}
              advanced on aggregate penalties ({g.away_shootout_score}–{g.home_shootout_score},
              away–home)
            </Text>
          ) : null}
          {g.decision_method === 'shootout' ? (
            <Text variant="bodyStrong" style={{ marginTop: theme.spacing.sm }}>
              {short(winnerHome ? g.home : g.away, 'Winner')} won on penalties (
              {g.away_shootout_score}–{g.home_shootout_score}, away–home)
            </Text>
          ) : null}
          {g.status === 'postponed' && g.rescheduled_to_game_id ? (
            <Button
              title="See the makeup game"
              variant="secondary"
              small
              onPress={() => router.push(`/games/${g.rescheduled_to_game_id}`)}
              style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md }}
            />
          ) : null}
        </Scoreboard>
        {g.sport_id === 'mls' ? (
          <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
            MLS schedules and results are available. Player stats, live updates and Relive are not
            available yet.
          </Text>
        ) : null}

        {/* A famous game, or a personal badge from a favourite player: right under the score. */}
        <FamousCard
          items={famous.data ?? []}
          sportId={g.sport_id}
          homeTeamId={g.home?.id ?? g.home_team_id}
        />

        {context.length ? (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.md }}>
            {context.map((x) => (
              <StatTile key={x.label} label={x.label} value={x.value} />
            ))}
          </View>
        ) : null}

        {/* The note on who scored, in the colour of the side that did. Nothing until the
            timeline exists, so a game without detail shows no empty section. */}
        <ScoringSection
          sport={g.sport_id}
          rows={scoring.data ?? []}
          homeTeamId={g.home?.id ?? g.home_team_id}
          awayTeamId={g.away?.id ?? g.away_team_id}
        />

        {canCheckIn ? (
          <Card tone="accent">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon="i-gate" solid />
              <Text variant="sub" style={{ flex: 1 }}>
                {a?.verified_via === 'checkin'
                  ? 'You are checked in.'
                  : g.sport_id === 'mls'
                    ? 'At the match? Check in to verify your attendance.'
                    : 'At the game? Check in to verify it and, if you are neutral, pick a side.'}
              </Text>
            </View>
            <Button
              title={a?.verified_via === 'checkin' ? 'Open check-in' : 'Check in'}
              variant={hasStory ? 'secondary' : 'primary'}
              onPress={() => router.push(`/games/checkin/${gameId}`)}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        ) : null}

        {pl ? (
          <SideTheme team={pl.team_id}>
            <Card>
              <CardHead label="Your pledge" pill={pledgeResult} />
              {pl.status === 'void' ? (
                <>
                  <Text variant="bodyStrong">Did not count</Text>
                  <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                    Your pledge to the {pledgeTeam ?? 'team'} was made after the first score, so it
                    doesn&apos;t count.
                  </Text>
                </>
              ) : pl.status === 'valid' && pl.result ? (
                <>
                  <Text variant="bodyStrong">
                    Pledged to the {pledgeTeam ?? 'team'}:{' '}
                    {pl.result === 'win' ? 'won' : pl.result === 'loss' ? 'lost' : 'tied'}
                  </Text>
                  <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                    {pctLabel(pl.win_prob_at_pledge)} to win when you picked
                    {pl.result === 'win'
                      ? `, +${(1 - pl.win_prob_at_pledge).toFixed(2)} vs expected`
                      : ''}
                    .
                  </Text>
                  <Button
                    title="Share result"
                    variant="secondary"
                    small
                    onPress={sharePledge}
                    style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md }}
                  />
                </>
              ) : (
                <>
                  <Text variant="bodyStrong">Pledged to the {pledgeTeam ?? 'team'}</Text>
                  <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                    {pctLabel(pl.win_prob_at_pledge)} to win. The result posts once the game is
                    final.
                  </Text>
                </>
              )}
            </Card>
          </SideTheme>
        ) : null}

        {attendance.isPending ? (
          <Loading />
        ) : attendance.isError ? (
          <ErrorNotice error={attendance.error} onRetry={attendance.refetch} />
        ) : a ? (
          <Card>
            <CardHead
              label={a.status === 'going' ? 'You are going' : 'You were there'}
              pill={myResult}
            />
            <View style={{ gap: 6 }}>
              {a.verified ? (
                <Fact icon="i-verified" tone="good">
                  Verified{a.verified_via ? ` by ${a.verified_via}` : ''}
                </Fact>
              ) : (
                <Fact icon="i-ticket" tone="muted">
                  Logged manually
                </Fact>
              )}
              {rootedName ? (
                <Fact icon="i-flag">
                  Rooting for the {rootedName}
                  {a.rooting_basis === 'chosen' ? ' (your pick)' : ''}
                </Fact>
              ) : (
                <Fact icon="i-flag" tone="muted">
                  Neutral, no side counted
                </Fact>
              )}
              {/* An easter egg: nothing unless a rally cap was flipped here and it worked. */}
              <RallyCapWorked
                gameId={g.id}
                winnerTeamId={
                  winnerHome
                    ? (g.home?.id ?? g.home_team_id)
                    : winnerAway
                      ? (g.away?.id ?? g.away_team_id)
                      : null
                }
              />
              {companions.length ? <Fact icon="i-users">With {companions.join(', ')}</Fact> : null}
              {seatParts.length || priceLabel ? (
                <Fact icon="i-seat">
                  {[seatParts.join(' · '), priceLabel ? `Paid ${priceLabel}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Fact>
              ) : null}
            </View>
            {a.note ? (
              <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
                “{a.note}”
              </Text>
            ) : null}
            {remove.error ? (
              <Notice tone="error" style={{ marginTop: theme.spacing.sm, marginBottom: 0 }}>
                {errorMessage(remove.error)}
              </Notice>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: theme.spacing.md,
              }}
            >
              <Button
                title="Edit"
                variant="secondary"
                small
                onPress={() => router.push(`/games/log/${gameId}`)}
              />
              <QuietDangerButton title="Remove" onPress={onDelete} loading={remove.isPending} />
            </View>
          </Card>
        ) : (
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: theme.spacing.md,
              }}
            >
              <IconTile icon="i-passport" />
              <Text variant="sub" color="muted" style={{ flex: 1 }}>
                Not on your passport yet.
              </Text>
            </View>
            <Button
              title={g.status === 'final' ? 'I was there' : 'I’m going'}
              // Until the game is on the passport, putting it there is the point of the page, so
              // this is the solid button and Relive waits. Checking in is the one thing that
              // outranks it, because at the stadium that is how the game gets logged.
              variant={canCheckIn ? 'secondary' : 'primary'}
              onPress={() => router.push(`/games/log/${gameId}`)}
            />
          </Card>
        )}

        {cards.length ? (
          <>
            <SectionHeader title="Storylines" />
            <Card>
              <View style={{ gap: 14 }}>
                {cards.map((card) => (
                  <View key={card.key} style={{ flexDirection: 'row', gap: 12 }}>
                    <IconTile icon="i-news" size={32} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{card.text}</Text>
                      <Text variant="label" color="muted" style={{ marginTop: 4 }}>
                        {card.source}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {/*
          Relive and the stadium guide had no entry point anywhere in the app: both routes
          existed and nothing linked to them (docs/interactions.md). This is that link.
          Relive appears only once the game has story steps, so it never opens onto an
          empty screen. It is the one solid button on the page.
        */}
        {hasStory ? (
          <Card tone="accent">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: theme.spacing.md,
              }}
            >
              <IconTile icon="i-trend" solid />
              <View style={{ flex: 1 }}>
                <Text variant="h2">Relive</Text>
                <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                  Play the game back moment by moment, with the win probability as it swung.
                </Text>
              </View>
            </View>
            <Button
              title="Relive this game"
              variant={a ? 'primary' : 'secondary'}
              onPress={() => router.push(`/relive/${gameId}`)}
            />
          </Card>
        ) : null}

        {g.venue ? (
          <Card style={{ paddingVertical: theme.spacing.xs + 1 }}>
            <Row
              icon="i-map"
              title={`Guide to ${g.venue.name}`}
              subtitle={`${g.venue.city}${g.venue.state ? `, ${g.venue.state}` : ''}`}
              chevron
              onPress={() => router.push(`/guide/${g.venue!.id}`)}
            />
          </Card>
        ) : null}

        {/* Friends (M7): mutuals at this game and remove-my-tag. Owned by features/social. */}
        <AlsoThere gameId={gameId} />

        <SectionHeader title="Moments" />
        <Card style={(events.data ?? []).length ? { paddingVertical: theme.spacing.xs + 1 } : null}>
          {events.isPending ? <Loading /> : null}
          {events.isError ? <ErrorNotice error={events.error} onRetry={events.refetch} /> : null}
          {events.data && events.data.length === 0 ? (
            <Text variant="sub" color="muted">
              {g.status === 'final'
                ? 'No notable moments detected for this game.'
                : 'Moments show up once the game is final.'}
            </Text>
          ) : null}
          {(events.data ?? []).map((e, i) => (
            // Each moment is in the colour of the side that made it.
            <SideTheme key={e.id} team={e.team_id}>
              <Row
                first={i === 0}
                icon={MOMENT_ICONS[e.type] ?? 'i-bolt'}
                title={momentLabel(e.type)}
                subtitle={[
                  e.player?.full_name,
                  teamName(e.team_id),
                  momentDetail(e.type, e.detail ?? {}),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </SideTheme>
          ))}
        </Card>

        <SectionHeader title="Players seen" />
        {appearances.isPending ? <Loading /> : null}
        {appearances.isError ? (
          <ErrorNotice error={appearances.error} onRetry={appearances.refetch} />
        ) : null}
        {appearances.data && appearances.data.length === 0 ? (
          <Card>
            <Text variant="sub" color="muted">
              {g.status === 'final'
                ? 'Players are not loaded for this game yet.'
                : 'Players show up after the game.'}
            </Text>
          </Card>
        ) : null}
        {[g.away, g.home].map((t) => {
          const group = t ? playersByTeam.get(t.id) : undefined;
          if (!t || !group) return null;
          return (
            <SideTheme key={t.id} team={t.id}>
              <PlayersCard teamName={t.name} group={group} showAll={showAllPlayers} />
            </SideTheme>
          );
        })}
        {(appearances.data ?? []).length > 0 ? (
          <Button
            title={showAllPlayers ? 'Show only notable players' : 'Show everyone who played'}
            variant="ghost"
            small
            onPress={() => setShowAllPlayers((v) => !v)}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}
      </Screen>
    </SideTheme>
  );
}

/** The top line of a compact card: its name in small capitals, and how it came out on the right. */
function CardHead({
  label,
  pill,
}: {
  label: string;
  pill: { label: string; tone: ResultTone } | null;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 24,
        marginBottom: 10,
      }}
    >
      <Text variant="kicker" color="accent">
        {label}
      </Text>
      {pill ? <ResultPill label={pill.label} tone={pill.tone} /> : null}
    </View>
  );
}

/** One side's players, in that side's colour: who did something, then everyone else folded away. */
function PlayersCard({
  teamName,
  group,
  showAll,
}: {
  teamName: string;
  group: TeamPlayers;
  showAll: boolean;
}) {
  const theme = useTheme();
  const rest = othersLine(group.others.length);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.fill }}
        />
        <Text variant="kicker" color="accent">
          {teamName}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {group.notable.map((p) => (
          <View key={p.playerId}>
            <Text variant="bodyStrong">{p.name}</Text>
            {p.honor ? (
              <Text variant="label" color="accent">
                {p.honor}
              </Text>
            ) : null}
            {p.did ? (
              <Text variant="caption" color="muted">
                {p.did}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {group.notable.length === 0 ? (
        <Text variant="sub" color="muted">
          Nothing notable recorded for this side.
        </Text>
      ) : null}
      {/* The roster is still here, just folded away: a count by default, the full
          list on request. Printing 25 names nobody reads was the old behaviour. */}
      {showAll && group.others.length ? (
        <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {group.others.join(', ')}
        </Text>
      ) : rest ? (
        <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {rest}
        </Text>
      ) : null}
    </Card>
  );
}
