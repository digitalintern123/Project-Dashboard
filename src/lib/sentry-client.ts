// The only Sentry APIs the app uses. Importing them by name (rather than the
// whole package) lets the build drop replay, feedback and tracing code.
export { captureException, init } from '@sentry/react';
