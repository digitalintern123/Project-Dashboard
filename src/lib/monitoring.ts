/**
 * Browser error reporting. Sentry is loaded only when the server reports a DSN
 * (SENTRY_DSN / SENTRY_CLIENT_DSN), so a deployment without Sentry downloads
 * none of it. Errors raised before it loads are queued and sent once it is ready.
 */
type SentryModule = typeof import('./sentry-client');
type ClientConfig = { sentryDsn: string | null; environment: string; release: string | null };

let sentry: SentryModule | null = null;
let pending: Array<{ error: unknown; context?: Record<string, unknown> }> | null = [];

export async function initMonitoring(): Promise<void> {
  try {
    const res = await fetch('/api/client-config', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`client-config ${res.status}`);
    const config = (await res.json()) as ClientConfig;
    if (!config.sentryDsn) {
      pending = null;
      return;
    }
    const Sentry = await import('./sentry-client');
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment,
      release: config.release ?? undefined,
      sendDefaultPii: false,
      // Error tracking only; no performance tracing or session replay.
      tracesSampleRate: 0,
    });
    sentry = Sentry;
    for (const item of pending ?? []) Sentry.captureException(item.error, { extra: item.context });
  } catch {
    // Monitoring must never break the app.
  } finally {
    pending = null;
  }
}

/** Reports an error caught by an error boundary or handler. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (sentry) sentry.captureException(error, { extra: context });
  else pending?.push({ error, context });
}
