import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameThumb } from '@/components/reference/GameThumb';
import { ICONS } from '@/components/reference/icons';
import { useRepository, useRepositoryStatus } from '@/features/data/context';
import { RepositoryAvatar } from '@/features/data/RepositoryAvatar';
import type { GameRowFixture, PersonRef } from '@/features/data/shapes';
import { useMyFamousGameIds } from '@/features/famous/queries';
import { FamousMark } from '@/features/famous/ui/FamousMark';
import { TabBar } from '@/features/passport/reference/parts';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, radius, screenPadding } from '@/theme/reference/tokens';

/**
 * The Games screen, ported from the third phone in `design/reference.html`
 * (SPEC.md 8.8.2). Title with an add button, search, the History / Upcoming / Imports
 * segments, then the game rows.
 *
 * Each row carries its own team theme, because the thumbnail's gradient ends in that
 * team's fill, exactly as `.fx-row` nests a `.t-*` class in the reference.
 *
 * Wiring follows `docs/interactions.md`. The visuals are untouched: the only element that
 * changed shape is the search field, which had to become a real `TextInput` to be
 * typeable, and keeps the `.fx-search` box and type it had as a `Text`.
 */

/**
 * The row the screen renders.
 *
 * `GameRowFixture` carries no game id: the demo fixtures have none, and
 * `gameRowFromAttendance()` drops `attendance.game.id` when it maps a real attendance. So
 * the shape is widened here with an optional `gameId`, which is what a row should be
 * opened by, and the fallback below covers the fixtures until the shape carries it.
 * Adding the field belongs in `features/data/shapes.ts` + `supabase.ts`, which this change
 * does not own.
 */
type GameRow = GameRowFixture & { gameId?: string };

const SEGMENTS = ['History', 'Upcoming', 'Imports'] as const;

/**
 * What the "+" offers (docs/interactions.md, Games).
 *
 * "Log a game" is the search-and-log flow, which lives on the pre-redesign Games tab
 * because the log sheet at `/games/log/[gameId]` needs a game that has already been found.
 * The other two are screens of their own.
 */
const ADD_ACTIONS: readonly { label: string; href: Href }[] = [
  { label: 'Log a game', href: '/legacy-games?segment=log' },
  { label: 'Log a season', href: '/games/bulk' },
  { label: 'Upload tickets', href: '/games/import' },
];

export function GamesScreen({ initialSegment = 'History' }: { initialSegment?: string }) {
  return (
    <ReferenceThemeProvider team="none">
      <Body initialSegment={initialSegment} />
    </ReferenceThemeProvider>
  );
}

/**
 * The date at the end of a row's `meta`, e.g. "Citizens Bank Park, Oct 12, 2024".
 *
 * That is the only thing on the row that says when the game is: both the demo fixtures and
 * `gameRowFromAttendance()` write the date with
 * `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`, so
 * this matches the format both produce rather than guessing at prose.
 */
const META_DATE = /([A-Za-z]{3,}) (\d{1,2}), (\d{4})$/;

function rowDate(meta: string): number | null {
  const m = META_DATE.exec(meta.trim());
  if (!m) return null;
  const t = Date.parse(`${m[1]} ${m[2]}, ${m[3]} 00:00:00`);
  return Number.isNaN(t) ? null : t;
}

/**
 * History is everything already played; Upcoming is everything still to come.
 *
 * The repository has one list — `games()` is the user's attendances — and no notion yet of
 * a game you have said you are going to, so this splits on the row's own date. A row whose
 * date cannot be read counts as history, because `games()` is a history list and hiding a
 * row is worse than showing it in the segment it was already in.
 */
function isUpcoming(game: GameRow, now: number): boolean {
  const at = rowDate(game.meta);
  return at != null && at > now;
}

/** Substring match over everything the row shows: teams and scores, venue and date, who. */
function matches(game: GameRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return `${game.title} ${game.meta} ${game.withText}`.toLowerCase().includes(q);
}

/**
 * The id a row opens.
 *
 * Until `GameRowFixture` carries the game's uuid, the demo rows have nothing else that
 * identifies them, so the title is passed through rather than a made-up id. Game detail
 * will not find a game by title and will say so; the row is still genuinely wired, and the
 * day the shape carries `gameId` this returns it with no other change here.
 */
function routeId(game: GameRow): string {
  return game.gameId ?? game.title;
}

