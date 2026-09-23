import { slotsCopy } from '@jinx/core';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Notice, errorMessage } from '@/components/Notice';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Row } from '@/components/Row';
import { Text } from '@/components/Text';
import type { GameContext } from '@/features/checkin/queries';
import { inOpenSession } from '@/features/checkin/session';
import { ToggleRow } from '@/features/account/ui/ToggleRow';
import { liveStatusLabel } from '@/features/live/format';
import type { LiveState } from '@/features/checkin/lock';
import {
  slotsOf,
  useAlsoHere,
  useEndCheckin,
  useGamePrompts,
  useGameReactions,
  useMuteCheckinPrompts,
} from '@/features/reactions/queries';
import { useTheme } from '@/theme/ThemeProvider';

/** "Session ends 30 minutes after the final" and its siblings, for the line under the score. */
export function sessionEndCopy(ctx: Pick<GameContext, 'checkin' | 'final_at' | 'scheduled_start'>): string {
  const c = ctx.checkin;
  if (c && !c.open) {
    switch (c.end_reason) {
      case 'left':
        return 'You left the game. Prompts have stopped.';
      case 'final':
        return 'The session ended 30 minutes after the final.';
      case 'timeout':
        return 'The session ended six hours after it started.';
      default:
        return 'The session has ended.';
    }
  }
  return 'Session ends 30 minutes after the final, or when you say you have left.';
}

/**
 * The checked-in screen's session panel (03, section 1; the prototype's "Checked in" screen):
 * the live line, reactions used of three with React now, Also here, "not tonight", and "I have
 * left". After the session ends, the post-game offer.
 */
export function SessionPanel({ gameId, ctx, live }: { gameId: string; ctx: GameContext; live: LiveState | null | undefined }) {
  const theme = useTheme();
  const router = useRouter();
  const open = inOpenSession(ctx);
  const prompts = useGamePrompts(gameId, open);
  const reactions = useGameReactions(gameId);
  const alsoHere = useAlsoHere(gameId, open);
  const end = useEndCheckin();
  const mute = useMuteCheckinPrompts();
  const slots = slotsOf(prompts.data);
  const mine = (reactions.data ?? []).filter((r) => r.mine);
  const selfUsed = mine.filter((r) => r.self_triggered).length;
  const status = liveStatusLabel(ctx.sport_id, live);
  const muted = ctx.checkin?.prompts_muted ?? false;

  const onLeave = () =>
    Alert.alert('Left the game?', 'Prompts stop and the session ends. Your attendance stays logged.', [
      { text: 'Still here', style: 'cancel' },
      { text: 'I have left', style: 'destructive', onPress: () => end.mutate(gameId) },
    ]);

  if (!open) {
    return (
      <Card tone="accent">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.spacing.md }}>
          <IconTile icon="i-passport" solid />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{sessionEndCopy(ctx)}</Text>
            <Text variant="sub" color="muted">
              Your game is logged and verified. Add a note, your seat and photos while it is fresh.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button title="Write it up" onPress={() => router.push(`/games/log/${gameId}`)} style={{ flex: 1 }} />
          <Button title="Relive it" variant="secondary" onPress={() => router.push(`/relive/${gameId}`)} style={{ flex: 1 }} />
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.red }} />
          <Text variant="kicker" color="red">
            {status ? `Checked in · ${status}` : 'Checked in'}
          </Text>
        </View>
        {live ? (
          <Text variant="stat" style={{ marginTop: 6 }}>
            {ctx.away.name} {live.away_score}, {ctx.home.name} {live.home_score}
          </Text>
        ) : null}
        <Text variant="caption" color="muted" style={{ marginTop: 6 }}>
          {sessionEndCopy(ctx)}
        </Text>
      </Card>

      <Card label="Reactions">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="i-camera" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{slotsCopy(slots)}</Text>
            <Text variant="sub" color="muted">
              {muted
                ? 'Prompts are off for tonight.'
                : 'One late-game prompt, up to two big moments. Two ignored in a row and the rest stay quiet.'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md, alignItems: 'center' }}>
          <Button
            title="React now"
            small
            disabled={selfUsed >= 5}
            onPress={() => router.push(`/react/${gameId}`)}
            style={{ alignSelf: 'flex-start' }}
          />
          <Text variant="caption" color="muted" style={{ flex: 1 }}>
            {selfUsed >= 5 ? 'Five of your own this game, the most there is.' : `${5 - selfUsed} of your own left, on top of the prompts.`}
          </Text>
        </View>
        <ToggleRow
          title="Not tonight"
          body="No reaction prompts for this game. Your own reactions still work."
          value={muted}
          disabled={mute.isPending}
          onValueChange={(v) => mute.mutate({ gameId, muted: v })}
        />
        {mute.error ? <Notice tone="error">{errorMessage(mute.error)}</Notice> : null}
      </Card>

      <Card label="Also here">
        {(alsoHere.data ?? []).map((p) => (
          <Row
            key={p.user_id}
            title={p.display_name?.trim() || `@${p.handle}`}
            subtitle={p.section ? `Mutual friend, section ${p.section}` : 'Mutual friend'}
            right={<PersonAvatar userId={p.user_id} name={p.display_name} handle={p.handle} path={p.avatar_path} size={32} />}
            chevron
            onPress={() => router.push(`/u/${p.handle}`)}
          />
        ))}
        <Text variant="caption" color="muted" style={{ marginTop: (alsoHere.data?.length ?? 0) > 0 ? theme.spacing.sm : 0 }}>
          {(alsoHere.data?.length ?? 0) > 0
            ? 'Visible to mutual friends only. Switch it off in Privacy.'
            : ctx.checkin?.visibility === 'off'
              ? 'You are hidden here. Mutual friends who check in would show once you switch it on in Privacy.'
              : 'No mutual friends checked in yet. They see you are here; nobody else does.'}
        </Text>
      </Card>

      {end.error ? <Notice tone="error">{errorMessage(end.error)}</Notice> : null}
      <Button title="I have left the game" variant="secondary" onPress={onLeave} loading={end.isPending} />
    </>
  );
}
