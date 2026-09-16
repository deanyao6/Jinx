import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/reference/Avatar';
import { SlideOver } from '@/components/reference/SlideOver';
import { ICONS, type IconName } from '@/components/reference/icons';
import { useRepository } from '@/features/data/context';
import { TabBar } from '@/features/passport/reference/parts';

import { FriendsPanel } from './FriendsPanel';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, screenPadding } from '@/theme/reference/tokens';

/**
 * Profile, ported from the seventh phone in `design/reference.html` (SPEC.md 8.8.7).
 * The Friends row opens the Friends panel; see FriendsPanel.
 */
export function ProfileScreen({ initialPanel }: { initialPanel?: 'friends' }) {
  const profile = useRepository().profile();
  const [panel, setPanel] = React.useState<'friends' | null>(initialPanel ?? null);
  return (
    <ReferenceThemeProvider team={profile.team}>
      <Body onOpenPanel={setPanel} />
      {panel === 'friends' ? (
        <SlideOver open initiallyOpen={initialPanel != null}>
          <FriendsPanel onClose={() => setPanel(null)} />
        </SlideOver>
      ) : null}
    </ReferenceThemeProvider>
  );
}

function Body({ onOpenPanel }: { onOpenPanel: (panel: 'friends') => void }) {
  const { base, team } = useReferenceTheme();
  const profile = useRepository().profile();
  const insets = useSafeAreaInsets();
  const Gear = ICONS['i-gear'];
  const Chevron = ICONS['i-chev-r'];

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
          <Text style={[s.handle, { color: base.ink }]}>{profile.handle}</Text>
          <View style={[s.iconButton, { backgroundColor: base.surface }]}>
            <Gear size={20} color={base.ink} />
          </View>
        </View>

        <View style={s.prof}>
          {/* `.prof .pfp` is a ring in the user's team colour with 3px of padding inside. */}
          <View style={[s.pfp, { borderColor: team.accent, backgroundColor: base.scr }]}>
            <View style={s.pfpInner}>
              <Avatar name={profile.avatar} size={80} />
            </View>
          </View>
          <Text style={[s.name, { color: base.ink }]}>{profile.name}</Text>
          <Text style={[s.tagline, { color: base.muted }]}>{profile.tagline}</Text>
          <View style={s.chips}>
            {profile.teamChips.map((chip) => (
              <TeamTheme key={chip.team} team={chip.team}>
                <TeamChip label={chip.label} />
              </TeamTheme>
            ))}
          </View>
        </View>

        <View style={[s.stats, { borderTopColor: base.line, borderBottomColor: base.line }]}>
          {profile.stats.map((stat) => (
            <View key={stat.label} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.statValue, { color: base.ink }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: base.muted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View>
          {profile.rows.map((row, i) => {
            const Icon = ICONS[row.icon as IconName];
            return (
              <Pressable
                key={row.title}
                accessibilityRole="button"
                // Only the Friends row has a destination so far; the rest are M8 and M9.
                onPress={row.facepile ? () => onOpenPanel('friends') : undefined}
                style={[
                  s.navrow,
                  i > 0 ? { borderTopWidth: border.hairline, borderTopColor: base.line } : null,
                ]}
              >
                <View style={[s.navIcon, { backgroundColor: base.surface }]}>
                  {Icon ? <Icon size={20} color={team.accent} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.navTitle, { color: base.ink }]}>{row.title}</Text>
                  <Text style={[s.navMeta, { color: base.muted }]}>{row.meta}</Text>
                </View>
                {row.facepile ? (
                  <View style={s.facepile}>
                    {profile.facepile.map((who) => (
                      <View key={who} style={[s.face, { borderColor: base.scr }]}>
                        <Avatar name={who} size={26} />
                      </View>
                    ))}
                  </View>
                ) : null}
                <Chevron size={20} color={base.muted} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <TabBar active="Profile" />
    </View>
  );
}

/** `.tchip`: a team dot with an inset ring in the secondary colour, plus the name. */
function TeamChip({ label }: { label: string }) {
  const { base, team } = useReferenceTheme();
  return (
    <View style={[s.chip, { backgroundColor: base.surface }]}>
      {/* `box-shadow:inset 0 0 0 3px var(--t2)` is an inset ring; React Native has no
          inset shadow, so it is a 3px border on a dot of the same size. */}
      <View style={[s.chipDot, { backgroundColor: team.accent, borderColor: team.second }]} />
      <Text style={[s.chipText, { color: base.ink }]}>{label}</Text>
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
  handle: { fontSize: 20, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -20 * 0.01 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.prof{text-align:center;padding-top:6px}`
  prof: { alignItems: 'center', paddingTop: 6 },
  // `.prof .pfp{width:92px;height:92px;border:3px solid var(--t);padding:3px}`
  pfp: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pfpInner: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden' },
  name: { fontSize: 22, fontFamily: fontFamily({ weight: 850 }), marginTop: 10 },
  tagline: { fontSize: 13.5, fontFamily: fontFamily() },

  // `.chips{gap:6px;margin:10px 0 2px}`
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 2 },
  // `.tchip{padding:4px 10px 4px 5px}`
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 5,
    paddingRight: 10,
  },
  chipDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  chipText: { fontSize: 12.5, fontFamily: fontFamily({ weight: 700 }) },

  // `.stats{margin:14px 0 6px;padding:10px 0}` with rules above and below.
  stats: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  statValue: { fontSize: 20, fontFamily: fontFamily({ width: 74, weight: 850 }) },
  statLabel: { fontSize: 11.5, fontFamily: fontFamily() },

  // `.navrow{gap:12px;padding:12px 0}`
  navrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { fontSize: 14.5, fontFamily: fontFamily({ weight: 700 }) },
  navMeta: { fontSize: 12.5, fontFamily: fontFamily() },
  // `.facepile svg{width:26px;height:26px;border:2px solid var(--scr);margin-left:-8px}`
  facepile: { flexDirection: 'row' },
  face: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    marginLeft: -8,
    overflow: 'hidden',
  },
});
