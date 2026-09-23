import { useRouter } from 'expo-router';
import React from 'react';

import { FormScreen } from '@/components/FormScreen';
import { ContactsImport } from '@/features/feed/ui/ContactsImport';
import { StepIntro } from '@/features/onboarding/ui/StepIntro';

/**
 * Onboarding step 2 (social brief 02, section 5): find people you know, right after the
 * handle, because friends are what make the feed worth opening. What we do with contacts is on
 * screen before the system prompt fires, and "Not now" skips it. Friends offers it again.
 */
export default function ContactsStep() {
  const router = useRouter();
  const next = () => router.push('/(onboarding)/teams');
  return (
    <FormScreen>
      <StepIntro step={2} title="Your people" onBack={() => router.back()} />
      <ContactsImport onDone={next} />
    </FormScreen>
  );
}
