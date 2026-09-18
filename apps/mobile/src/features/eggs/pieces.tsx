import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { PieceKind } from './live';

/**
 * What falls during a sport's signature break. Drawn by hand in the reference icon set's own
 * geometry (`.ico` in design/reference.html: a 24 box, 1.9 stroke, round caps and joins), so
 * they sit with the 36 generated icons without being added to that generated file.
 *
 * Generic objects only: no marks, no lettering, nothing on the box.
 */
type PieceProps = {
  size: number;
  /** The line. */
  color: string;
  /** Inside the shape, so a piece reads over any screen like a sticker. */
  fill: string;
};

const STROKE = {
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Frame({ size, color, children }: PieceProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...STROKE}>
      {children}
    </Svg>
  );
}

/** Two lobes and a waist, with the shell's dimples. */
function Peanut(props: PieceProps) {
  return (
    <Frame {...props}>
      <Path
        d="M8.2 10.4A4.5 4.5 0 1 1 15.8 10.4Q14.6 12 16 13.6A5 5 0 1 1 8 13.6Q9.4 12 8.2 10.4Z"
        fill={props.fill}
      />
      <Path d="M10.6 6.6v1.3M13.4 8v1.3M10.2 15.6v1.4M13.8 16.6v1.4M12 13.4v1.2" />
    </Frame>
  );
}

/** A striped snack box, popcorn over the top. Deliberately blank. */
function SnackBox(props: PieceProps) {
  return (
    <Frame {...props}>
      <Circle cx="9.2" cy="7.4" r="2" fill={props.fill} />
      <Circle cx="15" cy="7.5" r="1.9" fill={props.fill} />
      <Circle cx="12.2" cy="6" r="2.2" fill={props.fill} />
      <Rect x="6.5" y="9" width="11" height="12" rx="1.2" fill={props.fill} />
      <Path d="M6.5 14l11-2.6M6.5 18l11-2.6" />
    </Frame>
  );
}

function Baseball(props: PieceProps) {
  return (
    <Frame {...props}>
      <Circle cx="12" cy="12" r="8.5" fill={props.fill} />
      <Path d="M6.4 5.6c2.5 3.7 2.5 9.1 0 12.8M17.6 5.6c-2.5 3.7-2.5 9.1 0 12.8" />
    </Frame>
  );
}

function Football(props: PieceProps) {
  return (
    <Frame {...props}>
      <Path d="M4.2 19.8C3.2 12 10 4.6 19.8 4.2 20.8 12 14 19.4 4.2 19.8Z" fill={props.fill} />
      <Path d="M9.2 14.8l5.6-5.6M10 12.4l1.6 1.6M12.4 10l1.6 1.6" />
    </Frame>
  );
}

function Whistle(props: PieceProps) {
  return (
    <Frame {...props}>
      <Path d="M9.5 9H20.5v4h-6.1" fill={props.fill} />
      <Circle cx="9.5" cy="14" r="5" fill={props.fill} />
      <Circle cx="9.5" cy="14" r="1.5" />
      <Path d="M5.6 9.6C4.2 8.4 3.6 6.8 4.2 5" />
    </Frame>
  );
}

/** A sideline yard marker: a pole, a pennant, the lines it stands beside. */
function YardFlag(props: PieceProps) {
  return (
    <Frame {...props}>
      <Path d="M7 4.2l11 3.6-11 3.6Z" fill={props.fill} />
      <Path d="M7 21V3.2M4.5 21h5M13 17h6.5M13 20.6h6.5" />
    </Frame>
  );
}

/** A ball with its seams: one round the middle, two curving over the top and bottom. */
function Basketball(props: PieceProps) {
  return (
    <Frame {...props}>
      <Circle cx="12" cy="12" r="8.5" fill={props.fill} />
      <Path d="M3.5 12h17M12 3.5v17" />
      <Path d="M6 6c3.4 3.4 3.4 8.6 0 12M18 6c-3.4 3.4-3.4 8.6 0 12" />
    </Frame>
  );
}

/** A high-top from the side: the sole, the toe box, the laces. No mark. */
function Sneaker(props: PieceProps) {
  return (
    <Frame {...props}>
      <Path d="M4 17.5V9.2l2.8-1.4 3 4.4 2.2-6.7 2.6 1.1v5.2l5.6 2.8V17.5z" fill={props.fill} />
      <Path d="M4 17.5h16.2M4 14.8h16.2" />
      <Path d="M8.6 10.6l2.2-1M9.6 12.4l2.2-1" />
    </Frame>
  );
}

/** A towel over the shoulder: a folded rectangle with the loose end hanging. */
function Towel(props: PieceProps) {
  return (
    <Frame {...props}>
      <Path d="M6 4.5h12v10.4q-3-1.2-6 0t-6 0z" fill={props.fill} />
      <Path d="M9.5 14.6v5M14.5 14.6v5M6 8.2h12M6 11h12" />
    </Frame>
  );
}

export const PIECES: Readonly<Record<PieceKind, (props: PieceProps) => React.ReactElement>> = {
  peanut: Peanut,
  snackBox: SnackBox,
  baseball: Baseball,
  football: Football,
  whistle: Whistle,
  yardFlag: YardFlag,
  basketball: Basketball,
  sneaker: Sneaker,
  towel: Towel,
};
