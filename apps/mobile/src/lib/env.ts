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
};

export function assertEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env.',
    );
  }
}
