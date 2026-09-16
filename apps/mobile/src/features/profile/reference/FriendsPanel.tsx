import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/reference/Avatar';
import { ICONS } from '@/components/reference/icons';
import { FRIENDS, PROFILE } from '@/features/demo/fixtures';
import { TabBar } from '@/features/passport/reference/parts';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, screenPadding } from '@/theme/reference/tokens';

/**
 * The Friends slide-over, ported from `.panel#friends` (SPEC.md 8.8.8).
 *
 * Opens from Profile's Friends row. The companion records, the rivalry card and the
 * "before you connected" card, with every person ringed in their own team's colour.
 */
export function FriendsPanel() {
  return (
    <ReferenceThemeProvider team={PROFILE.team}>
      <Body />
    </ReferenceThemeProvider>
  );
}

function Body() {
  const { base } = useReferenceTheme();
  const insets = useSafeAreaInsets();
  const Back = ICONS['i-chev-l'];
  const Search = ICONS['i-search'];
  const Swords = ICONS['i-swords'];

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
          <View style={s.row}>
            <View style={[s.iconButton, { backgroundColor: base.surface }]}>
              <Back size={20} color={base.ink} />
            </View>
            <Text style={[s.topTitle, { color: base.ink }]}>Friends</Text>
          </View>
          <View style={[s.iconButton, { backgroundColor: base.surface }]}>
            <Search size={20} color={base.ink} />
          </View>
        </View>

        <View style={[s.seg, { backgroundColor: base.surface }]}>
          {FRIENDS.tabs.map((tab, i) => {
            const on = i === 0;
            return (
              <View key={tab} style={[s.segItem, on ? { backgroundColor: base.scr } : null]}>
                <Text style={[on ? s.segTextOn : s.segText, { color: on ? base.ink : base.muted }]}>
                  {tab}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={[s.note, { color: base.muted }]}>{FRIENDS.note}</Text>

        <View>
          {FRIENDS.people.map((person, i) => (
            <TeamTheme key={person.key} team={person.team}>
              <FriendRow person={person} first={i === 0} />
            </TeamTheme>
          ))}
        </View>

        {/* The rivalry card takes the rival's team colour. */}
        <TeamTheme team={FRIENDS.rivalry.team}>
          <RivalryCard>
            <Swords size={20} color={base.muted} />
          </RivalryCard>
        </TeamTheme>

        <View style={[s.card, { backgroundColor: base.surface }]}>
          <Text style={[s.cardLabel, { color: base.muted }]}>{FRIENDS.overlap.label}</Text>
          <Text style={[s.overlapText, { color: base.ink }]}>{FRIENDS.overlap.text}</Text>
        </View>
      </ScrollView>
      <TabBar active="Profile" />
    </View>
  );
}

/** `.fr`: a ringed photo, name with the team dot, and the record in its tone colour. */
function FriendRow({ person, first }: { person: (typeof FRIENDS.people)[number]; first: boolean }) {
  const { base, team } = useReferenceTheme();
  const tone = person.tone === 'good' ? base.good : person.tone === 'bad' ? base.bad : base.ink;
  return (
    <View
      style={[s.fr, first ? null : { borderTopWidth: border.hairline, borderTopColor: base.line }]}
    >
      <View style={[s.frPfp, { borderColor: team.accent }]}>
        <View style={s.frPfpInner}>
          <Avatar name={person.key} size={38} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.frName, { color: base.ink }]}>{person.name}</Text>
        <View style={s.frMetaRow}>
          <View style={[s.frDot, { backgroundColor: team.accent }]} />
          <Text style={[s.frMeta, { color: base.muted }]} numberOfLines={1}>
            {`${person.teamName}, ${person.sub}`}
          </Text>
        </View>
      </View>
      <Text style={[s.frRecord, { color: tone }]}>{person.record}</Text>
    </View>
  );
}

/** `.card.t-nym` with the head-to-head `.vs` row. */
function RivalryCard({ children }: { children: React.ReactNode }) {
  const { base, team } = useReferenceTheme();
  const r = FRIENDS.rivalry;
  return (
    <View style={[s.card, { backgroundColor: base.surface }]}>
      <Text style={[s.cardLabel, { color: base.muted }]}>{r.label}</Text>
      <View style={s.vs}>
        <View style={{ alignItems: 'center' }}>
          {/* "You" is scored in your own team colour, the rival in theirs. */}
          <TeamTheme team={r.you.team}>
            <VsScore value={r.you.score} />
          </TeamTheme>
          <Text style={[s.vsLabel, { color: base.muted }]}>{r.you.label}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          {children}
          <Text style={[s.vsMiddle, { color: base.muted }]}>{r.middle}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[s.vsScore, { color: team.accent }]}>{r.them.score}</Text>
          <Text style={[s.vsLabel, { color: base.muted }]}>{r.them.label}</Text>
        </View>
      </View>
    </View>
  );
}

function VsScore({ value }: { value: string }) {
  const { team } = useReferenceTheme();
  return <Text style={[s.vsScore, { color: team.accent }]}>{value}</Text>;
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topTitle: { fontSize: 24, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -24 * 0.01 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 6 },
  segItem: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segText: { fontSize: 13.5, fontFamily: fontFamily() },
  segTextOn: { fontSize: 13.5, fontFamily: fontFamily({ weight: 750 }) },

  note: {
    fontSize: 13,
    lineHeight: 13 * 1.45,
    marginTop: 6,
    marginBottom: 2,
    fontFamily: fontFamily(),
  },

  // `.fr{gap:12px;padding:10px 0}`
  fr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  // `.fr .pfp{width:46px;height:46px;padding:2px;border:2px solid var(--t)}`
  frPfp: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frPfpInner: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  frName: { fontSize: 14.5, fontFamily: fontFamily({ weight: 700 }) },
  frMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  frDot: { width: 9, height: 9, borderRadius: 4.5 },
  frMeta: { fontSize: 12.5, fontFamily: fontFamily(), flex: 1 },
  frRecord: { fontSize: 19, fontFamily: fontFamily({ width: 64, weight: 900 }) },

  // `.card{border-radius:18px;padding:13px;margin-top:10px}`
  card: { borderRadius: 18, padding: 13, marginTop: 10 },
  cardLabel: { fontSize: 12.5, marginBottom: 6, fontFamily: fontFamily() },
  vs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vsScore: {
    fontSize: 42,
    lineHeight: 42 * 0.9,
    fontFamily: fontFamily({ width: 62, weight: 900 }),
  },
  vsLabel: { fontSize: 12, fontFamily: fontFamily() },
  vsMiddle: { fontSize: 13, fontFamily: fontFamily() },
  overlapText: { fontSize: 14, lineHeight: 14 * 1.45, fontFamily: fontFamily() },
});
