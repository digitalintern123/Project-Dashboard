import type { ErrorEvent } from '@sentry/node';
import { logger } from './logger.js';

type SentryModule = typeof import('@sentry/node');

/** Server DSN. Error tracking is off unless this is set. */
export const serverDsn = () => process.env.SENTRY_DSN?.trim() || '';
/** Browser DSN: SENTRY_CLIENT_DSN for a separate Sentry project, otherwise the server's. */
export const clientDsn = () => process.env.SENTRY_CLIENT_DSN?.trim() || serverDsn();
export const sentryEnvironment = () => process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
export const appRelease = () => process.env.APP_RELEASE || undefined;

/** Origin events are posted to, for the CSP connect-src; null when the DSN is unset or invalid. */
export function dsnOrigin(dsn: string): string | null {
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

let sentry: SentryModule | null = null;

/** Never send cookies, auth headers or request bodies (passwords, secrets) to Sentry. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (/^(cookie|authorization|x-csrf-token)$/i.test(name)) delete event.request.headers[name];
      }
    }
  }
  return event;
}

/** Loads and starts the Sentry SDK when SENTRY_DSN is set; otherwise does nothing. */
export async function initSentry(): Promise<void> {
  const dsn = serverDsn();
  if (!dsn || sentry) return;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    release: appRelease(),
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    beforeSend: scrubEvent,
  });
  sentry = Sentry;
  logger.info({ environment: sentryEnvironment() }, 'Sentry error tracking enabled');
}

/** Reports an unexpected error; a no-op when Sentry is off. */
export function captureError(err: unknown, context: Record<string, unknown> = {}): void {
  sentry?.captureException(err, { extra: context });
}

/** Sends queued events before the process exits. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  await sentry?.flush(timeoutMs);
}
