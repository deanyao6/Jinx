import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';

import { errorMessage } from '@/components/Notice';
import { isAppleSignInAvailable, signInWithApple } from '@/features/auth/apple';
import { signInWithTokenHash } from '@/features/auth/email';
import { WelcomeActions } from '@/features/onboarding/ui/WelcomeActions';
import { WelcomeArt } from '@/features/onboarding/ui/WelcomeArt';
import { env, features } from '@/lib/env';

/**
 * The first screen (SPEC.md 8.8): the wall of Jinx objects behind the pitch, Sign in with
 * Apple, and "Continue with email" when the build offers it. `design/welcome-reference.html`
 * is what it looks like; `features/onboarding/ui/WelcomeArt.tsx` draws it.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // Development only: `jinx:///welcome?token_hash=<hashed magic-link token>` signs in without
  // typing, because the simulator cannot be typed into by a script (STATE.md trap 9). The hash
  // comes from local GoTrue's generate_link. A production build ignores the parameter.
  const { token_hash: tokenHash } = useLocalSearchParams<{ token_hash?: string }>();
  useEffect(() => {
    if (!__DEV__ || !tokenHash) return;
    signInWithTokenHash(tokenHash).catch((e) => setError(errorMessage(e)));
  }, [tokenHash]);

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
    <>
      {/* The screen is dark in both appearances, so the status bar is always light here. */}
      <StatusBar style="light" />
      <WelcomeArt frozen={env.welcomeFrozen}>
        <WelcomeActions
          apple={appleAvailable}
          email={features.emailSignIn}
          busy={busy}
          error={error}
          onApple={() => void onApple()}
          onEmail={() => router.push('/(auth)/email')}
        />
      </WelcomeArt>
    </>
  );
}
