# Running the app in the iOS Simulator

The Simulator is part of Xcode. There is no smaller download that provides it.

## Why not the App Store

The App Store only ever offers the newest Xcode. That is now Xcode 27.0, which requires
macOS 26.6. This machine runs macOS 26.5.2, so the App Store refuses to install it.

Xcode **26.6** requires only macOS 26.2, so it runs here, and it is one release behind current.
Older Xcode versions are not in the App Store but are free to download from Apple with any Apple
ID. A paid developer membership is not needed for this.

## Install

```
brew install xcodes aria2                                    # already done
xcodes install 26.6 --experimental-unxip --empty-trash --select
```

Run that in your own terminal, not through an agent: it prompts for your Apple ID and a
two-factor code. The `--empty-trash` flag deletes the ~10 GB archive once it has expanded, which
matters because this disk is over 90% full.

`xcodes` installs to `/Applications/Xcode-<version>.app`, not `Xcode.app`, and `--select`
points the command line tools at it. Both are fine; nothing expects the plain name.

Then:

```
brew install cocoapods          # system Ruby is 2.6, too old for the gem
bash scripts/setup-simulator.sh
```

The script accepts the licence, runs first launch, and downloads an iOS runtime if none is
present. Xcode ships the iOS SDK but not the simulator runtime, so that download is always
needed on a fresh install.

## Run the app

```
npm run ios
```

That runs `scripts/ios-sim.sh`, which boots a simulator, builds, installs, starts Metro and
launches. The first build takes 10 to 20 minutes. Later runs reuse the compiled output and take
seconds. Editing anything under `apps/mobile/src` reloads live with no rebuild.

Do not use Expo Go. The app depends on native modules Expo Go does not contain, including Sentry,
so it would crash on launch the same way the web build did before the map was split by platform.

### Why a script instead of `expo run:ios`

Two things block the plain Expo command on a machine with no Apple developer certificate.

**Sign in with Apple forces code signing.** Expo keeps a list of entitlements that require a
development signing identity even for simulator builds, and `com.apple.developer.applesignin` is
on it. The app declares that entitlement because the spec requires Apple sign-in, so every
`expo run:ios` fails with `No code signing certificates are available to use`. Simulators do not
actually need signing, so the script builds through `xcodebuild` with signing disabled.

**Sentry uploads source maps during the build.** The config plugin adds an upload phase that
calls `sentry-cli`, which fails with `An organization ID or slug is required` when `SENTRY_ORG`
and `SENTRY_PROJECT` are unset. The script sets `SENTRY_DISABLE_AUTO_UPLOAD=true`.

Once you join the Apple Developer Program and Xcode holds a certificate, plain `expo run:ios`
works and the script becomes unnecessary.

### Expected noise in the simulator

An `expo-notifications` error toast appears on launch: `ERR_NOTIFICATIONS_KEYCHAIN_ACCESS`. The
unsigned build has no keychain entitlement, so the native module cannot read its stored
registration. Push notifications do not work in a simulator anyway. Auth is unaffected, because
`src/lib/secureStorage.ts` already falls back to AsyncStorage when SecureStore is unavailable.

Sign in with Apple will not work in the simulator either, since it needs the Services ID
configured in Supabase. Use "Continue with email" and read the code from Mailpit at
http://127.0.0.1:54424.

## Disk

Budget roughly 40 GB: about 25 GB for Xcode and 9 GB for one iOS runtime, plus working space
while the archive expands. Reclaimable if needed:

```
npm cache clean --force        # ~4.8 GB
rm -rf ~/Library/Caches/pip    # ~1.7 GB
```