function Body({ initialSegment }: { initialSegment: string }) {
  const { base } = useReferenceTheme();
  const repo = useRepository();
  const famousIds = useMyFamousGameIds();
  const router = useRouter();
  const [segment, setSegment] = React.useState(initialSegment);
  const [query, setQuery] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const insets = useSafeAreaInsets();
  const Plus = ICONS['i-plus'];
  const Search = ICONS['i-search'];

  // Read once per mount rather than per render: the History / Upcoming boundary should
  // not move because React happened to re-render, and the clock is not pure.
  const [now] = React.useState(() => Date.now());

  const all: readonly GameRow[] = repo.games();
  const rows = React.useMemo(() => {
    if (segment === 'Imports') return [];
    return all.filter(
      (game) => isUpcoming(game, now) === (segment === 'Upcoming') && matches(game, query),
    );
  }, [all, segment, query, now]);

  const selectSegment = (option: string) => {
    setSegment(option);
    // The imports inbox is its own screen: it confirms or discards a parsed ticket, which
    // is a different job from listing games, and the repository serves nothing for it. The
    // segment opens it and the pane behind says where it went, rather than reusing the
    // list and showing the wrong rows (docs/interactions.md, "worse than inert").
    if (option === 'Imports') router.push('/games/imports');
  };

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
        keyboardShouldPersistTaps="handled"
      >
        {/* `.fx-head` with `margin-bottom:0` overridden inline on this screen. */}
        <View style={s.head}>
          <Text style={[s.title, { color: base.ink }]}>Games</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add games"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(true)}
            style={[s.iconButton, { borderColor: base.line, backgroundColor: base.card }]}
          >
            <Plus size={18} color={base.ink} />
          </Pressable>
        </View>

        <View style={[s.search, { borderColor: base.line, backgroundColor: base.card }]}>
          <Search size={16} color={base.muted} />
          <TextInput
            accessibilityRole="search"
            accessibilityLabel="Search games"
            style={[s.searchText, { color: base.ink }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search attended games, stadiums, teams..."
            placeholderTextColor={base.muted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        <Segmented options={SEGMENTS} selected={segment} onSelect={selectSegment} />

        {rows.map((game, i) => (
          <TeamTheme key={`${game.title}-${i}`} team={game.team}>
            <GameRowCard
              game={game}
              famous={!!game.gameId && famousIds.has(game.gameId)}
              personFor={repo.person}
              onPress={() => router.push(`/games/${routeId(game)}` as Href)}
            />
          </TeamTheme>
        ))}

        {rows.length === 0 ? (
          <EmptyPane
            segment={segment}
            query={query}
            onOpenImports={() => router.push('/games/imports')}
          />
        ) : null}
      </ScrollView>

      {/*
        The "+" menu. Rendered only while open and over everything, so the screen the
        parity harness measures is unchanged.
      */}
      {menuOpen ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={() => setMenuOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              s.menu,
              { top: insets.top + 50, borderColor: base.line, backgroundColor: base.card },
            ]}
          >
            {ADD_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  setMenuOpen(false);
                  router.push(action.href);
                }}
                style={s.menuItem}
              >
                <Text style={[s.menuText, { color: base.ink }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <TabBar active="Games" />
    </View>
  );
}

/**
 * What a segment shows when it has no rows.
 *
 * Upcoming and Imports are empty by construction rather than by accident — the repository
 * serves attended games and nothing else — so each says so instead of borrowing History's
 * list.
 */
function EmptyPane({
  segment,
  query,
  onOpenImports,
}: {
  segment: string;
  query: string;
  onOpenImports: () => void;
}) {
  const { base } = useReferenceTheme();
  const searching = query.trim() !== '';
  // "You have logged no games" and "your games have not arrived yet" are different claims,
  // and the History segment is where the difference is most visible.
  const loading = useRepositoryStatus() === 'loading';
  const body = loading
    ? 'Loading your games…'
    : searching
      ? `No games match "${query.trim()}".`
      : segment === 'Upcoming'
        ? 'Nothing coming up. Games you have said you are going to will show here once your passport tracks them; today it holds the games you have already attended.'
        : segment === 'Imports'
          ? 'Tickets you upload are confirmed on their own screen.'
          : 'No games yet. Add one with the + button.';
  return (
    <View style={[s.empty, { borderColor: base.line, backgroundColor: base.card }]}>
      <Text style={[s.emptyText, { color: base.muted }]}>{body}</Text>
      {segment === 'Imports' && !searching && !loading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open imports"
          onPress={onOpenImports}
        >
          <Text style={[s.emptyLink, { color: base.link }]}>Open imports</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** `.fx-seg`. */
function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string;
  onSelect: (option: string) => void;
}) {
  const { base } = useReferenceTheme();
  return (
    <View style={[s.seg, { borderColor: base.line, backgroundColor: base.card }]}>
      {options.map((option) => {
        const on = option === selected;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityLabel={option}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(option)}
            style={[s.segItem, on ? { backgroundColor: base.surface } : null]}
          >
            <Text style={[on ? s.segTextOn : s.segText, { color: on ? base.ink : base.muted }]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `.fx-row`. */
function GameRowCard({
  game,
  personFor,
  onPress,
  famous = false,
}: {
  game: GameRow;
  /** A famous game: a small gold mark after the title. Never in demo mode. */
  famous?: boolean;
  /** Resolves an avatar key to a real person, or to null for the demo's drawn faces. */
  personFor: (key: string) => PersonRef | null;
  onPress: () => void;
}) {
  const { base } = useReferenceTheme();
  const Check = ICONS['i-check-c'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}, ${game.meta}`}
      onPress={onPress}
      style={[s.row, { borderColor: base.line, backgroundColor: base.card }]}
    >
      <View style={s.thumb}>
        <GameThumb shapeKey={game.shape} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTitleLine}>
          <Text style={[s.rowTitle, { color: base.ink }]} numberOfLines={1}>
            {game.title}
          </Text>
          <Check size={14} color={base.good} />
          {famous ? <FamousMark color={base.warn} /> : null}
        </View>
        <Text style={[s.rowMeta, { color: base.muted }]} numberOfLines={1}>
          {game.meta}
        </Text>
        {game.withAvatars.length > 0 ? (
          <View style={s.avatars}>
            {game.withAvatars.map((who, i) => (
              <View
                key={`${who}-${i}`}
                // `.avs svg{margin-right:-6px;border:2px solid var(--card)}` on this row,
                // so the avatars overlap and each is ringed in the card colour.
                style={[s.avatar, { borderColor: base.card }, i > 0 ? { marginLeft: -6 } : null]}
              >
                <RepositoryAvatar who={who} person={personFor(who)} size={17} />
              </View>
            ))}
            <Text style={[s.avatarsText, { color: base.muted }]} numberOfLines={1}>
              {game.withText}
            </Text>
          </View>
        ) : null}
      </View>
      {game.result ? <ResultPip result={game.result} /> : null}
    </Pressable>
  );
}

/** `.fx-res`: a filled circle, not the outlined `.circ` the earlier screens use. */
function ResultPip({ result }: { result: 'w' | 'l' }) {
  const { base } = useReferenceTheme();
  return (
    <View style={[s.res, { backgroundColor: result === 'w' ? base.good : base.bad }]}>
      <Text style={s.resText}>{result.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  title: { fontSize: 28, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -28 * 0.01 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: border.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.fx-search{padding:9px 11px;margin:12px 0 10px}`
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: border.card,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 12,
    marginBottom: 10,
  },
  // The type is the reference's; `padding:0` and `includeFontPadding:false` only undo the
  // extra box a TextInput brings of its own, so the field keeps the `.fx-search` height it
  // had when this was a Text.
  searchText: {
    fontSize: 12.5,
    fontFamily: fontFamily(),
    flex: 1,
    padding: 0,
    includeFontPadding: false,
  },

  // `.fx-seg{padding:3px;margin-bottom:12px}`
  seg: {
    flexDirection: 'row',
    borderWidth: border.card,
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: 12,
  },
  segItem: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  segText: { fontSize: 12.5, fontFamily: fontFamily() },
  segTextOn: { fontSize: 12.5, fontFamily: fontFamily({ weight: 750 }) },

  // Not in the reference: it has no empty state and no menu, because its sample data is
  // never empty and its "+" does nothing. Both are built from the same tokens as the rest
  // of the screen (SPEC.md 8.8).
  empty: {
    borderWidth: border.card,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 2,
  },
  emptyText: { fontSize: 12.5, fontFamily: fontFamily(), lineHeight: 18 },
  emptyLink: { fontSize: 12.5, fontFamily: fontFamily({ weight: 750 }), marginTop: 8 },
  menu: {
    position: 'absolute',
    right: screenPadding.horizontal,
    minWidth: 172,
    borderWidth: border.card,
    borderRadius: radius.md,
    paddingVertical: 4,
  },
  menuItem: { paddingVertical: 10, paddingHorizontal: 13 },
  menuText: { fontSize: 13, fontFamily: fontFamily({ weight: 750 }) },

  // `.fx-row{gap:11px;padding:10px;margin-bottom:8px}`
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: border.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8,
  },
  // `.fx-th{width:42px;height:42px;border-radius:9px;overflow:hidden}`
  thumb: { width: 42, height: 42, borderRadius: 9, overflow: 'hidden' },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowTitle: { fontSize: 13.5, fontFamily: fontFamily({ weight: 800 }) },
  rowMeta: { fontSize: 11, fontFamily: fontFamily(), marginTop: 2 },

  avatars: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  avatar: { width: 17, height: 17, borderRadius: 8.5, borderWidth: 2, overflow: 'hidden' },
  avatarsText: { fontSize: 11, fontFamily: fontFamily(), marginLeft: 12, flex: 1 },

  // `.fx-res{width:28px;height:28px;font-size:11.5px;font-weight:900;color:#fff}`
  res: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resText: { fontSize: 11.5, fontFamily: fontFamily({ weight: 900 }), color: '#FFFFFF' },
});
