import { useIsFocused, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Notice, errorMessage } from '@/components/Notice';
import { IconChevR, ICONS } from '@/components/reference/icons';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import { isWithinCheckInWindow } from '@/features/checkin/lock';
import { useGameContext } from '@/features/checkin/queries';
import { useProfile } from '@/features/profile/queries';
import { openShare } from '@/features/share/navigate';
import { useTheme } from '@/theme/ThemeProvider';

import {
  canOfferHandshake,
  completedHandshakes,
  handshakeLine,
  handshakeName,
  handshakeStates,
  newlyCompleted,
  offerRefusalCopy,
  type HandshakeRow,
  type HandshakeState,
} from './handshake';
import { HandshakeAvatar } from './HandshakeAvatar';
import { useHandshakeCandidates, useMyHandshakes, useOfferHandshake } from './handshakeQueries';
import { lightHaptic } from './runtime';
import { WeWereThereSheet, type WeWereThereData } from './WeWereThere';

/** A mutual at the game, as `mutuals_at_game` lists them. */
export type AlsoThereMutual = { user_id: string; handle: string; display_name: string | null };

/**
 * The mutual rows of the game page's "Also there" card, with the secret handshake on top
 * (`./handshake`). `AlsoThere` mounts this only when the egg is on and the data is real, so
 * with the egg off, or in demo mode, the card draws the rows it always drew and none of the
 * requests below is made.
 *
 * A friend who can be offered a handshake gets their avatar at the head of the row; everybody
 * else keeps the plain row. Nothing here can show that somebody has offered YOU one: the server
 * never says (`my_handshakes` starts from the caller's own offers).
 */
export function HandshakeRows({
  gameId,
  mutuals,
}: {
  gameId: string;
  mutuals: readonly AlsoThereMutual[];
}) {
  const theme = useTheme();
  const router = useRouter();
  const focused = useIsFocused();
  const context = useGameContext(gameId);
  const profile = useProfile();

  const ctx = context.data ?? null;
  const viewerCheckedIn = !!ctx?.checked_in_at;
  // The clock is state, not a call during render: a minute's tick is also what closes the
  // window on a screen that has been left open since before the final.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!focused) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [focused]);
  const windowOpen = ctx ? isWithinCheckInWindow(now, ctx.scheduled_start, ctx.final_at) : false;

  // Who is there to shake hands with is only asked while a handshake could still happen. What
  // already happened is asked whenever the person was checked in, so the line survives the game.
  const candidates = useHandshakeCandidates(gameId, viewerCheckedIn && windowOpen);
  const mine = useMyHandshakes(gameId, { enabled: viewerCheckedIn, focused, windowOpen });
  const offer = useOfferHandshake(gameId);

  const [sheetFor, setSheetFor] = React.useState<string | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  /** Optimistic: the ring appears on the tap, not a round trip later. */
  const [tapped, setTapped] = React.useState<ReadonlySet<string>>(new Set());

  const rows = mine.data;
  const states = React.useMemo(() => handshakeStates(rows), [rows]);
  const completed = React.useMemo(() => completedHandshakes(rows), [rows]);
  const candidateById = React.useMemo(
    () => new Map((candidates.data ?? []).map((c) => [c.user_id, c])),
    [candidates.data],
  );

  const present = React.useCallback((userId: string) => {
    setSheetFor(userId);
    lightHaptic();
  }, []);

  // A waiting handshake that the last poll found complete: the other person tapped back.
  const before = React.useRef<ReadonlyMap<string, HandshakeState> | null>(null);
  const presented = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!rows) return;
    const fresh = newlyCompleted(before.current, rows).filter(
      (row) => !presented.current.has(row.user_id),
    );
    before.current = handshakeStates(rows);
    const first = fresh[0];
    if (first && focused) {
      presented.current.add(first.user_id);
      present(first.user_id);
    }
  }, [rows, focused, present]);

  const onOffer = (userId: string) => {
    setRefusal(null);
    setTapped((prev) => new Set(prev).add(userId));
    offer.mutate(
      { toUserId: userId },
      {
        onSuccess: (result) => {
          if (!result.offered) {
            setRefusal(offerRefusalCopy(result.reason));
            setTapped((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
            return;
          }
          if (result.complete) {
            presented.current.add(userId);
            present(userId);
          }
        },
        onError: () =>
          setTapped((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          }),
      },
    );
  };

  const cardData = (them: HandshakeRow | undefined): WeWereThereData | null => {
    if (!them || !ctx || !profile.data) return null;
    return {
      me: {
        id: profile.data.id,
        name: profile.data.display_name?.trim() || `@${profile.data.handle}`,
        handle: profile.data.handle,
        avatarPath: profile.data.avatar_path,
      },
      them: {
        id: them.user_id,
        name: handshakeName(them),
        handle: them.handle,
        avatarPath: them.avatar_path,
      },
      away: ctx.away.name,
      home: ctx.home.name,
      venue: ctx.venue.name,
      date: ctx.scheduled_start,
    };
  };
  const sheetData = sheetFor ? cardData(completed.find((r) => r.user_id === sheetFor)) : null;

  const line = handshakeLine(completed);
  const Users = ICONS['i-users'];

  return (
    <>
      {offer.error ? <Notice tone="error">{errorMessage(offer.error)}</Notice> : null}
      {refusal ? <Notice>{refusal}</Notice> : null}
      {mutuals.map((m, i) => {
        const name = m.display_name?.trim() || `@${m.handle}`;
        const candidate = candidateById.get(m.user_id);
        const state: HandshakeState | undefined =
          states.get(m.user_id) ?? (tapped.has(m.user_id) ? 'waiting' : undefined);
        const open = () => router.push(`/u/${m.handle}`);
        // No avatar unless there is, or was, a handshake to be had: the row is then the one
        // the card has always drawn.
        if (!candidate && !state) {
          return (
            <Row
              key={m.user_id}
              first={i === 0}
              title={name}
              subtitle={`@${m.handle}`}
              chevron
              onPress={open}
            />
          );
        }
        const tappable = canOfferHandshake({
          live: true,
          viewerCheckedIn,
          windowOpen,
          isCandidate: !!candidate,
          state,
        });
        const theirRow = rows?.find((r) => r.user_id === m.user_id);
        return (
          <View
            key={m.user_id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 }}
          >
            <HandshakeAvatar
              userId={m.user_id}
              name={name}
              handle={m.handle}
              path={candidate?.avatar_path ?? theirRow?.avatar_path ?? null}
              state={state}
              onPress={tappable ? () => onOffer(m.user_id) : undefined}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={name}
              onPress={open}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{name}</Text>
                <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
                  {`@${m.handle}`}
                </Text>
              </View>
              <IconChevR size={16} color={theme.colors.muted} />
            </Pressable>
          </View>
        );
      })}
      {line ? (
        <Pressable
          testID="handshake-line"
          accessibilityRole="button"
          accessibilityLabel={line}
          onPress={() => (completed[0] ? setSheetFor(completed[0].user_id) : undefined)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Users size={16} color={theme.accent.text} />
          <Text variant="sub" style={{ flex: 1 }}>
            {line}
          </Text>
        </Pressable>
      ) : null}
      <WeWereThereSheet
        data={sheetData}
        onClose={() => setSheetFor(null)}
        onShare={
          sheetData
            ? () => {
                setSheetFor(null);
                openShare(router, {
                  kind: 'handshake',
                  team: ctx?.attendance?.rooting_team_id ?? ctx?.home.team_id ?? null,
                  ...sheetData,
                });
              }
            : undefined
        }
      />
    </>
  );
}
