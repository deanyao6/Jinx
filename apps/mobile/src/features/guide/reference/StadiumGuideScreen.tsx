import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import { Avatar } from '@/components/reference/Avatar';
import { ICONS, type IconName } from '@/components/reference/icons';
import { StadiumShape } from '@/components/reference/StadiumShape';
import { GUIDE, GUIDE_ROWS, scoreClass, type GuideRow } from '@/features/demo/fixtures';
import { TabBar } from '@/features/passport/reference/parts';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, screenPadding } from '@/theme/reference/tokens';

/**
 * Stadium guide, ported from the sixth phone in `design/reference.html` (SPEC.md 8.8.6).
 * A demo shell in v1, behind FEATURE_GUIDE.
 */
export function StadiumGuideScreen({ tab = 'food' }: { tab?: string }) {
  return (
    <ReferenceThemeProvider team={GUIDE.team}>
      <Body tab={tab} />
    </ReferenceThemeProvider>
  );
}

function Body({ tab }: { tab: string }) {
  const { base, team } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const Back = ICONS['i-chev-l'];
  const Share = ICONS['i-share'];
  const rows = GUIDE_ROWS[tab] ?? GUIDE_ROWS.food ?? [];

  return (
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
          <View style={[s.iconButton, { backgroundColor: base.surface }]}>
            <Back size={20} color={base.ink} />
          </View>
          <View style={[s.iconButton, { backgroundColor: base.surface }]}>
            <Share size={20} color={base.ink} />
          </View>
        </View>

        {/* `.vhero` puts the venue's stadium shape beside its name.
            NOTE: the reference renders the friends' avatars here at 88x88 rather than the
            20x20 every other avatar stack uses, because `.vhero svg` and `.avs svg` have
            identical specificity and `.vhero svg` is declared later, so it wins for the
            avatars too. That is a cascade collision, not a design decision, and it is why
            this screen does not reach the parity the others do. Kept at 20 here pending
            Dean's call; see OVERNIGHT.md. */}
        <View style={[s.vhero, { backgroundColor: base.surface }]}>
          <Svg
            width={88}
            height={88}
            viewBox="0 0 64 64"
            fill="none"
            stroke={team.accent}
            color={team.accent}
            strokeWidth={2}
          >
            <StadiumShape shapeKey={GUIDE.shape} />
          </Svg>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.venue, { color: base.ink }]}>{GUIDE.venue}</Text>
            <Text style={[s.venueSub, { color: base.muted }]}>{GUIDE.subtitle}</Text>
            <View style={s.avatars}>
              {GUIDE.visitors.map((who, i) => (
                <View
                  key={who}
                  style={[
                    s.avatar,
                    { borderColor: base.surface },
                    i > 0 ? { marginLeft: -6 } : null,
                  ]}
                >
                  <Avatar name={who} size={20} />
                </View>
              ))}
              <Text style={[s.avatarsText, { color: base.muted }]} numberOfLines={1}>
                {GUIDE.visitorsText}
              </Text>
            </View>
          </View>
        </View>

        {/* `.seg`, the earlier screens' segmented control. Note it is not `.fx-seg`: the
            radii, padding and selected fill all differ. */}
        <View style={[s.seg, { backgroundColor: base.surface }]}>
          {GUIDE.tabs.map((t) => {
            const on = t.key === tab;
            return (
              <View key={t.key} style={[s.segItem, on ? { backgroundColor: base.scr } : null]}>
                <Text style={[on ? s.segTextOn : s.segText, { color: on ? base.ink : base.muted }]}>
                  {t.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View>
          {rows.map((row, i) => (
            <GuideListRow key={row.title} row={row} first={i === 0} />
          ))}
        </View>
      </ScrollView>
      <TabBar active="Games" />
    </View>
  );
}

/** `.li` with a score `.circ` whose colour comes from the score, not the team. */
function GuideListRow({ row, first }: { row: GuideRow; first: boolean }) {
  const { base, team } = useReferenceTheme();
  const Icon = ICONS[row.icon as IconName];
  const cls = scoreClass(row.score);
  const color = cls === 's-hi' ? base.good : cls === 's-mid' ? base.warn : base.bad;

  return (
    <View
      style={[s.li, first ? null : { borderTopWidth: border.hairline, borderTopColor: base.line }]}
    >
      <View style={[s.liIcon, { backgroundColor: base.surface }]}>
        {Icon ? <Icon size={20} color={team.accent} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.liTitle, { color: base.ink }]}>{row.title}</Text>
        <Text style={[s.liMeta, { color: base.muted }]} numberOfLines={1}>
          {row.meta}
        </Text>
      </View>
      <View style={[s.circ, { borderColor: color }]}>
        <Text style={[s.circText, { color }]}>{row.score}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.vhero{border-radius:22px;padding:12px;gap:12px;margin-bottom:10px}`
  vhero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    padding: 12,
    marginBottom: 10,
  },
  // `.vhero b{font-size:19px;font-weight:850;line-height:1.1}`
  venue: { fontSize: 19, lineHeight: 19 * 1.1, fontFamily: fontFamily({ weight: 850 }) },
  // `.vhero span{font-size:12.5px;color:var(--muted)}`
  venueSub: { fontSize: 12.5, fontFamily: fontFamily() },
  avatars: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  avatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, overflow: 'hidden' },
  avatarsText: { fontSize: 12, marginLeft: 12, fontFamily: fontFamily(), flex: 1 },

  // `.seg{border-radius:12px;padding:3px;margin-bottom:6px}`
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 6 },
  segItem: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segText: { fontSize: 13.5, fontFamily: fontFamily() },
  segTextOn: { fontSize: 13.5, fontFamily: fontFamily({ weight: 750 }) },

  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  liIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liTitle: { fontSize: 14.5, fontFamily: fontFamily({ weight: 700 }) },
  liMeta: { fontSize: 12.5, fontFamily: fontFamily() },
  circ: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circText: { fontSize: 15, fontFamily: fontFamily({ width: 80, weight: 850 }) },
});
