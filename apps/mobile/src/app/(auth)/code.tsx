import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { sendEmailCode, verifyEmailCode } from '@/features/auth/email';
import { useTheme } from '@/theme/ThemeProvider';

export default function CodeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = code.replace(/\D/g, '');
  const valid = digits.length === 6;

  const onVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyEmailCode(email, digits);
      // The auth listener flips the root guard; nothing to navigate here.
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      await sendEmailCode(email);
      setResent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <FormScreen>
      <Button
        title="Back"
        variant="ghost"
        small
        onPress={() => router.back()}
        style={{ alignSelf: 'flex-start' }}
      />
      <Text variant="h1" style={{ marginTop: theme.spacing.lg }}>
        Check your email
      </Text>
      <Text color="muted" style={{ marginBottom: theme.spacing.lg }}>
        Enter the 6-digit code we sent to {email}.
      </Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {resent ? <Notice tone="success">Sent a new code.</Notice> : null}
      <TextField
        label="Code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        placeholder="123456"
        style={{ fontSize: 28, fontWeight: '800', letterSpacing: 6 }}
        onSubmitEditing={valid ? onVerify : undefined}
      />
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Button title="Sign in" onPress={onVerify} disabled={!valid} loading={busy} />
        <Button title="Resend code" variant="ghost" onPress={onResend} disabled={busy} />
      </View>
    </FormScreen>
  );
}
