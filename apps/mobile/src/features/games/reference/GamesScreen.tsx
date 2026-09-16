import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/reference/Avatar';
import { GameThumb } from '@/components/reference/GameThumb';
import { ICONS } from '@/components/reference/icons';
import { useRepository } from '@/features/data/context';
import type { GameRowFixture } from '@/features/data/shapes';
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
 */
export function GamesScreen({ initialSegment = 'History' }: { initialSegment?: string }) {
  return (
    <ReferenceThemeProvider team="none">
      <Body initialSegment={initialSegment} />
    </ReferenceThemeProvider>
  );
}

function Body({ initialSegment }: { initialSegment: string }) {
  const { base } = useReferenceTheme();
  const repo = useRepository();
  const [segment, setSegment] = React.useState(initialSegment);
  const insets = useSafeAreaInsets();
  const Plus = ICONS['i-plus'];
  const Search = ICONS['i-search'];

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
        {/* `.fx-head` with `margin-bottom:0` overridden inline on this screen. */}
        <View style={s.head}>
          <Text style={[s.title, { color: base.ink }]}>Games</Text>
          <View style={[s.iconButton, { borderColor: base.line, backgroundColor: base.card }]}>
            <Plus size={18} color={base.ink} />
          </View>
        </View>

        <View style={[s.search, { borderColor: base.line, backgroundColor: base.card }]}>
          <Search size={16} color={base.muted} />
          <Text style={[s.searchText, { color: base.muted }]} numberOfLines={1}>
            Search attended games, stadiums, teams...
          </Text>
        </View>

        <Segmented
          options={['History', 'Upcoming', 'Imports']}
          selected={segment}
          onSelect={setSegment}
        />

        {repo.games().map((game, i) => (
          <TeamTheme key={`${game.title}-${i}`} team={game.team}>
            <GameRow game={game} />
          </TeamTheme>
        ))}
      </ScrollView>
      <TabBar active="Games" />
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
function GameRow({ game }: { game: GameRowFixture }) {
  const { base } = useReferenceTheme();
  const Check = ICONS['i-check-c'];
  return (
    <View style={[s.row, { borderColor: base.line, backgroundColor: base.card }]}>
      <View style={s.thumb}>
        <GameThumb shapeKey={game.shape} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTitleLine}>
          <Text style={[s.rowTitle, { color: base.ink }]} numberOfLines={1}>
            {game.title}
          </Text>
          <Check size={14} color={base.good} />
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
                <Avatar name={who} size={17} />
              </View>
            ))}
            <Text style={[s.avatarsText, { color: base.muted }]} numberOfLines={1}>
              {game.withText}
            </Text>
          </View>
        ) : null}
      </View>
      {game.result ? <ResultPip result={game.result} /> : null}
    </View>
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
  searchText: { fontSize: 12.5, fontFamily: fontFamily(), flex: 1 },

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
