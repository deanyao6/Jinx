import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDebounced } from '@/features/games/ui/useDebounced';
import { shareAppLink } from '@/features/people/invite';
import { useSearchProfiles } from '@/features/social/queries';
import { Avatar } from '@/features/social/ui/Avatar';
import { FollowButton } from '@/features/social/ui/FollowButton';
import { useTheme } from '@/theme/ThemeProvider';

export default function FindPeopleScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const results = useSearchProfiles(debounced);
  const active = debounced.trim().length >= 2;

  return (
    <FormScreen headerOffset={90}>
      <TextField
        placeholder="Search by handle or name"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        clearButtonMode="while-editing"
        accessibilityLabel="Search people"
        hint={active ? null : 'Type at least two letters.'}
      />
      {results.isError ? <ErrorNotice error={results.error} onRetry={results.refetch} /> : null}
      {active && results.isPending ? <Loading /> : null}
      {active && results.data ? (
        <Card>
          {results.data.length === 0 ? (
            <Text variant="sub" color="muted">
              Nobody matches “{debounced.trim()}”. Handles start with the letters you typed.
            </Text>
          ) : null}
          {results.data.map((p, i) => {
            const name = p.display_name?.trim() || `@${p.handle}`;
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.line,
                }}
              >
                <Avatar name={name} />
                <View style={{ flex: 1 }}>
                  <Text
                    variant="bodyStrong"
                    numberOfLines={1}
                    onPress={() => router.push(`/u/${p.handle}`)}
                    accessibilityRole="link"
                  >
                    {name}
                  </Text>
                  <Text variant="caption" color="muted" numberOfLines={1}>
                    @{p.handle}
                    {p.is_private ? ' · Private' : ''}
                    {p.follows_me ? ' · Follows you' : ''}
                  </Text>
                </View>
                <FollowButton
                  userId={p.id}
                  name={name}
                  status={p.follow_status}
                  isPrivate={p.is_private}
                  isMutual={p.follow_status === 'active' && p.follows_me}
                  small
                />
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card label="Not on the app yet?">
        <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Send them a link. Once they join, tag them at games or follow each other for rivalries and
          overlaps.
        </Text>
        <Button
          title="Share an invite"
          variant="secondary"
          small
          onPress={() => void shareAppLink()}
          style={{ alignSelf: 'flex-start' }}
        />
      </Card>
      <Text variant="caption" color="muted">
        Contacts import is not part of this version.
      </Text>
    </FormScreen>
  );
}
