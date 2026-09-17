import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice, errorMessage } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useNavStore } from '@/features/nav/store';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useInboundAddress, useUpdateProfile } from '@/features/profile/queries';
import { env, features } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

export default function PastGamesStep() {
  const theme = useTheme();
  const c = theme.colors;
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
      <Button
        title="Back"
        variant="ghost"
        small
        onPress={() => router.back()}
        style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.md }}
      />
      <StepHeader
        step={5}
        title="Add past games"
        subtitle="Three ways to fill your passport. You can do this any time from the Games tab."
      />
      {update.error ? <Notice tone="error">{errorMessage(update.error)}</Notice> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => finish('/(tabs)/games?segment=log')}
        disabled={update.isPending}
      >
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="search" size={22} color={c.ink} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Search now</Text>
              <Text variant="caption" color="muted">
                Find games by team, date, or season and log them one by one or a whole season at
                once.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </View>
        </Card>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => finish('/games/import')}
        disabled={update.isPending}
      >
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="image" size={22} color={c.ink} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Upload tickets</Text>
              <Text variant="caption" color="muted">
                Screenshots and PDFs of tickets. We read them, find the game, and you confirm.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </View>
        </Card>
      </Pressable>

      {features.forwarding ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="mail" size={22} color={c.muted} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color="muted">
                Forwarding address
              </Text>
              <Text variant="caption" color="muted">
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
