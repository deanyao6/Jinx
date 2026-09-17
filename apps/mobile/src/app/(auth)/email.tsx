import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice, errorMessage } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import { TextField } from '@/components/TextField';
import { isValidEmail, sendEmailCode } from '@/features/auth/email';
import { BackLink } from '@/features/onboarding/ui/BackLink';
import { useTheme } from '@/theme/ThemeProvider';

export default function EmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidEmail(email);

  const onSend = async () => {
    setError(null);
    setBusy(true);
    try {
      await sendEmailCode(email);
      router.push({ pathname: '/(auth)/code', params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <BackLink onPress={() => router.back()} />
      <PageIntro
        kicker="Sign in"
        title="Your email"
        body="We will send a 6-digit code. No password needed."
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={valid ? onSend : undefined}
        placeholder="you@example.com"
      />
      <View style={{ marginTop: theme.spacing.sm }}>
        <Button title="Send code" onPress={onSend} disabled={!valid} loading={busy} />
      </View>
    </FormScreen>
  );
}
