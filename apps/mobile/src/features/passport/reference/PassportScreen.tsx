import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideOver } from '@/components/reference/SlideOver';
import { useBadges, useFavoriteGames, useStreaks } from '@/features/communities/queries';
import { useRepository } from '@/features/data/context';
import { EmptyState } from '@/features/data/EmptyState';
import type { PassportFixture } from '@/features/data/shapes';
import type { Repository } from '@/features/data/types';
import { usePassportEggs } from '@/features/eggs/passport';
import { favoritePlayerItems } from '@/features/players/passport';
import { useFavoritePlayersSeen } from '@/features/players/queries';
import { env } from '@/lib/env';
import { formatGameDate } from '@/lib/format';
import { streakPatchLabel } from '@jinx/core';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { screenPadding } from '@/theme/reference/tokens';

import { GameLogPanel } from './GameLogPanel';
import {
  Head,
  Hero,
  Pills,
  RecordCards,
  SectionHeader,
  Stamps,
  SuperlativeList,
  TabBar,
} from './parts';

/**
 * The Passport screen, ported from the first phone in `design/reference.html`
 * (SPEC.md 8.8.1).
 *
 * Selecting a team pill filters the whole screen: the hero label, record, win rate,
 * streak, last game, glow colour, the three record cards, the stamps row and the
 * superlatives all change together, exactly as `renderPassport()` does in the reference.
 * That is one state variable here, because the reference derives all of it from the pill.
 */
export function PassportScreen({
  initialPill = 'all',
  initialLog,
}: {
  initialPill?: string;
  /** Opens with that record's game log already showing, and no slide animation. */
  initialLog?: string;
}) {
  const repo = useRepository();
  const [pill, setPill] = React.useState(initialPill);
  // The card that opened the log is kept, not just its key, because the panel's header
  // shows that card's own label and record rather than the log's.
  const [openLog, setOpenLog] = React.useState<{
    log: string;
    name: string;
    record: string;
  } | null>(() => initialCard(repo, initialPill, initialLog));

  const data = repo.passport(pill);

  const open = (log: string) => {
    const card = data.cards.find((c) => c.log === log);
    if (card && repo.gameLog(log)) setOpenLog({ log, name: card.name, record: card.record });
  };

  return (
    <ReferenceThemeProvider team={data.teamKey}>
      <PassportBody pill={pill} onSelect={setPill} data={data} onOpenLog={open} />
      {openLog ? (
        <SlideOver open initiallyOpen={initialLog != null}>
          <GameLogPanel
            log={openLog.log}
            // The reference titles the neutral card's log "As a neutral", not "Neutral".
            title={openLog.name === 'Neutral' ? 'As a neutral' : openLog.name}
            record={openLog.record}
            onClose={() => setOpenLog(null)}
          />
        </SlideOver>
      ) : null}
    </ReferenceThemeProvider>
  );
}

/** Resolve the card a deep-linked log belongs to, so the panel header matches. */
function initialCard(repo: Repository, pill: string, log?: string) {
  if (!log) return null;
  const card = repo.passport(pill).cards.find((c) => c.log === log);
  return card ? { log, name: card.name, record: card.record } : null;
}

