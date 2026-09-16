// Thin wrapper over xcrun simctl, shared by the app capture and the inset measurement.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DEVICE } from './geometry.mjs';

const run = promisify(execFile);

export async function simctl(args, opts = {}) {
  const { stdout } = await run('xcrun', ['simctl', ...args], {
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  return stdout;
}

/** UDID of the target device, booting it if necessary. */
export async function bootDevice(name = DEVICE.name) {
  const json = JSON.parse(await simctl(['list', 'devices', 'available', '--json']));
  const all = Object.values(json.devices).flat();
  const device = all.find((d) => d.name === name);
  if (!device) {
    throw new Error(
      `No available simulator named "${name}". Available: ${all.map((d) => d.name).join(', ')}`,
    );
  }
  if (device.state !== 'Booted') {
    await simctl(['boot', device.udid]);
    // `boot` returns before the device is usable; bootstatus blocks until it is.
    await simctl(['bootstatus', device.udid]);
  }
  return device.udid;
}

export async function setAppearance(udid, theme) {
  await simctl(['ui', udid, 'appearance', theme]);
}

export async function isInstalled(udid, bundleId) {
  try {
    const out = await simctl(['listapps', udid]);
    return out.includes(`"${bundleId}"`);
  } catch {
    return false;
  }
}

export async function openUrl(udid, url) {
  await simctl(['openurl', udid, url]);
}

export async function launch(udid, bundleId) {
  await simctl(['launch', udid, bundleId]);
}

export async function terminate(udid, bundleId) {
  try {
    await simctl(['terminate', udid, bundleId]);
  } catch {
    // Not running. Nothing to stop.
  }
}

export async function screenshot(udid, path) {
  await simctl(['io', udid, 'screenshot', '--type=png', path]);
}
