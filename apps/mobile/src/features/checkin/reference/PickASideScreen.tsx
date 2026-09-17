import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICONS } from '@/components/reference/icons';
import { LiveDot } from '@/components/reference/LiveDot';
import { useRepository } from '@/features/data/context';
import type { Repository } from '@/features/data/types';
import { EmptyState } from '@/features/data/EmptyState';
import { pickConfirmation } from '@/features/demo/fixtures';
import { TabBar } from '@/features/passport/reference/parts';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, radius, screenPadding } from '@/theme/reference/tokens';

/**
 * Pick a side, ported from the second phone in `design/reference.html` (SPEC.md 8.8.3).
 *
 * Picking a side shows the check icon and the ring on that button, dims the other to 50%,
 * and reveals the confirmation row with the vs-expected gain, exactly as the reference's
 * click handler does.
 */
export function PickASideScreen({ picked }: { picked?: 'away' | 'home' }) {
  return (
    <ReferenceThemeProvider team="none">
      <FixtureBody initialPicked={picked} />
    </ReferenceThemeProvider>
  );
}

export type PickASideData = ReturnType<Repository['pickASide']>;

export type PickASideViewProps = {
  data: PickASideData;
  picked: 'away' | 'home' | undefined;
  onPick: (side: 'away' | 'home') => void;
  /** Picks are closed: the lock passed, the game ended, or the pledge was validated. */
  locked?: boolean;
  /** A pick is on its way to the server. Buttons hold still so two taps cannot race. */
  busy?: boolean;
  /** Replaces the confirmation line, e.g. once locked. Defaults to the reference's copy. */
  statusText?: string | null;
  /** A failed pick, in words. Shown under the buttons. */
  errorText?: string | null;
  /** Shown under Storylines while they load or when the game has none. */
  storylinesNote?: string | null;
  onBack?: () => void;
};

/**
 * The fixture-backed screen: the parity harness, demo mode, and the repository's empty state.
 * A real game is mounted through PickASideLive, which feeds the same view.
 */
function FixtureBody({ initialPicked }: { initialPicked?: 'away' | 'home' }) {
  // The reference lets you switch sides freely until the countdown locks, so this is a
  // plain toggle rather than a one-way commit.
  const [picked, setPicked] = React.useState<'away' | 'home' | undefined>(initialPicked);
  const d = useRepository().pickASide();
  return <PickASideView data={d} picked={picked} onPick={setPicked} />;
}

