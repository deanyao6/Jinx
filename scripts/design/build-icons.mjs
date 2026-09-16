// Generates the app's icon set from the SVG sprite in design/reference.html.
//
// SPEC.md 8.4 requires the icon paths to be identical to the reference's. Hand-copying
// 36 icons is 36 chances to transpose a digit, and nothing would catch it: a slightly
// wrong curve still renders, and the parity diff would blame the layout. So the sprite
// is parsed and the components are emitted, which makes "identical" a property of the
// build rather than of my typing.
//
// Run: npm run build:icons

import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'design/reference.html';
const OUT = 'apps/mobile/src/components/reference/icons.tsx';

// The sprite's own attributes, from `.ico` in the reference CSS:
//   fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round;
//   stroke-linejoin:round
// They are applied once on <Svg>, exactly as the CSS applies them once on the element.

const ELEMENTS = {
  path: { component: 'Path', attrs: ['d', 'transform', 'fill', 'fillOpacity', 'strokeDasharray'] },
  circle: { component: 'Circle', attrs: ['cx', 'cy', 'r', 'fill', 'transform'] },
  rect: { component: 'Rect', attrs: ['x', 'y', 'width', 'height', 'rx', 'fill', 'transform'] },
  ellipse: { component: 'Ellipse', attrs: ['cx', 'cy', 'rx', 'ry', 'fill', 'transform'] },
};

const ATTR_ALIASES = {
  'fill-opacity': 'fillOpacity',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-width': 'strokeWidth',
};

function toPascal(id) {
  return id
    .replace(/^i-/, '')
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function parseAttrs(raw) {
  const out = {};
  for (const m of raw.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
    const name = ATTR_ALIASES[m[1]] ?? m[1];
    out[name] = m[2];
  }
  return out;
}

function renderChild(tag, attrs) {
  const spec = ELEMENTS[tag];
  if (!spec) throw new Error(`Unhandled sprite element <${tag}>. Add it to ELEMENTS.`);
  const props = Object.entries(attrs)
    .filter(([k]) => spec.attrs.includes(k))
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const unknown = Object.keys(attrs).filter((k) => !spec.attrs.includes(k));
  if (unknown.length) throw new Error(`<${tag}> has attributes this script drops: ${unknown.join(', ')}`);
  return `    <${spec.component} ${props} />`;
}

const html = await readFile(SOURCE, 'utf8');

const symbols = [...html.matchAll(/<symbol id="(i-[a-z0-9-]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g)];
if (symbols.length === 0) throw new Error('No <symbol> elements found. Did the sprite move?');

const icons = symbols.map(([, id, viewBox, body]) => {
  const children = [...body.matchAll(/<(path|circle|rect|ellipse)\s([^>]*?)\s*\/?>/g)].map((m) =>
    renderChild(m[1], parseAttrs(m[2]))
  );
  if (children.length === 0) throw new Error(`Sprite symbol ${id} produced no elements`);
  return { id, name: toPascal(id), viewBox, children };
});

const used = new Set();
for (const icon of icons) for (const c of icon.children) used.add(c.trim().split(/[\s<]/)[1]);

const body = `// GENERATED FILE. Do not edit by hand.
//
// Built from the SVG sprite in ${SOURCE} by scripts/design/build-icons.mjs.
// Re-run \`npm run build:icons\` after the reference changes. SPEC.md 8.4 requires these
// paths to be identical to the reference's, which is why they are generated rather than
// transcribed.
//
// ${icons.length} icons.
import React from 'react';
import Svg, { ${[...used].sort().join(', ')} } from 'react-native-svg';

import { iconSize } from '@/theme/reference/tokens';

export type IconProps = {
  /** Defaults to 20, the reference's \`.ico\` size. The tab bar uses 23. */
  size?: number;
  /**
   * Resolves \`currentColor\` for this icon. Left undefined, the icon inherits the
   * nearest ancestor's colour, which is how the reference's icons take on the team
   * accent from a \`.t-*\` class.
   */
  color?: string;
};

/**
 * Stroke geometry from \`.ico\` in the reference CSS. Applied on the root the way the
 * CSS applies it to the element, so each child inherits it unless it sets its own.
 */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

${icons
  .map(
    (icon) => `export function Icon${icon.name}({ size = iconSize.default, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="${icon.viewBox}" {...STROKE} {...(color ? { color } : null)}>
${icon.children.join('\n')}
    </Svg>
  );
}`
  )
  .join('\n\n')}

/** Every icon, keyed by its sprite id, for data-driven rows like the superlatives list. */
export const ICONS = {
${icons.map((i) => `  '${i.id}': Icon${i.name},`).join('\n')}
} as const;

export type IconName = keyof typeof ICONS;
`;

await writeFile(OUT, body);
console.log(`${icons.length} icons -> ${OUT}`);
console.log(icons.map((i) => i.id).join(', '));
