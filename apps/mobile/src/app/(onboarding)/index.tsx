import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { useAuth, useSignOut } from '@/features/auth/hooks';
import { StepIntro } from '@/features/onboarding/ui/StepIntro';
import {
  useHandleAvailable,
  useProfile,
  useUpdateProfile,
  type Profile,
} from '@/features/profile/queries';
import {
  isPlaceholderHandle,
  normalizeHandle,
  validateDisplayName,
  validateHandle,
} from '@/lib/handle';
import { useTheme } from '@/theme/ThemeProvider';

function HandleForm({ profile, metaName }: { profile: Profile; metaName: string }) {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateProfile();
  const signOut = useSignOut();
  const [handle, setHandle] = useState(isPlaceholderHandle(profile.handle) ? '' : profile.handle);
  const [name, setName] = useState(profile.display_name || metaName);
  const [touched, setTouched] = useState(false);

  const handleError = validateHandle(handle);
  const nameError = validateDisplayName(name);
  const availability = useHandleAvailable(handle, handleError == null);
  const taken = availability.data === false && normalizeHandle(handle) !== profile.handle;
  const canContinue = !handleError && !nameError && !taken && !availability.isFetching;

  const onNext = async () => {
    setTouched(true);
    if (!canContinue) return;
    try {
      await update.mutateAsync({ handle: normalizeHandle(handle), display_name: name.trim() });
      router.push('/(onboarding)/contacts');
    } catch {
      // error surfaced below
    }
  };

  const mutationError = update.error
    ? (update.error as { code?: string }).code === '23505'
      ? 'That handle is taken. Try another.'
      : errorMessage(update.error)
    : null;

  return (
    <FormScreen>
      <StepIntro
        step={1}
        title="Pick a handle"
        body="Friends find you by handle. Your name shows on your passport."
      />
      {mutationError ? <Notice tone="error">{mutationError}</Notice> : null}
      <TextField
        label="Handle"
        prefix="@"
        value={handle}
        onChangeText={(t) => setHandle(t.toLowerCase())}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={20}
        placeholder="phils_fan"
        error={
          touched || handle.length >= 3
            ? (handleError ?? (taken ? 'That handle is taken. Try another.' : null))
            : null
        }
        hint={
          !handleError && availability.data === true
            ? 'Available'
            : 'Letters, numbers, underscores. 3 to 20 characters.'
        }
      />
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={40}
        placeholder="Dean"
        error={touched ? nameError : null}
      />
      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          title="Continue"
          onPress={onNext}
          loading={update.isPending}
          disabled={!canContinue}
        />
        <Button title="Use a different email" variant="ghost" onPress={signOut} />
      </View>
    </FormScreen>
  );
}

export default function HandleStep() {
  const { session } = useAuth();
  const profile = useProfile();
  if (!profile.data) return <Loading />;
  const metaName =
    (session?.user.user_metadata as { full_name?: string } | undefined)?.full_name ?? '';
  return <HandleForm profile={profile.data} metaName={metaName} />;
}
