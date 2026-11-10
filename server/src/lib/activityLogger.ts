import { Request } from 'express';
import { prisma } from './prisma.js';

export type ActivityActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PAGE_VIEW'
  | 'SETTINGS_CHANGE'
  | 'USER_CHANGE'
  | 'WARD_CHANGE'
  | 'SECURITY_ALERT'
  | 'FAMILY_UPDATE'
  | 'FAMILY_APPROVE'
  | 'DIRECT_DEBIT_CHANGE'
  | 'DOCUMENT_CHANGE';

export type ActivityCategory =
  | 'AUTH'
  | 'NAVIGATION'
  | 'SETTINGS'
  | 'GOVERNANCE'
  | 'SECURITY'
  | 'REGISTER';

export interface LogActivityParams {
  parishId?: number | null;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  actionType: ActivityActionType;
  category: ActivityCategory;
  description: string;
  details?: Record<string, any> | string | null;
  path?: string | null;
  req?: Request;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Global System Activity Logger
 * Logs authentication, navigation, and settings modifications.
 * Respects the global parish-level activityLoggingEnabled toggle.
 */
export async function logSystemActivity(params: LogActivityParams): Promise<void> {
  try {
    const targetParishId = params.parishId || (params.req as any)?.activeParishId || (params.req as any)?.user?.parishId || 1;

    // Check if logging is enabled for this parish
    const parish = await prisma.parish.findUnique({
      where: { id: targetParishId },
      select: { id: true, activityLoggingEnabled: true },
    });

    if (parish && parish.activityLoggingEnabled === false) {
      // Global logging is switched OFF by developer/admin
      return;
    }

    // Extract user info if not explicitly passed
    let resolvedUserId = params.userId ?? null;
    let resolvedUserName = params.userName || '';
    let resolvedUserRole = params.userRole || null;

    if (params.req && (params.req as any).user) {
      const u = (params.req as any).user;
      if (!resolvedUserId) resolvedUserId = u.userId || u.id || null;
      if (!resolvedUserName) resolvedUserName = u.fullName || u.username || u.email || 'User';
      if (!resolvedUserRole) resolvedUserRole = u.role || null;
    }

    if (!resolvedUserName) {
      resolvedUserName = resolvedUserId ? `User #${resolvedUserId}` : 'System / Guest';
    }

    // Extract IP address and User Agent
    let ip = params.ipAddress;
    let ua = params.userAgent;

    if (params.req) {
      if (!ip) {
        const xForwarded = params.req.headers['x-forwarded-for'];
        if (typeof xForwarded === 'string') {
          ip = xForwarded.split(',')[0].trim();
        } else if (Array.isArray(xForwarded) && xForwarded.length > 0) {
          ip = xForwarded[0].trim();
        } else {
          ip = params.req.socket?.remoteAddress || null;
        }
      }
      if (!ua) {
        ua = (params.req.headers['user-agent'] as string) || null;
      }
    }

    // Clean IP address (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    // Serialize details
    let detailsString: string | null = null;
    if (params.details) {
      detailsString = typeof params.details === 'string'
        ? params.details
        : JSON.stringify(params.details);
    }

    const resolvedPath = params.path || (params.req ? params.req.originalUrl || params.req.url : null);

    await prisma.systemActivityLog.create({
      data: {
        parishId: targetParishId,
        userId: resolvedUserId,
        userName: resolvedUserName,
        userRole: resolvedUserRole,
        actionType: params.actionType,
        category: params.category,
        description: params.description.trim(),
        details: detailsString,
        path: resolvedPath,
        ipAddress: ip,
        userAgent: ua ? (ua.length > 255 ? ua.substring(0, 252) + '...' : ua) : null,
      },
    });
  } catch (err: any) {
    // Fail silently so logging never breaks core business logic
    console.error('[ActivityLogger] Error logging system activity:', err.message || err);
  }
}

/**
 * Helper to generate human-readable field diffs using captions
 */
export function diffFieldsWithCaptions(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  captions: Record<string, { caption: string; isSensitive?: boolean }>,
  ignoredKeys: string[] = ['updatedAt', 'createdAt', 'id', 'parishId']
): { summary: string; diffs: Array<{ field: string; caption: string; oldVal?: any; newVal?: any }> } {
  const diffs: Array<{ field: string; caption: string; oldVal?: any; newVal?: any }> = [];
  const changedCaptions: string[] = [];

  for (const [key, meta] of Object.entries(captions)) {
    if (ignoredKeys.includes(key)) continue;

    const oldVal = oldData[key];
    const newVal = newData[key];

    // Normalize comparison
    const normOld = oldVal === undefined || oldVal === null ? '' : String(oldVal).trim();
    const normNew = newVal === undefined || newVal === null ? '' : String(newVal).trim();

    if (normOld !== normNew) {
      changedCaptions.push(meta.caption);
      if (meta.isSensitive) {
        diffs.push({
          field: key,
          caption: meta.caption,
          oldVal: '[Protected]',
          newVal: '[Updated]',
        });
      } else {
        diffs.push({
          field: key,
          caption: meta.caption,
          oldVal: normOld || '(Blank)',
          newVal: normNew || '(Blank)',
        });
      }
    }
  }

  const summary = changedCaptions.length > 0
    ? `Modified: ${changedCaptions.join(', ')}`
    : 'No changes detected';

  return { summary, diffs };
}

