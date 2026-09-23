import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { PersonAvatar } from '@/components/PersonAvatar';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useDiscoverPeople, type DiscoverPerson } from '@/features/feed/queries';
import { FollowButton } from '@/features/social/ui/FollowButton';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';
import { Pill } from './PostCard';

/**
 * Discover's people (social brief 02, sections 2 and 4): creators first, ranked by a shared
 * favorite team, then followers, then who posted last; then fans who logged a game you logged.
 * Mutuals never appear here: they are in Following already.
 */
export function DiscoverPeople() {
  const theme = useTheme();
  const router = useRouter();
  const people = useDiscoverPeople();
  const creators = people.data?.filter((p) => p.section === 'creator') ?? [];
  // Someone already listed as a creator is not listed again as a fan.
  const creatorIds = new Set(creators.map((p) => p.userId));
  const fans = people.data?.filter((p) => p.section === 'fan' && !creatorIds.has(p.userId)) ?? [];
  return (
    <View style={{ gap: 4 }}>
      {creators.length ? (
        <>
          <SectionHeader title="Creators and superfans" />
          <Card style={{ gap: 14 }}>
            {creators.map((p) => (
              <PersonLine key={p.userId} person={p} />
            ))}
          </Card>
        </>
      ) : null}
      <SectionHeader title="Communities" action="See all" onAction={() => router.push('/communities')} />
      <Card>
        <Text variant="sub" color="muted">
          Team, stadium and school communities, each with its own leaderboard.
        </Text>
      </Card>
      {fans.length ? (
        <>
          <SectionHeader title="Fans at your games" />
          <Card style={{ gap: 14 }}>
            {fans.map((p) => (
              <PersonLine key={p.userId} person={p} />
            ))}
          </Card>
        </>
      ) : null}
      <View style={{ height: theme.spacing.md }} />
    </View>
  );
}

function PersonLine({ person }: { person: DiscoverPerson }) {
  const router = useRouter();
  const name = person.displayName || person.handle;
  const line =
    person.section === 'creator'
      ? [person.followers ? `${person.followers.toLocaleString('en-US')} followers` : null, person.note]
          .filter(Boolean)
          .join(' · ')
      : [
          person.sharedGames === 1 ? '1 game in common' : `${person.sharedGames ?? 0} games in common`,
          person.lastGame ? `last ${person.lastGame.label}` : null,
        ]
          .filter(Boolean)
          .join(', ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, @${person.handle}`}
        onPress={() => {
          if (!env.demo) router.push(`/u/${person.handle}` as Href);
        }}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
      >
        <PersonAvatar userId={person.userId} name={person.displayName} handle={person.handle} path={person.avatarPath} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {name}
            </Text>
            {person.isCreator ? <Pill label="Superfan" tone="gold" /> : null}
          </View>
          <Text variant="caption" color="muted" numberOfLines={2}>
            {line}
          </Text>
        </View>
      </Pressable>
      <FollowButton userId={person.userId} name={name} status={null} isPrivate={false} small />
    </View>
  );
}
