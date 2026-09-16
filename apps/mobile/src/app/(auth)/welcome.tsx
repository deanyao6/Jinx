import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { isAppleSignInAvailable, signInWithApple } from '@/features/auth/apple';
import { useTheme } from '@/theme/ThemeProvider';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const onApple = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithApple();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="display">Jinx</Text>
        <Text variant="h2" style={{ marginTop: theme.spacing.md }}>
          A passport for every game you attend.
        </Text>
        <Text color="muted" style={{ marginTop: theme.spacing.sm }}>
          Log the games you have been to, keep your record, and collect stadium stamps.
        </Text>
      </View>
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              theme.scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={theme.radius.md}
            style={{ height: 48, opacity: busy ? 0.5 : 1 }}
            onPress={onApple}
          />
        ) : null}
        <Button
          title="Continue with email"
          variant={appleAvailable ? 'secondary' : 'primary'}
          onPress={() => router.push('/(auth)/email')}
          disabled={busy}
        />
        <Text variant="caption" color="muted" align="center">
          You must be 13 or older to use Jinx.
        </Text>
      </View>
    </Screen>
  );
}
