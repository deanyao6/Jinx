import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { FormScreen } from '@/components/FormScreen';
import { Notice } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDeleteAccount, useExportData } from '@/features/account/queries';
import { useTheme } from '@/theme/ThemeProvider';

const CONFIRM_WORD = 'DELETE';

/** Everything the server removes, one line each so none of it hides in a paragraph. */
const REMOVED = [
  'Your profile',
  'Every game you logged, with its seats and companions',
  'Pledges, goals and lists',
  'Ticket imports and images',
  'Notifications',
  'Your Wrapped snapshots',
];

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
      <Notice tone="error" style={{ padding: theme.spacing.lg, borderRadius: theme.radius.lg }}>
        <Text variant="kicker" color="red">
          Permanent
        </Text>
        <Text variant="h2" color="red" style={{ marginTop: 2 }}>
          This cannot be undone
        </Text>
        <Text variant="sub" style={{ marginTop: theme.spacing.sm }}>
          Deleting your account removes:
        </Text>
        <View style={{ marginTop: theme.spacing.sm, gap: 6 }}>
          {REMOVED.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  marginTop: 7,
                  backgroundColor: theme.colors.red,
                }}
              />
              <Text variant="sub" style={{ flex: 1 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="sub" style={{ marginTop: theme.spacing.md }}>
          People you tagged lose you from their companion lists.
        </Text>
      </Notice>
      <Card>
        <Text variant="bodyStrong">Want a copy first?</Text>
        <Text variant="sub" color="muted" style={{ marginTop: 2 }}>
          Export your data as JSON.
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
        <View style={{ marginTop: theme.spacing.sm }}>
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
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
        </View>
      )}
    </FormScreen>
  );
}
