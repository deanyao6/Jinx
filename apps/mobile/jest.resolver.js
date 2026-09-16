/* global __dirname */
// Jest resolver: retries `.js` relative imports as `.ts`/`.tsx` for files inside packages/core,
// which is ESM TypeScript with `.js` suffixes. Everything else uses Jest's default resolution.
const path = require('path');

const corePath = path.resolve(__dirname, '../../packages/core');

module.exports = (request, options) => {
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