export function PickASideView({
  data: d,
  picked,
  onPick,
  locked = false,
  busy = false,
  statusText,
  errorText,
  storylinesNote,
  onBack,
}: PickASideViewProps) {
  const { base } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const Book = ICONS['i-book'];
  const Lock = ICONS['i-lock'];
  const Back = ICONS['i-chev-l'];
  const chosen = picked ? (picked === 'away' ? d.away : d.home) : null;
  const confirmation =
    statusText !== undefined
      ? statusText
      : chosen
        ? pickConfirmation(chosen.name, chosen.winProb)
        : null;

  /**
   * No game, no sides to pick between.
   *
   * Pick a side is per-game: it needs the `game_context` RPC for the game you just checked
   * into, and this repository holds only the current user's aggregate data, so it cannot
   * serve one (see the note on the Repository type). The mapping exists —
   * `pickASideFromContext` in features/data/supabase.ts — and this screen shows real teams
   * the day it is mounted with a game id instead. Until then it says there is no game
   * rather than offering a pledge on the reference's Mets–Padres fixture.
   */
  if (!d.home.name && !d.away.name) {
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
          <Text style={[s.h1, { color: base.ink }]}>{d.title}</Text>
          <EmptyState
            text="No game to pick a side in. Check in at a game where you follow neither team and the pledge opens here."
            loadingText="Loading this game…"
          />
        </ScrollView>
      </View>
    );
  }

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
        <View style={s.top}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Back size={22} color={base.ink} />
            </Pressable>
          ) : null}
          <View style={[s.live, { borderColor: base.good }]}>
            {/* `.fx-live i` pulses at 1.6s. The harness freezes animation, and SPEC.md 8.2
                requires honouring Reduce Motion, so the still state is a real state. */}
            <LiveDot color={base.good} size={6} />
            <Text style={[s.liveText, { color: base.good }]}>LIVE</Text>
          </View>
          <Text style={[s.at, { color: base.muted }]} numberOfLines={1}>
            {d.venue}
          </Text>
          <View style={[s.lock, { borderColor: base.warn }]}>
            <Text style={[s.lockText, { color: base.warn }]} accessibilityLiveRegion="polite">
              {locked ? 'LOCKED' : `LOCKS IN ${d.lockCountdown}`}
            </Text>
          </View>
        </View>

        <Text style={[s.h1, { color: base.ink }]}>{d.title}</Text>
        <Text style={[s.explainer, { color: base.muted }]}>{d.explainer}</Text>

        {/* `.fx-mu` is a 1fr auto 1fr grid, so the sides are equal and "vs" is intrinsic. */}
        <View style={s.matchup}>
          <TeamTheme team={d.away.team}>
            <Side badge={d.away.badge} name={d.away.name} record={d.away.record} />
          </TeamTheme>
          <Text style={[s.vs, { color: base.muted }]}>vs</Text>
          <TeamTheme team={d.home.team}>
            <Side badge={d.home.badge} name={d.home.name} record={d.home.record} />
          </TeamTheme>
        </View>

        <View style={[s.wp, { backgroundColor: base.surface }]}>
          <TeamTheme team={d.away.team}>
            <WpFill fraction={d.away.winProb} />
          </TeamTheme>
          <TeamTheme team={d.home.team}>
            <WpFill fraction={d.home.winProb} />
          </TeamTheme>
        </View>
        <View style={s.wpLabels}>
          <Text style={[s.wpLabel, { color: base.ink }]}>
            {`${Math.round(d.away.winProb * 100)}% Win Prob`}
          </Text>
          <Text style={[s.wpLabel, { color: base.ink }]}>
            {`${Math.round(d.home.winProb * 100)}%`}
          </Text>
        </View>

        <TeamTheme team={d.away.team}>
          <RootButton
            label={d.away.button}
            pressed={picked === 'away'}
            dimmed={picked === 'home' || (locked && picked !== 'away')}
            disabled={locked || busy}
            onPress={() => onPick('away')}
          />
        </TeamTheme>
        <TeamTheme team={d.home.team}>
          <RootButton
            label={d.home.button}
            pressed={picked === 'home'}
            dimmed={picked === 'away' || (locked && picked !== 'home')}
            disabled={locked || busy}
            onPress={() => onPick('home')}
          />
        </TeamTheme>

        {confirmation ? (
          <View style={[s.confirm, { backgroundColor: base.surface }]}>
            <Lock size={20} color={locked && !chosen ? base.muted : base.good} />
            <Text style={[s.confirmText, { color: base.ink }]}>{confirmation}</Text>
          </View>
        ) : null}
        {errorText ? (
          <Text style={[s.errorText, { color: base.bad }]} accessibilityRole="alert">
            {errorText}
          </Text>
        ) : null}

        <View style={s.storyHead}>
          <Book size={16} color={base.ink} />
          <Text style={[s.storyHeadText, { color: base.ink }]}>Storylines</Text>
        </View>
        {d.storylines.map((story) => (
          <View
            key={story.text}
            style={[s.story, { backgroundColor: base.card, borderColor: base.line }]}
          >
            <Text style={[s.storyText, { color: base.ink }]}>{story.text}</Text>
            <Text style={[s.storySource, { color: base.muted }]}>{story.source}</Text>
          </View>
        ))}
        {d.storylines.length === 0 && storylinesNote ? (
          <Text style={[s.storySource, { color: base.muted }]}>{storylinesNote}</Text>
        ) : null}
      </ScrollView>
      <TabBar active="Games" />
    </View>
  );
}

/** One side of `.fx-mu`, with the circular `.fx-bd` badge. */
function Side({ badge, name, record }: { badge: string; name: string; record: string }) {
  const { base, team } = useReferenceTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={[s.badge, { backgroundColor: team.fill, borderColor: team.second }]}>
        <Text style={s.badgeText}>{badge}</Text>
      </View>
      <Text style={[s.sideName, { color: base.ink }]}>{name}</Text>
      <Text style={[s.sideRecord, { color: base.muted }]}>{record}</Text>
    </View>
  );
}

