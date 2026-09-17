import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideOver } from '@/components/reference/SlideOver';
import { useRepository } from '@/features/data/context';
import { EmptyState } from '@/features/data/EmptyState';
import type { PassportFixture } from '@/features/data/shapes';
import type { Repository } from '@/features/data/types';
import { favoritePlayerItems } from '@/features/players/passport';
import { useFavoritePlayersSeen } from '@/features/players/queries';
import { env } from '@/lib/env';
import { formatGameDate } from '@/lib/format';
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
        <SectionHeader title="Fan superlatives" />
        {/* Each row could open the game, venue or player it names, but the fixture carries
            only display text for those. So every row opens the superlatives screen. */}
        <SuperlativeList
          items={data.superlatives}
          onItemPress={() => router.push('/passport/superlatives')}
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
          const player = byName.get(item.value);
          if (player?.lastGameId) router.push(`/games/${player.lastGameId}` as Href);
          else router.push('/settings/favorites?tab=players' as Href);
        }}
      />
    </View>
  );
}
