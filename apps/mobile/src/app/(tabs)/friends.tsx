import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useFollowRequests } from '@/features/social/queries';
import { FeedSegment } from '@/features/social/ui/FeedSegment';
import { OverlapSegment } from '@/features/social/ui/OverlapSegment';
import { RivalsSegment } from '@/features/social/ui/RivalsSegment';
import { WithSegment } from '@/features/social/ui/WithSegment';
import { useTheme } from '@/theme/ThemeProvider';

type Segment = 'feed' | 'with' | 'rivals' | 'overlap';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'with', label: 'With' },
  { key: 'rivals', label: 'Rivals' },
  { key: 'overlap', label: 'Overlap' },
];

function isSegment(s: string | undefined): s is Segment {
  return s === 'feed' || s === 'with' || s === 'rivals' || s === 'overlap';
}

export default function FriendsScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { segment: param } = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(isSegment(param) ? param : 'feed');
  const [seenParam, setSeenParam] = useState(param);
  if (param !== seenParam) {
    setSeenParam(param);
    if (isSegment(param)) setSegment(param);
  }
  const requests = useFollowRequests();
  const pending = requests.data?.length ?? 0;

  const goFind = () => router.push('/friends/find');
  const goRequests = () => router.push('/friends/requests');

  const header = (
    <View style={{ paddingTop: insets.top + theme.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.md,
        }}
      >
        <View>
          <Text variant="h1">Friends</Text>
          <Text variant="sub" color="muted">
            Who’s lucky, who’s a jinx
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <HeaderAction icon="person-add" label="Find people" onPress={goFind} />
          <HeaderAction icon="mail" label="Requests" badge={pending} onPress={goRequests} />
        </View>
      </View>
      <Segmented options={SEGMENTS} value={segment} onChange={setSegment} />
    </View>
  );

  if (segment === 'feed') {
    return (
      <View style={{ flex: 1, backgroundColor: c.screen }}>
        <FeedSegment header={header} onFindPeople={goFind} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.screen }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {segment === 'with' ? (
          <WithSegment onLog={() => router.push('/(tabs)/games?segment=log')} />
        ) : null}
        {segment === 'rivals' ? <RivalsSegment onFindPeople={goFind} /> : null}
        {segment === 'overlap' ? <OverlapSegment onFindPeople={goFind} /> : null}
      </ScrollView>
    </View>
  );
}

function HeaderAction({
  icon,
  label,
  badge = 0,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} pending` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.tint,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={c.ink} />
      {badge > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: c.red,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="label" style={{ color: '#FFFFFF' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
