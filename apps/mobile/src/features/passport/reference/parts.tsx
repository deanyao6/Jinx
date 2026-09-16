import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ICONS, type IconName } from '@/components/reference/icons';
import { Seal } from '@/components/reference/Seal';
import { TightText } from '@/components/reference/TightText';
import { fontFamily } from '@/theme/fonts';
import { TeamTheme, useReferenceTheme } from '@/theme/reference/TeamTheme';
import { border, iconSize, radius, screenPadding } from '@/theme/reference/tokens';

/**
 * The Passport screen's components, ported from the `fx-` classes in
 * `design/reference.html` (SPEC.md 8.3). Sizes, weights, radii and spacing are the CSS
 * values; where a CSS feature has no native equivalent the substitution is recorded in
 * `design/PORTING_NOTES.md`.
 *
 * Each instance already carries its weight in the outlines, so nothing here sets
 * `fontWeight` as well; that would make iOS synthesise a second, fake bolding.
 */

/** `.fx-head` plus `.fx-word` and `.fx-sub`. */
export function Head({
  title,
  subtitle,
  onBellPress,
  onProfilePress,
}: {
  title: string;
  subtitle: string;
  onBellPress?: () => void;
  onProfilePress?: () => void;
}) {
  const { base } = useReferenceTheme();
  const Bell = ICONS['i-bell'];
  const User = ICONS['i-user'];
  return (
    <View style={s.head}>
      <View>
        <TightText fontSize={32} lineHeight={0.85} style={[s.word, { color: base.ink }]}>
          {title}
        </TightText>
        <Text style={[s.sub, { color: base.muted }]}>{subtitle}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton onPress={onBellPress} label="Notifications">
          <Bell size={18} color={base.ink} />
        </IconButton>
        <IconButton onPress={onProfilePress} label="Your profile">
          <User size={18} color={base.ink} />
        </IconButton>
      </View>
    </View>
  );
}

