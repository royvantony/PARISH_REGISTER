import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import geoip from 'geoip-lite';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { checkUserPermission } from './permissions.js';
import { logSystemActivity } from '../lib/activityLogger.js';
import { sendParishEmail } from '../lib/email.js';
import { UserRole } from '@prisma/client';

export const devicesRouter = Router();

// Helper: Hash device secret
export function hashDeviceSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret.trim()).digest('hex');
}

// Helper: Sanitize device name to eliminate browser branding from physical workstation records
export function sanitizeDeviceName(name?: string | null, fallback = 'Workstation'): string {
  if (!name) return fallback;
  const stripped = name
    .replace(/(Google Chrome|Apple Safari|Microsoft Edge|Mozilla Firefox)\s*(on\s*)?/gi, '')
    .trim();
  return stripped || fallback;
}

// Helper: Determine private vs public IP and resolve location
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  return false;
}

export function resolveNetworkInfo(req: Request) {
  const forwarded = req.headers['x-forwarded-for']?.toString().split(',')[0].trim();
  const rawIp = forwarded || req.socket.remoteAddress || req.ip || '127.0.0.1';
  const cleanIp = rawIp.replace(/^::ffff:/, '').trim();

  const isLocal = isPrivateIp(cleanIp);
  if (isLocal) {
    return {
      ipAddress: cleanIp,
      networkScope: 'LOCAL_LAN',
      locationName: 'Parish Local Network (Wi-Fi / LAN)',
    };
  }

  // Remote IP: use offline geoip lookup
  const geo = geoip.lookup(cleanIp);
  const locParts = geo ? [geo.city, geo.region, geo.country].filter(Boolean) : [];
  const locationName = locParts.length > 0 ? locParts.join(', ') : 'Remote Location';

  return {
    ipAddress: cleanIp,
    networkScope: 'REMOTE_WAN',
    locationName,
  };
}

// POST /api/devices/verify - Check terminal authorization status on first load
devicesRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { parishId, deviceToken, hardwareHash, telemetry, browserInfo } = req.body;

    const pid = parseInt(parishId, 10);
    const approvedCount = !isNaN(pid)
      ? await prisma.parishAuthorizedDevice.count({
          where: { parishId: pid, status: 'APPROVED' },
        })
      : 0;

    if (!parishId || isNaN(pid)) {
      return res.json({
        status: 'UNREGISTERED',
        isFirstDeviceSetup: approvedCount === 0,
      });
    }

    const net = resolveNetworkInfo(req);
    let device = null;

    // 1. Try finding by device token in storage
    if (deviceToken && typeof deviceToken === 'string') {
      const tokenHash = hashDeviceSecret(deviceToken);
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: {
          parishId: pid,
          deviceTokenHash: tokenHash,
        },
        include: {
          parish: { select: { parishName: true, parishCode: true } },
        },
      });
    }

    // 2. If no token match (e.g. Safari Private Browsing or Cache Cleared),
    // match by physical hardware signature for this parish
    if (!device && hardwareHash && typeof hardwareHash === 'string') {
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: {
          parishId: pid,
          hardwareHash: hardwareHash,
          status: 'APPROVED',
        },
        include: {
          parish: { select: { parishName: true, parishCode: true } },
        },
      });
    }

    // 3. Fallback: match by physical GPU + CPU Cores + Timezone
    if (!device && telemetry?.gpuRenderer && telemetry?.cpuCores && telemetry.gpuRenderer !== 'Standard Display Adapter') {
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: {
          parishId: pid,
          gpuRenderer: telemetry.gpuRenderer,
          cpuCores: telemetry.cpuCores,
          timezone: telemetry.timezone || undefined,
          status: 'APPROVED',
        },
        include: {
          parish: { select: { parishName: true, parishCode: true } },
        },
      });
    }

    if (!device) {
      return res.json({
        status: 'UNREGISTERED',
        isFirstDeviceSetup: approvedCount === 0,
      });
    }

    if (device.status === 'APPROVED') {
      // Update last active metadata and backfill hardware telemetry
      await prisma.parishAuthorizedDevice.update({
        where: { id: device.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
          ipAddress: net.ipAddress,
          networkScope: net.networkScope,
          locationName: net.locationName,
          hardwareHash: device.hardwareHash || hardwareHash || undefined,
          gpuRenderer: device.gpuRenderer || telemetry?.gpuRenderer || undefined,
          screenResolution: device.screenResolution || telemetry?.screenResolution || undefined,
          cpuCores: device.cpuCores || telemetry?.cpuCores || undefined,
          deviceMemory: device.deviceMemory || telemetry?.deviceMemory || undefined,
          timezone: device.timezone || telemetry?.timezone || undefined,
        },
      });

      return res.json({
        status: 'APPROVED',
        deviceId: device.id,
        deviceName: device.deviceName,
        parishName: device.parish.parishName,
      });
    }

    if (device.status === 'REVOKED') {
      return res.json({
        status: 'REVOKED',
        deviceId: device.id,
        deviceName: device.deviceName,
        revokedAt: device.revokedAt,
        revokedBy: device.revokedBy,
      });
    }

    // Default: PENDING
    return res.json({
      status: 'PENDING',
      deviceId: device.id,
      deviceName: device.deviceName,
      requestedAt: device.createdAt,
    });
  } catch (err: any) {
    console.error('Device verify error:', err);
    return res.status(500).json({ error: 'Failed to verify terminal authorization.' });
  }
});

