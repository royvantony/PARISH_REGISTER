import { PrismaClient } from '@prisma/client';

/**
 * Resolves the active database connection URL based on APP_ENV:
 * - 'Dev'        -> Port 5432 (Local dev database: parish_register)
 * - 'Demo'       -> Port 5433 (Docker demo database: parish_demo)
 * - 'Production' -> DATABASE_URL from environment (or DATABASE_URL_PROD)
 */
export function getActiveDatabaseUrl(): string {
  const envMode = (process.env.APP_ENV || process.env.NODE_ENV || 'Dev').trim();
  const lower = envMode.toLowerCase();

  if (lower === 'demo') {
    return (
      process.env.DATABASE_URL_DEMO ||
      'postgresql://postgres:demopassword123@127.0.0.1:5433/parish_demo?schema=public'
    );
  }

  if (lower === 'production') {
    const prodUrl = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
    if (!prodUrl) {
      throw new Error('Database configuration error: DATABASE_URL must be defined when APP_ENV=Production.');
    }
    return prodUrl;
  }

  // Default: 'Dev'
  return (
    process.env.DATABASE_URL_DEV ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:password123@127.0.0.1:5432/parish_register?schema=public'
  );
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getActiveDatabaseUrl(),
    },
  },
  log: process.env.APP_ENV === 'Dev' || process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
