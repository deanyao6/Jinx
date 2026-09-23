import { useRouter, type Href } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { showToast } from '@/features/navigation/toast';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A link to a path that does not exist, or no longer does, lands on the Passport with a toast
 * rather than an error screen (docs/prompts/social/01, section 2). A path the signed-in guard
 * hides while signed out is a different case: the root layout sends that to the welcome screen.
 *
 * The replace waits a frame: a `<Redirect>` fired while the native stack was still presenting
 * this screen and left a blank page on the simulator.
 */
export default function NotFound() {
  const router = useRouter();
  const theme = useTheme();
  useEffect(() => {
    showToast('That link does not go anywhere yet');
    const t = setTimeout(() => router.replace('/(tabs)/(passport)' as Href), 0);
    return () => clearTimeout(t);
  }, [router]);
  return <View style={{ flex: 1, backgroundColor: theme.colors.screen }} />;
}
