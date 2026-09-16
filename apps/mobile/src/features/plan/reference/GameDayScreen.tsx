import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/reference/Avatar';
import { ICONS, type IconName } from '@/components/reference/icons';
import { useRepository } from '@/features/data/context';
import { TabBar } from '@/features/passport/reference/parts';
import { fontFamily } from '@/theme/fonts';
import { ReferenceThemeProvider, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { screenPadding } from '@/theme/reference/tokens';

/**
 * Game day, ported from the fifth phone in `design/reference.html` (SPEC.md 8.8.5).
 * A demo shell in v1, behind FEATURE_PLAN.
 *
 * The screen takes the team the user is rooting for, not the home team, which is why an
 * away game at SoFi is still in Eagles colours.
 */
export function GameDayScreen() {
  const plan = useRepository().gameDay();
  return (
    <ReferenceThemeProvider team={plan.team}>
      <Body />
    </ReferenceThemeProvider>
  );
}

function Body() {
  const { base, team } = useReferenceTheme();
  const plan = useRepository().gameDay();
  const insets = useSafeAreaInsets();
  const Share = ICONS['i-share'];

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
          <Text style={[s.topTitle, { color: base.ink }]}>Game day</Text>
          <View style={[s.iconButton, { backgroundColor: base.surface }]}>
            <Share size={20} color={base.ink} />
          </View>
        </View>

        {/* `.ticket` with its `::before`/`::after` notches and the `.stripe` down the right. */}
        <View style={[s.ticket, { backgroundColor: team.accent }]}>
          <View style={[s.ticketStripe, { backgroundColor: team.second }]} />
          <View style={[s.notch, s.notchLeft, { backgroundColor: base.scr }]} />
          <View style={[s.notch, s.notchRight, { backgroundColor: base.scr }]} />
          <Text style={[s.ticketTitle, { color: team.onFill }]}>{plan.matchup}</Text>
          <Text style={[s.ticketWhen, { color: team.onFill }]}>{plan.when}</Text>
          <View style={[s.seatRow, { borderTopColor: mix(team.onFill, 0.4) }]}>
            {plan.seat.map((field) => (
              <View key={field.label}>
                <Text style={[s.seatLabel, { color: team.onFill }]}>{field.label}</Text>
                <Text style={[s.seatValue, { color: team.onFill }]}>{field.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.avatars}>
          {plan.companions.map((who, i) => (
            <View
              key={who}
              style={[s.avatar, { borderColor: base.scr }, i > 0 ? { marginLeft: -6 } : null]}
            >
              <Avatar name={who} size={20} />
            </View>
          ))}
          <Text style={[s.avatarsText, { color: base.muted }]}>{plan.companionsText}</Text>
        </View>

        <View style={s.timeline}>
          {plan.timeline.map((item, i) => {
            const Icon = ICONS[item.icon as IconName];
            const last = i === plan.timeline.length - 1;
            return (
              <View key={item.time} style={s.timelineItem}>
                <View>
                  <View
                    style={[
                      s.timelineIcon,
                      { backgroundColor: item.now ? team.accent : base.surface },
                    ]}
                  >
                    {Icon ? <Icon size={20} color={item.now ? team.onFill : team.accent} /> : null}
                  </View>
                  {/* `.tl li:not(:last-child)::after` is the connector down to the next item. */}
                  {last ? null : <View style={[s.timelineRule, { backgroundColor: base.line }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.timelineTime, { color: base.ink }]}>{item.time}</Text>
                  <Text style={[s.timelineText, { color: base.muted }]}>{item.text}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <TabBar active="Plan" />
    </View>
  );
}

/**
 * `color-mix(in srgb, var(--on) 40%, transparent)`. React Native has no runtime colour
 * mixing, and every `--on` in the reference is either white or near-black, so this
 * resolves the alpha directly. Recorded in design/PORTING_NOTES.md.
 */
function mix(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  topTitle: { fontSize: 28, fontFamily: fontFamily({ weight: 850 }), letterSpacing: -28 * 0.01 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // `.ticket{border-radius:22px;padding:16px;margin-bottom:12px;overflow:hidden}`
  ticket: { borderRadius: 22, padding: 16, marginBottom: 12, overflow: 'hidden' },
  ticketStripe: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 10 },
  // The two notches sit at 66% of the ticket's height, half outside each edge.
  notch: { position: 'absolute', top: '66%', width: 20, height: 20, borderRadius: 10 },
  notchLeft: { left: -10 },
  notchRight: { right: -10 },
  ticketTitle: {
    fontSize: 28,
    lineHeight: 28,
    fontFamily: fontFamily({ width: 66, weight: 900 }),
  },
  ticketWhen: { fontSize: 13, opacity: 0.85, marginTop: 4, fontFamily: fontFamily() },
  // `.ticket .seat{gap:18px;border-top:1.5px dashed;margin-top:16px;padding-top:10px}`
  seatRow: {
    flexDirection: 'row',
    gap: 18,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 16,
    paddingTop: 10,
  },
  seatLabel: { fontSize: 12, fontFamily: fontFamily() },
  seatValue: { fontSize: 20, fontFamily: fontFamily({ width: 70, weight: 700 }) },

  // `.avs{margin-top:5px}` with a 2px ring in the screen colour and a -6px overlap.
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, overflow: 'hidden' },
  avatarsText: { fontSize: 12, marginLeft: 12, fontFamily: fontFamily() },

  // `.tl{margin:6px 0 0}` with the inline 14px top margin from the markup.
  timeline: { marginTop: 14 },
  timelineItem: { flexDirection: 'row', gap: 12, paddingBottom: 14 },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `left:17px;top:38px;bottom:2px;width:2px` relative to the row.
  timelineRule: { position: 'absolute', left: 17, top: 38, bottom: -12, width: 2 },
  timelineTime: { fontSize: 14.5, fontFamily: fontFamily({ width: 78, weight: 850 }) },
  timelineText: { fontSize: 13, lineHeight: 13 * 1.4, marginTop: 1, fontFamily: fontFamily() },
});
