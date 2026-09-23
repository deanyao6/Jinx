import { useCallback } from 'react';
import { Alert } from 'react-native';

import { friendlySocialError } from '@/features/feed/errors';
import { useMutedIds, useSetMuted } from '@/features/feed/queries';
import { REPORT_REASONS, useBlock, useReport, type ReportTarget } from '@/features/social/queries';

/**
 * The overflow menu every post, comment and profile carries (social brief 02, sections 3 and
 * 8; App Review needs all three): report, mute, block. Mute hides someone from your feed and
 * threads without telling them; block hides you from each other everywhere.
 */
export type MenuTarget = {
  type: Extract<ReportTarget, 'post' | 'comment' | 'reaction' | 'user'>;
  id: string;
  /** The person behind it, for mute and block. */
  userId: string;
  name: string;
};

export function useModerationMenu() {
  const report = useReport();
  const block = useBlock();
  const setMuted = useSetMuted();
  const muted = useMutedIds();

  const say = (e: unknown) =>
    Alert.alert('That did not work', friendlySocialError(e) ?? 'Check your connection and try again.');

  const askReason = useCallback(
    (target: MenuTarget) => {
      Alert.alert(
        'Report this',
        'What is wrong with it? We review every report.',
        [
          ...REPORT_REASONS.map((reason) => ({
            text: reason,
            onPress: () =>
              report.mutate(
                { targetType: target.type, targetId: target.id, reason },
                {
                  onSuccess: () => Alert.alert('Thanks for telling us', 'We will take a look.'),
                  onError: say,
                },
              ),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    },
    [report],
  );

  return useCallback(
    (target: MenuTarget, extra?: { title: string; destructive?: boolean; onPress: () => void }[]) => {
      const isMuted = muted.data?.has(target.userId) ?? false;
      Alert.alert(target.name, undefined, [
        ...(extra ?? []).map((e) => ({
          text: e.title,
          style: e.destructive ? ('destructive' as const) : ('default' as const),
          onPress: e.onPress,
        })),
        { text: 'Report', onPress: () => askReason(target) },
        {
          text: isMuted ? `Unmute ${target.name}` : `Mute ${target.name}`,
          onPress: () => setMuted.mutate({ userId: target.userId, muted: !isMuted }, { onError: say }),
        },
        {
          text: `Block ${target.name}`,
          style: 'destructive',
          onPress: () =>
            Alert.alert(`Block ${target.name}?`, 'You will not see each other anywhere in Jinx.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: () => block.mutate({ userId: target.userId }, { onError: say }),
              },
            ]),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [askReason, block, muted.data, setMuted],
  );
}
