import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adds request headers and IP for users
  sendDefaultPii: true,

  // ---------- Tracing ----------
  // 100 % in dev, 10 % in production — adjust based on traffic
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // ---------- Session Replay ----------
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
  ],

  // Capture Replay for 10 % of sessions, 100 % on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // ---------- Logs ----------
  enableLogs: true,
});

// Instrument Next.js router navigations
export const onRouterTransitionStart =
  Sentry.captureRouterTransitionStart;
