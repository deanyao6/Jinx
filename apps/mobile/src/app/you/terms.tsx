import { Stack } from 'expo-router';
import React from 'react';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { MarkdownLite } from '@/features/legal/MarkdownLite';
import { TERMS_MD } from '@/features/legal/text';

export default function TermsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Terms of use' }} />
      <Card>
        <MarkdownLite md={TERMS_MD} />
      </Card>
    </Screen>
  );
}
