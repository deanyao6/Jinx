import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideOver } from '@/components/reference/SlideOver';
import { useRepository } from '@/features/data/context';
import type { PassportFixture } from '@/features/data/shapes';
import type { Repository } from '@/features/data/types';
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
  // The reference draws a fake status row inside `.scr` and starts `.body` below it.
  // The app uses the real status bar instead (SPEC.md 8.1), so the content begins at the
  // top safe-area inset and then takes `.body`'s own 4px padding.
  const insets = useSafeAreaInsets();
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
        <Head title="JINX" subtitle="FAN PASSPORT" />
        <Pills pills={repo.passportPills()} selected={pill} onSelect={onSelect} />
        <Hero
          label={data.label}
          badge={data.badge}
          record={data.record}
          winRate={data.winRate}
          streak={data.streak}
          lastGame={data.lastGame}
        />
        <RecordCards cards={data.cards} onOpen={onOpenLog} />
        <SectionHeader title="Stadium stamps" action={data.stampCount} />
        <Stamps stamps={repo.stamps(pill)} />
        <SectionHeader title="Fan superlatives" />
        <SuperlativeList items={data.superlatives} />
      </ScrollView>
      <TabBar active="Passport" />
    </View>
  );
}
