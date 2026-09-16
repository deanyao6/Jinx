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
