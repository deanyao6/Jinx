/**
 * `#RRGGBB` at an opacity, as an `rgba()` string. Team colour is used three ways on the screens
 * outside the reference: solid for the one thing to press, as text for small marks, and washed
 * out to a tint behind a card or an icon. This is the third.
 */
export function alpha(hex: string, opacity: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h as string, 16));
  return `rgba(${r},${g},${b},${Math.min(Math.max(opacity, 0), 1)})`;
}

/** WCAG relative luminance of `#RRGGBB`, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const v = parseInt(h as string, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
