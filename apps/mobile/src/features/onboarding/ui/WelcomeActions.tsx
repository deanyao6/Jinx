import * as AppleAuthentication from 'expo-apple-authentication';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { fontFamily } from '@/theme/fonts';

import { WALL } from './wall';

/** `.cta`: 47px tall (15px padding round a 15.5px line), 14px corners, white. */
export const CTA_HEIGHT = 47;
export const CTA_RADIUS = 14;

/**
 * The buttons on the welcome screen. Apple's own Sign in with Apple button, white with the
 * reference's corner radius, stands where the reference's placeholder `.cta` is; "Continue
 * with email" sits under it as a secondary button when the build offers it (the reference
 * predates email sign-in). Both are styled for the dark screen directly rather than through
 * the app theme, because this screen is dark whatever the appearance.
 */
export function WelcomeActions({
  apple,
  email,
  busy,
  error,
  onApple,
  onEmail,
}: {
  apple: boolean;
  email: boolean;
  busy: boolean;
  error: string | null;
  onApple: () => void;
  onEmail: () => void;
}) {
  return (
    <View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: fontFamily({ width: 100, weight: 400 }),
            fontSize: 12.5,
            lineHeight: 17,
            color: WALL.bad,
            marginBottom: 10,
          }}
        >
          {error}
        </Text>
      ) : null}
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={CTA_RADIUS}
          style={{ height: CTA_HEIGHT, width: '100%', opacity: busy ? 0.5 : 1 }}
          onPress={onApple}
        />
      ) : null}
      {email ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onEmail}
          testID="welcome-email"
          style={({ pressed }) => ({
            height: CTA_HEIGHT,
            borderRadius: CTA_RADIUS,
            marginTop: apple ? 10 : 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: apple
              ? pressed
                ? 'rgba(255,255,255,0.18)'
                : 'rgba(255,255,255,0.12)'
              : pressed
                ? 'rgba(255,255,255,0.85)'
                : WALL.white,
            opacity: busy ? 0.5 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: fontFamily({ width: 100, weight: 800 }),
              fontSize: 15.5,
              color: apple ? WALL.white : WALL.onCta,
            }}
          >
            Continue with email
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
