import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
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

  const onRemove = (email: string) => {
    Alert.alert('Remove this address?', `Mail from ${email} will be ignored.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(email) },
    ]);
  };

  return (
    <FormScreen headerOffset={90}>
      <Stack.Screen options={{ title: 'Forwarding address' }} />
      <Card label="Your forwarding address">
        <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Forward ticket confirmations from any site (Ticketmaster, SeatGeek, StubHub, TickPick,
          team sites) to this address. Upcoming games are marked Going and past games are logged.
        </Text>
        {inbound.isPending ? <Loading /> : null}
        {inbound.isError ? (
          <ErrorNotice
            error={inbound.error}
            message="Could not load your address."
            onRetry={inbound.refetch}
          />
        ) : null}
        {address ? (
          <Text variant="bodyStrong" selectable style={{ fontVariant: ['tabular-nums'] }}>
            {address}
          </Text>
        ) : inbound.data === null ? (
          <Text variant="sub" color="muted">
            No address yet. Tap New address to create one.
          </Text>
        ) : null}
        {rotate.error ? (
          <Notice tone="error" style={{ marginTop: theme.spacing.sm }}>
            {errorMessage(rotate.error)}
          </Notice>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <Button
            title={copied ? 'Copied' : 'Copy address'}
            variant="secondary"
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

      <Card label="Addresses you can forward from">
        <Text variant="sub" color="muted" style={{ marginBottom: theme.spacing.sm }}>
          Mail is only accepted from these senders. Your sign-in email always works.
        </Text>
        {signInEmail ? (
          <Row
            title={signInEmail}
            subtitle="Sign-in email"
            first
            right={<Ionicons name="checkmark-circle" size={18} color={c.green} />}
          />
        ) : null}
        {emails.isPending ? <Loading /> : null}
        {(emails.data ?? [])
          .filter((e) => e.email !== signInEmail?.toLowerCase())
          .map((e, i) => (
            <Row
              key={e.email}
              title={e.email}
              subtitle={e.verified ? 'Verified' : 'Waiting for a first email from this address'}
              first={!signInEmail && i === 0}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {e.verified ? (
                    <Ionicons name="checkmark-circle" size={18} color={c.green} />
                  ) : (
                    <Ionicons name="time" size={18} color={c.muted} />
                  )}
                  <Button title="Remove" variant="ghost" small onPress={() => onRemove(e.email)} />
                </View>
              }
            />
          ))}
        {remove.error ? <Notice tone="error">{errorMessage(remove.error)}</Notice> : null}
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'flex-start',
            marginTop: theme.spacing.md,
          }}
        >
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
      </Card>
    </FormScreen>
  );
}
