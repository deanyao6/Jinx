/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values are inlined into the bundle and they are
 * public by design (SPEC.md Section 3). Service-role and Anthropic keys never live here.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  inboundEmailDomain: process.env.EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN ?? 'in.example.com',
  /** Crash reporting is off unless a DSN is set (src/lib/sentry.ts). */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  /**
   * Demo mode (SPEC.md 8.9): serve the reference's fixture account instead of the signed-in
   * user's own data.
   *
   * Off unless the build sets it. It exists for the visual parity harness and the reference
   * screenshots, which need the exact sample data the design was drawn from, and so the Plan
   * and Guide shells have content to show. A real user must never see it: their passport is
   * the product, and a fabricated 31–17 record makes every screen untestable for them.
   *
   * SPEC.md writes the flag as `DEMO=1`. Only EXPO_PUBLIC_* names are inlined into the
   * bundle, so `EXPO_PUBLIC_DEMO` is the one that reaches the app; plain `DEMO` is honoured
   * too for Node-side tooling (the parity harness and tests), where it does reach us.
   */
  demo: isOn(process.env.EXPO_PUBLIC_DEMO) || isOn(process.env.DEMO),
};

/** `1`, `true` or `yes` in any case. Anything else, including unset, is off. */
function isOn(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Hosts that only exist on the machine that built the app.
 *
 * `.env` points at the local Supabase stack during development, and EXPO_PUBLIC_* values are
 * INLINED INTO THE BUNDLE at build time. Build a release with that `.env` in place and the
 * app installs, launches, and then fails every single request on a device that has no such
 * host, with nothing on screen to explain why. Failing loudly at startup is better than
 * shipping a build that is silently dead.
 */
export function isLocalHost(url: string): boolean {
  const host = url.replace(/^\w+:\/\//, '').split(/[:/]/)[0] ?? '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    // Private ranges: reachable from a phone on the same wifi, but not from TestFlight.
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export function assertEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env.',
    );
  }
  // __DEV__ is false in a release build, which is what TestFlight ships.
  if (!__DEV__ && isLocalHost(env.supabaseUrl)) {
    throw new Error(
      `This release build points at ${env.supabaseUrl}, which does not exist on a phone. ` +
        'Set EXPO_PUBLIC_SUPABASE_URL to the hosted Supabase project before building for ' +
        'TestFlight. See docs/deploy.md.',
    );
  }
}
