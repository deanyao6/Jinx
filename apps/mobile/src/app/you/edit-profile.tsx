import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { TeamPicker } from '@/components/TeamPicker';
import { TextField } from '@/components/TextField';
import {
  useFavoriteTeams,
  useHandleAvailable,
  useProfile,
  useSetFavoriteTeams,
  useUpdateProfile,
  type Profile,
} from '@/features/profile/queries';
import type { Team } from '@/features/teams/queries';
import { normalizeHandle, validateDisplayName, validateHandle } from '@/lib/handle';
import { useTheme } from '@/theme/ThemeProvider';

function EditProfileForm({ profile, favorites }: { profile: Profile; favorites: Team[] }) {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateProfile();
  const setFavorites = useSetFavoriteTeams();

  const [handle, setHandle] = useState(profile.handle);
  const [name, setName] = useState(profile.display_name);
  const [city, setCity] = useState(profile.home_city ?? '');
  const [teams, setTeams] = useState<Team[]>(favorites);

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
      await setFavorites.mutateAsync(teams);
      router.back();
    } catch {
      // surfaced below
    }
  };

  const error = update.error ?? setFavorites.error;
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
      <Card label="Favorite teams">
        <TeamPicker selected={teams} onChange={setTeams} />
      </Card>
      <View style={{ marginBottom: theme.spacing.xl }}>
        <Button
          title="Save"
          onPress={onSave}
          disabled={!canSave}
          loading={update.isPending || setFavorites.isPending}
        />
      </View>
    </FormScreen>
  );
}

export default function EditProfileScreen() {
  const profile = useProfile();
  const favorites = useFavoriteTeams();
  if (!profile.data || !favorites.data) return <Loading />;
  return <EditProfileForm profile={profile.data} favorites={favorites.data} />;
}
