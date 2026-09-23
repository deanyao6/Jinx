import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorNotice } from '@/components/ErrorNotice';
import { FormScreen } from '@/components/FormScreen';
import { IconTile } from '@/components/IconTile';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { IconCheckC, IconClock } from '@/components/reference/icons';
import { Row } from '@/components/Row';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAuthStore } from '@/features/auth/store';
import {
  forwardingAddress,
  isPlausibleEmail,
  useAddUserEmail,
  useRemoveUserEmail,
  useRotateInboundToken,
  useUserEmails,
} from '@/features/imports/forwarding';
import { useInboundAddress } from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

export default function ForwardingScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const session = useAuthStore((s) => s.session);
  const inbound = useInboundAddress();
  const rotate = useRotateInboundToken();
  const emails = useUserEmails();
  const add = useAddUserEmail();
  const remove = useRemoveUserEmail();
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');

  const address = forwardingAddress(inbound.data);
  const signInEmail = session?.user.email ?? null;

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onRotate = () => {
    Alert.alert(
      'Get a new address?',
      'The old address stops working right away. Anything already forwarded to it is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New address', style: 'destructive', onPress: () => rotate.mutate() },
      ],
    );
  };

  const onAdd = async () => {
    try {
      await add.mutateAsync(draft);
      setDraft('');
    } catch {
      // surfaced through add.error
    }
  };

  // The sign-in address has its own row, so it is left out of the list below it.
  const others = (emails.data ?? []).filter((e) => e.email !== signInEmail?.toLowerCase());

  const onRemove = (email: string) => {
    Alert.alert('Remove this address?', `Mail from ${email} will be ignored.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(email) },
    ]);
  };

  return (
    <FormScreen headerOffset={90}>
      <Stack.Screen options={{ title: 'Forwarding address' }} />
      <Card tone="accent">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="i-ticket" solid />
          <View style={{ flex: 1 }}>
            <Text variant="kicker" color="accent">
              Your forwarding address
            </Text>
            {address ? (
              <Text variant="bodyStrong" selectable style={{ fontVariant: ['tabular-nums'] }}>
                {address}
              </Text>
            ) : inbound.data === null ? (
              <Text variant="sub" color="muted">
                No address yet. Tap New address to create one.
              </Text>
            ) : null}
          </View>
        </View>
        {inbound.isPending ? <Loading /> : null}
        {inbound.isError ? (
          <ErrorNotice
            error={inbound.error}
            message="Could not load your address."
            onRetry={inbound.refetch}
            style={{ marginTop: theme.spacing.md, marginBottom: 0 }}
          />
        ) : null}
        {rotate.error ? (
          <Notice tone="error" style={{ marginTop: theme.spacing.md, marginBottom: 0 }}>
            {errorMessage(rotate.error)}
          </Notice>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Button
            title={copied ? 'Copied' : 'Copy address'}
            small
            onPress={copy}
            disabled={!address}
          />
          <Button
            title="New address"
            variant="ghost"
            small
            onPress={inbound.data === null ? () => rotate.mutate() : onRotate}
            loading={rotate.isPending}
          />
        </View>
      </Card>
      <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Forward ticket confirmations from any site (Ticketmaster, SeatGeek, StubHub, TickPick, team
        sites) to this address. Upcoming games are marked Going and past games are logged.
      </Text>

      <SectionHeader title="Addresses you can forward from" />
      <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.md }}>
        Mail is only accepted from these senders. Your sign-in email always works.
      </Text>
      {signInEmail || emails.isPending || others.length ? (
        <Card>
          {signInEmail ? (
            <Row
              title={signInEmail}
              subtitle="Sign-in email"
              right={<IconCheckC size={20} color={c.green} />}
            />
          ) : null}
          {emails.isPending ? <Loading /> : null}
          {others.map((e) => (
            <Row
              key={e.email}
              title={e.email}
              subtitle={e.verified ? 'Verified' : 'Waiting for a first email from this address'}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {e.verified ? (
                    <IconCheckC size={20} color={c.green} />
                  ) : (
                    <IconClock size={20} color={c.muted} />
                  )}
                  <Button title="Remove" variant="ghost" small onPress={() => onRemove(e.email)} />
                </View>
              }
            />
          ))}
        </Card>
      ) : null}
      {remove.error ? <Notice tone="error">{errorMessage(remove.error)}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
        <TextField
          placeholder="name@example.com"
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          containerStyle={{ flex: 1, marginBottom: 0 }}
          returnKeyType="done"
          onSubmitEditing={onAdd}
          accessibilityLabel="Email address to add"
          error={add.error ? errorMessage(add.error) : null}
        />
        <Button
          title="Add"
          variant="secondary"
          onPress={onAdd}
          disabled={!isPlausibleEmail(draft)}
          loading={add.isPending}
        />
      </View>
      <Text variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
        Send any email from this address to your forwarding address and we&apos;ll verify it.
      </Text>
    </FormScreen>
  );
}
