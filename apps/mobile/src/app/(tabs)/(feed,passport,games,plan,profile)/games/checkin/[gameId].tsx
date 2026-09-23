import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useMyAttendanceForGame } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { checkInFailureCopy, isWithinCheckInWindow, pctLabel } from '@/features/checkin/lock';
import { measureDistanceToVenue } from '@/features/checkin/location';
import { PickASideLive } from '@/features/checkin/reference/PickASideLive';
import { ResultPill, type ResultTone } from '@/features/games/ui/detailParts';
import { Scoreboard } from '@/features/games/ui/Scoreboard';
import { SideTheme } from '@/features/games/ui/SideTheme';
import {
  useCheckIn,
  useChooseSide,
  useGameContext,
  useSetCompanions,
  type GameContext,
  useLiveState,
} from '@/features/checkin/queries';
import { inOpenSession } from '@/features/checkin/session';
import { hasLiveFeed } from '@/features/eggs/live';
import { isUnderWay } from '@/features/live/format';
import { getPushStatus, registerPush, type PushStatus } from '@/features/notifications/push';
import { useAddPerson, usePeople } from '@/features/people/queries';
import { openShare } from '@/features/share/navigate';
import { formatGameDateLong, formatGameTime, sportLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function CheckInScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const ctx = useGameContext(gameId);

  if (ctx.isPending) return <Loading label="Loading game" />;
  if (ctx.isError || !ctx.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Check in' }} />
        <ErrorNotice error={ctx.error} message="Could not load this game." onRetry={ctx.refetch} />
      </Screen>
    );
  }
  // A neutral fan who has checked in goes straight to the reference Pick a side (SPEC 6.4.1),
  // until the pick is settled; after that this route shows the result card below.
  const c = ctx.data;
  const settled = !!c.pledge && c.pledge.status !== 'provisional';
  if (inOpenSession(c) && c.neutral_for_user && !c.both_favorites && !settled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PickASideLive gameId={gameId} ctx={c} />
      </>
    );
  }
  return <CheckInBody gameId={gameId} ctx={c} />;
}

function CheckInBody({ gameId, ctx }: { gameId: string; ctx: GameContext }) {
  const theme = useTheme();
  const router = useRouter();
  const checkIn = useCheckIn();
  const [failure, setFailure] = useState<{ reason: string; distance_m?: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const checkedIn = !!ctx.checked_in_at;
  // The feed hears the final before the table does: the window then closes an hour after it.
  const live = useLiveState(
    gameId,
    ctx.sport_id,
    !checkedIn && hasLiveFeed(ctx.sport_id) && isUnderWay(ctx.status, ctx.scheduled_start, now),
  );
  const finalAt =
    ctx.final_at ?? (live.data?.status === 'final' ? live.data.fetched_at : null);
  const inWindow = isWithinCheckInWindow(now, ctx.scheduled_start, finalAt);
  const venueKnown = ctx.venue.lat != null && ctx.venue.lng != null && ctx.venue.geofence_m != null;

  useEffect(() => {
    if (checkedIn) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [checkedIn]);

  const onCheckIn = async () => {
    setFailure(null);
    if (ctx.venue.lat == null || ctx.venue.lng == null) {
      setFailure({ reason: 'venue_unknown' });
      return;
    }
    const loc = await measureDistanceToVenue({ lat: ctx.venue.lat, lng: ctx.venue.lng });
    if (!loc.ok) {
      setFailure({ reason: loc.reason });
      return;
    }
    try {
      const res = await checkIn.mutateAsync({
        gameId,
        distanceM: loc.distanceM,
        accuracyM: loc.accuracyM,
      });
      if (!res.ok) setFailure({ reason: res.reason, distance_m: res.distance_m });
    } catch {
      // surfaced through checkIn.error
    }
  };

  // The page is in the colours of the side this person is on, and the home team's until there is one.
  const pageTeam = ctx.attendance?.rooting_team_id ?? ctx.pledge?.team_id ?? ctx.home.team_id;

  return (
    <SideTheme team={pageTeam}>
      <Screen>
        <Stack.Screen options={{ title: 'Check in' }} />
        {checkedIn ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: theme.spacing.sm,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.red,
              }}
            />
            <Text variant="caption" color="red" style={{ fontWeight: '700' }}>
              You&apos;re at {ctx.venue.name ?? 'the game'}
            </Text>
          </View>
        ) : null}
        <Scoreboard
          away={{ teamId: ctx.away.team_id, name: ctx.away.name }}
          home={{ teamId: ctx.home.team_id, name: ctx.home.name }}
          winner={null}
          kicker={sportLabel(ctx.sport_id)}
          status={`${formatGameDateLong(ctx.scheduled_start)}, ${formatGameTime(ctx.scheduled_start)}`}
          venue={ctx.venue.name ?? 'Venue TBD'}
        />
        {checkedIn ? <PageIntro title={headline(ctx)} /> : null}

        {!checkedIn ? (
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: theme.spacing.md,
              }}
            >
              <IconTile icon="i-gate" />
              <Text variant="h2" style={{ flex: 1 }}>
                Check in at {ctx.venue.name ?? 'the venue'}
              </Text>
            </View>
            <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
              We use your location once, right now, to confirm you are inside{' '}
              {ctx.venue.name ?? 'the venue'}. Your coordinates are never stored, only how far you
              were from the gate.
            </Text>
            {!inWindow ? (
              <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
                {now < Date.parse(ctx.check_in_opens_at)
                  ? `Check-in opens ${formatGameDateLong(ctx.check_in_opens_at)} at ${formatGameTime(ctx.check_in_opens_at)}, three hours before the start.`
                  : 'Check-in for this game has closed.'}
              </Text>
            ) : null}
            {!venueKnown ? (
              <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
                {checkInFailureCopy('venue_unknown', {})}
              </Text>
            ) : null}
            {failure ? (
              <Notice tone="error">
                {checkInFailureCopy(failure.reason, {
                  distance_m: failure.distance_m,
                  venueName: ctx.venue.name,
                })}
              </Notice>
            ) : null}
            {checkIn.error ? <Notice tone="error">{errorMessage(checkIn.error)}</Notice> : null}
            <Button
              title="Check in"
              onPress={onCheckIn}
              loading={checkIn.isPending}
              disabled={
                !inWindow || !venueKnown || ctx.status === 'postponed' || ctx.status === 'cancelled'
              }
            />
          </Card>
        ) : ctx.both_favorites ? (
          <SidePicker gameId={gameId} ctx={ctx} />
        ) : ctx.neutral_for_user ? (
          <PledgePanel gameId={gameId} ctx={ctx} />
        ) : (
          <FavoritePanel gameId={gameId} ctx={ctx} />
        )}

        {checkedIn ? <PushPrimer /> : null}

        {checkedIn ? (
          <Card style={{ paddingVertical: theme.spacing.xs + 1 }}>
            <Row
              icon="i-ticket"
              title="See game details"
              chevron
              onPress={() => router.push(`/games/${gameId}`)}
            />
          </Card>
        ) : null}
      </Screen>
    </SideTheme>
  );
}

