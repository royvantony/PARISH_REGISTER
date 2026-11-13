import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { familiesRouter } from './routes/families.js';
import { mastersRouter } from './routes/masters.js';
import { permissionsRouter } from './routes/permissions.js';
import { importRouter } from './routes/import.js';
import { featuresRouter, ensureDefaultFeatures } from './routes/features.js';
import { settingsRouter } from './routes/settings.js';
import { activityRouter } from './routes/activity.js';
import { backupRouter } from './routes/backup.js';
import { prisma, getActiveDatabaseUrl } from './lib/prisma.js';
import { assertProductionSecretsConfigured } from './lib/crypto.js';

// ---------------------------------------------------------------------------
// Environment Profile Resolution: 'Dev' | 'Demo' | 'Production'
// ---------------------------------------------------------------------------
const rawEnv = (process.env.APP_ENV || process.env.NODE_ENV || 'Dev').trim();
const normalizedEnv = rawEnv.toLowerCase();

export const APP_ENV =
  normalizedEnv === 'production'
    ? 'Production'
    : normalizedEnv === 'demo'
    ? 'Demo'
    : 'Dev';

const isProduction = APP_ENV === 'Production';
const isDev = APP_ENV === 'Dev';
const isDemo = APP_ENV === 'Demo';

assertProductionSecretsConfigured();

// St. Alphonsa Syro-Malabar Parish Register Server
const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().toLowerCase())
  : [];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // In Dev or Demo (or local LAN access): allow all origins & LAN IP addresses
      if (!isProduction) {
        return callback(null, true);
      }

      // In Production: allow requests with no origin (mobile app / curl) and same-origin
      if (!origin) return callback(null, true);

      // In Production: allow configured domain(s) (e.g. Cloudflare tunnel domain)
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin.toLowerCase())) {
        return callback(null, true);
      }

      callback(new Error('Cross-Origin Request Blocked by CORS policy in Production.'));
    },
    credentials: true,
  })
);
app.use(express.json());

// Request logging in Dev / Demo
if (!isProduction) {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] [${APP_ENV}] ${req.method} ${req.url}`);
    next();
  });
}

// Routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/families', familiesRouter);
app.use('/api/masters', mastersRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/import', importRouter);
app.use('/api/features', featuresRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/backup', backupRouter);

// ---------------------------------------------------------------------------
// Single-Server Frontend Delivery:
// - Standalone deployments: ./public
// - Monorepo development: ../client/dist or ./client/dist
// ---------------------------------------------------------------------------
const candidateDistPaths = [
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
];
const clientDistPath = candidateDistPaths.find((p) => fs.existsSync(p)) || candidateDistPaths[0];
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      if (isDev) {
        return res.status(200).send(
          '<h3>Parish Register API Server (Dev Mode)</h3><p>API is active on port ' +
            PORT +
            '. In Dev mode, run <code>npm --prefix client run dev</code> to preview the frontend with hot-reload.</p>'
        );
      }
      next(err);
    }
  });
});


// Health check endpoint with database ping
app.get('/api/health', async (_req, res) => {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let latencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    // Ultra-lightweight raw query: SELECT 1
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - startTime;
    dbStatus = 'connected';
  } catch (error: any) {
    dbError = error?.message || 'Database connection error';
  }

  const isHealthy = dbStatus === 'connected';

  res.json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'Parish Register API Server',
    version: '1.0.0',
    database: {
      status: dbStatus,
      engine: 'PostgreSQL',
      latencyMs,
      error: dbError,
    },
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  const dbUrl = getActiveDatabaseUrl();
  const dbHostPort = dbUrl.replace(/.*@([^/]+)\/([^?]+).*/, '$1/$2');

  console.log(`\n======================================================`);
  console.log(`⛪ Parish Register Server running in [${APP_ENV}] mode`);
  console.log(`📡 URL: http://0.0.0.0:${PORT}`);
  console.log(`🗄️  Active Database: ${dbHostPort}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);

  // Warm up encrypted feature vault cache on startup for fast, instant lookups
  ensureDefaultFeatures().catch((err) => {
    console.warn('Feature cache warmup warning:', err);
  });
});
