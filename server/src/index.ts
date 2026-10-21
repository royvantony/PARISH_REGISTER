import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { familiesRouter } from './routes/families.js';
import { mastersRouter } from './routes/masters.js';
import { permissionsRouter } from './routes/permissions.js';
import { importRouter } from './routes/import.js';
import { prisma } from './lib/prisma.js';

// St. Alphonsa Syro-Malabar Parish Register Server
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // In dev or local network: allow localhost, 127.0.0.1, and local private LAN IP addresses
      if (
        !origin ||
        process.env.NODE_ENV !== 'production' ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Request logging in dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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
  console.log(`\n🚀 Parish Register API running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health\n`);
});
