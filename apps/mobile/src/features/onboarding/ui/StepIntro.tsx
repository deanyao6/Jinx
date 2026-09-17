import React from 'react';
import { View } from 'react-native';

import { PageIntro } from '@/components/PageIntro';
import { alpha } from '@/theme/color';
import { useTheme } from '@/theme/ThemeProvider';

import { ONBOARDING_STEPS } from '../StepHeader';
import { BackLink } from './BackLink';

type Props = {
  step: number;
  title: string;
  body?: string;
  /** Omitted on the first step, which has nowhere to go back to. */
  onBack?: () => void;
};

/**
 * The top of an onboarding step: Back, a pill per step with the ones reached filled in the
 * accent, then the page intro with "Step 2 of 5" as its kicker. The accent is ink until the
 * teams step saves a favourite, and that team's colour from then on.
 */
export function StepIntro({ step, title, body, onBack }: Props) {
  const theme = useTheme();
  const reached = theme.accent.themed ? theme.accent.text : theme.accent.fill;
  const ahead = alpha(theme.colors.ink, theme.scheme === 'dark' ? 0.14 : 0.1);
  return (
    <View>
      {onBack ? <BackLink onPress={onBack} /> : null}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${ONBOARDING_STEPS}`}
        accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}
        style={{
          flexDirection: 'row',
          gap: 6,
          marginTop: onBack ? 0 : theme.spacing.sm,
          marginBottom: theme.spacing.lg,
        }}
      >
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < step ? reached : ahead,
            }}
          />
        ))}
      </View>
      <PageIntro kicker={`Step ${step} of ${ONBOARDING_STEPS}`} title={title} body={body} />
    </View>
  );
}
