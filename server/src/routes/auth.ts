import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT, optionalAuth, AuthenticatedUser } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { sendParishEmail } from '../lib/email.js';
import { logSystemActivity } from '../lib/activityLogger.js';

export const authRouter = Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'st_alphonsa_parish_brisbane_secret_jwt_key_2026';

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const identifier = ((email || username || '') as string).trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email / username and password are required.' });
    }

    const user = await prisma.parishUser.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      include: {
        parish: true,
      },
    });

    if (!user || !user.isActive) {
      await logSystemActivity({
        parishId: 1,
        actionType: 'LOGIN_FAILED',
        category: 'AUTH',
        description: `Failed login attempt for identifier: "${identifier}" (User not found or inactive)`,
        req,
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await logSystemActivity({
        parishId: user.parishId || 1,
        userId: user.id,
        userName: user.fullName || user.username || user.email,
        userRole: user.role,
        actionType: 'LOGIN_FAILED',
        category: 'AUTH',
        description: `Failed login attempt for "${user.fullName || user.email}" (Invalid password)`,
        req,
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const payload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      parishId: user.parishId,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

    // Record successful login in system activity log
    await logSystemActivity({
      parishId: user.parishId || 1,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'LOGIN',
      category: 'AUTH',
      description: `User "${user.fullName}" (${user.role}) logged in successfully`,
      req,
    });

    // Return user info and available parishes for tenant switcher
    let availableParishes: any[] = [];
    const isGlobalRole =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.DIOCESAN_USER;

    if (isGlobalRole) {
      availableParishes = await prisma.parish.findMany({
        where: { isActive: true },
        select: {
          id: true,
          parishCode: true,
          parishName: true,
          city: true,
          state: true,
          postalCode: true,
          contactEmail: true,
          contactPhone: true,
          idPrefix: true,
          nextFamilyNumber: true,
          isActive: true,
          priestName: true,
          priestEmail: true,
          priestPhone: true,
          logoUrl: true,
        },
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
          postalCode: user.parish.postalCode,
          contactEmail: user.parish.contactEmail,
          contactPhone: user.parish.contactPhone,
          idPrefix: user.parish.idPrefix,
          nextFamilyNumber: user.parish.nextFamilyNumber,
          isActive: user.parish.isActive,
          priestName: user.parish.priestName,
          priestEmail: user.parish.priestEmail,
          priestPhone: user.parish.priestPhone,
          logoUrl: user.parish.logoUrl,
        },
      ];
    }

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        parishId: user.parishId,
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

// POST /api/auth/dev-login - Developer / Demo Passwordless Fast Access
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  try {
    const isDevAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === 'true';
    if (!isDevAllowed) {
      return res.status(403).json({ error: 'Developer login bypass is disabled on this server.' });
    }

    const { email } = req.body;
    const identifier = ((email || '') as string).trim().toLowerCase();

    if (!identifier) {
      return res.status(400).json({ error: 'Account identifier is required for developer login.' });
    }

    const user = await prisma.parishUser.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      include: {
        parish: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'Active user account not found.' });
    }

    const payload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      parishId: user.parishId,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

    // Record developer fast-login in activity log
    await logSystemActivity({
      parishId: user.parishId || 1,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'LOGIN',
      category: 'AUTH',
      description: `Developer Fast-Login as "${user.fullName}" (${user.role})`,
      req,
    });

    let availableParishes: any[] = [];
    const isGlobalRole =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.DIOCESAN_USER;

    if (isGlobalRole) {
      availableParishes = await prisma.parish.findMany({
        where: { isActive: true },
        select: {
          id: true,
          parishCode: true,
          parishName: true,
          city: true,
          state: true,
          postalCode: true,
          contactEmail: true,
          contactPhone: true,
          idPrefix: true,
          nextFamilyNumber: true,
          isActive: true,
          priestName: true,
          priestEmail: true,
          priestPhone: true,
          logoUrl: true,
        },
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
          postalCode: user.parish.postalCode,
          contactEmail: user.parish.contactEmail,
          contactPhone: user.parish.contactPhone,
          idPrefix: user.parish.idPrefix,
          nextFamilyNumber: user.parish.nextFamilyNumber,
          isActive: user.parish.isActive,
          priestName: user.parish.priestName,
          priestEmail: user.parish.priestEmail,
          priestPhone: user.parish.priestPhone,
          logoUrl: user.parish.logoUrl,
        },
      ];
    }

    return res.json({
      message: 'Developer login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        parishId: user.parishId,
        mustChangePassword: user.mustChangePassword,
      },
      availableParishes,
      defaultParishId: user.parishId || (availableParishes[0]?.id ?? 1),
    });
  } catch (err: any) {
    console.error('Dev login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout - End user session and record in activity log
authRouter.post('/logout', optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const bodyUser = req.body?.user;
    const userId = user?.userId || bodyUser?.id || null;
    const userName = user?.fullName || bodyUser?.fullName || user?.username || bodyUser?.username || user?.email || bodyUser?.email || 'User';
    const userRole = user?.role || bodyUser?.role || null;
    const parishId = user?.parishId || bodyUser?.parishId || req.activeParishId || 1;

    await logSystemActivity({
      parishId,
      userId,
      userName,
      userRole,
      actionType: 'LOGOUT',
      category: 'AUTH',
      description: `User "${userName}" (${userRole ? userRole.replace('_', ' ') : 'User'}) logged out`,
      req,
    });
    return res.json({ message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/parishes - Publicly accessible list of active parishes
authRouter.get('/parishes', async (_req: Request, res: Response) => {
  try {
    const parishes = await prisma.parish.findMany({
      where: { isActive: true },
      select: {
        id: true,
        parishCode: true,
        parishName: true,
        city: true,
        state: true,
        postalCode: true,
        contactEmail: true,
        contactPhone: true,
        idPrefix: true,
        nextFamilyNumber: true,
        isActive: true,
        priestName: true,
        priestEmail: true,
        priestPhone: true,
        logoUrl: true,
      },
      orderBy: { id: 'asc' },
    });
    return res.json(parishes);
  } catch (err: any) {
    console.error('Fetch parishes error:', err);
    return res.status(500).json({ error: 'Failed to fetch parishes' });
  }
});

// GET /api/auth/diocese - Publicly accessible official governing diocese details
authRouter.get('/diocese', async (_req: Request, res: Response) => {
  try {
    const diocese = await prisma.diocese.findFirst();
    if (diocese) {
      return res.json(diocese);
    }
    return res.json({
      dioceseName: 'Diocese of St. Thomas the Apostle, Melbourne',
      rite: 'Syro-Malabar',
      bishopName: 'Bishop John Panamthottathil',
      chanceryAddress: '62 Moore Rd, Mill Park VIC 3082, Australia',
      city: 'Melbourne',
      state: 'VIC',
      postalCode: '3082',
      contactPhone: '+61 3 9404 1533',
      contactEmail: 'chancery@syromalabar.org.au',
      website: 'https://syromalabar.org.au',
      logoUrl: '/branding/logo.png',
    });
  } catch (err: any) {
    console.error('Fetch diocese error:', err);
    return res.status(500).json({ error: 'Failed to fetch diocese details' });
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
        username: true,
        email: true,
        role: true,
        parishId: true,
        isActive: true,
        mustChangePassword: true,
        parish: {
          select: { id: true, parishCode: true, parishName: true, city: true, state: true, logoUrl: true },
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
        select: { id: true, parishCode: true, parishName: true, city: true, state: true, logoUrl: true },
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
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.parishUser.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // If user is voluntarily changing password (not forced on first login) or currentPassword is sent, verify it
    if (!user.mustChangePassword || currentPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change your password.' });
      }

      const isCurrentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentMatch) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }

      if (currentPassword === newPassword.trim()) {
        return res.status(400).json({ error: 'New password cannot be the same as your current password.' });
      }
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

// POST /api/auth/forgot-password - Dispatch 6-digit OTP to user's registered email
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const identifier = ((email || '') as string).trim().toLowerCase();

    if (!identifier) {
      return res.status(400).json({ error: 'Please enter your registered email address or username.' });
    }

    const user = await prisma.parishUser.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
        isActive: true,
      },
      include: {
        parish: true,
      },
    });

    // To prevent user enumeration attacks, if user is not found, return generic success
    if (!user) {
      return res.json({
        message: 'If an account matches that email address, a 6-digit verification code has been dispatched.',
      });
    }

    // Rate limiting: check if a token was already created within the last 60 seconds
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        email: user.email,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentToken) {
      return res.status(429).json({
        error: 'A verification code was recently sent. Please check your inbox or wait a moment before requesting another.',
      });
    }

    // Invalidate any existing unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: {
        email: user.email,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        tokenHash,
        expiresAt,
      },
    });

    // Dispatch email
    const parishId = user.parishId || 1;
    const parishName = user.parish?.parishName || 'Parish Register';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #831843; margin: 0 0 6px 0; font-size: 20px; font-weight: 800;">${parishName}</h2>
          <span style="background-color: #fdf2f8; color: #9d174d; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; border: 1px solid #fbcfe8;">
            Password Reset Request
          </span>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
          Hello <strong>${user.fullName}</strong>,
        </p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          We received a request to reset the password for your Parish Register account. Enter the 6-digit verification code below on the reset screen:
        </p>

        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
            Your One-Time Reset Code
          </div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #831843;">
            ${otpCode}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
            Valid for 15 minutes
          </div>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin-top: 20px;">
          If you did not request a password reset, you can safely ignore this email. Your password will not change until this code is entered.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Parish Register • St. Thomas the Apostle Syro-Malabar Diocese
        </p>
      </div>
    `;

    // Attempt to send email
    const emailResult = await sendParishEmail(parishId, {
      to: user.email,
      subject: `[Parish Register] Your Password Reset Code: ${otpCode}`,
      html: emailHtml,
      text: `Hello ${user.fullName},\n\nYour 6-digit password reset code is: ${otpCode}\n\nThis code is valid for 15 minutes. If you did not request this, please ignore this email.\n\nBlessings,\nParish Administration`,
    });

    if (!emailResult.success && !emailResult.skipped) {
      console.error('Failed to send reset email:', emailResult.error);
    }

    return res.json({
      message: 'If an account matches that email address, a 6-digit verification code has been dispatched.',
      email: user.email,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// POST /api/auth/reset-password - Verify OTP code and apply new password
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const targetEmail = ((email || '') as string).trim().toLowerCase();
    const targetCode = ((code || '') as string).trim();

    if (!targetEmail || !targetCode || !newPassword) {
      return res.status(400).json({ error: 'Email, 6-digit code, and new password are required.' });
    }

    if (targetCode.length !== 6 || !/^\d{6}$/.test(targetCode)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit verification code.' });
    }

    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    // Find active token record
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        email: targetEmail,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      return res.status(400).json({
        error: 'Invalid or expired verification code. Please request a new code.',
      });
    }

    // Verify OTP code
    const isCodeMatch = await bcrypt.compare(targetCode, tokenRecord.tokenHash);
    if (!isCodeMatch) {
      // Increment attempt counter
      await prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining = 5 - (tokenRecord.attempts + 1);
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Code has been invalidated.'}`,
      });
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    // Hash and update password on user
    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    const updatedUser = await prisma.parishUser.update({
      where: { email: targetEmail },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    return res.json({
      message: 'Your password has been reset successfully. You can now log in with your new password.',
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});