function headline(ctx: GameContext): string {
  if (ctx.both_favorites) return 'Pick a side';
  if (ctx.neutral_for_user) return 'Pick a side';
  const fav = ctx.home.favorite ? ctx.home : ctx.away;
  return `Rooting for the ${fav.name}. Good luck.`;
}

/** After the first check-in, offer notifications once. Never prompts on its own. */
function PushPrimer() {
  const theme = useTheme();
  const userId = useAuthStore((s) => s.userId);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getPushStatus()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (status !== 'undetermined' || !userId) return null;
  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: theme.spacing.md,
        }}
      >
        <IconTile icon="i-bell" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Notifications</Text>
          <Text variant="sub" color="muted">
            Get your pledge result and game-day reminders as notifications.
          </Text>
        </View>
      </View>
      <Button
        title="Turn on notifications"
        variant="secondary"
        small
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const s = await registerPush(userId, { request: true });
          setStatus(s);
          setBusy(false);
        }}
        style={{ alignSelf: 'flex-start' }}
      />
    </Card>
  );
}

function SidePicker({ gameId, ctx }: { gameId: string; ctx: GameContext }) {
  const theme = useTheme();
  const choose = useChooseSide();
  const current = ctx.attendance?.rooting_team_id ?? null;
  return (
    <Card>
      <Text variant="bodyStrong" style={{ marginBottom: theme.spacing.md }}>
        You follow both teams. Who are you rooting for today?
      </Text>
      <View style={{ gap: theme.spacing.sm }}>
        {[ctx.away, ctx.home].map((t) => (
          // Each choice is in its own team's colours: solid once picked, washed until then.
          <SideTheme key={t.team_id} team={t.team_id}>
            <SideOption
              name={t.name}
              selected={current === t.team_id}
              disabled={choose.isPending || !ctx.attendance}
              onPress={() =>
                ctx.attendance &&
                choose.mutate({ attendanceId: ctx.attendance.id, gameId, teamId: t.team_id })
              }
            />
          </SideTheme>
        ))}
      </View>
      {choose.error ? (
        <Notice tone="error" style={{ marginTop: theme.spacing.sm }}>
          {errorMessage(choose.error)}
        </Notice>
      ) : null}
      <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
        {current
          ? 'Counts for that record. You can change it any time from the game.'
          : 'Skip this and the game stays neutral for your record.'}
      </Text>
    </Card>
  );
}

function SideOption({
  name,
  selected,
  disabled,
  onPress,
}: {
  name: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const a = theme.accent;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? a.fill : a.wash,
        borderRadius: theme.radius.lg,
        paddingVertical: 14,
        paddingHorizontal: 16,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text variant="stat" style={{ color: selected ? a.onFill : a.text }}>
        {name}
      </Text>
    </Pressable>
  );
}

