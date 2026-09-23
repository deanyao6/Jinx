import { Stack } from 'expo-router';
import React from 'react';

import { Screen } from '@/components/Screen';
import { LegalText } from '@/features/account/ui/LegalText';
import { PRIVACY_MD } from '@/features/legal/text';

export default function PrivacyPolicyScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy policy' }} />
      <LegalText md={PRIVACY_MD} />
    </Screen>
  );
}
