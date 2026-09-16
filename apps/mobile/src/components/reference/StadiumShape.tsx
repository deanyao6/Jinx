import React from 'react';
import { Ellipse, G, Path, Rect } from 'react-native-svg';

import { shape, type ShapeElement } from './shapes';

/**
 * Draws one stadium footprint's elements. Returns the children only, so a caller can
 * place it inside its own <Svg> with its own transform, which is how the reference uses
 * the shapes: inline in a seal, inside a thumbnail, and as the hero's ghost watermark,
 * each at a different scale.
 */
export function StadiumShape({
  shapeKey,
  transform,
  strokeWidth,
}: {
  shapeKey: string;
  transform?: string;
  strokeWidth?: number;
}) {
  const children = shape(shapeKey).map((el: ShapeElement, i: number) => {
    switch (el.tag) {
      case 'rect':
        return (
          <Rect
            key={i}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            rx={el.rx}
            fill={el.fill ?? 'none'}
            fillOpacity={el.fillOpacity}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            key={i}
            cx={el.cx}
            cy={el.cy}
            rx={el.rx}
            ry={el.ry}
            fill={el.fill ?? 'none'}
            fillOpacity={el.fillOpacity}
          />
        );
      default:
        return (
          <Path
            key={i}
            d={el.d}
            strokeDasharray={el.strokeDasharray}
            fill={el.fill ?? 'none'}
            fillOpacity={el.fillOpacity}
          />
        );
    }
  });

  if (!transform && strokeWidth === undefined) return <>{children}</>;
  return (
    <G transform={transform} strokeWidth={strokeWidth}>
      {children}
    </G>
  );
}
