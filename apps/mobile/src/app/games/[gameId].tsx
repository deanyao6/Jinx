import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { momentDetail, momentLabel } from '@/features/attendances/moments';
import { useDeleteAttendance, useMyAttendanceForGame } from '@/features/attendances/queries';
import { isWithinCheckInWindow, pctLabel } from '@/features/checkin/lock';
import { usePledgeForGame } from '@/features/checkin/queries';
import { notablePlayers, othersLine } from '@/features/games/notable';
import { useGame, useGameAppearances, useGameEvents } from '@/features/games/queries';
import { useGameStorySteps } from '@/features/relive/queries';
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
import { ShareButton } from '@/features/share/ShareButton';
import { AlsoThere } from '@/features/social/ui/AlsoThere';
import { useTheme } from '@/theme/ThemeProvider';

export default function GameDetailScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useGame(gameId);
  const attendance = useMyAttendanceForGame(gameId);
  const events = useGameEvents(gameId);
  const appearances = useGameAppearances(gameId);
  const pledge = usePledgeForGame(gameId);
  // Relive only exists for a game whose play-by-play has been turned into story steps.
  const story = useGameStorySteps(gameId);
  const remove = useDeleteAttendance();
  const [openedAt] = useState(() => Date.now());

  const g = game.data;
  const a = attendance.data;

  const teamName = (teamId: string | null) =>
    teamId === g?.home?.id ? g?.home?.name : teamId === g?.away?.id ? g?.away?.name : null;

  // Who to name and who to count. See features/games/notable.ts for why "star player" is
  // "did something in this game" rather than a reputation the database does not hold.
  const playersByTeam = useMemo(() => {
    const groups = notablePlayers(appearances.data ?? [], events.data ?? [], story.data ?? []);
    return new Map(groups.map((g) => [g.teamId, g]));
  }, [appearances.data, events.data, story.data]);
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
  const winnerHome = final && g.home_score! > g.away_score!;
  const winnerAway = final && g.away_score! > g.home_score!;
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
  // final_at is not on the detail row; when the game is final the window is treated as closed.
  const canCheckIn =
    g.status !== 'final' &&
    g.status !== 'postponed' &&
    g.status !== 'cancelled' &&
    isWithinCheckInWindow(openedAt, g.scheduled_start, null);
  const pl = pledge.data;
  const pledgeTeam = teamName(pl?.team_id ?? null);
  const myResult: 'win' | 'loss' | 'tie' | null =
    !final || !a?.rooting_team_id
      ? null
      : g.is_tie
        ? 'tie'
        : g.winner_team_id === a.rooting_team_id
          ? 'win'
          : 'loss';
  const shareGame = () =>
    openShare(router, {
      kind: 'game',
      sport: g.sport_id,
      away: g.away?.name ?? 'Away',
      home: g.home?.name ?? 'Home',
      awayScore: g.away_score,
      homeScore: g.home_score,
      status: g.status,
      venue: g.venue ? `${g.venue.name}, ${g.venue.city}` : null,
      date: g.scheduled_start,
      side: rootedName ?? null,
      result: myResult,
      verified: !!a?.verified,
    });
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

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `${g.away?.abbreviation ?? ''} at ${g.home?.abbreviation ?? ''}`,
          headerRight: a
            ? () => <ShareButton label="Share this game" onPress={shareGame} />
            : undefined,
        }}
      />
      <Text variant="label" color="muted" style={{ textTransform: 'uppercase' }}>
        {labels}
      </Text>
      <Card style={{ marginTop: theme.spacing.sm }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="h2" color={winnerAway || !final ? 'ink' : 'muted'}>
              {g.away?.name ?? 'Away'}
            </Text>
            <Text variant="caption" color="muted">
              Away
            </Text>
          </View>
          <Text
            variant="display"
            color={winnerAway || !final ? 'ink' : 'muted'}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {final ? g.away_score : '–'}
          </Text>
        </View>
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: theme.spacing.md }} />
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="h2" color={winnerHome || !final ? 'ink' : 'muted'}>
              {g.home?.name ?? 'Home'}
            </Text>
            <Text variant="caption" color="muted">
              Home
            </Text>
          </View>
          <Text
            variant="display"
            color={winnerHome || !final ? 'ink' : 'muted'}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {final ? g.home_score : '–'}
          </Text>
        </View>
        <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.md }}>
          {final ? (g.is_tie ? 'Final, tie' : 'Final') : statusLabel(g.status)} ·{' '}
          {formatGameDateLong(g.scheduled_start)}, {formatGameTime(g.scheduled_start)}
        </Text>
        {g.venue ? (
          <Text variant="sub" color="muted">
            {g.venue.name}, {g.venue.city}
            {g.venue.state ? `, ${g.venue.state}` : ''}
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
      </Card>

      {canCheckIn ? (
        <Card style={{ backgroundColor: c.tint, borderColor: c.tint }}>
          <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
            {a?.verified_via === 'checkin'
              ? 'You are checked in.'
              : 'At the game? Check in to verify it and, if you are neutral, pick a side.'}
          </Text>
          <Button
            title={a?.verified_via === 'checkin' ? 'Open check-in' : 'Check in'}
            onPress={() => router.push(`/games/checkin/${gameId}`)}
          />
        </Card>
      ) : null}

      {pl ? (
        <Card label="Your pledge">
          {pl.status === 'void' ? (
            <>
              <Text variant="bodyStrong">Did not count</Text>
              <Text variant="sub" color="muted">
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
              <Text variant="sub" color="muted">
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
                style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }}
              />
            </>
          ) : (
            <>
              <Text variant="bodyStrong">Pledged to the {pledgeTeam ?? 'team'}</Text>
              <Text variant="sub" color="muted">
                {pctLabel(pl.win_prob_at_pledge)} to win. The result posts once the game is final.
              </Text>
            </>
          )}
        </Card>
      ) : null}

      {attendance.isPending ? (
        <Loading />
      ) : attendance.isError ? (
        <ErrorNotice error={attendance.error} onRetry={attendance.refetch} />
      ) : a ? (
        <Card label={a.status === 'going' ? 'You are going' : 'You were there'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {a.verified ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={c.green} />
                <Text variant="bodyStrong" color="green">
                  Verified{a.verified_via ? ` by ${a.verified_via}` : ''}
                </Text>
              </>
            ) : (
              <Text variant="sub" color="muted">
                Logged manually
              </Text>
            )}
          </View>
          {rootedName ? (
            <Text variant="sub">
              Rooting for the {rootedName}
              {a.rooting_basis === 'chosen' ? ' (your pick)' : ''}
            </Text>
          ) : (
            <Text variant="sub" color="muted">
              Neutral, no side counted
            </Text>
          )}
          {companions.length ? <Text variant="sub">With {companions.join(', ')}</Text> : null}
          {seatParts.length ? <Text variant="sub">{seatParts.join(' · ')}</Text> : null}
          {priceLabel ? <Text variant="sub">Paid {priceLabel}</Text> : null}
          {a.note ? (
            <Text variant="sub" color="muted" style={{ marginTop: 6 }}>
              “{a.note}”
            </Text>
          ) : null}
          {remove.error ? (
            <Notice tone="error" style={{ marginTop: theme.spacing.sm }}>
              {errorMessage(remove.error)}
            </Notice>
          ) : null}
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}
          >
            <Button
              title="Edit"
              variant="secondary"
              small
              onPress={() => router.push(`/games/log/${gameId}`)}
            />
            <Button
              title="Remove"
              variant="danger"
              small
              onPress={onDelete}
              loading={remove.isPending}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            Not on your passport yet.
          </Text>
          <Button
            title={g.status === 'final' ? 'I was there' : 'I’m going'}
            onPress={() => router.push(`/games/log/${gameId}`)}
          />
        </Card>
      )}

      {/*
        Relive and the stadium guide had no entry point anywhere in the app: both routes
        existed and nothing linked to them (docs/interactions.md). This is that link.
        Relive appears only once the game has story steps, so it never opens onto an
        empty screen.
      */}
      {story.data && story.data.length > 0 ? (
        <Card label="Relive">
          <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.sm }}>
            Play the game back moment by moment, with the win probability as it swung.
          </Text>
          <Button
            title="Relive this game"
            onPress={() => router.push(`/relive/${gameId}`)}
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>
      ) : null}

      {g.venue ? (
        <Button
          title={`Guide to ${g.venue.name}`}
          variant="secondary"
          small
          onPress={() => router.push(`/guide/${g.venue!.id}`)}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}

      {/* Friends (M7): mutuals at this game and remove-my-tag. Owned by features/social. */}
      <AlsoThere gameId={gameId} />

      <Card label="Moments">
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
          <Row
            key={e.id}
            first={i === 0}
            title={momentLabel(e.type)}
            subtitle={[
              e.player?.full_name,
              teamName(e.team_id),
              momentDetail(e.type, e.detail ?? {}),
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </Card>

      <Card label="Players seen">
        {appearances.isPending ? <Loading /> : null}
        {appearances.isError ? (
          <ErrorNotice error={appearances.error} onRetry={appearances.refetch} />
        ) : null}
        {appearances.data && appearances.data.length === 0 ? (
          <Text variant="sub" color="muted">
            {g.status === 'final'
              ? 'Lineups are not loaded for this game yet.'
              : 'Lineups arrive after the game.'}
          </Text>
        ) : null}
        {[g.away, g.home].map((t) => {
          const group = t ? playersByTeam.get(t.id) : undefined;
          if (!t || !group) return null;
          const rest = othersLine(group.others.length);
          return (
            <View key={t.id} style={{ marginBottom: theme.spacing.sm }}>
              <Text variant="bodyStrong" style={{ marginBottom: 2 }}>
                {t.name}
              </Text>
              {group.notable.map((p) => (
                <Text key={p.playerId} variant="sub">
                  {p.name} · <Text color="muted">{p.did}</Text>
                </Text>
              ))}
              {group.notable.length === 0 ? (
                <Text variant="sub" color="muted">
                  Nothing notable recorded for this side.
                </Text>
              ) : null}
              {/* The roster is still here, just folded away: a count by default, the full
                  list on request. Printing 25 names nobody reads was the old behaviour. */}
              {showAllPlayers ? (
                <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                  {group.others.join(', ')}
                </Text>
              ) : rest ? (
                <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
                  {rest}
                </Text>
              ) : null}
            </View>
          );
        })}
        {(appearances.data ?? []).length > 0 ? (
          <Button
            title={showAllPlayers ? 'Show only notable players' : 'Show everyone who played'}
            variant="secondary"
            small
            onPress={() => setShowAllPlayers((v) => !v)}
            style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }}
          />
        ) : null}
      </Card>
    </Screen>
  );
}
