/**
 * Crash reporting (SPEC.md M10). Enabled only when EXPO_PUBLIC_SENTRY_DSN is set, so local builds
 * and CI never report. We send the user id and nothing else about the person: no email, no IP,
 * no request bodies, and breadcrumbs keep only the URL path.
 */
import * as Sentry from '@sentry/react-native';

import { env } from './env';

export const sentryEnabled = !!env.sentryDsn;

function stripQuery(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

export function initSentry(): void {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    beforeSend(event) {
      const id = event.user?.id;
      event.user = id ? { id } : undefined;
      if (event.request) {
        event.request = { url: stripQuery(event.request.url) as string | undefined };
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'console') return null;
      if (crumb.data && typeof crumb.data === 'object' && 'url' in crumb.data) {
        crumb.data = { ...crumb.data, url: stripQuery(crumb.data.url) };
      }
      return crumb;
    },
  });
}

export function setSentryUser(userId: string | null): void {
  if (!sentryEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Wraps the root component for touch-event breadcrumbs and error boundaries when enabled. */
export function wrapRoot<P extends Record<string, unknown>>(
  component: React.ComponentType<P>,
): React.ComponentType<P> {
  return sentryEnabled ? Sentry.wrap(component) : component;
}
