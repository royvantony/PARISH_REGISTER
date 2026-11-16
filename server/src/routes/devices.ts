import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { checkUserPermission } from './permissions.js';
import { logSystemActivity } from '../lib/activityLogger.js';
import { UserRole } from '@prisma/client';

export const devicesRouter = Router();

// Helper: Hash device secret
export function hashDeviceSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret.trim()).digest('hex');
}

// POST /api/devices/verify - Check terminal authorization status on first load
devicesRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { parishId, deviceToken, browserInfo } = req.body;

    const pid = parseInt(parishId, 10);
    const approvedCount = !isNaN(pid)
      ? await prisma.parishAuthorizedDevice.count({
          where: { parishId: pid, status: 'APPROVED' },
        })
      : 0;

    if (!parishId || isNaN(pid) || !deviceToken) {
      return res.json({
        status: 'UNREGISTERED',
        isFirstDeviceSetup: approvedCount === 0,
      });
    }

    const tokenHash = hashDeviceSecret(deviceToken);
    const device = await prisma.parishAuthorizedDevice.findFirst({
      where: {
        parishId: pid,
        deviceTokenHash: tokenHash,
      },
      include: {
        parish: { select: { parishName: true, parishCode: true } },
      },
    });

    if (!device) {
      return res.json({
        status: 'UNREGISTERED',
        isFirstDeviceSetup: approvedCount === 0,
      });
    }

    if (device.status === 'APPROVED') {
      // Update last active metadata
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || req.ip;
      await prisma.parishAuthorizedDevice.update({
        where: { id: device.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
          ipAddress: clientIp,
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
    const { parishId, deviceName, deviceSecret, browserInfo } = req.body;

    if (!parishId || isNaN(Number(parishId))) {
      return res.status(400).json({ error: 'Valid Parish ID is required.' });
    }

    const pid = Number(parishId);
    const cleanName = (deviceName || '').trim();
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Please provide a descriptive terminal name (at least 2 characters).' });
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

    const tokenHash = hashDeviceSecret(cleanSecret);
    const existing = await prisma.parishAuthorizedDevice.findFirst({
      where: { deviceTokenHash: tokenHash },
    });

    if (existing) {
      return res.json({
        success: true,
        status: existing.status,
        deviceId: existing.id,
        deviceName: existing.deviceName,
        message: 'This workstation was already registered.',
      });
    }

    // Bootstrap check: If this parish has ZERO approved devices, auto-approve this first workstation as primary
    const approvedCount = await prisma.parishAuthorizedDevice.count({
      where: { parishId: pid, status: 'APPROVED' },
    });
    const isFirstApproved = approvedCount === 0;
    const initialStatus = isFirstApproved ? 'APPROVED' : 'PENDING';

    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || req.ip;
    const device = await prisma.parishAuthorizedDevice.create({
      data: {
        parishId: pid,
        deviceName: cleanName,
        deviceFingerprint: browserInfo || req.headers['user-agent'] || 'Web Browser',
        deviceTokenHash: tokenHash,
        status: initialStatus,
        approvedAt: isFirstApproved ? new Date() : null,
        approvedBy: isFirstApproved ? 'Initial Setup (Primary Workstation)' : null,
        ipAddress: clientIp,
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
        : 'Terminal registration submitted. Awaiting Parish Priest or Administrator approval.',
    });
  } catch (err: any) {
    console.error('Device register error:', err);
    return res.status(500).json({ error: 'Failed to submit terminal registration.' });
  }
});

// POST /api/devices/authorize-direct - In-place terminal authorization using Priest / Admin credentials
devicesRouter.post('/authorize-direct', async (req: Request, res: Response) => {
  try {
    const { parishId, deviceToken, email, username, password, terminalName, browserInfo } = req.body;
    const identifier = ((email || username || '') as string).trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Administrator email and password are required.' });
    }

    if (!parishId || !deviceToken) {
      return res.status(400).json({ error: 'Parish ID and terminal security token are required.' });
    }

    const pid = Number(parishId);
    const user = await prisma.parishUser.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: { parish: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    const isAuthorizedRole =
      user.role === 'SUPER_ADMIN' ||
      ((user.role === 'PARISH_PRIEST' || user.role === 'PARISH_ADMIN') && user.parishId === pid);

    if (!isAuthorizedRole) {
      return res.status(403).json({ error: 'Only a Parish Priest or Administrator can authorize terminals.' });
    }

    const tokenHash = hashDeviceSecret(deviceToken);
    let device = await prisma.parishAuthorizedDevice.findFirst({
      where: { parishId: pid, deviceTokenHash: tokenHash },
    });

    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || req.ip;
    const finalDeviceName = (terminalName || '').trim() || device?.deviceName || `${user.fullName}'s Workstation`;

    if (!device) {
      device = await prisma.parishAuthorizedDevice.create({
        data: {
          parishId: pid,
          deviceName: finalDeviceName,
          deviceFingerprint: browserInfo || req.headers['user-agent'] || 'Web Browser',
          deviceTokenHash: tokenHash,
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: `${user.fullName} (${user.role})`,
          ipAddress: clientIp,
          lastUsedAt: new Date(),
          lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
        },
      });
    } else {
      device = await prisma.parishAuthorizedDevice.update({
        where: { id: device.id },
        data: {
          status: 'APPROVED',
          deviceName: finalDeviceName,
          approvedAt: new Date(),
          approvedBy: `${user.fullName} (${user.role})`,
          revokedAt: null,
          revokedBy: null,
          ipAddress: clientIp,
          lastUsedAt: new Date(),
          lastUsedBrowser: browserInfo || req.headers['user-agent'] || 'Web Browser',
        },
      });
    }

    await logSystemActivity({
      parishId: pid,
      userId: user.id,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `Terminal "${device.deviceName}" authorized in-person by ${user.fullName} (${user.role}).`,
      req,
    });

    return res.json({
      success: true,
      status: 'APPROVED',
      deviceId: device.id,
      deviceName: device.deviceName,
      message: `Terminal authorized successfully by ${user.fullName}.`,
    });
  } catch (err: any) {
    console.error('Direct terminal authorize error:', err);
    return res.status(500).json({ error: 'Failed to authorize terminal directly.' });
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
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
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
        ipAddress: true,
        lastUsedAt: true,
        lastUsedBrowser: true,
        lastUsedUser: true,
        approvedAt: true,
        approvedBy: true,
        revokedAt: true,
        revokedBy: true,
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
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the Parish Priest or authorized Administrators can approve terminals.' });
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
      callerRole === 'PARISH_PRIEST' ||
      callerRole === 'PARISH_ADMIN' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the Parish Priest or authorized Administrators can revoke terminals.' });
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
      callerRole === 'PARISH_PRIEST' ||
      (await checkUserPermission(req.user.userId, callerRole, parishId, 'SETTINGS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the Parish Priest or Super Admin can remove terminal records.' });
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
