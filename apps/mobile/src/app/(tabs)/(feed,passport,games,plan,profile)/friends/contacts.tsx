import React from 'react';

import { Screen } from '@/components/Screen';
import { ContactsImport } from '@/features/feed/ui/ContactsImport';

/**
 * Contacts import, offered again after onboarding (social brief 02, section 5): from Friends >
 * Find people, and from an empty feed.
 */
export default function ContactsRoute() {
  return (
    <Screen>
      <ContactsImport />
    </Screen>
  );
}
