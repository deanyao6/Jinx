// GENERATED FILE. Do not edit by hand.
//
// Built from the SVG sprite in design/reference.html by scripts/design/build-icons.mjs.
// Re-run `npm run build:icons` after the reference changes. SPEC.md 8.4 requires these
// paths to be identical to the reference's, which is why they are generated rather than
// transcribed.
//
// 36 icons.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { iconSize } from '@/theme/reference/tokens';

export type IconProps = {
  /** Defaults to 20, the reference's `.ico` size. The tab bar uses 23. */
  size?: number;
  /**
   * Resolves `currentColor` for this icon. Left undefined, the icon inherits the
   * nearest ancestor's colour, which is how the reference's icons take on the team
   * accent from a `.t-*` class.
   */
  color?: string;
};

/**
 * Stroke geometry from `.ico` in the reference CSS. Applied on the root the way the
 * CSS applies it to the element, so each child inherits it unless it sets its own.
 */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function IconPassport({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Rect x="5" y="3" width="14" height="18" rx="2.5" />
      <Circle cx="12" cy="10.5" r="3.2" />
      <Path d="M8.8 10.5h6.4M12 7.3c1 .9 1.4 2 1.4 3.2s-.4 2.3-1.4 3.2M12 7.3c-1 .9-1.4 2-1.4 3.2s.4 2.3 1.4 3.2M9 17h6" />
    </Svg>
  );
}

export function IconTicket({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M3 8.5V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-2a2.5 2.5 0 0 0 0-5z" />
      <Path d="M15 5v2M15 11v2M15 17v1" />
    </Svg>
  );
}

export function IconRoute({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="6" cy="18" r="2" />
      <Path d="M18 11.5c1.9-2 3-3.5 3-5a3 3 0 0 0-6 0c0 1.5 1.1 3 3 5z" />
      <Circle cx="18" cy="6.5" r=".6" />
      <Path d="M8 18h7.5a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h2" />
    </Svg>
  );
}

export function IconUser({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="12" cy="8.5" r="3.8" />
      <Path d="M4.5 20.5c1.2-3.8 4.1-5.6 7.5-5.6s6.3 1.8 7.5 5.6" />
    </Svg>
  );
}

export function IconSearch({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="m16 16 4.5 4.5" />
    </Svg>
  );
}

export function IconShare({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
      <Path d="M5 12.5v6A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-6" />
    </Svg>
  );
}

