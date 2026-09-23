import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FormScreen } from '@/components/FormScreen';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Row } from '@/components/Row';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import { useDebounced } from '@/features/games/ui/useDebounced';
import { shareAppLink } from '@/features/people/invite';
import { useFollowRequests, useSearchProfiles } from '@/features/social/queries';
import { FollowButton } from '@/features/social/ui/FollowButton';
import { PersonRow } from '@/features/social/ui/PersonRow';

export default function FindPeopleScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const results = useSearchProfiles(debounced);
  const active = debounced.trim().length >= 2;
  const requests = useFollowRequests();
  const pending = requests.data?.length ?? 0;

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
      {/* Shown only when someone is waiting: a private account's requests had no way in. */}
      {pending > 0 && !active ? (
        <Card tone="accent">
          <Row
            icon="i-users"
            title="Follow requests"
            subtitle={pending === 1 ? '1 person is waiting' : `${pending} people are waiting`}
            first
            chevron
            onPress={() => router.push('/friends/requests')}
          />
        </Card>
      ) : null}
      {results.isError ? <ErrorNotice error={results.error} onRetry={results.refetch} /> : null}
      {active && results.isPending ? <Loading /> : null}
      {active && results.data && results.data.length === 0 ? (
        <EmptyState
          icon="i-search"
          title="No one found"
          body={`Nobody matches “${debounced.trim()}”. Handles start with the letters you typed.`}
        />
      ) : null}
      {active && results.data && results.data.length > 0 ? (
        <>
          <SectionHeader
            title={results.data.length === 1 ? '1 person' : `${results.data.length} people`}
          />
          <Card>
            {results.data.map((p) => {
              const name = p.display_name?.trim() || `@${p.handle}`;
              return (
                <PersonRow
                  key={p.id}
                  userId={p.id}
                  name={name}
                  handle={p.handle}
                  avatarPath={p.avatar_path}
                  caption={`@${p.handle}${p.is_private ? ' · Private' : ''}${
                    p.follows_me ? ' · Follows you' : ''
                  }`}
                  onPressName={() => router.push(`/u/${p.handle}`)}
                  right={
                    <FollowButton
                      userId={p.id}
                      name={name}
                      status={p.follow_status}
                      isPrivate={p.is_private}
                      isMutual={p.follow_status === 'active' && p.follows_me}
                      small
                    />
                  }
                />
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeader title="People you know" />
      <Card>
        <Row
          icon="i-users"
          title="Find from your contacts"
          subtitle="Matched on your phone; nothing from your address book is kept."
          accessibilityLabel="Find from your contacts"
          first
          chevron
          onPress={() => router.push('/friends/contacts')}
        />
        <Row
          icon="i-share"
          title="Share an invite"
          subtitle="Send them a link. Once they join, tag them at games or follow each other for rivalries and overlaps."
          accessibilityLabel="Share an invite"
          chevron
          onPress={() => void shareAppLink()}
        />
      </Card>
    </FormScreen>
  );
}