function FavoritePanel({ gameId, ctx }: { gameId: string; ctx: GameContext }) {
  const theme = useTheme();
  const attendance = useMyAttendanceForGame(gameId);
  const people = usePeople();
  const addPerson = useAddPerson();
  const save = useSetCompanions();
  const [newPerson, setNewPerson] = useState('');
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const initial = useMemo(
    () =>
      new Set(
        (attendance.data?.companions ?? [])
          .map((x) => x.person?.id)
          .filter((id): id is string => !!id),
      ),
    [attendance.data],
  );
  const companions = selected ?? initial;
  const dirty =
    selected != null &&
    (selected.size !== initial.size || [...selected].some((id) => !initial.has(id)));

  const toggle = (id: string) => {
    const next = new Set(companions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onAdd = async () => {
    const name = newPerson.trim();
    if (!name) return;
    const person = await addPerson.mutateAsync(name);
    setSelected(new Set(companions).add(person.id));
    setNewPerson('');
  };

  const onSave = () => {
    if (!ctx.attendance) return;
    save.mutate(
      { attendanceId: ctx.attendance.id, gameId, personIds: [...companions] },
      { onSuccess: () => setSelected(null) },
    );
  };

  return (
    <Card label="Who's with you">
      {people.isPending ? <Loading /> : null}
      {(people.data ?? []).map((p, i) => (
        <CheckRow
          key={p.id}
          title={p.display_name}
          checked={companions.has(p.id)}
          onToggle={() => toggle(p.id)}
          first={i === 0}
        />
      ))}
      {people.data && people.data.length === 0 ? (
        <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Tag the people you came with. They do not need the app.
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          alignItems: 'flex-start',
          marginTop: theme.spacing.sm,
        }}
      >
        <TextField
          placeholder="Add someone, like Dad"
          value={newPerson}
          onChangeText={setNewPerson}
          autoCapitalize="words"
          containerStyle={{ flex: 1, marginBottom: 0 }}
          returnKeyType="done"
          onSubmitEditing={onAdd}
          maxLength={40}
          accessibilityLabel="Add a person"
        />
        <Button
          title="Add"
          variant="secondary"
          onPress={onAdd}
          disabled={!newPerson.trim()}
          loading={addPerson.isPending}
        />
      </View>
      {save.error ? (
        <Notice tone="error" style={{ marginTop: theme.spacing.sm }}>
          {errorMessage(save.error)}
        </Notice>
      ) : null}
      {dirty ? (
        <Button
          title="Save companions"
          onPress={onSave}
          loading={save.isPending}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}
    </Card>
  );
}

/**
 * The settled pledge. While a pick is still open, a neutral fan is on the reference Pick a side
 * screen instead (PickASideLive, routed above), so this only ever renders a result.
 */
function PledgePanel({ ctx }: { gameId: string; ctx: GameContext }) {
  const theme = useTheme();
  const router = useRouter();
  const p = ctx.pledge;
  if (!p) return null;

  const teamName = (id: string | null | undefined) =>
    id === ctx.home.team_id ? ctx.home.name : id === ctx.away.team_id ? ctx.away.name : 'team';
  const won = p.result === 'win';
  const gain = (1 - p.win_prob_at_pledge).toFixed(2);
  const pill: { label: string; tone: ResultTone } =
    p.status === 'void'
      ? { label: p.void_reason === 'draw' ? 'Drawn' : 'Void', tone: 'neutral' }
      : won
        ? { label: 'Won', tone: 'win' }
        : p.result === 'loss'
          ? { label: 'Lost', tone: 'loss' }
          : { label: 'Tied', tone: 'neutral' };
  return (
    <SideTheme team={p.team_id}>
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text variant="kicker" color="accent">
            Your pick
          </Text>
          <ResultPill label={pill.label} tone={pill.tone} />
        </View>
        {p.status === 'void' && p.void_reason === 'draw' ? (
          <>
            <Text variant="h2">Drawn, no result</Text>
            <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
              The match ended level, so your pick does not count either way.
            </Text>
          </>
        ) : p.status === 'void' ? (
          <>
            <Text variant="h2">Your pick did not count</Text>
            <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
              Your pick came after the first score, so it doesn&apos;t count.
            </Text>
          </>
        ) : (
          <>
            <Text variant="h2">
              The {teamName(p.team_id)}{' '}
              {p.result === 'win' ? 'won' : p.result === 'loss' ? 'lost' : 'tied'}
            </Text>
            <Text variant="sub" color="muted" style={{ marginTop: 4 }}>
              {won
                ? `+${gain} vs expected. They were ${pctLabel(p.win_prob_at_pledge)} to win when you picked.`
                : `They were ${pctLabel(p.win_prob_at_pledge)} to win when you picked.`}
            </Text>
          </>
        )}
        <Button
          title="Share result"
          variant="secondary"
          small
          onPress={() =>
            openShare(router, {
              kind: 'pledge',
              team: teamName(p.team_id),
              away: ctx.away.name,
              home: ctx.home.name,
              date: ctx.scheduled_start,
              result:
                p.status === 'void'
                  ? 'void'
                  : p.result === 'win' || p.result === 'loss' || p.result === 'tie'
                    ? p.result
                    : 'pending',
              winProb: p.win_prob_at_pledge,
            })
          }
          style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md }}
        />
      </Card>
    </SideTheme>
  );
}
