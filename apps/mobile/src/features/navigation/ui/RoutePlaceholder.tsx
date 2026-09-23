import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import type { IconName } from '@/components/reference/icons';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * What a route shows before its feature lands. Prompt 1 of the social work ships routes and
 * tables only (docs/prompts/social/01, section 6): every new path resolves, deep links included,
 * and says plainly that it is not built yet rather than faking content. Prompts 2 to 4 replace
 * these one by one.
 */
export function RoutePlaceholder({
  icon,
  title,
  body,
  links = [],
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  /** Ways onward, so no placeholder is a dead end. */
  links?: readonly { label: string; href: Href }[];
  /** Anything that sits above the empty state, such as a segment control. */
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Screen>
      {children}
      <EmptyState icon={icon} title={title} body={body} />
      {links.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          {links.map((link) => (
            <Button
              key={link.label}
              title={link.label}
              variant="secondary"
              onPress={() => router.push(link.href)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
