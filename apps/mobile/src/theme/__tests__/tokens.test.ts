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
