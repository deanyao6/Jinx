import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ICONS } from '@/components/reference/icons';
import { fontFamily } from '@/theme/fonts';
import { useReferenceTheme } from '@/theme/reference/TeamTheme';

/**
 * The pieces every Favourites screen is built from, in the reference's visual language.
 *
 * The flow is four screens deep at its longest (favourites, league, team, player) and they
 * are all the same shape: a card of rows that either drill in or toggle. Sharing the row
 * rather than restyling four screens is what keeps them looking like one feature.
 *
 * Requires a `<ReferenceThemeProvider>` above it, like every other reference component.
 */

/** A card that draws hairlines between its children, as the settings index does. */
export function Card({ children }: { children: React.ReactNode }) {
  const { base } = useReferenceTheme();
  const items = React.Children.toArray(children);
  return (
    <View style={[s.card, { backgroundColor: base.card, borderColor: base.line }]}>
      {items.map((child, i) => (
        <View
          key={i}
          style={
            i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: base.line } : null
          }
        >
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * One row. `chevron` drills in, `checked` toggles, and a row can have neither.
 *
 * `checked` being `undefined` rather than `false` is the difference between "this row is a
 * destination" and "this row is off", which is why it is optional rather than defaulted.
 */
export function Row({
  title,
  meta,
  onPress,
  chevron,
  checked,
  accessibilityLabel,
}: {
  title: string;
  meta?: string;
  onPress?: () => void;
  chevron?: boolean;
  checked?: boolean;
  accessibilityLabel?: string;
}) {
  const { base, team } = useReferenceTheme();
  const ChevR = ICONS['i-chev-r'];
  const Check = ICONS['i-check-c'];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={checked === undefined ? 'button' : 'checkbox'}
      accessibilityState={checked === undefined ? undefined : { checked }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [s.row, pressed && onPress ? { opacity: 0.6 } : null]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowTitle, { color: base.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={[s.rowMeta, { color: base.muted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {checked ? <Check size={18} color={team.accent} /> : null}
      {chevron ? <ChevR size={18} color={base.muted} /> : null}
    </Pressable>
  );
}

/** The section label above a card. */
export function SectionLabel({ children }: { children: string }) {
  const { base } = useReferenceTheme();
  return <Text style={[s.sectionLabel, { color: base.muted }]}>{children}</Text>;
}

/** What a list says when it is empty, or when a search matched nothing. */
export function EmptyNote({ children }: { children: string }) {
  const { base } = useReferenceTheme();
  return (
    <View style={[s.empty, { borderColor: base.line, backgroundColor: base.card }]}>
      <Text style={[s.emptyText, { color: base.muted }]}>{children}</Text>
    </View>
  );
}

/** `.fx-search`, the reference's search field. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const { base } = useReferenceTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={base.muted}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      accessibilityLabel={placeholder}
      style={[s.search, { backgroundColor: base.surface, color: base.ink, borderColor: base.line }]}
    />
  );
}

/** `.fx-seg`, the reference's two-up segmented control. */
export function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { base } = useReferenceTheme();
  return (
    <View style={[s.seg, { backgroundColor: base.surface, borderColor: base.line }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[s.segItem, on && { backgroundColor: base.card }]}
          >
            <Text
              style={[
                s.segText,
                {
                  color: on ? base.ink : base.muted,
                  fontFamily: fontFamily({ weight: on ? 700 : 500 }),
                },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowTitle: { fontSize: 15, fontFamily: fontFamily({ weight: 700 }) },
  rowMeta: { fontSize: 12.5, marginTop: 2, fontFamily: fontFamily() },
  sectionLabel: {
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fontFamily({ weight: 700 }),
    marginTop: 18,
    marginBottom: 8,
  },
  empty: { borderRadius: 12, borderWidth: 1, padding: 14 },
  emptyText: { fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily() },
  search: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fontFamily(),
    marginBottom: 12,
  },
  seg: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 3, marginBottom: 14 },
  segItem: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  segText: { fontSize: 13.5 },
});
