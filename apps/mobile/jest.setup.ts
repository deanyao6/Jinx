// Jest setup for apps/mobile (jest-expo preset).
//
// react-native-reanimated's animation primitives need a native worklets runtime that does
// not exist under Jest. Its own shipped mock is not usable on its own here, because it
// re-exports the real module and so still reaches for that runtime.
//
// This mock covers exactly the surface the ported screens use, and resolves animations to
// their final value synchronously, so an animated component renders in its settled state
// and can be asserted on like any other. `useReducedMotion` returns false, which is the
// harder path: it means the tests exercise the animated branch rather than the shortcut.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const identity = (value: unknown) => value;
  return {
    __esModule: true,
    default: { View, ScrollView: View, Text: View },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useReducedMotion: () => false,
    withTiming: identity,
    withRepeat: identity,
    withSpring: identity,
    Easing: {
      bezier: () => identity,
      inOut: identity,
      ease: identity,
    },
  };
});

// Screens read their data through features/data/context, which now reaches the signed-in
// user's own queries (SPEC.md 8.9) and so pulls in the Supabase client at import time. The
// client's session storage falls back to AsyncStorage, whose native module does not exist
// under Jest; this is the integration the library documents for exactly that case. Nothing
// in the tests stores a session — the queries are all disabled while signed out — so the
// in-memory mock is enough.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The client is constructed at import and asserts its URL and key are present, so a test
// run with no .env would fail on the import rather than on anything it asserts. These are
// the local defaults; a real value in the environment still wins.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54421';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
