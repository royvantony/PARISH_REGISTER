import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { verifyAndTestSmtp, SmtpConfigInput } from '../lib/email.js';
import { checkUserPermission } from './permissions.js';

export const settingsRouter = Router();

// GET /api/settings/smtp - Fetch SMTP settings for active parish
settingsRouter.get('/smtp', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;

    if (req.user) {
      const canView = await checkUserPermission(req.user.userId, req.user.role, parishId, 'SETTINGS', 'canView');
      if (!canView) {
        return res.status(403).json({ error: 'You do not have permission to view settings.' });
      }
    }

    const setting = await prisma.smtpSetting.findUnique({
      where: { parishId },
    });

    if (!setting) {
      return res.json({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        hasPassword: false,
        fromEmail: '',
        fromName: 'Parish Register',
        isEnabled: false,
      });
    }

    return res.json({
      id: setting.id,
      parishId: setting.parishId,
      host: setting.host,
      port: setting.port,
      secure: setting.secure,
      user: setting.user || '',
      hasPassword: Boolean(setting.pass),
      fromEmail: setting.fromEmail || '',
      fromName: setting.fromName || 'Parish Register',
      isEnabled: setting.isEnabled,
      updatedAt: setting.updatedAt,
    });
  } catch (error: any) {
    console.error('Fetch SMTP setting error:', error);
    return res.status(500).json({ error: 'Failed to retrieve SMTP settings.' });
  }
});

// POST /api/settings/smtp - Update SMTP settings for active parish
settingsRouter.post('/smtp', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const canEdit = await checkUserPermission(req.user.userId, req.user.role, parishId, 'SETTINGS', 'canEdit');
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to configure mail settings.' });
    }
    const { host, port, secure, user, pass, fromEmail, fromName, isEnabled } = req.body;

    // Check existing setting to preserve password if not updated
    const existing = await prisma.smtpSetting.findUnique({
      where: { parishId },
    });

    let finalPass = existing?.pass || null;
    if (pass && pass !== '••••••••' && pass.trim() !== '') {
      const candidate = pass.trim();
      if (candidate.includes('@')) {
        return res.status(400).json({
          error: 'Invalid password format: It looks like you pasted an email address into the password field. Please paste the 16-character Google App Password.',
        });
      }
      // If host is Gmail, strip internal spaces
      if ((host?.trim() || '').includes('gmail.com')) {
        finalPass = candidate.replace(/\s+/g, '');
      } else {
        finalPass = candidate;
      }
    }

    const updated = await prisma.smtpSetting.upsert({
      where: { parishId },
      update: {
        host: host?.trim() || 'smtp.gmail.com',
        port: Number(port) || 587,
        secure: Boolean(secure),
        user: user?.trim() || null,
        pass: finalPass,
        fromEmail: fromEmail?.trim() || user?.trim() || null,
        fromName: fromName?.trim() || 'Parish Register',
        isEnabled: Boolean(isEnabled),
      },
      create: {
        parishId,
        host: host?.trim() || 'smtp.gmail.com',
        port: Number(port) || 587,
        secure: Boolean(secure),
        user: user?.trim() || null,
        pass: finalPass,
        fromEmail: fromEmail?.trim() || user?.trim() || null,
        fromName: fromName?.trim() || 'Parish Register',
        isEnabled: Boolean(isEnabled),
      },
    });

    return res.json({
      message: 'SMTP settings updated successfully.',
      setting: {
        id: updated.id,
        parishId: updated.parishId,
        host: updated.host,
        port: updated.port,
        secure: updated.secure,
        user: updated.user,
        hasPassword: Boolean(updated.pass),
        fromEmail: updated.fromEmail,
        fromName: updated.fromName,
        isEnabled: updated.isEnabled,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Save SMTP setting error:', error);
    return res.status(500).json({ error: 'Failed to save SMTP settings.' });
  }
});

// POST /api/settings/smtp/test - Test connection & send test email
settingsRouter.post('/smtp/test', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const canEdit = await checkUserPermission(req.user.userId, req.user.role, parishId, 'SETTINGS', 'canEdit');
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to test mail settings.' });
    }
    const { host, port, secure, user, pass, fromEmail, fromName, recipientEmail } = req.body;

    const targetRecipient = (recipientEmail || req.user.email || '').trim();
    if (!targetRecipient) {
      return res.status(400).json({ error: 'A recipient email address is required to send a test verification email.' });
    }

    // Determine config to test: either from request body or saved DB record
    const existing = await prisma.smtpSetting.findUnique({
      where: { parishId },
    });

    let passToTest = (pass && pass !== '••••••••' ? pass.trim() : existing?.pass) || '';
    if (passToTest.includes('@')) {
      return res.status(400).json({
        error: 'Invalid password: It appears an email address was entered as the password. Please re-enter the 16-character Google App Password.',
      });
    }
    if ((host?.trim() || existing?.host || '').includes('gmail.com')) {
      passToTest = passToTest.replace(/\s+/g, '');
    }

    const configToTest: SmtpConfigInput = {
      host: host?.trim() || existing?.host || 'smtp.gmail.com',
      port: Number(port) || existing?.port || 587,
      secure: secure !== undefined ? Boolean(secure) : (existing?.secure ?? false),
      user: user?.trim() || existing?.user || '',
      pass: passToTest,
      fromEmail: fromEmail?.trim() || existing?.fromEmail || user?.trim() || existing?.user || '',
      fromName: fromName?.trim() || existing?.fromName || 'Parish Register',
    };

    if (!configToTest.user || !configToTest.pass) {
      return res.status(400).json({
        error: 'Missing SMTP credentials. Please enter a valid Email and Password / Google App Password.',
      });
    }

    const result = await verifyAndTestSmtp(configToTest, targetRecipient);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({
      message: result.message,
      sentTo: targetRecipient,
    });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    return res.status(500).json({ error: error.message || 'SMTP test failed.' });
  }
});

