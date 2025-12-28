let sentryClient = null;

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      maxBreadcrumbs: 50,
    });
    sentryClient = Sentry;
  } catch {
    // noop
  }
}

export function captureException(error, context) {
  if (!sentryClient) return;
  try {
    sentryClient.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // noop
  }
}
