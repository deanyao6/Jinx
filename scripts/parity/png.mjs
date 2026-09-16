// Small PNG helpers. pixelmatch works on raw RGBA, so everything here stays in
// PNG objects from pngjs rather than buffers of encoded PNG.
import { readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

export async function readPng(path) {
  return PNG.sync.read(await readFile(path));
}

export async function writePng(path, png) {
  await writeFile(path, PNG.sync.write(png));
}

/** Crop `png` to a rectangle, returning a new PNG. */
export function crop(png, { x = 0, y = 0, width, height }) {
  const w = Math.min(width, png.width - x);
  const h = Math.min(height, png.height - y);
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x, y, w, h, 0, 0);
  return out;
}

/** Paste `src` into `dst` at (x, y). */
export function paste(dst, src, x, y) {
  PNG.bitblt(src, dst, 0, 0, src.width, src.height, x, y);
}

export function fill(png, [r, g, b, a = 255]) {
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  }
  return png;
}

export function blank(width, height, color = [255, 255, 255, 255]) {
  return fill(new PNG({ width, height }), color);
}