// POST /api/devices/register - Request workstation enrollment for a parish
devicesRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { parishId, deviceName, deviceSecret, browserInfo, telemetry } = req.body;

    if (!parishId || isNaN(Number(parishId))) {
      return res.status(400).json({ error: 'Valid Parish ID is required.' });
    }

    const pid = Number(parishId);
    const cleanName = sanitizeDeviceName(deviceName, telemetry?.platformSummary || 'Workstation');
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Please provide a descriptive workstation name (at least 2 characters).' });
    }

    const cleanSecret = (deviceSecret || '').trim();
    if (!cleanSecret || cleanSecret.length < 16) {
      return res.status(400).json({ error: 'Invalid terminal security key.' });
    }

    const parish = await prisma.parish.findUnique({
      where: { id: pid },
    });

    if (!parish) {
      return res.status(404).json({ error: 'Parish not found.' });
    }

    const net = resolveNetworkInfo(req);
    const tokenHash = hashDeviceSecret(cleanSecret);

    // Check if this token or hardware signature was already registered
    const existing = await prisma.parishAuthorizedDevice.findFirst({
      where: {
        parishId: pid,
        OR: [
          { deviceTokenHash: tokenHash },
          ...(telemetry?.hardwareHash ? [{ hardwareHash: telemetry.hardwareHash }] : []),
          ...(telemetry?.gpuRenderer && telemetry?.cpuCores && telemetry.gpuRenderer !== 'Standard Display Adapter'
            ? [{
                gpuRenderer: telemetry.gpuRenderer,
                cpuCores: telemetry.cpuCores,
                timezone: telemetry.timezone || undefined,
              }]
            : []),
        ],
      },
    });

    if (existing) {
      return res.json({
        success: true,
        status: existing.status,
        deviceId: existing.id,
        deviceName: existing.deviceName,
        message: 'This workstation is already registered.',
      });
    }

    // Bootstrap check: If this parish has ZERO approved devices, auto-approve this first workstation as primary
    const approvedCount = await prisma.parishAuthorizedDevice.count({
      where: { parishId: pid, status: 'APPROVED' },
    });
    const isFirstApproved = approvedCount === 0;
    const initialStatus = isFirstApproved ? 'APPROVED' : 'PENDING';

    const device = await prisma.parishAuthorizedDevice.create({
      data: {
        parishId: pid,
        deviceName: cleanName,
        deviceFingerprint: browserInfo || req.headers['user-agent'] || 'Web Browser',
        deviceTokenHash: tokenHash,
        status: initialStatus,
        hardwareHash: telemetry?.hardwareHash || null,
        gpuRenderer: telemetry?.gpuRenderer || null,
        screenResolution: telemetry?.screenResolution || null,
        cpuCores: telemetry?.cpuCores || null,
        deviceMemory: telemetry?.deviceMemory || null,
        timezone: telemetry?.timezone || null,
        ipAddress: net.ipAddress,
        networkScope: net.networkScope,
        locationName: net.locationName,
        approvedAt: isFirstApproved ? new Date() : null,
        approvedBy: isFirstApproved ? 'Initial Setup (Primary Workstation)' : null,
        lastUsedAt: isFirstApproved ? new Date() : null,
        lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
      },
    });

    await logSystemActivity({
      parishId: pid,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: isFirstApproved
        ? `Primary parish terminal "${cleanName}" initialized and auto-authorized (${browserInfo || 'Web Browser'}).`
        : `New terminal authorization request submitted: "${cleanName}" (${browserInfo || 'Web Browser'}).`,
      req,
    });

    return res.json({
      success: true,
      status: initialStatus,
      deviceId: device.id,
      deviceName: device.deviceName,
      isFirstDevice: isFirstApproved,
      message: isFirstApproved
        ? 'Primary terminal auto-authorized as the initial administrative workstation.'
        : 'Terminal registration submitted. Awaiting Administrator approval.',
    });
  } catch (err: any) {
    console.error('Device register error:', err);
    return res.status(500).json({ error: 'Failed to submit terminal registration.' });
  }
});

