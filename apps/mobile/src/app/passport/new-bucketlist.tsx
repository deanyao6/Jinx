import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow } from '@/components/CheckRow';
import { Chip } from '@/components/Chip';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import {
  useCreateBucketList,
  useSearchVenues,
  type VenueHit,
} from '@/features/bucketlists/queries';
import { useDebounced } from '@/features/games/ui/useDebounced';
import { useTheme } from '@/theme/ThemeProvider';

export default function NewBucketListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const create = useCreateBucketList();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const hits = useSearchVenues(debounced);
  const [picked, setPicked] = useState<VenueHit[]>([]);
  const pickedIds = new Set(picked.map((v) => v.id));

  const toggle = (v: VenueHit) => {
    setPicked((cur) =>
      cur.some((p) => p.id === v.id) ? cur.filter((p) => p.id !== v.id) : [...cur, v],
    );
  };

  const canSave = title.trim().length >= 2 && picked.length >= 1;

  return (
    <FormScreen>
      {create.isError ? <Notice tone="error">{errorMessage(create.error)}</Notice> : null}
      <TextField
        label="Title"
        placeholder="Every park on the East Coast"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
      />
      <TextField
        label="Description"
        placeholder="Optional"
        value={description}
        onChangeText={setDescription}
        maxLength={200}
      />
      <TextField
        label="Venues"
        placeholder="Search stadiums"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        hint={picked.length ? `${picked.length} picked` : 'Pick at least one venue.'}
      />
      {picked.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
          {picked.map((v) => (
            <Chip key={v.id} label={v.name} selected onPress={() => toggle(v)} />
          ))}
        </View>
      ) : null}
      {hits.isFetching ? <Loading /> : null}
      {hits.data && hits.data.length > 0 ? (
        <Card label="Results">
          {hits.data.map((v, i) => (
            <CheckRow
              key={v.id}
              first={i === 0}
              title={v.name}
              subtitle={[v.city, v.state].filter(Boolean).join(', ')}
              trailing={v.closed_year ? `Closed ${v.closed_year}` : null}
              checked={pickedIds.has(v.id)}
              onToggle={() => toggle(v)}
            />
          ))}
        </Card>
      ) : null}
      {hits.data && hits.data.length === 0 ? (
        <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
          No venues match “{debounced.trim()}”.
        </Text>
      ) : null}
      <Button
        title="Create list"
        disabled={!canSave}
        loading={create.isPending}
        onPress={() =>
          create.mutate(
            { title, description: description || null, venueIds: picked.map((v) => v.id) },
            { onSuccess: () => router.back() },
          )
        }
      />
    </FormScreen>
  );
}
