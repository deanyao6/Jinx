import { Stack } from 'expo-router';
import React, { useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { FormScreen } from '@/components/FormScreen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDeleteAccount, useExportData } from '@/features/account/queries';
import { useTheme } from '@/theme/ThemeProvider';

const CONFIRM_WORD = 'DELETE';

/**
 * Two-step account deletion (SPEC.md 9, 11): confirm intent, then type DELETE. Everything, including
 * ticket images and imports, is removed server-side; the root layout returns to sign-in afterwards.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const remove = useDeleteAccount();
  const exportData = useExportData();
  const ready = typed.trim() === CONFIRM_WORD;

  return (
    <FormScreen headerOffset={60}>
      <Stack.Screen options={{ title: 'Delete account' }} />
      {remove.isError ? <ErrorNotice error={remove.error} /> : null}
      {exportData.isError ? <ErrorNotice error={exportData.error} /> : null}
      <Card>
        <Text variant="h2">This cannot be undone</Text>
        <Text color="muted" style={{ marginTop: theme.spacing.sm }}>
          Deleting your account removes your profile, every game you logged, seats, companions,
          pledges, goals, lists, ticket imports and images, notifications, and your Wrapped
          snapshots. People you tagged lose you from their companion lists.
        </Text>
        <Text color="muted" style={{ marginTop: theme.spacing.sm }}>
          Want a copy first? Export your data as JSON.
        </Text>
        <Button
          title="Export my data"
          variant="secondary"
          small
          loading={exportData.isPending}
          onPress={() => exportData.mutate()}
          style={{ alignSelf: 'flex-start', marginTop: theme.spacing.md }}
        />
      </Card>
      {step === 1 ? (
        <Button title="I understand, continue" variant="danger" onPress={() => setStep(2)} />
      ) : (
        <Card label={`Type ${CONFIRM_WORD} to confirm`}>
          <TextField
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={CONFIRM_WORD}
            accessibilityLabel="Confirmation word"
          />
          <Button
            title="Delete my account"
            variant="danger"
            disabled={!ready}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
        </Card>
      )}
    </FormScreen>
  );
}
