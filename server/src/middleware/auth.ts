import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { getJwtSecret } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  username?: string | null;
  fullName: string;
  role: UserRole;
  parishId: number | null; // NULL for Diocesan Admins
}

// Extend Express Request to carry authenticated user and active parish
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      activeParishId: number; // Always resolved to a concrete parish
    }
  }
}

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded: AuthenticatedUser;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  try {
    const dbUser = await prisma.parishUser.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true, role: true, parishId: true },
    });

    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: 'User account is inactive or no longer exists.' });
    }

    const effectiveUser: AuthenticatedUser = {
      ...decoded,
      role: dbUser.role,
      parishId: dbUser.parishId,
    };
    req.user = effectiveUser;

    // Resolve Active Parish Context:
    // 1. If Global Roles (SUPER_ADMIN, DIOCESAN_ADMIN, DIOCESAN_USER): Can switch active parish via 'x-parish-id' header or defaults to user's assigned parish (or 1)
    // 2. If Parish Staff: Strictly locked to their assigned parishId
    const isGlobalRole =
      effectiveUser.role === UserRole.SUPER_ADMIN ||
      effectiveUser.role === UserRole.DIOCESAN_ADMIN ||
      effectiveUser.role === UserRole.DIOCESAN_USER;

    if (isGlobalRole) {
      const headerParish = req.headers['x-parish-id'];
      req.activeParishId = headerParish ? parseInt(headerParish as string, 10) : (effectiveUser.parishId || 1);
    } else {
      req.activeParishId = effectiveUser.parishId || 1;
    }

    next();
  } catch (err) {
    console.error('Auth user lookup error:', err);
    return res.status(500).json({ error: 'Failed to verify user session.' });
  }
}

// Optional helper for public/optional auth endpoints
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
      req.user = decoded;
    } catch (_) {
      // Token invalid, proceed as guest
    }
  }
  const headerParish = req.headers['x-parish-id'];
  req.activeParishId = headerParish ? parseInt(headerParish as string, 10) : 1;
  next();
}
