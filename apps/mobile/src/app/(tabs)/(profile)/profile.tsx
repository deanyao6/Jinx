import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { ProfileScreen } from '@/features/profile/reference/ProfileScreen';

/** `?panel=friends` opens with the Friends panel out, which is how Settings reaches it. */
export default function ProfileTab() {
  const { panel } = useLocalSearchParams<{ panel?: string }>();
  return (
    <ProfileScreen
      key={panel ?? 'none'}
      initialPanel={panel === 'friends' ? 'friends' : undefined}
    />
  );
}
