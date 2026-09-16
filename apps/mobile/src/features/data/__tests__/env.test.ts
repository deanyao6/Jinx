/**
 * The demo flag (SPEC.md 8.9). It decides whether a user sees their own passport or the
 * reference's, so what counts as "on" is worth pinning down. Default is off.
 */
describe('EXPO_PUBLIC_DEMO', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  function loadEnv(value?: string) {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_DEMO;
    delete process.env.DEMO;
    if (value != null) process.env.EXPO_PUBLIC_DEMO = value;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('@/lib/env') as typeof import('@/lib/env')).env;
  }

  it('is off when unset, which is what a real user builds', () => {
    expect(loadEnv().demo).toBe(false);
  });

  it('is on for 1, true and yes, in any case', () => {
    expect(loadEnv('1').demo).toBe(true);
    expect(loadEnv('true').demo).toBe(true);
    expect(loadEnv('YES').demo).toBe(true);
  });

  it('is off for anything else, including an empty value', () => {
    expect(loadEnv('').demo).toBe(false);
    expect(loadEnv('0').demo).toBe(false);
    expect(loadEnv('false').demo).toBe(false);
  });
});
