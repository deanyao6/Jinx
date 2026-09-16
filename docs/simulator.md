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

The first run generates the native iOS project, installs pods, compiles, and boots the
Simulator. Expect 10 to 20 minutes. After that it starts in seconds and hot-reloads on save.

`npm run ios` (which calls `expo run:ios`) is the right command for this project, not
`expo start` with Expo Go. The app depends on native modules that Expo Go does not contain,
including Sentry, so Expo Go would crash on launch the same way the web build did before the map
was split by platform.

## Disk

Budget roughly 40 GB: about 25 GB for Xcode and 9 GB for one iOS runtime, plus working space
while the archive expands. Reclaimable if needed:

```
npm cache clean --force        # ~4.8 GB
rm -rf ~/Library/Caches/pip    # ~1.7 GB
```
