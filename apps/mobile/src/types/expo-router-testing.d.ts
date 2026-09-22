// expo-router/testing-library registers toHavePathname, toHavePathnameWithParams and
// toHaveSegments with jest at runtime, but the package's expect.d.ts is empty (SDK 57), so
// TypeScript has never heard of them. Declared here so a test can use them and still typecheck.
declare namespace jest {
  interface Matchers<R> {
    toHavePathname(expected: string): R;
    toHavePathnameWithParams(expected: string): R;
    toHaveSegments(expected: string[]): R;
  }
}
