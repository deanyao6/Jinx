import { containsProfanity } from './profanity';

export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
export const DISPLAY_NAME_MAX = 40;

/** Handles the auth trigger assigns before onboarding; never treat them as chosen. */
export function isPlaceholderHandle(handle: string | null | undefined): boolean {
  return !handle || /^fan_[0-9a-f]{8}$/.test(handle);
}

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

export function validateHandle(raw: string): string | null {
  const handle = normalizeHandle(raw);
  if (handle.length < 3) return 'Handles need at least 3 characters.';
  if (handle.length > 20) return 'Handles can be up to 20 characters.';
  if (!HANDLE_PATTERN.test(handle)) return 'Use lowercase letters, numbers, and underscores only.';
  if (containsProfanity(handle)) return 'Pick a different handle.';
  return null;
}

export function validateDisplayName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return 'Add a name so friends can recognize you.';
  if (name.length > DISPLAY_NAME_MAX) return `Names can be up to ${DISPLAY_NAME_MAX} characters.`;
  if (containsProfanity(name)) return 'Pick a different name.';
  return null;
}
