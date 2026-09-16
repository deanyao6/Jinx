import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import {
  useHandleAvailable,
  useProfile,
  useUpdateProfile,
  type Profile,
} from '@/features/profile/queries';
import { normalizeHandle, validateDisplayName, validateHandle } from '@/lib/handle';
import { useTheme } from '@/theme/ThemeProvider';

function EditProfileForm({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateProfile();

  const [handle, setHandle] = useState(profile.handle);
  const [name, setName] = useState(profile.display_name);
  const [city, setCity] = useState(profile.home_city ?? '');

  const handleError = validateHandle(handle);
  const nameError = validateDisplayName(name);
  const changedHandle = normalizeHandle(handle) !== profile.handle;
  const availability = useHandleAvailable(handle, handleError == null && changedHandle);
  const taken = changedHandle && availability.data === false;
  const canSave = !handleError && !nameError && !taken;

  const onSave = async () => {
    if (!canSave) return;
    try {
      const cityChanged = (profile.home_city ?? '') !== city.trim();
      await update.mutateAsync({
        handle: normalizeHandle(handle),
        display_name: name.trim(),
        home_city: city.trim() || null,
        // A changed city drops the old coordinates rather than keeping a stale map pin.
        ...(cityChanged ? { home_lat: null, home_lng: null } : {}),
      });
      router.back();
    } catch {
      // surfaced below
    }
  };

  const error = update.error;
  const errorText = error
    ? (error as { code?: string }).code === '23505'
      ? 'That handle is taken. Try another.'
      : errorMessage(error)
    : null;

  return (
    <FormScreen headerOffset={60}>
      {errorText ? <Notice tone="error">{errorText}</Notice> : null}
      <Card label="Profile">
        <TextField
          label="Handle"
          prefix="@"
          value={handle}
          onChangeText={(t) => setHandle(t.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          error={handle ? (handleError ?? (taken ? 'That handle is taken.' : null)) : null}
        />
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
          error={name ? nameError : null}
        />
        <TextField
          label="Home city"
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
          placeholder="Optional"
          containerStyle={{ marginBottom: 0 }}
        />
      </Card>
      {/*
        Favourite teams used to be a 62-row checklist right here. They moved to
        Settings > Favorites, which also holds favourite players: they are not profile
        fields, they decide what the passport counts (SPEC.md 5.1).
      */}
      <Card label="Favorites">
        <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Your teams and players live in Settings, under Favorites.
        </Text>
        <Button
          title="Open Favorites"
          variant="secondary"
          small
          onPress={() => router.push('/settings/favorites')}
          style={{ alignSelf: 'flex-start' }}
        />
      </Card>
      <View style={{ marginBottom: theme.spacing.xl }}>
        <Button title="Save" onPress={onSave} disabled={!canSave} loading={update.isPending} />
      </View>
    </FormScreen>
  );
}

export default function EditProfileScreen() {
  const profile = useProfile();
  if (!profile.data) return <Loading />;
  return <EditProfileForm profile={profile.data} />;
}
