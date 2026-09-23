/**
 * Server errors a fan can cause, said in plain words. The database raises these codes on
 * purpose (supabase/migrations/20260924010100_feed.sql and 20260924010500_moderation.sql), so a
 * rate limit or a refused name is a sentence on screen, never a crash.
 */

type MaybeError = { code?: unknown; message?: unknown } | null | undefined;

export const RATE_LIMITED = 'JX429';
export const PROFANE_NAME = 'JX451';

const RATE_COPY: Record<string, string> = {
  post: 'That is a lot of posting. Try again in a little while.',
  comment: 'Slow down a little. You can comment again in a few minutes.',
  kudos: 'That is a lot of kudos. Try again in a little while.',
  follow: 'You have followed a lot of people in the last hour. Try again later.',
  report: 'Thanks, we have your reports. You can send more in an hour.',
  contact_match: 'You have checked your contacts a few times already. Try again in an hour.',
};

export function isRateLimited(e: unknown): boolean {
  return (e as MaybeError)?.code === RATE_LIMITED;
}

/** The sentence to show for an error from a social write, or null when it is not one of ours. */
export function friendlySocialError(e: unknown): string | null {
  const err = e as MaybeError;
  const message = typeof err?.message === 'string' ? err.message : '';
  if (err?.code === RATE_LIMITED) {
    const kind = message.replace(/^rate_limited:\s*/, '').trim();
    return RATE_COPY[kind] ?? 'Slow down a little and try again in a few minutes.';
  }
  if (err?.code === PROFANE_NAME) {
    return message.includes('display_name')
      ? 'That name will not work here. Try another.'
      : 'That handle will not work here. Try another.';
  }
  return null;
}