// POST /api/devices/request-review - User submits an access review request for a revoked/blocked terminal
devicesRouter.post('/request-review', async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceToken, hardwareHash, email, reason, parishId } = req.body;

    let device = null;
    if (deviceId) {
      device = await prisma.parishAuthorizedDevice.findUnique({
        where: { id: Number(deviceId) },
      });
    }

    if (!device && deviceToken) {
      const tokenHash = hashDeviceSecret(deviceToken);
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: { deviceTokenHash: tokenHash },
      });
    }

    if (!device && hardwareHash) {
      device = await prisma.parishAuthorizedDevice.findFirst({
        where: { hardwareHash },
      });
    }

    if (!device) {
      return res.status(404).json({ error: 'Workstation registration not found.' });
    }

    const requesterIdentifier = (email || '').trim() || device.lastUsedUser || 'User';

    const updated = await prisma.parishAuthorizedDevice.update({
      where: { id: device.id },
      data: {
        reviewRequestedAt: new Date(),
        reviewRequestedBy: requesterIdentifier,
        reviewReason: (reason || '').trim() || 'Workstation access review requested after revocation.',
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    await logSystemActivity({
      parishId: device.parishId,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `Access review requested for revoked workstation "${device.deviceName}" by ${requesterIdentifier}.`,
      req,
    });

    return res.json({
      success: true,
      message: 'Access review request sent to Administrator.',
      device: updated,
    });
  } catch (err: any) {
    console.error('Request review error:', err);
    return res.status(500).json({ error: 'Failed to submit access review request.' });
  }
});

// In-Memory store for Initial Bootstrap Workstation Setup Codes
interface BootstrapOtpRecord {
  parishId: number;
  deviceId: number;
  userId: number;
  email: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}
const bootstrapOtpStore = new Map<number, BootstrapOtpRecord>();