/** `.fx-ib`. */
export function IconButton({
  children,
  onPress,
  label,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  label?: string;
}) {
  const { base } = useReferenceTheme();
  const style = [s.iconButton, { borderColor: base.line, backgroundColor: base.card }];
  // Stays a View without an action, so decorative uses do not announce a dead button.
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

export type Pill = { key: string; label: string; count: string; team: string };

/** `.fx-pills` and `.fx-pill`. The rail bleeds to the screen edges, as the CSS does. */
export function Pills({
  pills,
  selected,
  onSelect,
}: {
  pills: readonly Pill[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.pillsRail}
      contentContainerStyle={s.pillsContent}
    >
      {pills.map((pill) => (
        <TeamTheme key={pill.key} team={pill.team}>
          <PillButton
            pill={pill}
            pressed={pill.key === selected}
            onPress={() => onSelect(pill.key)}
          />
        </TeamTheme>
      ))}
    </ScrollView>
  );
}

function PillButton({
  pill,
  pressed,
  onPress,
}: {
  pill: Pill;
  pressed: boolean;
  onPress: () => void;
}) {
  const { base, team, teamKey, scheme } = useReferenceTheme();

  // `.fx-pill[aria-pressed="true"]` fills with --tf and puts white on it, except that
  // the neutral pill in dark mode inverts to the ink colours instead. Both are explicit
  // rules in the reference rather than anything derivable.
  const neutralDark = teamKey === 'none' && scheme === 'dark';
  const fill = pressed ? (neutralDark ? '#F1F3F6' : team.fill) : base.card;
  const label = pressed ? (neutralDark ? '#0E1115' : '#FFFFFF') : base.ink;

  // `.fx-pill .n` takes --t, except on the neutral pill where it takes --muted.
  const countColor = pressed ? label : teamKey === 'none' ? base.muted : team.accent;
  const countBg = pressed ? 'rgba(255,255,255,0.22)' : base.surface;

  return (
    <Pressable
      testID={`pill-${pill.key}`}
      accessibilityRole="button"
      accessibilityState={{ selected: pressed }}
      onPress={onPress}
      style={[s.pill, { borderColor: pressed ? fill : base.line, backgroundColor: fill }]}
    >
      <Text style={[s.pillLabel, { color: label }]}>{pill.label}</Text>
      <View style={[s.pillCount, { backgroundColor: countBg }]}>
        <Text style={[s.pillCountText, { color: countColor }]}>{pill.count}</Text>
      </View>
    </Pressable>
  );
}

/**
 * `.fx-hero`. Two CSS features have no native equivalent here:
 *   the glow is `filter: blur(46px)` on a solid circle, drawn instead as a radial
 *   gradient that fades to transparent, which is what a heavy Gaussian on a disc
 *   approximates; and
 *   `::before` lays a 22px grid of 1px translucent lines over the card, drawn here as
 *   explicit hairline views.
 * Both are recorded in design/PORTING_NOTES.md.
 */
export function Hero({
  label,
  badge,
  record,
  winRate,
  streak,
  lastGame,
  onLastGamePress,
}: {
  label: string;
  badge: string;
  record: string;
  winRate: string;
  streak: string;
  lastGame: string;
  onLastGamePress?: () => void;
}) {
  const { team, teamKey } = useReferenceTheme();
  const Chevron = ICONS['i-chev-r'];
  const [width, setWidth] = React.useState(0);

  return (
    <View style={s.hero} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* linear-gradient(160deg,#1C2331 0%,#0B0F16 100%) */}
      <View style={StyleSheet.absoluteFill}>
        <HeroBackground width={width} />
      </View>

      {/* `.fx-hero.t-none .glow` is fully transparent, so All teams has no glow at all. */}
      {teamKey !== 'none' ? <Glow color={team.fill} /> : null}
      <GridTexture />

      <View style={s.heroRow1}>
        <Text style={s.heroLabel}>{label}</Text>
        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>{badge}</Text>
        </View>
      </View>

      <View style={s.heroRec}>
        <TightText fontSize={64} lineHeight={0.78} style={s.heroRecord}>
          {record}
        </TightText>
        <View>
          <TightText fontSize={19} lineHeight={1} style={s.heroWinRate}>
            {`WIN RATE ${winRate}`}
          </TightText>
          <Text style={s.heroStreak}>{streak}</Text>
        </View>
      </View>

      {onLastGamePress ? (
        <Pressable
          style={({ pressed }) => [s.heroLast, pressed && { opacity: 0.6 }]}
          onPress={onLastGamePress}
          accessibilityRole="button"
          accessibilityLabel={lastGame}
        >
          <View style={s.heroDot} />
          <Text style={s.heroLastText}>{lastGame}</Text>
          <Chevron size={16} color="#FFFFFF" />
        </Pressable>
      ) : (
        <View style={s.heroLast}>
          <View style={s.heroDot} />
          <Text style={s.heroLastText}>{lastGame}</Text>
          <Chevron size={16} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

function HeroBackground({ width }: { width: number }) {
  // `linear-gradient(160deg,#1C2331 0%,#0B0F16 100%)`. CSS measures the angle clockwise
  // from "to top", so 160deg points down and slightly right: the unit vector is
  // (sin 160, -cos 160) = (0.342, 0.940). react-native-svg takes endpoints rather than an
  // angle, so those components are given directly in objectBoundingBox units.
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id="heroBg" x1="0" y1="0" x2="0.342" y2="0.94">
          <Stop offset="0" stopColor="#1C2331" />
          <Stop offset="1" stopColor="#0B0F16" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width || '100%'} height="100%" fill="url(#heroBg)" />
    </Svg>
  );
}

/** `.fx-hero .glow`: a 170px disc of --tf, blurred 46px, at 55% opacity. */
function Glow({ color }: { color: string }) {
  const size = 170;
  return (
    <View style={{ position: 'absolute', right: -50, top: -60, width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.55" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.33" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

/** `.fx-hero::before`: a 22px grid of 1px rgba(255,255,255,.035) lines. */
function GridTexture() {
  const step = 22;
  const color = 'rgba(255,255,255,0.035)';
  const lines = Array.from({ length: 20 }, (_, i) => i * step);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines.map((y) => (
        <View
          key={`h${y}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: y,
            height: 1,
            backgroundColor: color,
          }}
        />
      ))}
      {lines.map((x) => (
        <View
          key={`v${x}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: x,
            width: 1,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export type RecordCard = { name: string; record: string; pct: string; team: string; log: string };

/** `.fx-cards` and `.fx-rc`. */
export function RecordCards({
  cards,
  onOpen,
}: {
  cards: readonly RecordCard[];
  onOpen: (log: string) => void;
}) {
  return (
    <View style={s.cards}>
      {cards.map((card) => (
        <TeamTheme key={card.log} team={card.team === 'neutral' ? 'none' : card.team}>
          <RecordCardView card={card} onPress={() => onOpen(card.log)} />
        </TeamTheme>
      ))}
    </View>
  );
}

function RecordCardView({ card, onPress }: { card: RecordCard; onPress: () => void }) {
  const { base, team } = useReferenceTheme();
  // `.fx-rc.neutral .lb` overrides the accent to --muted for the As a neutral card.
  const accent = card.team === 'neutral' ? base.muted : team.accent;
  return (
    <Pressable
      testID={`record-card-${card.log}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[s.recordCard, { backgroundColor: base.card, borderColor: base.line }]}
    >
      <View style={s.recordCardLabel}>
        <Text style={[s.recordCardName, { color: accent }]} numberOfLines={1}>
          {card.name}
        </Text>
        <View style={[s.recordCardDot, { backgroundColor: accent }]} />
      </View>
      <TightText fontSize={27} lineHeight={1} style={[s.recordCardValue, { color: base.ink }]}>
        {card.record}
      </TightText>
      <Text style={[s.recordCardPct, { color: base.muted }]}>{card.pct}</Text>
    </Pressable>
  );
}

/** `.fx-sh`. */
export function SectionHeader({
  title,
  action,
  onActionPress,
}: {
  title: string;
  action?: string;
  onActionPress?: () => void;
}) {
  const { base } = useReferenceTheme();
  return (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionTitle, { color: base.ink }]}>{title.toUpperCase()}</Text>
      {action ? (
        onActionPress ? (
          <Pressable
            onPress={onActionPress}
            accessibilityRole="link"
            accessibilityLabel={`${title}: ${action}`}
            hitSlop={8}
          >
            {({ pressed }) => (
              <Text style={[s.sectionAction, { color: base.link, opacity: pressed ? 0.6 : 1 }]}>
                {action}
              </Text>
            )}
          </Pressable>
        ) : (
          <Text style={[s.sectionAction, { color: base.link }]}>{action}</Text>
        )
      ) : null}
    </View>
  );
}

export type StampItem = {
  name: string;
  city: string;
  ring: string;
  shape: string;
  metal: 'brass' | 'silver';
};

/** `.fx-stamps` and `.fx-stamp`. */
export function Stamps({
  stamps,
  onStampPress,
}: {
  stamps: readonly StampItem[];
  onStampPress?: (stamp: StampItem) => void;
}) {
  const { base } = useReferenceTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.stampsRail}
      contentContainerStyle={s.stampsContent}
    >
      {stamps.map((stamp) => {
        const Tile = onStampPress ? Pressable : View;
        return (
          <Tile
            key={stamp.name}
            style={s.stamp}
            {...(onStampPress
              ? {
                  onPress: () => onStampPress(stamp),
                  accessibilityRole: 'button' as const,
                  accessibilityLabel: `${stamp.name}, ${stamp.city}`,
                }
              : {})}
          >
            <View style={{ marginBottom: 6 }}>
              <Seal
                ring={stamp.ring}
                shapeKey={stamp.shape}
                metal={stamp.metal}
                size={78}
                inkColor={base.ink}
              />
            </View>
            <Text style={[s.stampName, { color: base.ink }]} numberOfLines={1}>
              {stamp.name}
            </Text>
            <Text style={[s.stampCity, { color: base.muted }]} numberOfLines={1}>
              {stamp.city}
            </Text>
          </Tile>
        );
      })}
    </ScrollView>
  );
}

export type Superlative = { icon: string; label: string; value: string; chip: string };

/** `.fx-list`, `.fx-li` and `.fx-chip`. */
export function SuperlativeList({
  items,
  onItemPress,
}: {
  items: readonly Superlative[];
  onItemPress?: (item: Superlative) => void;
}) {
  const { base } = useReferenceTheme();
  return (
    <View style={[s.list, { backgroundColor: base.card, borderColor: base.line }]}>
      {items.map((item, i) => {
        const Icon = ICONS[item.icon as IconName];
        const Row = onItemPress ? Pressable : View;
        return (
          <Row
            key={item.label}
            style={[
              s.listItem,
              i > 0 ? { borderTopWidth: border.hairline, borderTopColor: base.line } : null,
            ]}
            {...(onItemPress
              ? {
                  onPress: () => onItemPress(item),
                  accessibilityRole: 'button' as const,
                  accessibilityLabel: `${item.label}: ${item.value}`,
                }
              : {})}
          >
            {Icon ? <Icon size={19} color={base.ink} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.listLabel, { color: base.muted }]}>{item.label}</Text>
              <Text style={[s.listValue, { color: base.ink }]}>{item.value}</Text>
            </View>
            {/* Real superlatives carry no context chip yet (see toSuperlatives). An empty
                chip draws a blank pill, which reads as a broken control rather than an
                absent one, so it is omitted instead. */}
            {item.chip ? (
              <View style={[s.chip, { borderColor: base.line, backgroundColor: base.surface }]}>
                <Text style={[s.chipText, { color: base.ink }]}>{item.chip}</Text>
              </View>
            ) : null}
          </Row>
        );
      })}
    </View>
  );
}

/** `.tabs`. The active tab takes the screen's team accent. */
/** Where each tab lives. The screens draw this bar themselves, so it navigates rather
 *  than being driven by a navigator's own tab bar, which would render a second one. */
const TAB_ROUTES = {
  Passport: '/',
  Games: '/games',
  Plan: '/plan',
  Profile: '/profile',
} as const;

export function TabBar({ active = 'Passport' }: { active?: string }) {
  const { base, team } = useReferenceTheme();
  const router = useRouter();
  const tabs: [keyof typeof TAB_ROUTES, IconName][] = [
    ['Passport', 'i-passport'],
    ['Games', 'i-ticket'],
    ['Plan', 'i-map'],
    ['Profile', 'i-user'],
  ];
  return (
    <View style={[s.tabs, { borderTopColor: base.line, backgroundColor: base.card }]}>
      {tabs.map(([label, icon]) => {
        const Icon = ICONS[icon];
        const on = label === active;
        const color = on ? team.accent : base.muted;
        return (
          <Pressable
            key={label}
            style={s.tab}
            onPress={() => {
              if (!on) router.replace(TAB_ROUTES[label] as Href);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
          >
            <Icon size={iconSize.tab} color={color} />
            <Text style={[on ? s.tabLabelOn : s.tabLabel, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  word: {
    // fontSize and the line box are set by <TightText>.
    fontFamily: fontFamily({ width: 62, weight: 900 }),
    letterSpacing: 32 * 0.01,
  },
  sub: {
    fontSize: 9.5,
    fontFamily: fontFamily({ weight: 750 }),
    letterSpacing: 9.5 * 0.07,
    marginTop: 3,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: border.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pillsRail: { marginHorizontal: -screenPadding.horizontal, marginBottom: 12, flexGrow: 0 },
  pillsContent: { paddingHorizontal: screenPadding.horizontal, gap: 6 },
  pill: {
    borderWidth: border.pill,
    borderRadius: radius.pill,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pillLabel: {
    fontSize: 13,
    lineHeight: 13 * 1.2,
    fontFamily: fontFamily({ weight: 700 }),
  },
  pillCount: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  pillCountText: {
    fontSize: 10.5,
    fontFamily: fontFamily({ weight: 850 }),
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.heroFx,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 13,
    paddingHorizontal: 15,
    paddingBottom: 11,
  },
  heroRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: {
    fontSize: 9.5,
    fontFamily: fontFamily({ weight: 750 }),
    letterSpacing: 9.5 * 0.07,
    color: 'rgba(255,255,255,0.62)',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 9 * 0.05,
    fontFamily: fontFamily({ weight: 750 }),
  },
  heroRec: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginVertical: 12 },
  heroRecord: {
    // fontSize and the line box are set by <TightText>.
    fontFamily: fontFamily({ width: 62, weight: 900 }),
    letterSpacing: -64 * 0.01,
    color: '#FFFFFF',
  },
  heroWinRate: {
    // fontSize and the line box are set by <TightText>.
    fontFamily: fontFamily({ width: 64, weight: 900 }),
    letterSpacing: 19 * 0.01,
    color: '#FFFFFF',
  },
  heroStreak: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fontFamily(),
  },
  heroLast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  heroLastText: {
    fontSize: 11.5,
    fontFamily: fontFamily({ weight: 650 }),
    color: '#FFFFFF',
    flex: 1,
  },

  cards: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 18 },
  recordCard: {
    flex: 1,
    borderWidth: border.card,
    borderRadius: radius.md,
    paddingTop: 9,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  recordCardLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordCardName: { fontSize: 11, lineHeight: 11 * 1.2, fontFamily: fontFamily({ weight: 750 }) },
  recordCardDot: { width: 6, height: 6, borderRadius: 3 },
  recordCardValue: {
    // fontSize and the line box are set by <TightText>.
    fontFamily: fontFamily({ width: 62, weight: 900 }),
    marginTop: 7,
    marginBottom: 3,
  },
  recordCardPct: { fontSize: 10, lineHeight: 10 * 1.2, fontFamily: fontFamily() },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fontFamily({ width: 62, weight: 900 }),
    letterSpacing: 17 * 0.01,
  },
  sectionAction: {
    fontSize: 11.5,
    fontFamily: fontFamily({ weight: 750 }),
  },

  stampsRail: { marginHorizontal: -screenPadding.horizontal, marginBottom: 18, flexGrow: 0 },
  stampsContent: { paddingHorizontal: screenPadding.horizontal, gap: 4 },
  stamp: { width: 98, alignItems: 'center' },
  stampName: {
    fontSize: 10.5,
    lineHeight: 10.5 * 1.2, // `.fx-stamp b{line-height:1.2}`
    fontFamily: fontFamily({ weight: 800 }),
    textAlign: 'center',
  },
  stampCity: {
    fontSize: 8.5,
    // `.fx-stamp span` is an inline element in a block whose font-size is the inherited
    // 16px, so its line box is sized by that 16px strut rather than by the 8.5px span.
    // React Native sizes a line box from the Text's own font, so without this the caption
    // sits about 7pt too high and everything below it follows.
    lineHeight: 16 * 1.15,
    letterSpacing: 8.5 * 0.05,
    fontFamily: fontFamily({ weight: 650 }),
    textAlign: 'center',
  },

  list: {
    borderWidth: border.card,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  listLabel: { fontSize: 10.5, lineHeight: 10.5 * 1.2, fontFamily: fontFamily() },
  listValue: {
    fontSize: 14.5,
    fontFamily: fontFamily({ weight: 850 }),
    marginTop: 1,
  },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  chipText: { fontSize: 10, lineHeight: 10 * 1.2, fontFamily: fontFamily({ weight: 650 }) },

  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 9,
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  tab: { alignItems: 'center', gap: 3, minWidth: 56 },
  tabLabel: { fontSize: 11, lineHeight: 11 * 1.2, fontFamily: fontFamily() },
  tabLabelOn: { fontSize: 11, fontFamily: fontFamily({ weight: 750 }) },
});
