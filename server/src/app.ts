import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { uploadsDir } from './db/database.js';

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

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled to allow internal media, SVGs, and base64 canvases without CSP breakage
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. HTTP Compression (Gzip / Deflate)
  app.use(compression());

  // 3. CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : null;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (!isProduction) return callback(null, true);
        if (allowedOrigins && allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (!allowedOrigins) {
          // If no CORS_ORIGIN specified in production, allow same host or reflect
          return callback(null, true);
        }
        return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
      },
      credentials: true,
    })
  );

  // 4. Rate Limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600, // Limit each IP to 600 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 30 login attempts per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again after 15 minutes.' },
  });

  const emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // 100 email notifications per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Email dispatch rate limit reached. Please try again shortly.' },
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/email/test-smtp', emailLimiter);
  app.use('/api/email/tag-and-comment', emailLimiter);

  // 5. Body Parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 6. Serve Uploaded Media with 1-day Cache
  app.use('/uploads', express.static(uploadsDir, { maxAge: '1d' }));

  // 7. Request Logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.originalUrl.startsWith('/api')) {
        const statusColor = res.statusCode >= 500 ? '🔴' : res.statusCode >= 400 ? '🟡' : '🟢';
        console.log(`[API] ${statusColor} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      }
    });
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
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.resolve(__dirname, '../../dist');

  if (fs.existsSync(distPath)) {
    // Serve hashed assets with immutable 1-year caching
    const assetsPath = path.join(distPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      app.use('/assets', express.static(assetsPath, { maxAge: '1y', immutable: true }));
    }

    // Serve root static files (favicon, logos, etc.)
    app.use(express.static(distPath, { maxAge: '1h' }));

    // Client-side SPA routing fallback: always serve index.html with fresh no-cache headers
    app.get('/{*splat}', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.redirect('http://localhost:5173');
    });
  }

  // 11. Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Unhandled Error]', err);
    const status = typeof err.status === 'number' ? err.status : 500;
    res.status(status).json({
      error: 'Internal Server Error',
      message: isProduction ? 'An unexpected error occurred.' : err.message,
    });
  });

  return app;
}
