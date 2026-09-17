import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Notice, errorMessage } from '@/components/Notice';
import { PageIntro } from '@/components/PageIntro';
import { TextField } from '@/components/TextField';
import { sendEmailCode, verifyEmailCode } from '@/features/auth/email';
import { BackLink } from '@/features/onboarding/ui/BackLink';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/** The space between the six digits. Also the left padding that keeps them optically centred. */
const CODE_SPACING = 12;

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
      <BackLink onPress={() => router.back()} />
      <PageIntro
        kicker="Sign in"
        title="Check your email"
        body={`Enter the 6-digit code we sent to ${email}.`}
      />
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
        // The condensed heavy cut the app sets every number in. The family carries the weight, so
        // no `fontWeight`: iOS would fake a second bolding on top. Letter spacing trails the last
        // digit too, so the same amount on the left puts the group back in the middle.
        style={{
          fontFamily: fontFamily({ width: 62, weight: 900 }),
          fontSize: 44,
          letterSpacing: CODE_SPACING,
          textAlign: 'center',
          paddingLeft: CODE_SPACING,
          minHeight: 76,
        }}
        onSubmitEditing={valid ? onVerify : undefined}
      />
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Button title="Sign in" onPress={onVerify} disabled={!valid} loading={busy} />
        <Button title="Resend code" variant="ghost" onPress={onResend} disabled={busy} />
      </View>
    </FormScreen>
  );
}
