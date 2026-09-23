import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Notice, errorMessage } from '@/components/Notice';
import { IconChevR, type IconName } from '@/components/reference/icons';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useNavStore } from '@/features/nav/store';
import { StepIntro } from '@/features/onboarding/ui/StepIntro';
import { useInboundAddress, useUpdateProfile } from '@/features/profile/queries';
import { env, features } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

export default function PastGamesStep() {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateProfile();
  const inbound = useInboundAddress();
  const setPendingRoute = useNavStore((s) => s.setPendingRoute);
  const [copied, setCopied] = useState(false);

  const address = inbound.data ? `u-${inbound.data}@${env.inboundEmailDomain}` : null;

  const finish = async (next: string | null) => {
    try {
      if (next) setPendingRoute(next);
      await update.mutateAsync({ onboarded_at: new Date().toISOString() });
      // The root guard flips to the signed-in stack and opens `next` if set.
    } catch {
      setPendingRoute(null);
    }
  };

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
  };

  return (
    <Screen>
      <StepIntro
        step={6}
        title="Add past games"
        // Forwarding is switched off until there is an inbound domain, and then there are two.
        body={`${features.forwarding ? 'Three' : 'Two'} ways to fill your passport. You can do this any time from the Games tab.`}
        onBack={() => router.back()}
      />
      {update.error ? <Notice tone="error">{errorMessage(update.error)}</Notice> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => finish('/games?segment=log')}
        disabled={update.isPending}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <WayCard
          icon="i-search"
          lead
          title="Search now"
          body="Find games by team, date, or season and log them one by one or a whole season at once."
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => finish('/games/import')}
        disabled={update.isPending}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <WayCard
          icon="i-ticket"
          title="Upload tickets"
          body="Screenshots and PDFs of tickets. We read them, find the game, and you confirm."
        />
      </Pressable>

      {features.forwarding ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon="i-ext" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color="muted">
                Forwarding address
              </Text>
              <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
                Forward ticket emails here and we will log the game. Manage sender addresses in the
                You tab.
              </Text>
            </View>
          </View>
          {address ? (
            <View style={{ marginTop: theme.spacing.md }}>
              <Text variant="bodyStrong" selectable style={{ fontVariant: ['tabular-nums'] }}>
                {address}
              </Text>
              <Button
                title={copied ? 'Copied' : 'Copy address'}
                variant="secondary"
                small
                onPress={copy}
                style={{ alignSelf: 'flex-start', marginTop: theme.spacing.sm }}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      <View style={{ marginTop: theme.spacing.md }}>
        <Button title="Finish" onPress={() => finish(null)} loading={update.isPending} />
      </View>
    </Screen>
  );
}

/**
 * One way to add games: an icon tile, a title, a line of help and a chevron. `lead` washes the
 * card in the accent and fills its tile, for the way most people should start with.
 */
function WayCard({
  icon,
  title,
  body,
  lead = false,
}: {
  icon: IconName;
  title: string;
  body: string;
  lead?: boolean;
}) {
  const theme = useTheme();
  return (
    <Card tone={lead ? 'accent' : 'plain'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={icon} solid={lead} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" color="muted" style={{ marginTop: 1 }}>
            {body}
          </Text>
        </View>
        <IconChevR size={16} color={lead ? theme.accent.text : theme.colors.muted} />
      </View>
    </Card>
  );
}
