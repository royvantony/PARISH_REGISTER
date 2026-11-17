import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT, optionalAuth, AuthenticatedUser } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { sendParishEmail } from '../lib/email.js';
import { logSystemActivity } from '../lib/activityLogger.js';
import { getJwtSecret, JWT_EXPIRES_IN } from '../lib/crypto.js';
import { hashDeviceSecret, resolveNetworkInfo } from './devices.js';
import { realtimeHub } from '../lib/realtime.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password, deviceToken, hardwareHash, telemetry, browserInfo, deviceName } = req.body;
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

    // ----------------------------------------------------
    // USER-FIRST ZERO-TRUST DEVICE VERIFICATION
    // Credentials valid. Now verify if this workstation is authorized.
    // ----------------------------------------------------
    const activeParishId = user.parishId || 1;
    const net = resolveNetworkInfo(req);
    const tokenHash = deviceToken ? hashDeviceSecret(deviceToken) : null;

    // Check if any approved devices exist in this parish (Bootstrap Check)
    const approvedDevicesCount = await prisma.parishAuthorizedDevice.count({
      where: { parishId: activeParishId, status: 'APPROVED' },
    });

    const isParishLeader = user.role === 'PARISH_PRIEST' || user.role === 'PARISH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'DIOCESAN_ADMIN';

    // Find existing device by token OR by deterministic hardware signature
    let device = null;
    if (tokenHash) {
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: { parishId: activeParishId, deviceTokenHash: tokenHash },
      });
    }

    if (!device && hardwareHash) {
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: { parishId: activeParishId, hardwareHash: hardwareHash },
      });
    }

    // Fallback: match by physical hardware profile (GPU + Cores + Timezone) to bridge browser zoom differences
    if (!device && telemetry?.gpuRenderer && telemetry?.cpuCores && telemetry.gpuRenderer !== 'Standard Display Adapter') {
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: {
          parishId: activeParishId,
          gpuRenderer: telemetry.gpuRenderer,
          cpuCores: telemetry.cpuCores,
          timezone: telemetry.timezone || undefined,
        },
      });
    }

    // 1. Blocked / Revoked Device
    if (device && device.status === 'REVOKED') {
      await logSystemActivity({
        parishId: activeParishId,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        actionType: 'LOGIN_FAILED',
        category: 'SECURITY',
        description: `Blocked login attempt by ${user.fullName} (${user.role}) from revoked workstation "${device.deviceName}".`,
        req,
      });

      return res.status(403).json({
        error: `Terminal Access Blocked: This workstation was revoked by parish administration. Access is denied.`,
        isRevokedTerminal: true,
        deviceId: device.id,
        deviceName: device.deviceName,
        reviewRequestedAt: device.reviewRequestedAt,
        reviewRequestedBy: device.reviewRequestedBy,
        reviewStatus: device.reviewStatus,
      });
    }

    // 2. Re-Authorization Check: If physical hardware matched, but tokenHash is different or reviewStatus is REAUTHORIZE_PENDING
    if (device && (device.deviceTokenHash !== tokenHash || device.reviewStatus === 'REAUTHORIZE_PENDING')) {
      if (tokenHash && (device.reviewStatus !== 'REAUTHORIZE_PENDING' || device.reviewReason !== tokenHash)) {
        await prisma.parishAuthorizedDevice.update({
          where: { id: device.id },
          data: {
            reviewStatus: 'REAUTHORIZE_PENDING',
            reviewReason: tokenHash || device.reviewReason,
            reviewRequestedAt: new Date(),
            registeredUserId: user.id,
            registeredByName: user.fullName,
            registeredByEmail: user.email,
            registeredByRole: user.role,
            lastUsedUser: user.fullName,
            lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
            ipAddress: net.ipAddress,
            networkScope: net.networkScope,
            locationName: net.locationName,
          },
        });
        realtimeHub.emitTerminalListChanged(activeParishId);
      }

      return res.status(403).json({
        needsDeviceApproval: true,
        isReauthorizing: true,
        parishId: activeParishId,
        deviceId: device.id,
        deviceName: device.deviceName,
        userName: user.fullName,
        userRole: user.role,
        userEmail: user.email,
        requestedAt: device.reviewRequestedAt || device.createdAt,
        networkScope: net.networkScope,
        locationName: net.locationName,
        ipAddress: net.ipAddress,
        message: `Workstation Re-Authorization Required: Local security key was cleared on "${device.deviceName}". Awaiting administrator re-approval.`,
      });
    }

    // 3. Unapproved Device: Needs Administrator Approval!
    if (!device || device.status !== 'APPROVED') {
      const autoDeviceName = (deviceName || '').trim() || `${user.fullName}'s ${telemetry?.platformSummary || 'Workstation'}`;
      const finalTokenHash = tokenHash || hashDeviceSecret(`dev_${Date.now()}_${Math.random()}`);

      if (!device) {
        device = await prisma.parishAuthorizedDevice.create({
          data: {
            parishId: activeParishId,
            deviceName: autoDeviceName,
            deviceFingerprint: browserInfo || req.headers['user-agent'] || 'Web Browser',
            deviceTokenHash: finalTokenHash,
            status: 'PENDING',
            registeredUserId: user.id,
            registeredByName: user.fullName,
            registeredByEmail: user.email,
            registeredByRole: user.role,
            hardwareHash: hardwareHash || telemetry?.hardwareHash || null,
            gpuRenderer: telemetry?.gpuRenderer || null,
            screenResolution: telemetry?.screenResolution || null,
            cpuCores: telemetry?.cpuCores || null,
            deviceMemory: telemetry?.deviceMemory || null,
            timezone: telemetry?.timezone || null,
            ipAddress: net.ipAddress,
            networkScope: net.networkScope,
            locationName: net.locationName,
            lastUsedAt: new Date(),
            lastUsedUser: user.fullName,
            lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
          },
        });
      } else {
        device = await prisma.parishAuthorizedDevice.update({
          where: { id: device.id },
          data: {
            deviceName: autoDeviceName,
            registeredUserId: user.id,
            registeredByName: user.fullName,
            registeredByEmail: user.email,
            registeredByRole: user.role,
            lastUsedAt: new Date(),
            lastUsedUser: user.fullName,
            lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
            ipAddress: net.ipAddress,
            networkScope: net.networkScope,
            locationName: net.locationName,
          },
        });
      }

      await logSystemActivity({
        parishId: activeParishId,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        actionType: 'TERMINAL_CHANGE',
        category: 'SECURITY',
        description: `Terminal authorization request submitted for ${user.fullName} (${user.role}) on "${device.deviceName}".`,
        req,
      });

      realtimeHub.emitTerminalListChanged(activeParishId);

      const isBootstrap = approvedDevicesCount === 0 && isParishLeader;
      const maskedEmail = user.email ? `${user.email.slice(0, 3)}***@${user.email.split('@')[1]}` : undefined;

      return res.status(403).json({
        needsDeviceApproval: true,
        hasApprovedDevices: approvedDevicesCount > 0,
        isBootstrap,
        maskedEmail: isBootstrap ? maskedEmail : undefined,
        parishId: activeParishId,
        deviceId: device.id,
        deviceName: device.deviceName,
        userName: user.fullName,
        userRole: user.role,
        userEmail: user.email,
        requestedAt: device.createdAt,
        networkScope: net.networkScope,
        locationName: net.locationName,
        ipAddress: net.ipAddress,
        message: isBootstrap
          ? 'Initial Parish Setup: No approved workstations exist. Please verify via Administrator Email OTP to authorize this primary workstation.'
          : 'This workstation requires administrator authorization. An enrollment request has been submitted to an Authorized Administrator with your credentials verified.',
      });
    }

    // 4. Approved Workstation: Grant Session Token
    await prisma.parishAuthorizedDevice.update({
      where: { id: device.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedUser: user.fullName,
        lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
        ipAddress: net.ipAddress,
        networkScope: net.networkScope,
        locationName: net.locationName,
      },
    });

    const payload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      parishId: user.parishId,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    // Record successful login in system activity log
    await logSystemActivity({
      parishId: activeParishId,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'LOGIN',
      category: 'AUTH',
      description: `User "${user.fullName}" (${user.role}) logged in successfully from authorized workstation "${device.deviceName}" (${browserInfo || 'Browser'}).`,
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

    if (user.mustChangePassword) {
      sendTempLoginOtp(user).catch((err) => {
        console.error('Failed to dispatch temp login OTP on sign-in:', err);
      });
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
      deviceId: device?.id,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const isDevLoginAllowed = () => {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'Dev').toLowerCase();
  const isDevOrDemo = env === 'dev' || env === 'demo';
  const hasAllowFlag = process.env.ALLOW_DEV_LOGIN === 'true';
  return isDevOrDemo && hasAllowFlag;
};

// POST /api/auth/dev-available - Check which configured dev shortcut emails exist and are active
authRouter.post('/dev-available', async (req: Request, res: Response) => {
  try {
    if (!isDevLoginAllowed()) {
      return res.status(403).json({ availableEmails: [] });
    }

    const rawEmails: unknown[] = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const normalizedEmails = Array.from(
      new Set<string>(
        rawEmails
          .filter((e): e is string => typeof e === 'string')
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)
      )
    ).slice(0, 20);

    if (normalizedEmails.length === 0) {
      return res.json({ availableEmails: [] });
    }

    const matchingUsers = await prisma.parishUser.findMany({
      where: {
        email: { in: normalizedEmails },
        isActive: true,
      },
      select: { email: true },
    });

    return res.json({
      availableEmails: matchingUsers.map((u) => u.email.toLowerCase()),
    });
  } catch (err: any) {
    console.error('Dev available accounts error:', err);
    return res.status(500).json({ availableEmails: [] });
  }
});

// POST /api/auth/dev-login - Developer / Demo Passwordless Fast Access
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  try {
    if (!isDevLoginAllowed()) {
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

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

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

    if (user.mustChangePassword) {
      sendTempLoginOtp(user).catch((err) => {
        console.error('Failed to dispatch temp login OTP on dev sign-in:', err);
      });
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

interface ChangePasswordOtp {
  otpHash: string;
  expiresAt: number;
  userId: number;
}

const changePasswordOtpStore = new Map<number, ChangePasswordOtp>();

interface TempLoginOtp {
  otpHash: string;
  expiresAt: number; // 5 minutes
  lastSentAt: number;
}

const tempLoginOtpStore = new Map<number, TempLoginOtp>();

function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name.substring(0, 2)}***${name.slice(-1)}@${domain}`;
}

async function sendTempLoginOtp(user: { id: number; fullName: string; email: string; parishId?: number | null }): Promise<{ success: boolean; error?: string }> {
  if (!user.email || !user.email.trim()) {
    return { success: false, error: 'No registered email address found for user.' };
  }

  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  tempLoginOtpStore.set(user.id, {
    otpHash,
    expiresAt,
    lastSentAt: Date.now(),
  });

  const parishId = user.parishId || 1;
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; border: 1px solid #fde68a; text-transform: uppercase; letter-spacing: 0.5px;">
          Security Verification (First Sign-In)
        </span>
      </div>

      <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
        Hello <strong>${user.fullName}</strong>,
      </p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        A sign-in attempt was initiated for your Parish Register account using a temporary administrator-assigned password. To confirm your identity and set your personal permanent password, enter this verification code:
      </p>

      <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
          One-Time Verification Code (OTP)
        </div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #064e3b;">
          ${rawOtp}
        </div>
        <div style="font-size: 12px; color: #dc2626; font-weight: 700; margin-top: 8px;">
          ⏱️ Valid for 5 minutes only
        </div>
      </div>

      <p style="color: #dc2626; font-size: 12px; line-height: 1.6; margin-top: 20px; font-weight: 600;">
        ⚠️ If you did not initiate this sign-in attempt, someone may be attempting to access your account. Please notify your Parish Administrator immediately.
      </p>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Parish Register Security • St. Thomas the Apostle Syro-Malabar Diocese
      </p>
    </div>
  `;

  console.log(`[Temp Login OTP] Generated 5-minute OTP for user ${user.email}: ${rawOtp}`);

  const emailResult = await sendParishEmail(parishId, {
    to: user.email,
    subject: `[Parish Register] Sign-In Verification Code: ${rawOtp} (5-min validity)`,
    html: emailHtml,
    text: `Hello ${user.fullName},\n\nYour 6-digit verification code to complete sign-in and set your permanent password is: ${rawOtp}\n\nThis code is valid for 5 minutes only.\n\nBlessings,\nParish Administration`,
  });

  return { success: emailResult.success || Boolean(emailResult.skipped), error: emailResult.error };
}

// POST /api/auth/change-password/request-otp - Send 6-digit OTP to user's registered email for password update
authRouter.post('/change-password/request-otp', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.parishUser.findUnique({
      where: { id: userId },
      include: { parish: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (!user.email || !user.email.trim()) {
      return res.status(400).json({ error: 'No registered email address found for your account. Please update your profile with a valid email.' });
    }

    // Generate 6-digit numeric OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    changePasswordOtpStore.set(userId, {
      otpHash,
      expiresAt,
      userId,
    });

    const parishId = user.parishId || req.activeParishId || 1;
    const parishName = user.parish?.parishName || 'Parish Register';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #064e3b; margin: 0 0 6px 0; font-size: 20px; font-weight: 800;">${parishName}</h2>
          <span style="background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0;">
            Security Verification Code
          </span>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
          Hello <strong>${user.fullName}</strong>,
        </p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          A password change was requested for your account in the Parish Register portal. To verify your identity and prevent unauthorized changes or misuse by other users, enter the following 6-digit verification code:
        </p>

        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
            One-Time Password (OTP)
          </div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #064e3b;">
            ${rawOtp}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
            Valid for 15 minutes
          </div>
        </div>

        <p style="color: #dc2626; font-size: 12px; line-height: 1.6; margin-top: 20px; font-weight: 600;">
          ⚠️ If you did not initiate this password change, do not share this code with anyone. Your password will remain unchanged unless this code is provided.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Parish Register Security • St. Thomas the Apostle Syro-Malabar Diocese
        </p>
      </div>
    `;

    const emailResult = await sendParishEmail(parishId, {
      to: user.email,
      subject: `[Parish Register] Password Change Verification Code: ${rawOtp}`,
      html: emailHtml,
      text: `Hello ${user.fullName},\n\nYour 6-digit verification code to change your password is: ${rawOtp}\n\nThis code is valid for 15 minutes. If you did not request this, please ignore this email.\n\nBlessings,\nParish Administration`,
    });

    const isDevEnv = process.env.NODE_ENV !== 'production' || process.env.IS_DEMO === 'true';
    if (!emailResult.success && !emailResult.skipped) {
      console.error('Failed to send change password OTP email:', emailResult.error);
    }
    console.log(`[Change Password OTP] Generated OTP for user ${user.email}: ${rawOtp}`);

    return res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${maskEmail(user.email)}.`,
      email: maskEmail(user.email),
    });
  } catch (err: any) {
    console.error('Request change password OTP error:', err);
    return res.status(500).json({ error: 'Failed to dispatch verification code.' });
  }
});

