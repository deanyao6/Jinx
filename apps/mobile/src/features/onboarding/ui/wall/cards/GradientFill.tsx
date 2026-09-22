import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A CSS `linear-gradient(<angle>, ...)` as the background of a card.
 *
 * React Native has no gradient background, and the app carries no gradient package, so a card
 * that needs one draws an SVG rectangle behind its content. The gradient runs in the
 * rectangle's bounding box: the CSS angle is turned into a line through the box's centre, so
 * `135deg` is the top-left corner to the bottom-right, as it is in CSS on a square. On a
 * wide card the line is a few degrees off what CSS would draw; for a tint from 42% to 7%
 * that is below what the parity diff can see, and it costs nothing at layout time because
 * the card never has to be measured first (design/PORTING_NOTES.md).
 */
export type GradientStop = { offset: number; color: string; opacity?: number };

export function gradientLine(angleDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(dx) + Math.abs(dy)) / 2;
  return { x1: 0.5 - dx * half, y1: 0.5 - dy * half, x2: 0.5 + dx * half, y2: 0.5 + dy * half };
}

export const GradientFill = React.memo(function GradientFill({
  id,
  angle,
  stops,
}: {
  /** Unique within the screen: SVG gradient ids are global to the document. */
  id: string;
  angle: number;
  stops: readonly GradientStop[];
}) {
  const { x1, y1, x2, y2 } = gradientLine(angle);
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
          {stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
});
