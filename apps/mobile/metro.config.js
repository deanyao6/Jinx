// Metro config: extends Expo's defaults so the app can import @jinx/core, an ESM TypeScript
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

// Watch only what the bundler actually resolves from. Watching the whole workspace root pulled in
// apps/mobile/ios (34k files, 4 GB of Xcode derived data once a native build exists), which
// overwhelms the file watcher and silently stops Fast Refresh from firing at all.
config.watchFolders = Array.from(
  new Set([
    ...(config.watchFolders ?? []),
    path.join(workspaceRoot, 'packages', 'core'),
    path.join(workspaceRoot, 'node_modules'),
  ]),
);

// The project root itself is always watched, and ios/ and android/ live inside it, so they have to
// be excluded explicitly. They contain no JavaScript the bundler needs.
const escape = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nativeBuildDirs = [
  new RegExp(`^${escape(path.join(projectRoot, 'ios'))}/.*$`),
  new RegExp(`^${escape(path.join(projectRoot, 'android'))}/.*$`),
];
config.resolver.blockList = Array.isArray(config.resolver.blockList)
  ? [...config.resolver.blockList, ...nativeBuildDirs]
  : config.resolver.blockList
    ? [config.resolver.blockList, ...nativeBuildDirs]
    : nativeBuildDirs;

// Do not delegate file watching to the watchman daemon. This repo lives under ~/Desktop, which
// macOS restricts, and the daemon is not granted access there: `watchman since` reports zero
// changes after a write, so Fast Refresh silently stops firing. Metro's own watcher runs inside
// the node process started from your terminal, which does have access. Remove this only if the
// project moves out of a protected folder, or watchman is granted Full Disk Access.
config.resolver.useWatchman = false;

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
