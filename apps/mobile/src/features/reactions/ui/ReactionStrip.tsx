import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice } from '@/components/Notice';
import { ICONS } from '@/components/reference/icons';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { REPORT_REASONS, useBlock, useReport } from '@/features/social/queries';
import { useTheme } from '@/theme/ThemeProvider';

import {
  useDeleteReaction,
  useGameReactions,
  useSetReactionVisibility,
  type GameReaction,
  type ReactionVisibility,
} from '../queries';
import { ReactionCard, StitchedPhoto, reactionCaption } from './ReactionCard';

const VISIBILITY: { key: ReactionVisibility; label: string }[] = [
  { key: 'private', label: 'Only me' },
  { key: 'followers', label: 'Followers' },
  { key: 'public', label: 'Everyone' },
];

/**
 * A game's reactions in a row (03, section 5: the strip on the game page). Mine always; others'
 * when their post lets me see them. Nothing renders for a game with none, so a game without
 * reactions shows no empty section.
 */
export function ReactionStrip({ gameId, title = 'Reactions' }: { gameId: string; title?: string }) {
  const reactions = useGameReactions(gameId);
  const [open, setOpen] = React.useState<GameReaction | null>(null);
  const list = reactions.data ?? [];
  if (list.length === 0) return null;
  return (
    <Card label={title}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {list.map((r) => (
          <ReactionCard key={r.id} reaction={r} size={120} onPress={() => setOpen(r)} />
        ))}
      </ScrollView>
      {open ? <ReactionViewer reaction={open} gameId={gameId} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}

/** A reaction, full size. Mine: who sees it, delete. Someone else's: report, block. */
export function ReactionViewer({ reaction, gameId, onClose }: { reaction: GameReaction; gameId: string; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setVisibility = useSetReactionVisibility();
  const remove = useDeleteReaction();
  const report = useReport();
  const block = useBlock();
  const [chosen, setChosen] = React.useState<ReactionVisibility>((reaction.visibility as ReactionVisibility) ?? 'followers');
  const [notice, setNotice] = React.useState<string | null>(null);
  const Close = ICONS['i-chev-l'];
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 420);

  const onVisibility = async (visibility: ReactionVisibility) => {
    const before = chosen;
    setChosen(visibility);
    try {
      await setVisibility.mutateAsync({ id: reaction.id, gameId, visibility });
    } catch {
      setChosen(before);
      setNotice('That did not save. Try again.');
    }
  };
  const onDelete = () =>
    Alert.alert('Delete this reaction?', 'Its post, its photos and its place in Relive go with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove
            .mutateAsync({ id: reaction.id, back_path: reaction.back_path, front_path: reaction.front_path, gameId })
            .then(onClose)
            .catch(() => setNotice('That did not delete. Try again.')),
      },
    ]);
  const onReport = () =>
    Alert.alert('Report this', 'What is wrong with it?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () =>
          report
            .mutateAsync({ targetType: 'reaction', targetId: reaction.id, reason })
            .then(() => setNotice('Thanks. We will take a look.'))
            .catch(() => setNotice('That report did not send. Try again.')),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  const onBlock = () =>
    Alert.alert('Block this person?', 'You will not see each other anywhere in Jinx.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          block
            .mutateAsync({ userId: reaction.user_id })
            .then(onClose)
            .catch(() => setNotice('That did not work. Try again.')),
      },
    ]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: theme.colors.screen, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
            <Close size={22} color={theme.colors.ink} />
          </Pressable>
          <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {reactionCaption(reaction)}
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <StitchedPhoto backUrl={reaction.backUrl} frontUrl={reaction.frontUrl} size={size} style={{ alignSelf: 'center' }} />
          {reaction.label ? (
            <Text variant="sub" color="muted" style={{ marginTop: 10 }}>
              {reaction.label}
            </Text>
          ) : null}
          {notice ? <Notice tone="info" style={{ marginTop: 10 }}>{notice}</Notice> : null}
          {reaction.mine ? (
            <View style={{ marginTop: 16, gap: 12 }}>
              <Text variant="kicker" color="muted">
                Who sees it
              </Text>
              <Segmented options={VISIBILITY} value={chosen} onChange={(v) => void onVisibility(v)} />
              <Text variant="caption" color="muted">
                Only me keeps it in your own Relive and out of every feed.
              </Text>
              <Button title="Delete reaction" variant="danger" small onPress={onDelete} loading={remove.isPending} style={{ alignSelf: 'flex-start' }} />
            </View>
          ) : (
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button title="View profile" variant="secondary" small onPress={() => { onClose(); router.push(`/u/${reaction.handle}`); }} />
              <Button title="Report" variant="ghost" small onPress={onReport} loading={report.isPending} />
              <Button title="Block" variant="ghost" small onPress={onBlock} loading={block.isPending} />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
