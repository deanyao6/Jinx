import { Stack } from 'expo-router';
import React from 'react';

import { Screen } from '@/components/Screen';
import { LegalText } from '@/features/account/ui/LegalText';
import { TERMS_MD } from '@/features/legal/text';

export default function TermsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Terms of use' }} />
      <LegalText md={TERMS_MD} />
    </Screen>
  );
}
