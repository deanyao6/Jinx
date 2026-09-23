import React from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/ErrorNotice';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { PageIntro } from '@/components/PageIntro';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useBadges, type Badge } from '@/features/communities/queries';
import { useTheme } from '@/theme/ThemeProvider';

function formatEarned(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const TIER_LABEL: Record<Badge['tier'], string> = {
  standard: '',
  rare: 'Rare',
  legendary: 'Legendary',
};

/** Badges: the public, collectible version of superlatives (docs/prompts/social/04, section 5). */
export default function BadgesRoute() {
  const theme = useTheme();
  const badges = useBadges();
  const earnedCount = (badges.data ?? []).filter((b) => b.earned_at).length;

  return (
    <Screen>
      <PageIntro
        kicker={badges.data ? `${earnedCount} of ${badges.data.length}` : 'Earned for the games you go to'}
        title="Badges"
        body="The public, collectible version of superlatives. Locked ones show what it takes; secret ones show only after you earn them."
      />
      {badges.isPending ? <Loading /> : null}
      {badges.isError ? <ErrorNotice error={badges.error} onRetry={badges.refetch} /> : null}
      {(badges.data ?? []).map((b, i) => (
        <View
          key={b.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 11,
            marginTop: i === 0 ? 0 : 0,
            opacity: b.earned_at ? 1 : 0.55,
          }}
        >
          <IconTile icon="i-verified" gold={!!b.earned_at && b.tier !== 'standard'} solid={!!b.earned_at} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{b.name}</Text>
            <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
              {b.earned_at ? `Earned ${formatEarned(b.earned_at)}` : b.description}
            </Text>
          </View>
          {TIER_LABEL[b.tier] && b.earned_at ? (
            <Text variant="caption" color="accent" weight={750}>
              {TIER_LABEL[b.tier]}
            </Text>
          ) : null}
        </View>
      ))}
      {badges.data && badges.data.length === 0 ? (
        <Text color="muted">No badges yet. Keep going to games.</Text>
      ) : null}
      <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.md }}>
        A handful of badges are secret. You will not see them here until you earn them.
      </Text>
    </Screen>
  );
}
