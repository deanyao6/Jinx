import { Stack } from 'expo-router';
import React from 'react';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { MarkdownLite } from '@/features/legal/MarkdownLite';
import { PRIVACY_MD } from '@/features/legal/text';

export default function PrivacyPolicyScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy policy' }} />
      <Card>
        <MarkdownLite md={PRIVACY_MD} />
      </Card>
    </Screen>
  );
}