/** `.fx-wp i`, whose width is the win probability as a percentage. */
function WpFill({ fraction }: { fraction: number }) {
  const { team } = useReferenceTheme();
  return (
    <View style={{ width: `${fraction * 100}%`, height: '100%', backgroundColor: team.fill }} />
  );
}

/** `.fx-root`. */
function RootButton({
  label,
  pressed,
  dimmed,
  disabled = false,
  onPress,
}: {
  label: string;
  pressed: boolean;
  dimmed: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { base, team } = useReferenceTheme();
  const Check = ICONS['i-check-c'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: pressed, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.root,
        { backgroundColor: team.fill, borderColor: team.second },
        // `.fx-pick.has-pick .fx-root[aria-pressed="false"]{opacity:.5}`
        dimmed ? { opacity: 0.5 } : null,
        // The pressed state is `box-shadow:0 0 0 2px var(--canvas),0 0 0 4px var(--t2)`,
        // a double ring. React Native shadows have no spread, so this is approximated;
        // recorded in design/PORTING_NOTES.md.
        pressed ? { borderColor: base.canvas, borderWidth: 2 } : null,
      ]}
    >
      {pressed ? <Check size={17} color="#FFFFFF" /> : null}
      <Text style={s.rootText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // `.fx-top{margin:10px 0 14px;gap:8px}`
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 14 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: border.pill,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  liveText: { fontSize: 9.5, fontFamily: fontFamily({ weight: 850 }), letterSpacing: 9.5 * 0.05 },
  at: { flex: 1, fontSize: 11, fontFamily: fontFamily({ weight: 650 }) },
  lock: { borderWidth: border.pill, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
  lockText: { fontSize: 9.5, fontFamily: fontFamily({ weight: 850 }), letterSpacing: 9.5 * 0.05 },

  h1: {
    fontSize: 31,
    fontFamily: fontFamily({ weight: 850 }),
    letterSpacing: -31 * 0.01,
    marginBottom: 6,
  },
  explainer: { fontSize: 12.5, lineHeight: 12.5 * 1.45, fontFamily: fontFamily() },

  // `.fx-mu{margin:20px 0 16px}`
  matchup: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 16 },
  // `.fx-bd{width:62px;height:62px;border:3px solid var(--t2);font-size:17px}`
  badge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 17, fontFamily: fontFamily({ width: 80, weight: 900 }), color: '#FFFFFF' },
  sideName: { fontSize: 14, fontFamily: fontFamily({ weight: 800 }), marginTop: 8 },
  sideRecord: {
    fontSize: 10.5,
    fontFamily: fontFamily(),
  },
  vs: {
    fontSize: 14,
    fontFamily: fontFamily({ weight: 850 }),
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },

  // `.fx-wp{height:8px;border-radius:99px;overflow:hidden}`
  wp: { flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden' },
  wpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    marginBottom: 16,
  },
  wpLabel: { fontSize: 11, fontFamily: fontFamily({ weight: 750 }) },

  // `.fx-root{padding:13px;font-size:14px;margin-bottom:10px;gap:8px}`
  root: {
    width: '100%',
    borderRadius: radius.sm,
    padding: 13,
    borderWidth: border.pill,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  rootText: { fontSize: 14, fontFamily: fontFamily({ weight: 800 }), color: '#FFFFFF' },

  // `.confirm{border-radius:16px;padding:12px;font-size:13.5px;line-height:1.4}`
  confirm: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 12, marginBottom: 10 },
  confirmText: { flex: 1, fontSize: 13.5, lineHeight: 13.5 * 1.4, fontFamily: fontFamily() },
  errorText: { fontSize: 13, lineHeight: 13 * 1.4, marginTop: 8, fontFamily: fontFamily() },

  // `.fx-sth{margin:14px 0 8px;gap:6px}`
  storyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8 },
  storyHeadText: { fontSize: 13.5, fontFamily: fontFamily({ weight: 850 }) },
  // `.fx-story{padding:10px 11px;margin-bottom:8px}`
  story: {
    borderWidth: border.card,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 11,
    marginBottom: 8,
  },
  storyText: { fontSize: 12.5, lineHeight: 12.5 * 1.35, fontFamily: fontFamily({ weight: 650 }) },
  storySource: {
    fontSize: 9.5,
    fontFamily: fontFamily({ weight: 750 }),
    letterSpacing: 9.5 * 0.06,
    marginTop: 5,
  },
});
