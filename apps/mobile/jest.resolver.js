/* global __dirname, require, module */
// Jest resolver, doing two jobs.
//
// 1. Retries `.js` relative imports as `.ts`/`.tsx` for files inside packages/core, which is
//    ESM TypeScript with `.js` suffixes.
// 2. Delegates react-native-worklets to the resolver it ships, which drops the `.native`
//    extensions. react-native-reanimated pulls worklets in at import time, and its native
//    entry point reaches for a TurboModule that does not exist under Jest, so anything
//    importing an animated component failed to load at all.
//
// Everything else uses Jest's default resolution.
const path = require('path');

const workletsResolver = require('react-native-worklets/jest/resolver');

const corePath = path.resolve(__dirname, '../../packages/core');

module.exports = (request, options) => {
  if (
    options.basedir?.includes('react-native-worklets') ||
    request.includes('react-native-worklets')
  ) {
    return workletsResolver(request, options);
  }
  const inCore = options.basedir && options.basedir.startsWith(corePath);
  if (inCore && request.startsWith('.') && request.endsWith('.js')) {
    const base = request.slice(0, -3);
    for (const ext of ['.ts', '.tsx']) {
      try {
        return options.defaultResolver(`${base}${ext}`, options);
      } catch {
        // try the next extension
      }
    }
  }
  return options.defaultResolver(request, options);
};
