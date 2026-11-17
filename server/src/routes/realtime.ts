import { Router, Request, Response } from 'express';
import { realtimeHub, UserSessionInfo } from '../lib/realtime.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { checkUserPermission } from './permissions.js';
import { logSystemActivity } from '../lib/activityLogger.js';
import { isFeatureEnabled } from './features.js';

export const realtimeRouter = Router();

// 1. GET /api/realtime/terminal/:deviceId (Public SSE stream for login waiting screen)
realtimeRouter.get('/terminal/:deviceId', (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.deviceId) ? req.params.deviceId[0] : req.params.deviceId;
  const deviceId = parseInt(rawId, 10);
  if (isNaN(deviceId)) {
    return res.status(400).json({ error: 'Invalid device ID.' });
  }

  // SSE Response Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disables Nginx buffering if deployed
  res.flushHeaders();

  realtimeHub.subscribeTerminal(deviceId, res);
});

// 2. GET /api/realtime/user-stream (Authenticated SSE stream for logged-in users)
realtimeRouter.get('/user-stream', authenticateJWT, (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // SSE Response Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Resolve session identity
  const clientSessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || `sess_${user.userId}_${Date.now()}`;
  const rawDevId = req.query.deviceId ? Number(req.query.deviceId) : undefined;
  const deviceId = rawDevId && !isNaN(rawDevId) ? rawDevId : undefined;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Web Browser';

  // Extract clean platform summary
  let platformSummary = 'Desktop Workstation';
  if (/Windows/i.test(ua)) platformSummary = 'Windows Workstation';
  else if (/Macintosh|Mac OS/i.test(ua)) platformSummary = 'Mac Workstation';
  else if (/iPhone|iPad/i.test(ua)) platformSummary = 'Apple iOS Device';
  else if (/Android/i.test(ua)) platformSummary = 'Android Device';
  else if (/Linux/i.test(ua)) platformSummary = 'Linux Workstation';

  const session: UserSessionInfo = {
    sessionId: clientSessionId,
    userId: user.userId,
    userName: user.fullName || user.email,
    userEmail: user.email,
    userRole: user.role,
    parishId: req.activeParishId || user.parishId || null,
    deviceId,
    ipAddress: ip.replace(/^::ffff:/, ''),
    userAgent: ua,
    platformSummary,
    connectedAt: new Date(),
    lastPingAt: new Date(),
  };

  realtimeHub.registerUserSession(session, res);
});

// 3. GET /api/realtime/sessions - View active online user sessions (Admin only)
realtimeRouter.get('/sessions', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const targetParishId = req.activeParishId || user.parishId || 1;

    // Developer Controls Guard: Feature toggle check
    const isFeatureActive = await isFeatureEnabled('USERS_TAB_SESSIONS', targetParishId);
    if (!isFeatureActive && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Active Sessions telemetry is currently disabled in Developer Controls.' });
    }

    const isAuthorized =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.PARISH_PRIEST ||
      user.role === UserRole.PARISH_ADMIN ||
      (await checkUserPermission(user.userId, user.role, targetParishId, 'USERS', 'canView'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Requires administrator privileges.' });
    }

    // Strictly parish-wise telemetry
    const sessions = realtimeHub.getActiveSessions(targetParishId);
    return res.json({ sessions });
  } catch (err: any) {
    console.error('Error fetching realtime sessions:', err);
    return res.status(500).json({ error: 'Failed to fetch active sessions.' });
  }
});

// 4. POST /api/realtime/sessions/:sessionId/kill - Force terminate an active session (Kill Switch)
realtimeRouter.post('/sessions/:sessionId/kill', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const targetParishId = req.activeParishId || user.parishId || 1;

    // Developer Controls Guard: Feature toggle check
    const isFeatureActive = await isFeatureEnabled('USERS_TAB_SESSIONS', targetParishId);
    if (!isFeatureActive && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Active Sessions telemetry is currently disabled in Developer Controls.' });
    }

    const isAuthorized =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.PARISH_PRIEST ||
      user.role === UserRole.PARISH_ADMIN ||
      (await checkUserPermission(user.userId, user.role, targetParishId, 'USERS', 'canEdit'));

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Requires administrator privileges.' });
    }

    const rawSessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const sessionId = String(rawSessionId);
    const reason = (req.body.reason as string) || `Session terminated remotely by ${user.fullName} (${user.role}).`;

    const success = realtimeHub.terminateSession(sessionId, reason, user);
    if (!success) {
      return res.status(404).json({ error: 'Session not found or already offline.' });
    }

    await logSystemActivity({
      parishId: req.activeParishId || user.parishId || 1,
      userId: user.userId,
      userName: user.fullName,
      userRole: user.role,
      actionType: 'TERMINAL_CHANGE',
      category: 'SECURITY',
      description: `Active user session "${sessionId}" was killed remotely by ${user.fullName} (${user.role}). Reason: ${reason}`,
      req,
    });

    return res.json({ success: true, message: 'User session terminated immediately.' });
  } catch (err: any) {
    console.error('Error terminating session:', err);
    return res.status(500).json({ error: 'Failed to terminate session.' });
  }
});

// 5. POST /api/realtime/families/:familyId/editing - Announce viewing/editing for collision guard
realtimeRouter.post('/families/:familyId/editing', authenticateJWT, (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const rawFamilyId = Array.isArray(req.params.familyId) ? req.params.familyId[0] : req.params.familyId;
  const familyId = parseInt(rawFamilyId, 10);
  if (isNaN(familyId)) return res.status(400).json({ error: 'Invalid family ID.' });

  const activeEditors = realtimeHub.startEditingFamily(
    familyId,
    user.userId,
    user.fullName || user.email,
    user.role,
    req.activeParishId || user.parishId || 1
  );

  return res.json({ activeEditors });
});

// 6. DELETE /api/realtime/families/:familyId/editing - Release viewing/editing lock
realtimeRouter.delete('/families/:familyId/editing', authenticateJWT, (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const rawDelFamilyId = Array.isArray(req.params.familyId) ? req.params.familyId[0] : req.params.familyId;
  const familyId = parseInt(rawDelFamilyId, 10);
  if (isNaN(familyId)) return res.status(400).json({ error: 'Invalid family ID.' });

  realtimeHub.stopEditingFamily(
    familyId,
    user.userId,
    req.activeParishId || user.parishId || 1
  );

  return res.json({ success: true });
});
