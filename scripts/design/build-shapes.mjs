// Generates the stadium shape paths from design/reference.html.
//
// Same reasoning as the icons (scripts/design/build-icons.mjs): SPEC.md 8.5 requires the
// geometry to match the reference, and a mistyped coordinate in a stadium outline still
// renders as a plausible stadium. Generating them makes "verbatim" a build property.
//
// Run: npm run build:shapes

import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'design/reference.html';
const OUT = 'apps/mobile/src/components/reference/shapes.ts';

const html = await readFile(SOURCE, 'utf8');

const block = html.match(/var SHAPES = \{([\s\S]*?)\n  \};/);
if (!block?.[1]) throw new Error('Could not find the SHAPES object in the reference');

const shapes = [];
for (const m of block[1].matchAll(/(\w+):'((?:[^'\\]|\\.)*)'/g)) {
  shapes.push({ key: m[1], markup: m[2] });
}
if (shapes.length === 0) throw new Error('SHAPES parsed to nothing');

// Each shape is a fragment of SVG children inside a 64x64 viewBox. Parse them into the
// element list the React component needs, rather than shipping raw markup a native
// renderer cannot read.
const ELEMENTS = {
  path: ['d', 'stroke-dasharray', 'fill', 'fill-opacity'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'fill', 'fill-opacity'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'fill-opacity'],
};
const CAMEL = { 'stroke-dasharray': 'strokeDasharray', 'fill-opacity': 'fillOpacity' };

function parse(markup) {
  const out = [];
  for (const m of markup.matchAll(/<(path|rect|ellipse)\s([^>]*?)\s*\/?>/g)) {
    const tag = m[1];
    const allowed = ELEMENTS[tag];
    const attrs = {};
    for (const a of m[2].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
      if (!allowed.includes(a[1])) throw new Error(`<${tag}> attribute "${a[1]}" is not handled`);
      attrs[CAMEL[a[1]] ?? a[1]] = a[2];
    }
    out.push({ tag, attrs });
  }
  if (out.length === 0) throw new Error('shape parsed to no elements');
  return out;
}

const parsed = shapes.map((s) => ({ ...s, elements: parse(s.markup) }));

const body = `// GENERATED FILE. Do not edit by hand.
//
// Built from the SHAPES object in ${SOURCE} by scripts/design/build-shapes.mjs.
// Re-run \`npm run build:shapes\` after the reference changes.
//
// These are the reference's stylized stadium footprints, drawn in a 64x64 viewBox and
// used inside stamp seals and game thumbnails (SPEC.md 8.5). v1 ships them as
// placeholders keyed by venue type; a later pass traces real OpenStreetMap outlines into
// the \`venue_shapes\` table.

export type ShapeElement =
  | { tag: 'path'; d: string; strokeDasharray?: string; fill?: string; fillOpacity?: string }
  | { tag: 'rect'; x: string; y: string; width: string; height: string; rx?: string; fill?: string; fillOpacity?: string }
  | { tag: 'ellipse'; cx: string; cy: string; rx: string; ry: string; fill?: string; fillOpacity?: string };

/** The viewBox every shape is drawn in. */
export const SHAPE_VIEWBOX = '0 0 64 64';

export const SHAPES = {
${parsed
  .map(
    (s) => `  ${s.key}: [
${s.elements
  .map((e) => `    { tag: '${e.tag}', ${Object.entries(e.attrs).map(([k, v]) => `${k}: '${v}'`).join(', ')} },`)
  .join('\n')}
  ],`
  )
  .join('\n')}
} as const satisfies Record<string, readonly ShapeElement[]>;

export type ShapeKey = keyof typeof SHAPES;

export function shape(key: string): readonly ShapeElement[] {
  return SHAPES[key as ShapeKey] ?? SHAPES.ballparkA;
}
`;

await writeFile(OUT, body);
console.log(`${parsed.length} shapes -> ${OUT}`);
console.log(parsed.map((s) => `${s.key} (${s.elements.length} elements)`).join(', '));
