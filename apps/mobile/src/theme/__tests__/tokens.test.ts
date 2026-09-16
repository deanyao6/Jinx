import { darkBase, lightBase } from '../reference/tokens';
import { darkColors, lightColors, makeTheme } from '../tokens';

describe('theme tokens', () => {
  it('has the same color keys in light and dark', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
  it('builds a theme for each scheme', () => {
    expect(makeTheme('light').colors.ink).toBe(lightColors.ink);
    expect(makeTheme('dark').colors.ink).toBe(darkColors.ink);
  });
});

describe('the legacy palette follows the reference', () => {
  // The sub screens looked like a different app because this palette was the old
  // turnstile-ui placeholder — navy ink on grey — beside the reference's near-black on
  // white. It is derived from the reference now; these pin the mapping so it cannot drift
  // back by hand-editing a hex.
  it('takes its surfaces straight from the reference base colours', () => {
    expect(lightColors.ink).toBe(lightBase.ink);
    expect(lightColors.screen).toBe(lightBase.scr);
    expect(lightColors.card).toBe(lightBase.card);
    expect(lightColors.line).toBe(lightBase.line);
    expect(lightColors.muted).toBe(lightBase.muted);
    expect(darkColors.ink).toBe(darkBase.ink);
    expect(darkColors.screen).toBe(darkBase.scr);
  });

  it('maps the semantic colours onto the reference names', () => {
    expect(lightColors.green).toBe(lightBase.good);
    expect(lightColors.red).toBe(lightBase.bad);
    expect(lightColors.gold).toBe(lightBase.warn);
    expect(lightColors.blue).toBe(lightBase.link);
    expect(lightColors.tint).toBe(lightBase.surface);
  });

  it('no longer carries any of the placeholder hexes', () => {
    const placeholders = ['#14213D', '#F6F7F9', '#DCE2E8', '#C8102E', '#2E7D4F'];
    const inUse = [...Object.values(lightColors), ...Object.values(darkColors)];
    for (const hex of placeholders) expect(inUse).not.toContain(hex);
  });
});
