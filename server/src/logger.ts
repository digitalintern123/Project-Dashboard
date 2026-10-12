import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';

const env = process.env.NODE_ENV || 'development';

/**
 * Anything that can hold a credential. Paths are matched in every log object,
 * including the request and response that pino-http attaches.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...[
    'password',
    'currentPassword',
    'newPassword',
    'temporaryPassword',
    'password_hash',
    'pass',
    'clientSecret',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
  ].flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

function destination(): pino.LoggerOptions['transport'] {
  // Human-readable output for local development only; production logs are JSON lines.
  if (env === 'production' || process.env.LOG_FORMAT === 'json' || !process.stdout.isTTY) return undefined;
  return { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } };
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (env === 'test' ? 'silent' : 'info'),
  base: { service: 'encalm-dashboard', env },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  transport: destination(),
});

const REQUEST_ID = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Uses the X-Request-Id set by Nginx (or another proxy) when it looks sane,
 * otherwise a new UUID, and echoes it back so a user's report can be matched to the logs.
 */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}
