import React from 'react';

import { ICONS } from '@/components/reference/icons';
import { useTheme } from '@/theme/ThemeProvider';

/** The small gold mark beside a famous game's title in a list row. */
export function FamousMark({ size = 13, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const Spark = ICONS['i-spark'];
  return <Spark size={size} color={color ?? theme.colors.gold} />;
}
