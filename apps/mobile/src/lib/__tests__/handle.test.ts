import {
  isPlaceholderHandle,
  normalizeHandle,
  validateDisplayName,
  validateHandle,
} from '../handle';

describe('validateHandle', () => {
  it('accepts lowercase letters, digits, and underscores between 3 and 20 chars', () => {
    expect(validateHandle('dean')).toBeNull();
    expect(validateHandle('phils_fan_2019')).toBeNull();
    expect(validateHandle('abc')).toBeNull();
    expect(validateHandle('a'.repeat(20))).toBeNull();
  });

  it('normalizes a leading @, whitespace, and case before checking', () => {
    expect(normalizeHandle('  @Dean ')).toBe('dean');
    expect(validateHandle('@Dean')).toBeNull();
  });

  it('rejects short, long, and badly formed handles', () => {
    expect(validateHandle('ab')).toMatch(/at least 3/);
    expect(validateHandle('a'.repeat(21))).toMatch(/up to 20/);
    expect(validateHandle('dean yao')).toMatch(/lowercase letters/);
    expect(validateHandle('dean-yao')).toMatch(/lowercase letters/);
    expect(validateHandle('dëan')).toMatch(/lowercase letters/);
  });

  it('rejects profanity', () => {
    expect(validateHandle('shithead')).toMatch(/different handle/);
    expect(validateHandle('sh1t_fan')).toMatch(/different handle/);
  });
});

describe('validateDisplayName', () => {
  it('requires a non-empty name of at most 40 characters', () => {
    expect(validateDisplayName('Dean')).toBeNull();
    expect(validateDisplayName('   ')).toMatch(/Add a name/);
    expect(validateDisplayName('x'.repeat(41))).toMatch(/up to 40/);
  });
  it('rejects profanity', () => {
    expect(validateDisplayName('Mr Fuck')).toMatch(/different name/);
  });
});

describe('isPlaceholderHandle', () => {
  it('recognizes the auth trigger placeholder', () => {
    expect(isPlaceholderHandle('fan_0a1b2c3d')).toBe(true);
    expect(isPlaceholderHandle('fan_dean')).toBe(false);
    expect(isPlaceholderHandle('dean')).toBe(false);
    expect(isPlaceholderHandle(null)).toBe(true);
  });
});
