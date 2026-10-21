import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  fullName: string;
  role: UserRole;
  parishId: number | null; // NULL for Diocesan Admins
  assignedUnitId?: number | null; // For Unit Coordinators
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

const getJwtSecret = () => process.env.JWT_SECRET || 'st_alphonsa_parish_brisbane_secret_jwt_key_2026';

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
    req.user = decoded;

    // Resolve Active Parish Context:
    // 1. If Global Roles (SUPER_ADMIN, DIOCESAN_ADMIN, DIOCESAN_USER): Can switch active parish via 'x-parish-id' header or defaults to user's assigned parish (or 1)
    // 2. If Parish Staff: Strictly locked to their assigned parishId
    const isGlobalRole =
      decoded.role === UserRole.SUPER_ADMIN ||
      decoded.role === UserRole.DIOCESAN_ADMIN ||
      decoded.role === UserRole.DIOCESAN_USER;

    if (isGlobalRole) {
      const headerParish = req.headers['x-parish-id'];
      req.activeParishId = headerParish ? parseInt(headerParish as string, 10) : (decoded.parishId || 1);
    } else {
      req.activeParishId = decoded.parishId || 1;
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
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
