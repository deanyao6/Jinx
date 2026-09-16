import { StyleSheet } from 'react-native';

import { screenPadding } from '@/theme/reference/tokens';

/**
 * The frame every Favourites screen uses, so the four of them line up exactly as you drill
 * through them. The background colour is applied by the screen, which has the theme.
 */
export const screen = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: screenPadding.horizontal },
});
