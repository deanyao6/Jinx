// Device geometry for the parity harness.
//
// The kickoff brief specifies an iPhone 16 at 393x852pt. Xcode 26.6 on this machine
// ships no iPhone 16 simulator, so the harness targets the iPhone 17 Pro it does have
// and reads its real point size rather than assuming one. Override with PARITY_DEVICE.
//
// 1 CSS px is treated as 1 point, per SPEC.md 8.2, so the reference screen is sized in
// px to the same numbers used here and allowed to reflow. It is never scaled.

export const DEVICE = {
  name: process.env.PARITY_DEVICE ?? 'iPhone 17 Pro',
  width: Number(process.env.PARITY_WIDTH ?? 402),
  height: Number(process.env.PARITY_HEIGHT ?? 874),
  scale: Number(process.env.PARITY_SCALE ?? 3),
};

// The app draws under the real iOS status bar; the reference draws a fake one that
// Section 8.1 excludes from the comparison. Both are cropped away, so the compared
// region starts below the status bar and runs to the bottom of the screen.
//
// Measured, not guessed: scripts/parity/measure-inset.mjs finds the first row of the
// app screenshot that differs from the status bar band. Re-run it after changing the
// device. The value is recorded here so a capture run needs no live measurement.
export const TOP_CROP_PT = Number(process.env.PARITY_TOP_CROP ?? 62);

export const COMPARE = {
  width: DEVICE.width,
  height: DEVICE.height - TOP_CROP_PT,
};

export const PX = {
  width: COMPARE.width * DEVICE.scale,
  height: COMPARE.height * DEVICE.scale,
  topCrop: TOP_CROP_PT * DEVICE.scale,
};

export const OUT_DIR = 'design/parity';
