import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Linking } from 'react-native';

import { Card } from '@/components/Card';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { LegalText } from '@/features/account/ui/LegalText';
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
      <Card tone="accent">
        <Text variant="kicker" color="accent">
          A passport for sports fans
        </Text>
        <Text
          variant="display"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ marginTop: theme.spacing.xs }}
        >
          {APP_NAME}
        </Text>
        <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.xs }}>
          {appVersionLine()}
        </Text>
      </Card>

      <SectionHeader title="Legal" />
      <Card>
        <Row icon="i-book" title="Terms of use" chevron onPress={() => router.push('/you/terms')} />
        <Row
          icon="i-lock"
          title="Privacy policy"
          chevron
          onPress={() => router.push('/you/privacy-policy')}
        />
      </Card>

      <SectionHeader title="Contact" />
      <Card>
        <Row
          icon="i-ext"
          title="Email support"
          subtitle={SUPPORT_EMAIL}
          chevron
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`)}
        />
      </Card>
      <Text variant="caption" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Reports are reviewed within 24 hours. You can report or block anyone from the menu on their
        profile.
      </Text>

      <SectionHeader title="Data attributions" />
      <LegalText md={ATTRIBUTION_MD} />
    </Screen>
  );
}
