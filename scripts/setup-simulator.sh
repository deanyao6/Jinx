#!/usr/bin/env bash
# Finishes iOS Simulator setup after Xcode.app is installed, then reports how to run the app.
# Safe to re-run. Asks for your password because selecting the toolchain and accepting the
# licence need root. See docs/simulator.md.
set -uo pipefail

# xcodes installs as Xcode-<version>.app, the App Store installs as Xcode.app, and an already
# selected toolchain wins over both. Accept all three.
if [ -n "${XCODE_APP:-}" ]; then
  :
elif SEL="$(xcode-select -p 2>/dev/null)" && [ -d "${SEL%/Contents/Developer}" ] \
     && [ "$SEL" != "/Library/Developer/CommandLineTools" ]; then
  XCODE_APP="${SEL%/Contents/Developer}"
else
  XCODE_APP="$(ls -d /Applications/Xcode*.app 2>/dev/null | sort -V | tail -1)"
fi

if [ -z "${XCODE_APP:-}" ] || [ ! -d "$XCODE_APP" ]; then
  echo "No Xcode found in /Applications."
  echo "Install it first:  xcodes install 26.6 --experimental-unxip --empty-trash --select"
  echo "(Xcode 27 needs macOS 26.6; 26.6 needs only macOS 26.2, so it works on this machine.)"
  exit 1
fi

echo "==> Pointing the command line tools at Xcode"
sudo xcode-select -s "$XCODE_APP" || exit 1
echo "    $(xcode-select -p)"

echo "==> Accepting the licence"
sudo xcodebuild -license accept || exit 1

echo "==> First launch (installs bundled components)"
sudo xcodebuild -runFirstLaunch || exit 1

echo "==> Checking for an iOS simulator runtime"
if xcrun simctl list runtimes 2>/dev/null | grep -q '^iOS'; then
  xcrun simctl list runtimes | grep '^iOS' | sed 's/^/    /'
else
  echo "    none found. Downloading (this is several GB and takes a while)"
  xcodebuild -downloadPlatform iOS || {
    echo "    Download failed. You can also get it from Xcode > Settings > Components."
    exit 1
  }
fi

echo
echo "Done. To build the app into the simulator, from the repo root:"
echo
echo "    npm run ios"
echo
echo "The first build compiles the native project and takes 10-20 minutes."
echo "After that, 'npm run ios' starts in seconds and reloads on save."