export function IconBell({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconVerified({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M12 2.8 14.3 4.5l2.8-.2.9 2.7 2.3 1.7-.9 2.7.9 2.7-2.3 1.7-.9 2.7-2.8-.2L12 21.2l-2.3-1.7-2.8.2-.9-2.7-2.3-1.7.9-2.7-.9-2.7 2.3-1.7.9-2.7 2.8.2z" />
      <Path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </Svg>
  );
}

export function IconLock({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Svg>
  );
}

export function IconChevR({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  );
}

export function IconChevL({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  );
}

export function IconCar({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M4 16.5V12l2-5h12l2 5v4.5z" />
      <Path d="M4 12h16" />
      <Circle cx="7.5" cy="16.5" r="1.8" />
      <Circle cx="16.5" cy="16.5" r="1.8" />
    </Svg>
  );
}

export function IconGrill({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M4.5 9.5h15a7.5 7.5 0 0 1-15 0z" />
      <Path d="M8 17l-2 4M16 17l2 4M9 6c0-1.2 1-1.5 1-2.8M13 6c0-1.2 1-1.5 1-2.8" />
    </Svg>
  );
}

export function IconGate({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M4 21V10a8 8 0 0 1 16 0v11" />
      <Path d="M8 21v-9a4 4 0 0 1 8 0v9M3 21h18" />
    </Svg>
  );
}

export function IconFlag({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M5.5 21V4" />
      <Path d="M5.5 4.5h11l-2 3.5 2 3.5h-11" />
    </Svg>
  );
}

export function IconFood({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M7 3v7.5a2 2 0 0 0 4 0V3M9 12.5V21M17 21V3c-2 1.5-3 4-3 7.5h3" />
    </Svg>
  );
}

export function IconDoor({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M4 21h16" />
      <Circle cx="14.5" cy="12.5" r=".9" />
    </Svg>
  );
}

export function IconSeat({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M7 12V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" />
      <Path d="M5 12h14v4H5zM7 16v5M17 16v5" />
    </Svg>
  );
}

export function IconThermo({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <Path d="M12 17.5V10" />
    </Svg>
  );
}

export function IconClock({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconBolt({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
    </Svg>
  );
}

export function IconTrend({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="m3.5 17 6-6 4 4 7-7.5" />
      <Path d="M15 7.5h5.5V13" />
    </Svg>
  );
}

export function IconEye({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconUsers({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="9" cy="9" r="3.3" />
      <Path d="M3 19.5c.9-3 3.2-4.5 6-4.5s5.1 1.5 6 4.5" />
      <Path d="M15.5 5.8a3.3 3.3 0 0 1 0 6.4M17.5 15.2c1.7.5 3 1.9 3.5 4.3" />
    </Svg>
  );
}

export function IconTarget({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="12" cy="12" r="8.5" />
      <Circle cx="12" cy="12" r="4.5" />
      <Circle cx="12" cy="12" r=".8" />
    </Svg>
  );
}

export function IconMap({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="m3.5 6 5.5-2.5 6 2.5 5.5-2.5v14.5L15 20.5 9 18l-5.5 2.5z" />
      <Path d="M9 3.5V18M15 6v14.5" />
    </Svg>
  );
}

export function IconSpark({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </Svg>
  );
}

export function IconGear({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="12" cy="12" r="3" />
      <Path
        d="M19 13.5v-3l-2.1-.5-.6-1.4 1.1-1.9-2.1-2.1-1.9 1.1-1.4-.6L11.5 3h-3l-.5 2.1-1.4.6-1.9-1.1-2.1 2.1 1.1 1.9-.6 1.4-2.1.5v3l2.1.5.6 1.4-1.1 1.9 2.1 2.1 1.9-1.1 1.4.6.5 2.1h3l.5-2.1 1.4-.6 1.9 1.1 2.1-2.1-1.1-1.9.6-1.4z"
        transform="translate(1.5 0)"
      />
    </Svg>
  );
}

export function IconSwords({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M3.5 3.5h4l9 9M20.5 3.5h-4l-9 9M13.5 15.5l5 5M10.5 15.5l-5 5M15 19l4-4M9 19l-4-4" />
    </Svg>
  );
}

export function IconExt({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M14 4h6v6M20 4l-9 9" />
      <Path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </Svg>
  );
}

export function IconCamera({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.5h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <Circle cx="12" cy="12.8" r="3.4" />
    </Svg>
  );
}

export function IconNews({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M5 5.5h11v13H6.5A1.5 1.5 0 0 1 5 17z" />
      <Path d="M16 9h3v8.5a1.5 1.5 0 0 1-3 0M8 9h5M8 12.5h5M8 16h3" />
    </Svg>
  );
}

export function IconSpeaker({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <Path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11" />
    </Svg>
  );
}

export function IconBook({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M12 6.5C10.2 5.2 7.6 4.5 4 4.5v14c3.6 0 6.2.7 8 2 1.8-1.3 4.4-2 8-2v-14c-3.6 0-6.2.7-8 2zM12 6.5v14" />
    </Svg>
  );
}

export function IconCheckC({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="m8.3 12.2 2.5 2.5 4.9-5.2" />
    </Svg>
  );
}

export function IconPlus({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} {...(color ? { color } : null)}>
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Every icon, keyed by its sprite id, for data-driven rows like the superlatives list. */
export const ICONS = {
  'i-passport': IconPassport,
  'i-ticket': IconTicket,
  'i-route': IconRoute,
  'i-user': IconUser,
  'i-search': IconSearch,
  'i-share': IconShare,
  'i-bell': IconBell,
  'i-verified': IconVerified,
  'i-lock': IconLock,
  'i-chev-r': IconChevR,
  'i-chev-l': IconChevL,
  'i-car': IconCar,
  'i-grill': IconGrill,
  'i-gate': IconGate,
  'i-flag': IconFlag,
  'i-food': IconFood,
  'i-door': IconDoor,
  'i-seat': IconSeat,
  'i-thermo': IconThermo,
  'i-clock': IconClock,
  'i-bolt': IconBolt,
  'i-trend': IconTrend,
  'i-eye': IconEye,
  'i-users': IconUsers,
  'i-target': IconTarget,
  'i-map': IconMap,
  'i-spark': IconSpark,
  'i-gear': IconGear,
  'i-swords': IconSwords,
  'i-ext': IconExt,
  'i-camera': IconCamera,
  'i-news': IconNews,
  'i-speaker': IconSpeaker,
  'i-book': IconBook,
  'i-check-c': IconCheckC,
  'i-plus': IconPlus,
} as const;

export type IconName = keyof typeof ICONS;
