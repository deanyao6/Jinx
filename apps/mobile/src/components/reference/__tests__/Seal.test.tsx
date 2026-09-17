import React from 'react';
import { render } from '@testing-library/react-native';

import { Seal } from '@/components/reference/Seal';
import { REFERENCE_TEAMS } from '@/theme/reference/teams';

/**
 * The two snapshots below were written against the Seal as it stood BEFORE it learned team
 * colours, wear and gold, and have not been regenerated since. They are the proof that a
 * brass or silver seal, which is what demo mode and `npm run parity` draw, is unchanged.
 * Do not run `jest -u` on this file without reading the diff.
 */
describe('Seal, the reference metals', () => {
  it('draws a silver seal exactly as the reference does', async () => {
    const { toJSON } = await render(
      <Seal ring="CITIZENS BANK PARK" shapeKey="ballparkA" metal="silver" inkColor="#101318" />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('draws a brass seal exactly as the reference does', async () => {
    const { toJSON } = await render(
      <Seal ring="THE LINC" shapeKey="bowl" metal="brass" size={88} inkColor="#F1F3F6" />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };

/** Every element in a rendered tree, flattened, so a test can count what was drawn. */
function nodes(tree: unknown): Node[] {
  if (!tree || typeof tree === 'string') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  const node = tree as Node;
  return [node, ...(node.children ?? []).flatMap(nodes)];
}

const count = (tree: unknown, type: string) => nodes(tree).filter((n) => n.type === type).length;

const phi = REFERENCE_TEAMS.phi.light;
const TINT = { fill: phi.fill, second: phi.second, onFill: phi.onFill };

describe('Seal, beyond the reference', () => {
  it('draws a team tint with the same parts as a metal, and nothing added', async () => {
    const silver = await render(
      <Seal ring="CITIZENS BANK PARK" shapeKey="ballparkA" metal="silver" inkColor="#101318" />,
    );
    const tinted = await render(
      <Seal ring="CITIZENS BANK PARK" shapeKey="ballparkA" metal={TINT} inkColor="#101318" />,
    );
    const a = nodes(silver.toJSON()).map((n) => n.type);
    const b = nodes(tinted.toJSON()).map((n) => n.type);
    expect(b).toEqual(a);
    expect(JSON.stringify(tinted.toJSON())).not.toEqual(JSON.stringify(silver.toJSON()));
  });

  it('adds the second strike and the specks when worn, the same way every time', async () => {
    const props = {
      ring: 'CITIZENS BANK PARK',
      shapeKey: 'ballparkA',
      metal: TINT,
      inkColor: '#101318',
      seed: 'venue-1',
    } as const;
    const crisp = (await render(<Seal {...props} />)).toJSON();
    const light = (await render(<Seal {...props} wear={1} />)).toJSON();
    const heavy = (await render(<Seal {...props} wear={2} />)).toJSON();
    const again = (await render(<Seal {...props} wear={2} />)).toJSON();

    expect(count(light, 'RNSVGCircle')).toBeGreaterThan(count(crisp, 'RNSVGCircle'));
    expect(count(heavy, 'RNSVGCircle')).toBeGreaterThan(count(light, 'RNSVGCircle'));
    // The ring text is struck twice: once in the ghost, once for real.
    expect(count(crisp, 'RNSVGTextPath')).toBe(1);
    expect(count(heavy, 'RNSVGTextPath')).toBe(2);

    // Gradient and path ids come from useId and differ per mount; everything else must not.
    const stable = (tree: unknown) => JSON.stringify(tree).replace(/s[grf]_r_[0-9a-z]+_/g, 'ID');
    expect(stable(again)).toEqual(stable(heavy));
  });

  it('draws gold with a foil band, and holds the glint still when asked', async () => {
    const still = (
      await render(<Seal ring="THE LINC" shapeKey="bowl" metal="gold" inkColor="#101318" still />)
    ).toJSON();
    expect(count(still, 'RNSVGLinearGradient')).toBe(1);
    expect(count(still, 'RNSVGSvgView')).toBe(1);

    const moving = (
      await render(<Seal ring="THE LINC" shapeKey="bowl" metal="gold" inkColor="#101318" />)
    ).toJSON();
    // The glint is plain views over the SVG, so there are more of them than when it is still.
    expect(count(moving, 'View')).toBeGreaterThan(count(still, 'View'));
  });
});
