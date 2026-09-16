import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { ICONS } from '@/components/reference/icons';
import { StadiumShape } from '@/components/reference/StadiumShape';
import { useRepository } from '@/features/data/context';
import type { GameLogFixture, LogRowFixture } from '@/features/data/shapes';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, screenPadding } from '@/theme/reference/tokens';

import { TabBar } from './parts';

/**
 * The record game log, ported from `.panel#logPanel` in `design/reference.html`
 * (SPEC.md 8.8.9). It slides in over the Passport screen from any record card.
 *
 * This screen is one of the earlier-concept ones, so it uses the older component classes
 * (`.top`, `.loghead`, `.li`, `.thumb`, `.circ`) rather than the `fx-` set, exactly as the
 * reference draws it. A later design pass will restyle it.
 */
export function GameLogPanel({
  log,
  title,
  record,
  onClose,
}: {
  /** Which log to show, keyed as in the reference's LOGS object. */
  log: string;
  /** The record card's label, e.g. "Phillies". Neutral shows as "As a neutral". */
  title: string;
  /** The record from the card that opened it, e.g. "12 - 5". */
  record: string;
  onClose?: () => void;
}) {
  const repo = useRepository();
  const data = repo.gameLog(log);
  if (!data) throw new Error(`no game log for "${log}"`);

  // A screen root, so it establishes the theme rather than nesting inside one.
  // <TeamTheme> re-themes a subtree and requires a provider above it; in the real app this
  // panel will sit inside Passport's provider, but the parity harness mounts it alone.
  return (
    <ReferenceThemeProvider team={data.teamKey}>
      <PanelBody data={data} title={title} record={record} onClose={onClose ?? (() => {})} />
    </ReferenceThemeProvider>
  );
}

function PanelBody({
  data,
  title,
  record,
  onClose,
}: {
  data: GameLogFixture;
  title: string;
  record: string;
  onClose: () => void;
}) {
  const { base, team } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const Back = ICONS['i-chev-l'];
  const Share = ICONS['i-share'];

  return (
    // `.panel` fills the screen and uses --scr, not the canvas the Passport screen uses.
    <View style={{ flex: 1, backgroundColor: base.scr, paddingTop: insets.top }}>
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
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to passport"
              onPress={onClose}
              style={[s.iconButton, { backgroundColor: base.surface }]}
            >
              <Back size={20} color={base.ink} />
            </Pressable>
            <Text style={[s.topTitle, { color: base.ink }]}>{title}</Text>
          </View>
          <View style={[s.iconButton, { backgroundColor: base.surface }]}>
            <Share size={20} color={base.ink} />
          </View>
        </View>

        {/* `.loghead` takes the record's own team colour. */}
        <View style={[s.logHead, { backgroundColor: team.accent }]}>
          <Text style={[s.logHeadLabel, { color: team.onFill }]}>{data.sub}</Text>
          <Text style={[s.logHeadRecord, { color: team.onFill }]}>{record}</Text>
          <Text style={[s.logHeadLabel, { color: team.onFill }]}>{data.meta}</Text>
        </View>

        <View>
          {data.rows.map((row, i) => (
            <LogRow key={`${row.title}-${i}`} row={row} first={i === 0} />
          ))}
        </View>

        <Text style={[s.more, { color: base.muted }]}>{data.more}</Text>
      </ScrollView>
      {/* Only `.loghead` carries the record's team class in the reference. The tab bar
          sits on `.scr`, which is `t-none`, so it stays neutral. */}
      <TeamTheme team="none">
        <TabBar active="Passport" />
      </TeamTheme>
    </View>
  );
}

/** `.li` with a `.thumb` on the left and a `.circ` result on the right. */
function LogRow({ row, first }: { row: LogRowFixture; first: boolean }) {
  const { base } = useReferenceTheme();
  return (
    <TeamTheme team={row.team}>
      <View
        style={[
          s.li,
          first ? null : { borderTopWidth: border.hairline, borderTopColor: base.line },
        ]}
      >
        <Thumb shapeKey={row.shape} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.liTitle, { color: base.ink }]}>{row.title}</Text>
          <Text style={[s.liMeta, { color: base.muted }]} numberOfLines={1}>
            {row.meta}
          </Text>
        </View>
        <ResultCircle result={row.result} />
      </View>
    </TeamTheme>
  );
}

/** `.thumb`: the venue's stadium shape in the row's team colour on a surface tile. */
function Thumb({ shapeKey }: { shapeKey: string }) {
  const { base, team } = useReferenceTheme();
  return (
    <View style={[s.thumb, { backgroundColor: base.surface }]}>
      <Svg
        width={38}
        height={38}
        viewBox="0 0 64 64"
        fill="none"
        stroke={team.accent}
        strokeWidth={2.6}
      >
        <StadiumShape shapeKey={shapeKey} />
      </Svg>
    </View>
  );
}

/** `.circ` in its win/loss colour. Not team-tinted: `.circ.w` is --good, `.circ.l` is --bad. */
function ResultCircle({ result }: { result: 'w' | 'l' }) {
  const { base } = useReferenceTheme();
  const color = result === 'w' ? base.good : base.bad;
  return (
    <View style={[s.circ, { borderColor: color }]}>
      <Text style={[s.circText, { color }]}>{result.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // `.top{margin:6px 0 10px}`
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The panel header overrides `.top h2` to 22px inline in the reference markup.
  topTitle: { fontSize: 22, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -22 * 0.01 },
  // `.iconbtn{width:36px;height:36px;border-radius:50%}`
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.loghead{border-radius:22px;padding:14px 16px;margin-bottom:8px}`
  logHead: { borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  logHeadLabel: { fontSize: 13, opacity: 0.9, fontFamily: fontFamily() },
  // `.loghead b{font-size:56px;line-height:.85;margin:4px 0 2px}`
  logHeadRecord: {
    fontSize: 56,
    lineHeight: 56 * 0.85,
    fontFamily: fontFamily({ width: 62, weight: 900 }),
    marginTop: 4,
    marginBottom: 2,
  },

  // `.li{gap:12px;padding:11px 0}`
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  liTitle: { fontSize: 14.5, fontFamily: fontFamily({ weight: 700 }) },
  liMeta: { fontSize: 12.5, fontFamily: fontFamily() },

  // `.thumb{width:48px;height:48px;border-radius:14px}`
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.circ{width:42px;height:42px;border:2.5px solid currentColor;font-size:15px}`
  circ: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circText: { fontSize: 15, fontFamily: fontFamily({ width: 80, weight: 850 }) },

  // `.more{padding:10px 0 4px}`
  more: {
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    fontFamily: fontFamily(),
  },
});
