// GENERATED FILE. Do not edit by hand.
//
// Built from the SHAPES object in design/reference.html by scripts/design/build-shapes.mjs.
// Re-run `npm run build:shapes` after the reference changes.
//
// These are the reference's stylized stadium footprints, drawn in a 64x64 viewBox and
// used inside stamp seals and game thumbnails (SPEC.md 8.5). v1 ships them as
// placeholders keyed by venue type; a later pass traces real OpenStreetMap outlines into
// the `venue_shapes` table.

export type ShapeElement =
  | { tag: 'path'; d: string; strokeDasharray?: string; fill?: string; fillOpacity?: string }
  | {
      tag: 'rect';
      x: string;
      y: string;
      width: string;
      height: string;
      rx?: string;
      fill?: string;
      fillOpacity?: string;
    }
  | {
      tag: 'ellipse';
      cx: string;
      cy: string;
      rx: string;
      ry: string;
      fill?: string;
      fillOpacity?: string;
    };

/** The viewBox every shape is drawn in. */
export const SHAPE_VIEWBOX = '0 0 64 64';

export const SHAPES = {
  ballparkA: [
    { tag: 'path', d: 'M32 58 6 35Q8 13 31 8q21 1 27 22l-6 6z' },
    {
      tag: 'path',
      d: 'M32 50 16 36q4-14 16-16 12 2 16 16z',
      fill: 'currentColor',
      fillOpacity: '.14',
    },
    { tag: 'path', d: 'm32 49-5-5 5-5 5 5z' },
  ],
  dodger: [
    { tag: 'path', d: 'M32 58 12 39l7-6q13-7 26 0l7 6z' },
    { tag: 'path', d: 'M9 31Q32 2 55 31', strokeDasharray: '3 3' },
    { tag: 'path', d: 'm7 27 5-3 3 4-4 4zM57 27l-5-3-3 4 4 4z' },
    { tag: 'path', d: 'm32 50-5-5 5-5 5 5z' },
  ],
  wrigley: [
    { tag: 'rect', x: '8', y: '8', width: '48', height: '48', rx: '5' },
    {
      tag: 'path',
      d: 'M32 54 14 37q3-16 18-19 15 3 18 19z',
      fill: 'currentColor',
      fillOpacity: '.14',
    },
    { tag: 'path', d: 'm32 48-4-4 4-4 4 4z' },
  ],
  oracle: [
    { tag: 'path', d: 'M32 58 7 34Q10 12 32 8h14l10 20-6 8z' },
    { tag: 'path', d: 'M50 10q4 2 3 5t3 5M54 20q4 2 3 5', strokeDasharray: '2 3' },
    { tag: 'path', d: 'm32 49-5-5 5-5 5 5z' },
  ],
  bowl: [
    { tag: 'rect', x: '5', y: '13', width: '54', height: '38', rx: '17' },
    {
      tag: 'rect',
      x: '17',
      y: '22',
      width: '30',
      height: '20',
      rx: '2',
      fill: 'currentColor',
      fillOpacity: '.14',
    },
    { tag: 'path', d: 'M32 22v20' },
  ],
  canopy: [
    { tag: 'path', d: 'M5 20q0-9 9-9h36q9 0 9 9v24q0 9-9 9H14q-9 0-9-9z' },
    {
      tag: 'rect',
      x: '17',
      y: '22',
      width: '30',
      height: '20',
      rx: '2',
      fill: 'currentColor',
      fillOpacity: '.14',
    },
    { tag: 'path', d: 'M5 20 17 22M59 20l-12 2M5 44l12-2M59 44l-12-2' },
  ],
  colonnade: [
    { tag: 'ellipse', cx: '32', cy: '32', rx: '26', ry: '20' },
    {
      tag: 'rect',
      x: '18',
      y: '23',
      width: '28',
      height: '18',
      rx: '2',
      fill: 'currentColor',
      fillOpacity: '.14',
    },
    { tag: 'path', d: 'M10 22v20M13 18v28M51 18v28M54 22v20' },
  ],
  arena: [
    { tag: 'ellipse', cx: '32', cy: '32', rx: '27', ry: '21' },
    {
      tag: 'rect',
      x: '15',
      y: '22',
      width: '34',
      height: '20',
      rx: '2',
      fill: 'currentColor',
      fillOpacity: '.14',
    },
    { tag: 'path', d: 'M32 22v20' },
    { tag: 'ellipse', cx: '32', cy: '32', rx: '4', ry: '4' },
    { tag: 'path', d: 'M15 27h5v10h-5M49 27h-5v10h5' },
  ],
} as const satisfies Record<string, readonly ShapeElement[]>;

export type ShapeKey = keyof typeof SHAPES;

export function shape(key: string): readonly ShapeElement[] {
  return SHAPES[key as ShapeKey] ?? SHAPES.ballparkA;
}
