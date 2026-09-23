import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Text } from '@/components/Text';
import { useMyAttendances } from '@/features/attendances/queries';
import { useAuthStore } from '@/features/auth/store';
import { distanceMeters, isTodayAtVenue, isWithinCheckInWindow } from '@/features/checkin/lock';
import { useGameContext, useLiveState, useNearbyDayGames, type TodayGame } from '@/features/checkin/queries';
import { useEggsLive } from '@/features/eggs/runtime';
import { hasLiveFeed } from '@/features/eggs/live';
import { useTicketImports } from '@/features/imports/queries';
import { liveStatusLabel } from '@/features/live/format';
import { useFavoriteTeams } from '@/features/profile/queries';
import { slotsOf, useGamePrompts, useMyOpenSession } from '@/features/reactions/queries';
import { formatGameTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The two cards at the top of Games while a game is on (03, section 1, ways 2 and 3):
 *
 *   The open session, as the prototype's "LIVE · Padres at Dodgers · Checked in, top 3rd"
 *   card, opening the checked-in screen.
 *
 *   The check-in offer for a game today: a logged or ticket-matched game (ticket-armed: the
 *   app open is enough), or a favorite's game when the phone is already allowed to read its
 *   location and one reading puts it inside the venue. Never asks for a permission here.
 */
export function GamesSessionCards() {
  const userId = useAuthStore((s) => s.userId);
  const live = useEggsLive();
  const enabled = !!userId && live;
  const session = useMyOpenSession(enabled);
  if (!enabled) return null;
  return (
    <>
      {session.data ? <LiveSessionCard gameId={session.data.game_id} /> : null}
      <CheckInOffer exceptGameId={session.data?.game_id ?? null} />
    </>
  );
}

export function LiveSessionCard({ gameId }: { gameId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const ctx = useGameContext(gameId);
  const c = ctx.data;
  const live = useLiveState(gameId, c?.sport_id, !!c && hasLiveFeed(c.sport_id) && c.status !== 'final');
  const prompts = useGamePrompts(gameId);
  if (!c) return null;
  const status = liveStatusLabel(c.sport_id, live.data);
  const slots = slotsOf(prompts.data);
  const pick = c.pledge ? `Pick: ${c.pledge.team_id === c.home.team_id ? c.home.name : c.away.name}. ` : '';
  return (
    <Card tone="accent" testID="live-session-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon="i-gate" solid />
        <View style={{ flex: 1 }}>
          <Text variant="kicker" color="red">
            {status ? `Live · ${status}` : 'Checked in'}
          </Text>
          <Text variant="h2">
            {c.away.name} at {c.home.name}
          </Text>
          <Text variant="sub" color="muted">
            {pick}
            {slots.used} of 3 reactions used.
          </Text>
        </View>
      </View>
      <Button title="Open" onPress={() => router.push(`/games/checkin/${gameId}`)} style={{ marginTop: theme.spacing.md }} />
    </Card>
  );
}

type Offer = { game: TodayGame; reason: 'logged' | 'ticket' | 'nearby' };

/** Which of today's games to offer, from what the phone knows without asking for anything. */
export function checkInOffers(input: {
  today: readonly TodayGame[];
  loggedIds: ReadonlySet<string>;
  ticketIds: ReadonlySet<string>;
  /** A reading the phone was already allowed to take, or null. */
  here: { lat: number; lng: number; accuracyM: number } | null;
  venues: ReadonlyMap<string, { lat: number; lng: number; geofence_m: number }>;
  nowMs: number;
}): Offer[] {
  const out: Offer[] = [];
  for (const g of input.today) {
    if (g.status === 'postponed' || g.status === 'cancelled') continue;
    if (!isWithinCheckInWindow(input.nowMs, g.scheduled_start, g.final_at ?? null)) continue;
    if (input.loggedIds.has(g.id)) out.push({ game: g, reason: 'logged' });
    else if (input.ticketIds.has(g.id)) out.push({ game: g, reason: 'ticket' });
    else if (input.here && g.venue_id) {
      const v = input.venues.get(g.venue_id);
      if (v && distanceMeters(input.here.lat, input.here.lng, v.lat, v.lng) <= v.geofence_m + Math.min(input.here.accuracyM, 200)) {
        out.push({ game: g, reason: 'nearby' });
      }
    }
  }
  return out;
}

function CheckInOffer({ exceptGameId }: { exceptGameId: string | null }) {
  const theme = useTheme();
  const router = useRouter();
  const favorites = useFavoriteTeams();
  const attendances = useMyAttendances();
  const imports = useTicketImports();
  const [mountedAt] = useState(() => Date.now());
  const favIds = useMemo(() => (favorites.data ?? []).map((t) => t.id), [favorites.data]);
  const loggedNear = useMemo(() => {
    const day = 30 * 60 * 60 * 1000;
    return (attendances.data ?? []).filter((a) => Math.abs(Date.parse(a.game.scheduled_start) - mountedAt) <= day).map((a) => a.game_id);
  }, [attendances.data, mountedAt]);
  const games = useNearbyDayGames(favIds, loggedNear);
  const today = useMemo(
    () => (games.data ?? []).filter((g) => g.id !== exceptGameId && isTodayAtVenue(g.scheduled_start, g.venue?.tz, mountedAt)),
    [games.data, exceptGameId, mountedAt],
  );
  const loggedIds = useMemo(() => new Set(loggedNear), [loggedNear]);
  const ticketIds = useMemo(
    () => new Set((imports.data ?? []).map((i) => (i as { matched_game_id?: string | null }).matched_game_id).filter((x): x is string => !!x)),
    [imports.data],
  );

  // One reading, only if the phone already allows it, only when there is a game to test.
  const [here, setHere] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null);
  const wantsLocation = today.some((g) => !loggedIds.has(g.id) && !ticketIds.has(g.id));
  useEffect(() => {
    if (!wantsLocation) return;
    let alive = true;
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (alive) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? 500 });
      } catch {
        // No reading, no nearby offer. The logged and ticket paths do not need one.
      }
    })();
    return () => {
      alive = false;
    };
  }, [wantsLocation]);

  const venues = useMemo(() => new Map<string, { lat: number; lng: number; geofence_m: number }>(), []);
  const offers = useMemo(
    () => checkInOffers({ today, loggedIds, ticketIds, here, venues, nowMs: mountedAt }),
    [today, loggedIds, ticketIds, here, venues, mountedAt],
  );
  if (offers.length === 0) return null;
  return (
    <>
      {offers.map(({ game: g, reason }) => (
        <Card key={g.id} tone="accent" testID="check-in-offer">
          <Text variant="kicker" color="muted">
            {reason === 'nearby' ? 'You are at the stadium' : 'Today'}
          </Text>
          <Text variant="h2" style={{ marginTop: 2 }}>
            {g.away?.name ?? 'Away'} at {g.home?.name ?? 'Home'}
          </Text>
          <Text variant="sub" color="muted">
            {formatGameTime(g.scheduled_start)}
            {g.venue ? ` · ${g.venue.name}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <Button title="Check in" onPress={() => router.push(`/games/checkin/${g.id}`)} style={{ flex: 1 }} />
            <Button title="Details" variant="ghost" onPress={() => router.push(`/games/${g.id}`)} />
          </View>
        </Card>
      ))}
    </>
  );
}
