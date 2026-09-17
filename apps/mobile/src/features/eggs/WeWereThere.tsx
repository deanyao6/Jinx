import React from 'react';
import { Modal, View } from 'react-native';

import { Button } from '@/components/Button';
import { PersonAvatar } from '@/components/PersonAvatar';
import { ICONS } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { formatGameDateLong } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/** Everything the card says. Plain data, so the share route can carry it as a param. */
export type WeWereThereData = {
  me: { id: string; name: string; handle?: string | null; avatarPath?: string | null };
  them: { id: string; name: string; handle?: string | null; avatarPath?: string | null };
  away: string;
  home: string;
  venue: string | null;
  /** ISO start time. */
  date: string;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The secret handshake's "We were there" card (`./handshake`): both people, the matchup, the
 * stadium and the date, as a solid hero in the colours of the team in scope. The caller scopes
 * it (`SideTheme`) to the side the person was on, so two friends who rooted against each other
 * each get the card in their own colours.
 */
export function WeWereThereCard({
  data,
  compact = false,
}: {
  data: WeWereThereData;
  compact?: boolean;
}) {
  const theme = useTheme();
  const a = theme.accent;
  const Users = ICONS['i-users'];
  const size = compact ? 64 : 76;
  const face = (p: WeWereThereData['me'], overlap: boolean) => (
    <View
      style={{
        marginLeft: overlap ? -14 : 0,
        borderRadius: (size + 8) / 2,
        borderWidth: 4,
        borderColor: a.fill,
      }}
    >
      <PersonAvatar userId={p.id} name={p.name} handle={p.handle} path={p.avatarPath} size={size} />
    </View>
  );
  return (
    <View
      testID="we-were-there-card"
      accessible
      accessibilityLabel={`We were there. ${data.me.name} and ${data.them.name}, ${data.away} at ${data.home}${data.venue ? `, ${data.venue}` : ''}, ${formatGameDateLong(data.date)}`}
      style={{
        backgroundColor: a.fill,
        borderRadius: theme.radius.lg,
        padding: compact ? 18 : 22,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Users size={15} color={a.onFill} />
        <Text variant="kicker" style={{ color: a.onFill }}>
          We were there
        </Text>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 16, marginLeft: -4 }}>
        {face(data.me, false)}
        {face(data.them, true)}
      </View>
      <Text
        variant="h1"
        numberOfLines={2}
        adjustsFontSizeToFit
        style={{ color: a.onFill, marginTop: 14 }}
      >
        {`${firstName(data.me.name)} & ${firstName(data.them.name)}`}
      </Text>
      <View
        style={{ height: 3, width: 44, borderRadius: 2, backgroundColor: a.second, marginTop: 12 }}
      />
      <Text variant="bodyStrong" style={{ color: a.onFill, marginTop: 12 }}>
        {`${data.away} at ${data.home}`}
      </Text>
      <Text variant="sub" style={{ color: a.onFill, opacity: 0.82, marginTop: 2 }}>
        {[data.venue, formatGameDateLong(data.date)].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

/** The card as a page sheet, with Share when the caller can take it somewhere. */
export function WeWereThereSheet({
  data,
  onClose,
  onShare,
}: {
  /** Null keeps the sheet closed. */
  data: WeWereThereData | null;
  onClose: () => void;
  onShare?: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={!!data}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.screen,
          padding: theme.spacing.lg,
          justifyContent: 'center',
          gap: theme.spacing.lg,
        }}
      >
        {data ? <WeWereThereCard data={data} /> : null}
        <Text variant="sub" color="muted" align="center">
          You both tapped. That is the whole handshake.
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          {onShare ? <Button title="Share" onPress={onShare} /> : null}
          <Button title="Done" variant={onShare ? 'ghost' : 'primary'} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
