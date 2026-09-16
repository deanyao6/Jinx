import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Linking } from 'react-native';

import { Card } from '@/components/Card';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { MarkdownLite } from '@/features/legal/MarkdownLite';
import { ATTRIBUTION_MD } from '@/features/legal/text';
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/app';
import { useTheme } from '@/theme/ThemeProvider';

export function appVersionLine(): string {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = Constants.nativeBuildVersion;
  return build ? `Version ${version} (${build})` : `Version ${version}`;
}

/** About: version, data attributions, terms, privacy policy, and a way to reach us (SPEC.md 11). */
export default function AboutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const subject = encodeURIComponent(`${APP_NAME} support (${appVersionLine()})`);
  return (
    <Screen>
      <Stack.Screen options={{ title: 'About' }} />
      <Card>
        <Text variant="h2">{APP_NAME}</Text>
        <Text variant="sub" color="muted">
          A passport for sports fans. {appVersionLine()}
        </Text>
      </Card>
      <Card label="Data attributions">
        <MarkdownLite md={ATTRIBUTION_MD} />
      </Card>
      <Card label="Legal">
        <Row title="Terms of use" chevron first onPress={() => router.push('/you/terms')} />
        <Row title="Privacy policy" chevron onPress={() => router.push('/you/privacy-policy')} />
      </Card>
      <Card label="Contact">
        <Row
          title="Email support"
          subtitle={SUPPORT_EMAIL}
          chevron
          first
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`)}
        />
      </Card>
      <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Reports are reviewed within 24 hours. You can report or block anyone from the menu on their
        profile.
      </Text>
    </Screen>
  );
}