// POST /api/auth/temp-login/resend-otp - Resend 5-minute OTP for users logging in with temporary password
authRouter.post('/temp-login/resend-otp', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = await prisma.parishUser.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (!user.mustChangePassword) {
      return res.status(400).json({ error: 'Account does not require temporary password setup.' });
    }

    const existing = tempLoginOtpStore.get(user.id);
    if (existing && Date.now() - existing.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (Date.now() - existing.lastSentAt)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSeconds}s before requesting a new code.` });
    }

    await sendTempLoginOtp(user);

    return res.json({
      success: true,
      message: `A new 5-minute verification code has been dispatched to ${maskEmail(user.email)}.`,
      email: maskEmail(user.email),
    });
  } catch (err: any) {
    console.error('Resend temp login OTP error:', err);
    return res.status(500).json({ error: 'Failed to dispatch verification code.' });
  }
});

// POST /api/auth/change-password - Set new password on first login or profile update
authRouter.post('/change-password', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.parishUser.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Branch 1: User logged in with a temporary password (mustChangePassword === true)
    if (user.mustChangePassword) {
      const cleanOtp = ((otp || '') as string).trim();
      if (!cleanOtp) {
        return res.status(400).json({ error: 'Please enter the 6-digit verification code sent to your registered email.' });
      }

      const stored = tempLoginOtpStore.get(user.id);
      if (!stored || Date.now() > stored.expiresAt) {
        return res.status(400).json({ error: 'Your 5-minute verification code has expired. Please click "Resend Code" to receive a new one.' });
      }

      const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
      if (submittedHash !== stored.otpHash) {
        return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
      }

      // Consume OTP so it cannot be reused
      tempLoginOtpStore.delete(user.id);
    } else {
      // Branch 2: Voluntary password change in user profile
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

      // Verify OTP to prevent misuse by other users on shared sessions
      const cleanOtp = ((otp || '') as string).trim();
      if (!cleanOtp) {
        return res.status(400).json({ error: 'Email verification code (OTP) is required. Please click "Send Email OTP" to receive a verification code.' });
      }

      const stored = changePasswordOtpStore.get(user.id);
      if (!stored || Date.now() > stored.expiresAt) {
        return res.status(400).json({ error: 'Verification code has expired or was not requested. Please click "Send Email OTP" to receive a new code.' });
      }

      const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
      if (submittedHash !== stored.otpHash) {
        return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
      }

      // Consume OTP so it cannot be reused
      changePasswordOtpStore.delete(user.id);
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

    await logSystemActivity({
      parishId: user.parishId || 1,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'USER_CHANGE',
      category: 'SECURITY',
      description: user.mustChangePassword
        ? `User ${user.fullName} (${user.email}) completed first-time sign-in and set permanent password with 5-minute email OTP verification.`
        : `User ${user.fullName} (${user.email}) changed account password with email OTP verification.`,
      req,
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
