import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CheckRow } from '@/components/CheckRow';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { useFollowing } from '@/features/social/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { usePersonForUser, type Person } from './queries';

type Props = {
  /** My people list; followed users who already have a linked row are shown there instead. */
  people: Person[];
  /** Called with the (created or reused) person id so the log form can tick it. */
  onPick: (personId: string) => void;
};

/**
 * "People you follow" section of the companions picker (SPEC 6.10). Ticking someone calls
 * person_for_user, which creates or reuses the linked people row; they then appear in the
 * main list as a normal companion.
 */
export function FollowedCompanions({ people, onPick }: Props) {
  const theme = useTheme();
  const following = useFollowing();
  const link = usePersonForUser();
  const [busyId, setBusyId] = useState<string | null>(null);

  const linkedIds = useMemo(
    () => new Set(people.map((p) => p.linked_user_id).filter((id): id is string => !!id)),
    [people],
  );
  const candidates = useMemo(
    () => (following.data ?? []).filter((u) => !linkedIds.has(u.id)),
    [following.data, linkedIds],
  );

  if (candidates.length === 0) return null;

  const pick = async (userId: string) => {
    setBusyId(userId);
    try {
      const personId = await link.mutateAsync({ linkedUserId: userId });
      onPick(personId);
    } catch {
      // surfaced via link.error
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ marginTop: theme.spacing.md }}>
      <Text variant="caption" color="muted" style={{ marginBottom: 2 }}>
        People you follow
      </Text>
      {link.error ? <Notice tone="error">{errorMessage(link.error)}</Notice> : null}
      {candidates.map((u, i) => (
        <CheckRow
          key={u.id}
          first={i === 0}
          title={u.display_name?.trim() || `@${u.handle}`}
          subtitle={`@${u.handle}`}
          checked={false}
          disabled={busyId != null}
          trailing={busyId === u.id ? 'Adding' : null}
          onToggle={() => void pick(u.id)}
        />
      ))}
    </View>
  );
}