// POST /api/devices/bootstrap-otp/send - Send verification code to administrator for initial workstation setup
devicesRouter.post('/bootstrap-otp/send', async (req: Request, res: Response) => {
  try {
    const { parishId, deviceId, email } = req.body;
    if (!parishId || !deviceId || !email) {
      return res.status(400).json({ error: 'Parish ID, Device ID, and Email are required.' });
    }

    const pid = Number(parishId);
    const did = Number(deviceId);

    // CRITICAL: Bootstrap OTP is ONLY allowed when 0 approved terminals exist in this parish!
    const approvedCount = await prisma.parishAuthorizedDevice.count({
      where: { parishId: pid, status: 'APPROVED' },
    });

    if (approvedCount > 0) {
      return res.status(400).json({
        error: 'Initial workstation bootstrap is closed. Approved workstations already exist for this parish.',
      });
    }

    // Verify user is an authorized leader
    const user = await prisma.parishUser.findFirst({
      where: {
        email: (email as string).trim().toLowerCase(),
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Administrator account not found.' });
    }

    const isAuthorizedRole =
      user.role === 'SUPER_ADMIN' ||
      user.role === 'DIOCESAN_ADMIN' ||
      ((user.role === 'PARISH_PRIEST' || user.role === 'PARISH_ADMIN') && (user.parishId === pid || user.parishId === null));

    if (!isAuthorizedRole) {
      return res.status(403).json({ error: 'Only an authorized administrator can perform initial workstation setup.' });
    }

    // Verify device exists and is PENDING
    const device = await prisma.parishAuthorizedDevice.findFirst({
      where: { id: did, parishId: pid },
    });

    if (!device) {
      return res.status(404).json({ error: 'Workstation enrollment record not found.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(otp).digest('hex');

    bootstrapOtpStore.set(did, {
      parishId: pid,
      deviceId: did,
      userId: user.id,
      email: user.email,
      codeHash,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
    });

    // Send email to administrator
    await sendParishEmail(pid, {
      to: user.email,
      subject: `[Parish Register] Initial Workstation Verification Code: ${otp}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #701a34; margin-top: 0;">Initial Workstation Authorization</h2>
          <p>An initial setup request was initiated to authorize the primary workstation for your parish register system.</p>
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #64748b;">This verification code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            Workstation Name: <strong>${device.deviceName}</strong><br/>
            Requested by: ${user.fullName} (${user.role})
          </p>
        </div>
      `,
      text: `Your Parish Register workstation verification code is ${otp}. Valid for 10 minutes.`,
    });

    console.log(`[Bootstrap Security OTP] Initial Workstation Code for ${user.email} (Device #${did}): ${otp}`);

    const masked = `${user.email.slice(0, 3)}***@${user.email.split('@')[1]}`;
    return res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${masked}.`,
      maskedEmail: masked,
    });
  } catch (err: any) {
    console.error('Bootstrap OTP send error:', err);
    return res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// POST /api/devices/bootstrap-otp/verify - Verify code and authorize primary workstation
devicesRouter.post('/bootstrap-otp/verify', async (req: Request, res: Response) => {
  try {
    const { parishId, deviceId, otp } = req.body;
    if (!parishId || !deviceId || !otp) {
      return res.status(400).json({ error: 'Parish ID, Device ID, and verification code are required.' });
    }

    const pid = Number(parishId);
    const did = Number(deviceId);

    // CRITICAL: Bootstrap OTP is ONLY allowed when 0 approved terminals exist in this parish!
    const approvedCount = await prisma.parishAuthorizedDevice.count({
      where: { parishId: pid, status: 'APPROVED' },
    });

    if (approvedCount > 0) {
      return res.status(400).json({
        error: 'Initial workstation bootstrap is closed. Approved workstations already exist for this parish.',
      });
    }

    const record = bootstrapOtpStore.get(did);
    if (!record || record.parishId !== pid) {
      return res.status(400).json({ error: 'No active verification code found. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt) {
      bootstrapOtpStore.delete(did);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (record.attempts >= 5) {
      bootstrapOtpStore.delete(did);
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    const inputHash = crypto.createHash('sha256').update((otp as string).trim()).digest('hex');
    if (inputHash !== record.codeHash) {
      record.attempts++;
      return res.status(400).json({
        error: `Invalid verification code. ${5 - record.attempts} attempts remaining.`,
      });
    }

    // OTP Verified! Consume the record
    bootstrapOtpStore.delete(did);

    const net = resolveNetworkInfo(req);
    const approvedDevice = await prisma.parishAuthorizedDevice.update({
      where: { id: did },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: `Initial Setup via Email OTP (${record.email})`,
        lastUsedAt: new Date(),
        lastUsedUser: record.email,
        ipAddress: net.ipAddress,
        networkScope: net.networkScope,
        locationName: net.locationName,
      },
    });

    await logSystemActivity({
      parishId: pid,
      userId: record.userId,
      userName: record.email,
      userRole: 'ADMIN',
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `Primary parish workstation "${approvedDevice.deviceName}" authorized via Email OTP by ${record.email}.`,
      req,
    });

    return res.json({
      success: true,
      status: 'APPROVED',
      deviceId: approvedDevice.id,
      deviceName: approvedDevice.deviceName,
      message: 'Workstation successfully authorized as the primary parish terminal.',
    });
  } catch (err: any) {
    console.error('Bootstrap OTP verify error:', err);
    return res.status(500).json({ error: 'Failed to verify code.' });
  }
});

// GET /api/devices/list - List authorized terminals for the active parish (Protected)
devicesRouter.get('/list', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const callerRole = req.user.role as UserRole;
    const parishId = req.activeParishId || req.user.parishId;

    if (!parishId) {
      return res.status(400).json({ error: 'No active parish selected.' });
    }

    const isAuthorized =
      callerRole === 'SUPER_ADMIN' ||
      callerRole === 'DIOCESAN_ADMIN' ||
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'TERMINALS', 'canView')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canView')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'You do not have permission to manage authorized terminals.' });
    }

    const devices = await prisma.parishAuthorizedDevice.findMany({
      where: { parishId: Number(parishId) },
      orderBy: [
        { status: 'asc' }, // PENDING first
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        deviceName: true,
        deviceFingerprint: true,
        status: true,
        registeredUserId: true,
        registeredByName: true,
        registeredByEmail: true,
        registeredByRole: true,
        hardwareHash: true,
        screenResolution: true,
        gpuRenderer: true,
        cpuCores: true,
        deviceMemory: true,
        timezone: true,
        networkScope: true,
        locationName: true,
        ipAddress: true,
        lastUsedAt: true,
        lastUsedBrowser: true,
        lastUsedUser: true,
        approvedAt: true,
        approvedBy: true,
        revokedAt: true,
        revokedBy: true,
        reviewRequestedAt: true,
        reviewRequestedBy: true,
        reviewReason: true,
        reviewStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ devices });
  } catch (err: any) {
    console.error('List devices error:', err);
    return res.status(500).json({ error: 'Failed to retrieve authorized terminals.' });
  }
});

// POST /api/devices/:id/approve - Approve a pending or revoked terminal (Protected)
devicesRouter.post('/:id/approve', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const deviceId = Number(req.params.id);
    const callerRole = req.user.role as UserRole;
    const parishId = req.activeParishId || req.user.parishId;

    if (!parishId) {
      return res.status(400).json({ error: 'No active parish selected.' });
    }

    const isAuthorized =
      callerRole === 'SUPER_ADMIN' ||
      callerRole === 'DIOCESAN_ADMIN' ||
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'TERMINALS', 'canApprove')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canApprove')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only an authorized Administrator can approve terminals.' });
    }

    const device = await prisma.parishAuthorizedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.parishId !== parishId) {
      return res.status(404).json({ error: 'Terminal record not found.' });
    }

    const updated = await prisma.parishAuthorizedDevice.update({
      where: { id: deviceId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: req.user.fullName || 'Parish Administration',
        revokedAt: null,
        revokedBy: null,
        reviewRequestedAt: null,
        reviewRequestedBy: null,
        reviewReason: null,
        reviewStatus: null,
      },
    });

    await logSystemActivity({
      parishId,
      userId: req.user.userId,
      userName: req.user.fullName,
      userRole: callerRole,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `${req.user.fullName || 'Administrator'} approved terminal: "${device.deviceName}".`,
      req,
    });

    return res.json({
      success: true,
      message: `Terminal "${device.deviceName}" has been approved for access.`,
      device: updated,
    });
  } catch (err: any) {
    console.error('Approve device error:', err);
    return res.status(500).json({ error: 'Failed to approve terminal.' });
  }
});

// POST /api/devices/:id/revoke - Revoke/Deactivate a terminal (Protected)
devicesRouter.post('/:id/revoke', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const deviceId = Number(req.params.id);
    const callerRole = req.user.role as UserRole;
    const parishId = req.activeParishId || req.user.parishId;

    if (!parishId) {
      return res.status(400).json({ error: 'No active parish selected.' });
    }

    const isAuthorized =
      callerRole === 'SUPER_ADMIN' ||
      callerRole === 'DIOCESAN_ADMIN' ||
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'TERMINALS', 'canApprove')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canApprove')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only an authorized Administrator can revoke terminals.' });
    }

    const device = await prisma.parishAuthorizedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.parishId !== parishId) {
      return res.status(404).json({ error: 'Terminal record not found.' });
    }

    const updated = await prisma.parishAuthorizedDevice.update({
      where: { id: deviceId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: req.user.fullName || 'Parish Administration',
      },
    });

    await logSystemActivity({
      parishId,
      userId: req.user.userId,
      userName: req.user.fullName,
      userRole: callerRole,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `${req.user.fullName || 'Administrator'} revoked terminal: "${device.deviceName}".`,
      req,
    });

    return res.json({
      success: true,
      message: `Terminal "${device.deviceName}" has been revoked. All access from this machine is blocked.`,
      device: updated,
    });
  } catch (err: any) {
    console.error('Revoke device error:', err);
    return res.status(500).json({ error: 'Failed to revoke terminal.' });
  }
});

// DELETE /api/devices/:id - Permanently delete a terminal record (Protected)
devicesRouter.delete('/:id', authenticateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const deviceId = Number(req.params.id);
    const callerRole = req.user.role as UserRole;
    const parishId = req.activeParishId || req.user.parishId;

    if (!parishId) {
      return res.status(400).json({ error: 'No active parish selected.' });
    }

    const isAuthorized =
      callerRole === 'SUPER_ADMIN' ||
      callerRole === 'DIOCESAN_ADMIN' ||
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'TERMINALS', 'canDelete')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canDelete')) ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only an authorized Administrator can remove terminal records.' });
    }

    const device = await prisma.parishAuthorizedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.parishId !== parishId) {
      return res.status(404).json({ error: 'Terminal record not found.' });
    }

    await prisma.parishAuthorizedDevice.delete({
      where: { id: deviceId },
    });

    await logSystemActivity({
      parishId,
      userId: req.user.userId,
      userName: req.user.fullName,
      userRole: callerRole,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `${req.user.fullName || 'Administrator'} permanently deleted terminal record: "${device.deviceName}".`,
      req,
    });

    return res.json({
      success: true,
      message: `Terminal record "${device.deviceName}" removed.`,
    });
  } catch (err: any) {
    console.error('Delete device error:', err);
    return res.status(500).json({ error: 'Failed to remove terminal.' });
  }
});
