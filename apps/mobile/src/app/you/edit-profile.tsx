import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { SectionHeader } from '@/components/SectionHeader';
import { TextField } from '@/components/TextField';
import {
  pickAvatarFromLibrary,
  takeAvatarPhoto,
  useRemoveAvatar,
  useSetAvatar,
  type PickedAvatar,
} from '@/features/account/avatar';
import { IdentityCard } from '@/features/account/ui/IdentityCard';
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

  // The photo saves by itself, the moment it is chosen: it is not one of the fields Save sends.
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();
  const [pickError, setPickError] = useState<string | null>(null);
  const avatarPath = profile.avatar_path;
  const avatarBusy = setAvatar.isPending || removeAvatar.isPending;

  const choosePhoto = async (pick: () => Promise<PickedAvatar | null>) => {
    setPickError(null);
    setAvatar.reset();
    removeAvatar.reset();
    try {
      const picked = await pick();
      if (picked) setAvatar.mutate({ picked, oldPath: avatarPath });
    } catch (err) {
      setPickError(errorMessage(err));
    }
  };

  const onPressAvatar = () => {
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose from library', onPress: () => void choosePhoto(pickAvatarFromLibrary) },
      { text: 'Take photo', onPress: () => void choosePhoto(takeAvatarPhoto) },
      ...(avatarPath
        ? [
            {
              text: 'Remove photo',
              style: 'destructive' as const,
              onPress: () => {
                setPickError(null);
                setAvatar.reset();
                removeAvatar.mutate({ oldPath: avatarPath });
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const photoError =
    pickError ??
    (setAvatar.error
      ? `Could not save your photo. ${errorMessage(setAvatar.error)}`
      : removeAvatar.error
        ? `Could not remove your photo. ${errorMessage(removeAvatar.error)}`
        : null);

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
      {photoError ? <Notice tone="error">{photoError}</Notice> : null}
      <IdentityCard
        userId={profile.id}
        name={name}
        handle={normalizeHandle(handle) || profile.handle}
        avatarPath={avatarPath}
        note={city.trim() || null}
        onPressAvatar={onPressAvatar}
        avatarBusy={avatarBusy}
      />
      <SectionHeader title="Profile" />
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
      />
      {/*
        Favourite teams used to be a 62-row checklist right here. They moved to
        Settings > Favorites, which also holds favourite players: they are not profile
        fields, they decide what the passport counts (SPEC.md 5.1).
      */}
      <SectionHeader title="Favorites" />
      <Card>
        <Row
          icon="i-spark"
          title="Open Favorites"
          subtitle="Your teams and players live in Settings, under Favorites."
          chevron
          onPress={() => router.push('/settings/favorites')}
        />
      </Card>
      <View style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
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
