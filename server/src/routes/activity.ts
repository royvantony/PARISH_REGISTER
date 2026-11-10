import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticateJWT } from '../middleware/auth.js';
import { checkUserPermission } from './permissions.js';
import { logSystemActivity, ActivityActionType, ActivityCategory } from '../lib/activityLogger.js';
import { UserRole } from '@prisma/client';

export const activityRouter = Router();

// Apply auth to all endpoints
activityRouter.use(authenticateJWT);

/**
 * GET /api/activity/status
 * Check if activity logging is enabled for the active parish
 */
activityRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    const parish = await prisma.parish.findUnique({
      where: { id: parishId },
      select: { id: true, activityLoggingEnabled: true },
    });

    return res.json({
      parishId,
      loggingEnabled: parish?.activityLoggingEnabled ?? true,
    });
  } catch (err: any) {
    console.error('Fetch activity status error:', err);
    return res.status(500).json({ error: 'Failed to retrieve activity status.' });
  }
});

/**
 * PUT /api/activity/toggle
 * Developer / Admin toggle for global activity logging
 */
activityRouter.put('/toggle', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    // Only Priests, Parish Admins, Diocesan Admins, and Super Admins can toggle
    const isGlobal =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIOCESAN_ADMIN ||
      user.role === UserRole.PARISH_PRIEST ||
      user.role === UserRole.PARISH_ADMIN;

    if (!isGlobal) {
      return res.status(403).json({ error: 'Access denied: Insufficient privileges to toggle system logging.' });
    }

    const { enabled } = req.body;
    const targetState = Boolean(enabled);

    const updated = await prisma.parish.update({
      where: { id: parishId },
      data: { activityLoggingEnabled: targetState },
      select: { id: true, parishName: true, activityLoggingEnabled: true },
    });

    // Log the toggle event itself before shutting off or when turning on
    await logSystemActivity({
      parishId,
      userId: user.userId,
      userName: user.fullName || user.username || user.email,
      userRole: user.role,
      actionType: 'SETTINGS_CHANGE',
      category: 'GOVERNANCE',
      description: `Global System Activity Logging switched ${targetState ? 'ENABLED' : 'DISABLED'} by ${user.fullName || user.email}`,
      details: { previousState: !targetState, newState: targetState },
      req,
    });

    return res.json({
      success: true,
      message: `System activity logging is now ${targetState ? 'Enabled' : 'Disabled'}.`,
      loggingEnabled: updated.activityLoggingEnabled,
    });
  } catch (err: any) {
    console.error('Toggle activity logging error:', err);
    return res.status(500).json({ error: 'Failed to toggle activity logging.' });
  }
});

/**
 * POST /api/activity/page-view
 * Log client-side page navigation
 */
activityRouter.post('/page-view', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const { path, pageTitle } = req.body;
    if (!path) return res.status(400).json({ error: 'Path is required.' });

    // Clean title
    const readableTitle = pageTitle || path.replace('/', '').toUpperCase() || 'Dashboard';

    await logSystemActivity({
      parishId,
      userId: user.userId,
      userName: user.fullName || user.username || user.email,
      userRole: user.role,
      actionType: 'PAGE_VIEW',
      category: 'NAVIGATION',
      description: `Accessed page: ${readableTitle} (${path})`,
      path,
      req,
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Page view logging error:', err);
    return res.status(500).json({ error: 'Failed to record page navigation.' });
  }
});

/**
 * GET /api/activity/logs
 * Retrieve paginated system activity logs with search & filters
 */
activityRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    // Verify permission
    const canView = await checkUserPermission(user.userId, user.role, parishId, 'AUDIT_LOGS', 'canView');
    if (!canView && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'You do not have permission to inspect system activity logs.' });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string, 10) || 25));
    const skip = (page - 1) * limit;

    const { category, actionType, userId, search, startDate, endDate } = req.query;

    const where: any = { parishId };

    if (category && category !== 'ALL') {
      where.category = category as string;
    }

    if (actionType && actionType !== 'ALL') {
      where.actionType = actionType as string;
    }

    if (userId && userId !== 'ALL') {
      const parsedUserId = parseInt(userId as string, 10);
      if (!isNaN(parsedUserId)) {
        where.userId = parsedUserId;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      where.OR = [
        { description: { contains: term, mode: 'insensitive' } },
        { userName: { contains: term, mode: 'insensitive' } },
        { path: { contains: term, mode: 'insensitive' } },
        { ipAddress: { contains: term } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.systemActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.systemActivityLog.count({ where }),
    ]);

    // Summary metrics for KPI banner
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, loginCount, settingsCount] = await Promise.all([
      prisma.systemActivityLog.count({
        where: { parishId, createdAt: { gte: todayStart } },
      }),
      prisma.systemActivityLog.count({
        where: { parishId, actionType: 'LOGIN' },
      }),
      prisma.systemActivityLog.count({
        where: { parishId, category: 'SETTINGS' },
      }),
    ]);

    // Unique users active in logs
    const distinctUsers = await prisma.systemActivityLog.findMany({
      where: { parishId },
      distinct: ['userId'],
      select: { userId: true, userName: true, userRole: true },
      take: 50,
    });

    return res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total,
        todayCount,
        loginCount,
        settingsCount,
      },
      usersList: distinctUsers.filter((u) => u.userId !== null),
    });
  } catch (err: any) {
    console.error('Fetch activity logs error:', err);
    return res.status(500).json({ error: 'Failed to retrieve system activity logs.' });
  }
});

/**
 * GET /api/activity/export
 * Export activity logs to CSV format
 */
activityRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const canView = await checkUserPermission(user.userId, user.role, parishId, 'AUDIT_LOGS', 'canView');
    if (!canView && user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied: Export permission required.' });
    }

    const logs = await prisma.systemActivityLog.findMany({
      where: { parishId },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const csvRows = [
      ['ID', 'Timestamp (UTC)', 'User Name', 'Role', 'Action', 'Category', 'Description', 'Path', 'IP Address'],
      ...logs.map((l) => [
        l.id,
        l.createdAt.toISOString(),
        `"${(l.userName || '').replace(/"/g, '""')}"`,
        l.userRole || '',
        l.actionType,
        l.category,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${(l.path || '').replace(/"/g, '""')}"`,
        l.ipAddress || '',
      ]),
    ];

    const csvContent = csvRows.map((r) => r.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="system_activity_logs_${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err: any) {
    console.error('Export activity logs error:', err);
    return res.status(500).json({ error: 'Failed to export activity logs.' });
  }
});

/**
 * DELETE /api/activity/purge
 * Developer / Super Admin Only: Purge all activity logs for active parish
 */
activityRouter.delete('/purge', async (req: Request, res: Response) => {
  try {
    const parishId = req.activeParishId || req.user?.parishId || 1;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    // Strict security check: Developer / Super Admin only
    if (user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        error: 'Access denied: Only Developer / Super Admin accounts can purge system activity logs.',
      });
    }

    const deleteResult = await prisma.systemActivityLog.deleteMany({
      where: { parishId },
    });

    return res.json({
      success: true,
      message: `Successfully purged ${deleteResult.count} activity log entries.`,
      purgedCount: deleteResult.count,
    });
  } catch (err: any) {
    console.error('Purge activity logs error:', err);
    return res.status(500).json({ error: 'Failed to purge activity logs.' });
  }
});


