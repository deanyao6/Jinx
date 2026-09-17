import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { Loading } from '@/components/Loading';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useMyAttendanceForGame } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { checkInFailureCopy, isWithinCheckInWindow, pctLabel } from '@/features/checkin/lock';
import { measureDistanceToVenue } from '@/features/checkin/location';
import { PickASideLive } from '@/features/checkin/reference/PickASideLive';
import {
  useCheckIn,
  useChooseSide,
  useGameContext,
  useSetCompanions,
  type GameContext,
} from '@/features/checkin/queries';
import { getPushStatus, registerPush, type PushStatus } from '@/features/notifications/push';
import { useAddPerson, usePeople } from '@/features/people/queries';
import { openShare } from '@/features/share/navigate';
import { formatGameDateLong, formatGameTime } from '@/lib/format';
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
  if (c.checked_in_at && c.neutral_for_user && !c.both_favorites && !settled) {
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
  const inWindow = isWithinCheckInWindow(now, ctx.scheduled_start, ctx.final_at);
  const venueKnown = ctx.venue.lat != null && ctx.venue.lng != null && ctx.venue.geofence_m != null;
  const title = `${ctx.away.name} at ${ctx.home.name}`;

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

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Check in' }} />
      {checkedIn ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
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
      <Text variant="h1">{checkedIn ? headline(ctx) : title}</Text>
      <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
        {checkedIn ? title : (ctx.venue.name ?? 'Venue TBD')} ·{' '}
        {formatGameDateLong(ctx.scheduled_start)}, {formatGameTime(ctx.scheduled_start)}
      </Text>

      {!checkedIn ? (
        <Card label={`Check in at ${ctx.venue.name ?? 'the venue'}`}>
          <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
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
        <Button
          title="See game details"
          variant="ghost"
          onPress={() => router.push(`/games/${gameId}`)}
          style={{ marginTop: theme.spacing.sm }}
        />
      ) : null}
    </Screen>
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
    <Card label="Notifications">
      <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
        Get your pledge result and game-day reminders as notifications.
      </Text>
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
  const c = theme.colors;
  const choose = useChooseSide();
  const current = ctx.attendance?.rooting_team_id ?? null;
  return (
    <Card label="You follow both teams. Who are you rooting for today?">
      <View style={{ gap: theme.spacing.sm }}>
        {[ctx.away, ctx.home].map((t) => {
          const on = current === t.team_id;
          return (
            <Pressable
              key={t.team_id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              disabled={choose.isPending || !ctx.attendance}
              onPress={() =>
                ctx.attendance &&
                choose.mutate({ attendanceId: ctx.attendance.id, gameId, teamId: t.team_id })
              }
              style={{
                borderWidth: 2,
                borderColor: on ? c.ink : c.line,
                backgroundColor: on ? c.ink : c.card,
                borderRadius: theme.radius.lg,
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <Text variant="stat" color={on ? 'onInk' : 'ink'}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
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
  return (
    <Card label="Your pick">
      {p.status === 'void' ? (
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
  );
}
