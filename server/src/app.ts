import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';

import { uploadsDir } from './db/database.js';
import { clientDistDir } from './paths.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './utils/session.js';
import { envInt } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { HttpError } from './utils/http-error.js';
import { LARGE_JSON_PATHS } from './validation/large-json.js';
import { logger, requestId } from './logger.js';
import { appRelease, captureError, clientDsn, dsnOrigin, sentryEnvironment } from './sentry.js';

import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import phasesRouter from './routes/phases.js';
import milestonesRouter from './routes/milestones.js';
import issuesRouter from './routes/issues.js';
import { projectUpdatesRouter, globalUpdatesRouter } from './routes/updates.js';
import notificationsRouter from './routes/notifications.js';
import systemRouter from './routes/system.js';
import emailRouter from './routes/email.js';
import { projectPhotosRouter, globalPhotosRouter } from './routes/photos.js';

const isProduction = process.env.NODE_ENV === 'production';

export function createApp() {
  const app = express();

  // Trust reverse proxy (Nginx, Docker, Cloudflare, Traefik) for correct client IP detection
  app.set('trust proxy', 1);

  // 0. Structured request logging with a request ID (X-Request-Id).
  app.use(
    pinoHttp({
      logger,
      genReqId: requestId,
      // Health probes run every minute; logging each one is noise.
      autoLogging: { ignore: (req) => req.url === '/api/system/ready' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      // Method and path only: query strings can carry search terms and ids we don't need in logs.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Browsers may post error reports to Sentry only when a DSN is configured.
  const sentryOrigin = dsnOrigin(clientDsn());

  // 1. Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", ...(sentryOrigin ? [sentryOrigin] : [])],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  // 2. HTTP Compression (Gzip / Deflate)
  app.use(compression());

  // 3. CORS. Same-origin requests need no CORS headers. In production only the
  // origins listed in CORS_ORIGIN get them; in development only localhost does.
  // Other origins simply get no CORS headers, so browsers block the response.
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isLocalhost = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, false);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (!isProduction && isLocalhost(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  // 4. Rate Limiting (limits configurable for tests and unusual deployments)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: envInt('API_RATE_LIMIT', 600),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: envInt('LOGIN_RATE_LIMIT', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts from this network. Please try again in 15 minutes.' },
  });

  const emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: envInt('EMAIL_RATE_LIMIT', 100),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Email dispatch rate limit reached. Please try again shortly.' },
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/email/test', emailLimiter);
  app.use('/api/email/send-project-update', emailLimiter);
  app.use('/api/email/tag-and-comment', emailLimiter);

  // 5. Body parsers: 1 MB for JSON and forms. Photo uploads are multipart
  // (multer in routes/photos.ts); coordinator-only full-portfolio imports parse
  // up to 10 MB after their auth checks (validation/large-json.ts).
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => (LARGE_JSON_PATHS.has(req.path) ? next() : jsonParser(req, res, next)));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(cookieParser());

  // CSRF protection for cookie sessions: state-changing API requests must carry a
  // custom header, which a cross-site form or image cannot set and a cross-site
  // fetch cannot send without passing CORS. Requests with no session cookie have
  // nothing to forge and fall through to the normal 401.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const hasSession = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
    const isSessionStart = req.path === '/auth/login' || req.path === '/auth/refresh';
    if ((hasSession || isSessionStart) && req.get('X-Requested-With') !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Forbidden: missing CSRF header' });
    }
    next();
  });

  // 6. Uploaded photos: signed-in users only, never sniffed as another type, and
  // cached only by the user's own browser. File names are random UUIDs that are
  // never reused, so a stored copy never goes stale.
  app.use(
    '/uploads',
    requireAuth,
    express.static(uploadsDir, {
      dotfiles: 'deny',
      index: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  // Browser runtime settings. Public: a Sentry DSN is designed to be exposed.
  app.get('/api/client-config', (_req, res) => {
    res.json({ sentryDsn: clientDsn() || null, environment: sentryEnvironment(), release: appRelease() ?? null });
  });

  // API caching: GETs may be kept by the user's browser but are revalidated on
  // every use against the ETag Express adds, so an unchanged list costs a 304
  // with no body. Auth responses and writes are never stored.
  app.use('/api', (req, res, next) => {
    const revalidate = req.method === 'GET' && !req.path.startsWith('/auth/');
    res.setHeader('Cache-Control', revalidate ? 'private, no-cache' : 'no-store');
    next();
  });

  // 8. Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:id/phases', phasesRouter);
  app.use('/api/projects/:id/milestones', milestonesRouter);
  app.use('/api/projects/:id/issues', issuesRouter);
  app.use('/api/projects/:id/updates', projectUpdatesRouter);
  app.use('/api/projects/:id/photos', projectPhotosRouter);
  app.use('/api/updates', globalUpdatesRouter);
  app.use('/api/photos', globalPhotosRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/email', emailRouter);
  app.use('/api/system', systemRouter);

  // 9. Explicit 404 for missing API and Upload resources (prevents falling through to SPA HTML)
  app.all('/api/{*splat}', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  app.all('/uploads/{*splat}', (req, res) => {
    res.status(404).json({ error: `Upload asset not found: ${req.originalUrl}` });
  });

  // 10. Serve Frontend Static Build
  const distPath = clientDistDir;

  if (fs.existsSync(distPath)) {
    // Serve hashed assets with immutable 1-year caching
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      app.use('/assets', express.static(assetsPath, { maxAge: '1y', immutable: true }));
    }

    // Root static files (favicon, logos). index.html is left to the fallback
    // below so a deploy is picked up at once instead of after a cached hour.
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );

    // Client-side SPA routing fallback: always serve index.html with fresh no-cache headers
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.redirect('http://localhost:5173');
    });
  }

  // 11. Global Error Handler
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    const status = (err as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // e.g. body-parser's 413 for oversized bodies
      return res.status(status).json({ error: (err as Error).message });
    }
    req.log.error({ err }, 'Unhandled error');
    captureError(err, { requestId: req.id, method: req.method, path: req.path });
    res.status(500).json({
      error: 'Internal Server Error',
      message: isProduction ? 'An unexpected error occurred.' : (err as Error)?.message,
    });
  });

  return app;
}
