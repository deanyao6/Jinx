// Metro config: extends Expo's defaults so the app can import @appname/core, an ESM TypeScript
// package whose relative imports carry `.js` suffixes (`./types.js` -> `types.ts`). The retry is
// limited to files inside packages/core.
// getSentryExpoConfig extends Expo's defaults with debug ids for source maps; it is a no-op at
// runtime when no DSN is configured.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const corePath = path.join(workspaceRoot, 'packages', 'core');

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  const inCore = context.originModulePath && context.originModulePath.startsWith(corePath);
  if (inCore && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3);
    for (const ext of ['.ts', '.tsx']) {
      try {
        return resolve(context, `${base}${ext}`, platform);
      } catch {
        // try the next extension
      }
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