function PassportBody({
  pill,
  onSelect,
  data,
  onOpenLog,
}: {
  pill: string;
  onSelect: (key: string) => void;
  data: PassportFixture;
  onOpenLog: (log: string) => void;
}) {
  const { base } = useReferenceTheme();
  const repo = useRepository();
  const router = useRouter();
  // The reference draws a fake status row inside `.scr` and starts `.body` below it.
  // The app uses the real status bar instead (SPEC.md 8.1), so the content begins at the
  // top safe-area inset and then takes `.body`'s own 4px padding.
  const insets = useSafeAreaInsets();
  const stamps = repo.stamps(pill);
  // Easter eggs. Empty in demo mode and for any egg that is switched off.
  const egg = usePassportEggs(pill);
  return (
    <View style={{ flex: 1, backgroundColor: base.canvas, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: screenPadding.top,
          paddingHorizontal: screenPadding.horizontal,
          paddingBottom: screenPadding.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Head
          title="JINX"
          subtitle="FAN PASSPORT"
          onBellPress={() => router.push('/you/notifications')}
          // Profile is a tab, so it replaces rather than pushing: pushing would stack a
          // second copy of a tab screen on top of this one.
          onProfilePress={() => router.replace('/profile')}
          {...egg.head}
        />
        <Pills pills={repo.passportPills()} selected={pill} onSelect={onSelect} />
        <Hero
          label={data.label}
          badge={data.badge}
          record={data.record}
          winRate={data.winRate}
          streak={data.streak}
          lastGame={data.lastGame}
          // The fixture has no game id for the last game, only its display line. See
          onLastGamePress={() => router.push(`/games/${data.lastGameId}` as Href)}
          {...egg.hero}
        />
        <RecordCards cards={data.cards} onOpen={onOpenLog} />
        {/* A passport with no records is a real state, and the commonest one: it is what
            the app looks like the day you sign up. It says so rather than leaving the gap
            under the hero unexplained. */}
        {data.cards.length === 0 ? (
          <EmptyState
            text="No records yet. Log a game and your lifetime record starts here."
            loadingText="Loading your records…"
          />
        ) : null}
        <SectionHeader
          title="Stadium stamps"
          action={data.stampCount}
          onActionPress={() => router.push('/passport/stamps')}
        />
        {/* The stamps screen has no per-venue route: it opens a venue in its own sheet.
            So a tile opens the screen, and selecting the venue there is still a step the
            user has to take. */}
        <Stamps stamps={stamps} onStampPress={() => router.push('/passport/stamps')} />
        {stamps.length === 0 ? (
          <EmptyState
            text="No stamps yet. Each new stadium you log earns one."
            loadingText="Loading your stamps…"
          />
        ) : null}
        <FavoritePlayers pill={pill} />
        <StreakPatches />
        <FourFavoritesSection />
        <BadgesPreview />
        {/* A real row opens the game its number is from, or the games you saw the player in, so
            the full list needs its own way in. The demo rows name no real game: they open the
            full list, and the header stays as the reference draws it, with no action. */}
        {data.superlatives.some((item) => item.href) ? (
          <SectionHeader
            title="Fan superlatives"
            action="View All"
            onActionPress={() => router.push('/passport/superlatives')}
          />
        ) : (
          <SectionHeader title="Fan superlatives" />
        )}
        <SuperlativeList
          items={data.superlatives}
          onItemPress={(item) => router.push((item.href ?? '/passport/superlatives') as Href)}
        />
        {data.superlatives.length === 0 ? (
          <EmptyState
            text="No superlatives yet. The coldest game, the longest one and the rest arrive once you have games to compare."
            loadingText="Loading your superlatives…"
          />
        ) : null}
      </ScrollView>
      <TabBar active="Passport" />
    </View>
  );
}

/**
 * Favourite players, between the stamps and the superlatives: how often you have seen each one,
 * filtered by the team pill like everything else on the screen.
 *
 * Not in `design/reference.html`; Dean added favourite players on 2026-09-17. It reuses the
 * superlatives list so it looks native, and reads its own query rather than the repository,
 * which serves the reference's fixtures in demo mode: demo mode has no section to show, so the
 * parity screenshots are unchanged. It is absent until you have a favourite, and under a team
 * pill until you have seen one of them play for that team.
 */
/**
 * Season streak patches, one per team with a run going (section 3). Not in
 * `design/reference.html`; added for social v2 the same way `FavoritePlayers` was: its own
 * query, absent in demo mode, so the parity screenshots are unchanged.
 */
function StreakPatches() {
  const router = useRouter();
  const { base } = useReferenceTheme();
  const streaks = useStreaks();
  if (env.demo || !streaks.data || streaks.data.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
      {streaks.data.map((s) => (
        <Pressable
          key={s.team_id}
          accessibilityRole="button"
          onPress={() => router.push(`/passport/streak/${s.team_id}` as Href)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            borderRadius: 999,
            paddingVertical: 5,
            paddingHorizontal: 11,
            backgroundColor: base.card,
            borderWidth: 1,
            borderColor: s.is_active ? base.line : base.line,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: base.ink }}>
            {streakPatchLabel(s.team_name, {
              startSeason: s.start_season,
              endSeason: s.end_season,
              seasons: s.seasons,
              minGames: s.min_games,
              isActive: s.is_active,
            })}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Four favorite games preview, section 6: absent until at least one is picked. */
function FourFavoritesSection() {
  const router = useRouter();
  const favorites = useFavoriteGames();
  if (env.demo || !favorites.data || favorites.data.length === 0) return null;
  return (
    <View style={{ marginBottom: 18 }}>
      <SectionHeader
        title="Four favorite games"
        action="Edit"
        onActionPress={() => router.push('/passport/favorites' as Href)}
      />
      <SuperlativeList
        items={favorites.data.map((f) => ({
          icon: 'i-spark',
          label: new Date(f.date).getFullYear().toString() || 'Favorite',
          value: f.note ?? f.matchup,
          chip: '',
        }))}
        onItemPress={() => router.push(`/games/${favorites.data![0]!.game_id}` as Href)}
      />
    </View>
  );
}

/** Earned badges preview, section 5: absent until the fan has earned one. */
function BadgesPreview() {
  const router = useRouter();
  const badges = useBadges();
  const earned = (badges.data ?? []).filter((b) => b.earned_at);
  if (env.demo || earned.length === 0) return null;
  return (
    <View style={{ marginBottom: 18 }}>
      <SectionHeader
        title="Badges"
        action={`See all ${badges.data!.length}`}
        onActionPress={() => router.push('/passport/badges' as Href)}
      />
      <SuperlativeList
        items={earned.slice(0, 6).map((b) => ({
          icon: 'i-verified',
          label: b.name,
          value: b.tier === 'legendary' ? 'Legendary' : b.tier === 'rare' ? 'Rare' : 'Earned',
          chip: '',
          tone: b.tier === 'standard' ? undefined : 'gold',
        }))}
        onItemPress={() => router.push('/passport/badges' as Href)}
      />
    </View>
  );
}

function FavoritePlayers({ pill }: { pill: string }) {
  const router = useRouter();
  const seen = useFavoritePlayersSeen();
  if (env.demo || !seen.data) return null;
  const items = favoritePlayerItems(seen.data, pill, (iso) =>
    formatGameDate(iso, { withYear: true }),
  );
  if (items.length === 0) return null;
  const byName = new Map(items.map((i) => [i.name, i]));
  return (
    // The stamps rail's 18px bottom margin, so the gap before the next header matches the one above.
    <View style={{ marginBottom: 18 }}>
      <SectionHeader
        title="Favorite players"
        action="Edit"
        onActionPress={() => router.push('/settings/favorites?tab=players' as Href)}
      />
      <SuperlativeList
        items={items.map((i) => ({
          icon: 'i-eye',
          label: i.seenLine,
          value: i.name,
          chip: i.chip,
        }))}
        onItemPress={(item) => {
          // Seen: the games you saw them in, the same page their superlative row opens.
          const player = byName.get(item.value);
          if (player && player.seen > 0) router.push(`/passport/player/${player.playerId}` as Href);
          else router.push('/settings/favorites?tab=players' as Href);
        }}
      />
    </View>
  );
}
