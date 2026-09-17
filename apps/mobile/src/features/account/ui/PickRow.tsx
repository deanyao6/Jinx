import React from 'react';
import { Pressable, View } from 'react-native';

import { IconCheckC, IconChevR, IconPlus } from '@/components/reference/icons';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  title: string;
  meta?: string | null;
  /** Two or three capitals on a tile in the colour in scope: "PHI", "NFL". Text, never a logo. */
  badge?: string;
  /** A slim bar in the colour in scope instead of a tile, for a row about a player. */
  mark?: boolean;
  /**
   * `true` and `false` make the row a checkbox; `undefined` makes it a destination. That is the
   * difference between "this one is off" and "this one leads somewhere".
   */
  selected?: boolean;
  /** How a selected row shows it: filled with the colour, or only washed in it. */
  selectedTone?: 'solid' | 'wash';
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * One row of a picker, as its own filled shape. Wrap it in `<TeamTheme team={id}>` and the tile,
 * the mark and the selected fill are that team's colours; without one they are the person's.
 */
export function PickRow({
  title,
  meta,
  badge,
  mark,
  selected,
  selectedTone = 'solid',
  chevron,
  onPress,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const a = theme.accent;
  const solid = selected === true && selectedTone === 'solid';
  const washed = selected === true && selectedTone === 'wash';
  const ink = solid ? a.onFill : theme.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 58,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: theme.spacing.sm,
        borderRadius: theme.radius.lg - 2,
        backgroundColor: solid ? a.fill : washed ? a.wash : theme.colors.card,
        opacity: pressed && onPress ? 0.75 : 1,
      })}
    >
      {badge ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: solid ? 'transparent' : a.fill,
          }}
        >
          {solid ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: a.onFill,
                opacity: 0.18,
              }}
            />
          ) : null}
          <Text
            variant="section"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: a.onFill, fontSize: 15, letterSpacing: 0.3 }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      {mark ? (
        <View
          style={{
            width: 4,
            height: 30,
            borderRadius: 2,
            backgroundColor: solid ? a.onFill : a.text,
          }}
        />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ color: ink }}>
          {title}
        </Text>
        {meta ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ marginTop: 1, color: solid ? a.onFill : theme.colors.muted }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {selected === true ? <IconCheckC size={20} color={solid ? a.onFill : a.text} /> : null}
      {selected === false ? <IconPlus size={18} color={a.text} /> : null}
      {chevron ? <IconChevR size={16} color={theme.colors.muted} /> : null}
    </Pressable>
  );
}
