import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT, AuthenticatedUser } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

export const authRouter = Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'st_alphonsa_parish_brisbane_secret_jwt_key_2026';

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.parishUser.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        parish: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const payload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      parishId: user.parishId,
      assignedUnitId: user.assignedUnitId,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

    // Return user info and available parishes for tenant switcher
    let availableParishes: any[] = [];
    const isGlobalRole =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.DIOCESAN_USER;

    if (isGlobalRole) {
      availableParishes = await prisma.parish.findMany({
        where: { isActive: true },
        select: { id: true, parishCode: true, parishName: true, city: true, state: true },
        orderBy: { id: 'asc' },
      });
    } else if (user.parish) {
      availableParishes = [
        {
          id: user.parish.id,
          parishCode: user.parish.parishCode,
          parishName: user.parish.parishName,
          city: user.parish.city,
          state: user.parish.state,
        },
      ];
    }

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        parishId: user.parishId,
        assignedUnitId: user.assignedUnitId,
        mustChangePassword: user.mustChangePassword,
      },
      availableParishes,
      defaultParishId: user.parishId || (availableParishes[0]?.id ?? 1),
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/parishes - Publicly accessible list of active parishes
authRouter.get('/parishes', async (_req: Request, res: Response) => {
  try {
    const parishes = await prisma.parish.findMany({
      where: { isActive: true },
      select: { id: true, parishCode: true, parishName: true, city: true, state: true },
      orderBy: { id: 'asc' },
    });
    return res.json(parishes);
  } catch (err: any) {
    console.error('Fetch parishes error:', err);
    return res.status(500).json({ error: 'Failed to fetch parishes' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = await prisma.parishUser.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        parishId: true,
        assignedUnitId: true,
        isActive: true,
        mustChangePassword: true,
        parish: {
          select: { id: true, parishCode: true, parishName: true, city: true, state: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let availableParishes: any[] = [];
    const isGlobalRole =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.DIOCESAN_USER;

    if (isGlobalRole) {
      availableParishes = await prisma.parish.findMany({
        where: { isActive: true },
        select: { id: true, parishCode: true, parishName: true, city: true, state: true },
        orderBy: { id: 'asc' },
      });
    } else if (user.parish) {
      availableParishes = [user.parish];
    }

    return res.json({
      user,
      activeParishId: req.activeParishId,
      availableParishes,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password - Set new password on first login or profile update
authRouter.post('/change-password', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    const updated = await prisma.parishUser.update({
      where: { id: req.user!.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        mustChangePassword: true,
      },
    });

    return res.json({
      message: 'Password updated successfully.',
      user: updated,
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});
