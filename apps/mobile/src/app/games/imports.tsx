import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { GameRow } from '@/components/GameRow';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Row } from '@/components/Row';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import type { GameDetail } from '@/features/games/queries';
import { Fact, QuietDangerButton } from '@/features/games/ui/detailParts';
import { SideTheme } from '@/features/games/ui/SideTheme';
import {
  groupImports,
  parsedSummary,
  readParsed,
  searchPrefill,
  seatLabel,
  type ParsedTicket,
} from '@/features/imports/grouping';
import {
  useConfirmImport,
  useDiscardImport,
  useImportGames,
  useImportThumbnail,
  useTicketImports,
  type TicketImport,
} from '@/features/imports/queries';
import { doubleheaderLabel, formatGameDate, formatGameDateLong } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

function gameLine(g: GameDetail): string {
  return `${g.away?.name ?? 'Away'} vs ${g.home?.name ?? 'Home'}, ${formatGameDate(g.scheduled_start)}${g.venue ? ` at ${g.venue.name}` : ''}`;
}

export default function ImportsInboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const imports = useTicketImports();
  const groups = useMemo(() => groupImports(imports.data ?? []), [imports.data]);

  const gameIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of imports.data ?? []) {
      for (const id of i.candidate_game_ids ?? []) ids.add(id);
      const makeup = readParsed(i.parsed).makeup_game_id;
      if (makeup) ids.add(makeup);
    }
    return [...ids];
  }, [imports.data]);
  const games = useImportGames(gameIds);

  if (imports.isPending) return <Loading label="Loading imports" />;
  if (imports.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Imports' }} />
        <ErrorNotice
          error={imports.error}
          message="Could not load your imports."
          onRetry={imports.refetch}
        />
      </Screen>
    );
  }

  const open =
    groups.confirm.length + groups.review.length + groups.failed.length + groups.processing.length;
  const byId = games.data ?? new Map<string, GameDetail>();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Imports' }} />
      {open === 0 ? (
        <EmptyState
          icon="i-ticket"
          title="Inbox is clear"
          body="Tickets you upload or forward by email show up here for a quick confirm."
          actionTitle="Upload tickets"
          onAction={() => router.push('/games/import')}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.md }}>
            <StatTile label="Ready" value={String(groups.confirm.length)} accent />
            <StatTile label="To pick" value={String(groups.review.length)} />
            <StatTile label="Not found" value={String(groups.failed.length)} />
          </View>
          <Card style={{ paddingVertical: theme.spacing.xs + 1 }}>
            <Row
              icon="i-plus"
              title="Upload more tickets"
              chevron
              onPress={() => router.push('/games/import')}
            />
          </Card>
        </>
      )}

      {groups.confirm.map((i) => (
        <ImportCard key={i.id} imp={i} byId={byId} />
      ))}
      {groups.review.map((i) => (
        <ImportCard key={i.id} imp={i} byId={byId} />
      ))}
      {groups.failed.map((i) => (
        <ImportCard key={i.id} imp={i} byId={byId} />
      ))}
      {groups.processing.length ? (
        <>
          <SectionHeader title="Still reading" />
          <Card>
            <View style={{ gap: 8 }}>
              {groups.processing.map((i) => (
                <Fact key={i.id} icon="i-clock" tone="muted">
                  {i.source === 'email' ? 'Forwarded email' : 'Uploaded file'} from{' '}
                  {formatGameDate(i.created_at)}
                </Fact>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {groups.done.length ? (
        <>
          <SectionHeader title="Logged from imports" />
          <Card>
            <View style={{ gap: 8 }}>
              {groups.done.map((i) => {
                const p = readParsed(i.parsed);
                const g = i.candidate_game_ids?.[0] ? byId.get(i.candidate_game_ids[0]) : undefined;
                return (
                  <Fact key={i.id} icon="i-check-c" tone="muted">
                    {g ? gameLine(g) : parsedSummary(p)}
                  </Fact>
                );
              })}
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function ImportCard({ imp, byId }: { imp: TicketImport; byId: Map<string, GameDetail> }) {
  const theme = useTheme();
  const router = useRouter();
  const confirm = useConfirmImport();
  const discard = useDiscardImport();
  const thumb = useImportThumbnail(imp.storage_path);
  const [picked, setPicked] = useState<string | null>(null);

  const p: ParsedTicket = readParsed(imp.parsed);
  const candidates = (p.candidates ?? []).filter((cand) => byId.has(cand.game_id));
  const best = candidates[0] ? byId.get(candidates[0].game_id) : undefined;
  const makeup = p.makeup_game_id ? byId.get(p.makeup_game_id) : undefined;
  const seat = seatLabel(p);
  const isConfirm = imp.status === 'matched';
  const isFailed = imp.status === 'failed';

  const onConfirm = (gameId: string) => {
    confirm.mutate(
      { importId: imp.id, gameId },
      { onSuccess: () => router.push(`/games/${gameId}`) },
    );
  };

  const onDiscard = () => {
    Alert.alert('Discard this import?', 'The ticket file is removed and nothing is logged.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => discard.mutate(imp.id) },
    ]);
  };

  const onSearch = () => {
    const { q, date } = searchPrefill(p);
    const params = new URLSearchParams({ segment: 'log' });
    if (q) params.set('q', q);
    if (date) params.set('date', date);
    router.push(`/(tabs)/games?${params.toString()}`);
  };

  const label = isConfirm
    ? 'Ready to confirm'
    : isFailed
      ? "Couldn't find this game"
      : 'Needs your pick';

  // A card that has found its game takes that game's home colours; the rest stay the person's own.
  return (
    <SideTheme team={isConfirm ? best?.home?.id : null}>
      <Card label={label}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          {thumb.data ? (
            <Image
              source={{ uri: thumb.data }}
              accessibilityLabel="Your ticket"
              style={{
                width: 56,
                height: 72,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.tint,
              }}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flex: 1 }}>
            {isConfirm && best ? (
              <Text variant="bodyStrong">
                Log {best.away?.name ?? 'Away'} vs {best.home?.name ?? 'Home'},{' '}
                {formatGameDateLong(best.scheduled_start)} at {best.venue?.name ?? 'the venue'}?
              </Text>
            ) : (
              <Text variant="bodyStrong">{parsedSummary(p)}</Text>
            )}
            <Text variant="caption" color="muted">
              {[
                seat,
                p.venue,
                p.ticketing_platform,
                imp.source === 'email' ? 'From email' : 'From upload',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        {confirm.error ? (
          <Notice tone="error" style={{ marginTop: theme.spacing.sm }}>
            {errorMessage(confirm.error)}
          </Notice>
        ) : null}

        {isConfirm && best ? (
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}
          >
            <Button
              title="Log it"
              onPress={() => onConfirm(best.id)}
              loading={confirm.isPending}
              style={{ flex: 1 }}
            />
            <Button title="Not this game" variant="ghost" onPress={() => setPicked('other')} />
          </View>
        ) : null}

        {makeup ? (
          <Notice style={{ marginTop: theme.spacing.md }}>
            <Text variant="sub" style={{ marginBottom: theme.spacing.sm }}>
              This game was postponed to {formatGameDate(makeup.scheduled_start)}. Log that one?
            </Text>
            <Button
              title={`Log ${formatGameDate(makeup.scheduled_start)} instead`}
              small
              onPress={() => onConfirm(makeup.id)}
              loading={confirm.isPending}
              style={{ alignSelf: 'flex-start' }}
            />
          </Notice>
        ) : null}

        {(!isConfirm || picked === 'other') && !isFailed && candidates.length ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <Text variant="kicker" color="accent" style={{ marginBottom: 4 }}>
              {p.doubleheader_ambiguous ? 'Which game of the doubleheader?' : 'Which game is it?'}
            </Text>
            {candidates.map((cand, i) => {
              const g = byId.get(cand.game_id)!;
              const on = picked === cand.game_id;
              return (
                <GameRow
                  key={cand.game_id}
                  first={i === 0}
                  game={{
                    id: g.id,
                    scheduled_start: g.scheduled_start,
                    status: g.status,
                    awayName: g.away?.name ?? 'Away',
                    homeName: g.home?.name ?? 'Home',
                    venueName: g.venue?.name,
                    home_score: g.home_score,
                    away_score: g.away_score,
                    is_tie: g.is_tie,
                    doubleheader_number: g.doubleheader_number,
                  }}
                  badge={on ? 'Selected' : null}
                  right={
                    <View style={{ alignItems: 'flex-end', maxWidth: 140 }}>
                      <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                        {Math.round(cand.score)}
                      </Text>
                      <Text variant="caption" color="muted" numberOfLines={2}>
                        {[doubleheaderLabel(g.doubleheader_number), ...cand.reasons]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>
                  }
                  onPress={() => setPicked(cand.game_id)}
                />
              );
            })}
            {picked && picked !== 'other' ? (
              <Button
                title="Log this game"
                onPress={() => onConfirm(picked)}
                loading={confirm.isPending}
                style={{ marginTop: theme.spacing.sm }}
              />
            ) : null}
          </View>
        ) : null}

        {isFailed ? (
          <Text variant="sub" color="muted" style={{ marginTop: theme.spacing.sm }}>
            {imp.error && imp.error !== 'No matching game found'
              ? imp.error
              : 'We read the ticket but no game in our schedule matched it.'}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: theme.spacing.md,
          }}
        >
          {isFailed || picked === 'other' || !isConfirm ? (
            <Button title="Search instead" variant="secondary" small onPress={onSearch} />
          ) : (
            <View />
          )}
          <QuietDangerButton title="Discard" onPress={onDiscard} loading={discard.isPending} />
        </View>
      </Card>
    </SideTheme>
  );
}
