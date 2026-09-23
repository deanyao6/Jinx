import React from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { useReferenceTheme } from '@/theme/reference/TeamTheme';

import { useGameReactions, type GameReaction } from '../queries';
import { ReactionCard } from './ReactionCard';
import { ReactionViewer } from './ReactionStrip';

/**
 * The reactions pinned to the story step on screen: taken between the previous step's point on
 * the win probability line and this one's (03, section 5). A reaction with no point yet (its
 * game's line has not been built) sits on the final step. Mine always; others' when their post
 * lets me see them.
 */
export function reactionsAtStep(
  reactions: readonly GameReaction[],
  prevWp: number | null,
  wp: number,
  isLast: boolean,
): GameReaction[] {
  return reactions.filter((r) => {
    if (r.wp_seq == null) return isLast;
    return r.wp_seq <= wp && (prevWp == null || r.wp_seq > prevWp);
  });
}

export function ReliveReactions({ gameId, prevWp, wp, isLast }: { gameId: string; prevWp: number | null; wp: number; isLast: boolean }) {
  const { base } = useReferenceTheme();
  const reactions = useGameReactions(gameId);
  const [open, setOpen] = React.useState<GameReaction | null>(null);
  const here = reactionsAtStep(reactions.data ?? [], prevWp, wp, isLast);
  if (here.length === 0) return null;
  return (
    <View style={{ marginTop: 10 }} testID="relive-reactions">
      <Text variant="kicker" style={{ color: base.muted, marginBottom: 6 }}>
        {here.length === 1 ? 'A reaction at this moment' : `${here.length} reactions at this moment`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {here.map((r) => (
          <ReactionCard key={r.id} reaction={r} size={104} onPress={() => setOpen(r)} />
        ))}
      </ScrollView>
      {open ? <ReactionViewer reaction={open} gameId={gameId} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}
