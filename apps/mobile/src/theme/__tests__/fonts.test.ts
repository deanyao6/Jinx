import {
  DEFAULT_WEIGHT,
  DEFAULT_WIDTH,
  FONT_ASSETS,
  FONT_INSTANCES,
  FONT_WIDTHS,
  fontFamily,
} from '../fonts';

describe('Archivo static instances', () => {
  // Importing this module runs all 19 `require`s in FONT_ASSETS. A missing or renamed .ttf
  // fails to resolve and this file cannot even be imported, so that is the real on-disk guard;
  // this asserts each one resolved to an actual asset rather than to undefined.
  it('resolves a real asset for every declared instance', () => {
    const unresolved = Object.entries(FONT_ASSETS).filter(([, source]) => source == null);
    expect(unresolved).toEqual([]);
    expect(Object.keys(FONT_ASSETS)).toHaveLength(FONT_INSTANCES.length);
  });

  it('declares one expo-font asset per instance, with no duplicates', () => {
    const names = FONT_INSTANCES.map(([width, weight]) => `Archivo_wdth${width}_wght${weight}`);
    expect(new Set(names).size).toBe(FONT_INSTANCES.length);
    expect(Object.keys(FONT_ASSETS).sort()).toEqual([...names].sort());
  });
});

describe('fontFamily', () => {
  it('returns the exact instance when one exists', () => {
    for (const [width, weight] of FONT_INSTANCES) {
      expect(fontFamily({ width, weight })).toBe(`Archivo_wdth${width}_wght${weight}`);
    }
  });

  it('defaults to the reference body face', () => {
    expect(fontFamily()).toBe(`Archivo_wdth${DEFAULT_WIDTH}_wght${DEFAULT_WEIGHT}`);
  });

  it('snaps to the nearest width before the nearest weight', () => {
    // 63 is between 62 and 64; ties and near-misses resolve to a real instance.
    expect(fontFamily({ width: 61, weight: 900 })).toBe('Archivo_wdth62_wght900');
    expect(fontFamily({ width: 71, weight: 900 })).toBe('Archivo_wdth70_wght850');
    // Width 70 has no 400, so the weight snaps up to the lightest instance at that width.
    expect(fontFamily({ width: 70, weight: 100 })).toBe('Archivo_wdth70_wght700');
  });

  it('is total: every width/weight in and around the reference range maps to a real family', () => {
    const names = new Set(Object.keys(FONT_ASSETS));
    for (let width = 0; width <= 200; width += 1) {
      for (let weight = 0; weight <= 1000; weight += 50) {
        expect(names.has(fontFamily({ width, weight }))).toBe(true);
      }
    }
    expect(names.has(fontFamily({ width: Number.NaN, weight: Number.NaN }))).toBe(true);
    expect(names.has(fontFamily({}))).toBe(true);
  });

  it('exposes every generated width', () => {
    expect(FONT_WIDTHS).toEqual([62, 64, 66, 70, 72, 74, 78, 80, 100]);
  });
});
