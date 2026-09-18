import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export const ONBOARDING_STEPS = 6;

type Props = { step: number; title: string; subtitle?: string };

export function StepHeader({ step, title, subtitle }: Props) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Text variant="label" color="muted" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
        Step {step} of {ONBOARDING_STEPS}
      </Text>
      <Text variant="h1">{title}</Text>
      {subtitle ? (
        <Text color="muted" style={{ marginTop: theme.spacing.sm }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
