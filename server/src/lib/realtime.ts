import { Response, Request } from 'express';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logSystemActivity } from './activityLogger.js';

export interface UserSessionInfo {
  sessionId: string;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  parishId: number | null;
  parishName?: string;
  ipAddress?: string;
  userAgent?: string;
  platformSummary?: string;
  connectedAt: Date;
  lastPingAt: Date;
  res?: Response;
}

export interface FamilyEditorInfo {
  userId: number;
  userName: string;
  userRole: string;
  lastPing: number;
}

class RealtimeHub {
  // 1. Pending Workstations waiting on login: Map<deviceId, Set<Response>>
  private terminalSubscribers = new Map<number, Set<Response>>();

  // 2. Active Authenticated User Sessions: Map<sessionId, UserSessionInfo>
  private activeSessions = new Map<string, UserSessionInfo>();

  // 3. Concurrent Family Record Editors: Map<familyId, Map<userId, FamilyEditorInfo>>
  private familyEditors = new Map<number, Map<number, FamilyEditorInfo>>();

  // Periodic cleanup of stale editing locks (every 20s)
  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [familyId, editors] of this.familyEditors.entries()) {
        for (const [userId, editor] of editors.entries()) {
          if (now - editor.lastPing > 30000) {
            editors.delete(userId);
          }
        }
        if (editors.size === 0) {
          this.familyEditors.delete(familyId);
        }
      }
    }, 20000);
  }

  // ==========================================================================
  // TERMINAL AUTHORIZATION STREAM (Unauthenticated Waiting Screen)
  // ==========================================================================

  public subscribeTerminal(deviceId: number, res: Response) {
    if (!this.terminalSubscribers.has(deviceId)) {
      this.terminalSubscribers.set(deviceId, new Set());
    }
    const set = this.terminalSubscribers.get(deviceId)!;
    set.add(res);

    // Initial greeting comment to flush headers
    res.write(': connected to terminal stream\n\n');

    res.on('close', () => {
      set.delete(res);
      if (set.size === 0) {
        this.terminalSubscribers.delete(deviceId);
      }
    });
  }

  public emitTerminalApproved(deviceId: number, deviceName: string) {
    const subscribers = this.terminalSubscribers.get(deviceId);
    if (!subscribers || subscribers.size === 0) return;

    const payload = JSON.stringify({
      event: 'APPROVED',
      deviceId,
      deviceName,
      timestamp: new Date().toISOString(),
    });

    for (const res of subscribers) {
      try {
        res.write(`data: ${payload}\n\n`);
      } catch (_) {}
    }
  }

  public emitTerminalRevoked(deviceId: number) {
    // 1. Notify any pending login screen for this terminal
    const subscribers = this.terminalSubscribers.get(deviceId);
    if (subscribers && subscribers.size > 0) {
      const payload = JSON.stringify({
        event: 'REVOKED',
        deviceId,
        timestamp: new Date().toISOString(),
      });
      for (const res of subscribers) {
        try {
          res.write(`data: ${payload}\n\n`);
        } catch (_) {}
      }
    }

    // 2. Broadcast to all active user sessions that this terminal was revoked
    this.broadcastToAll('TERMINAL_REVOKED', { deviceId });
  }

  // ==========================================================================
  // AUTHENTICATED USER SESSIONS & INSTANT KILL SWITCH
  // ==========================================================================

  public registerUserSession(session: UserSessionInfo, res: Response) {
    session.res = res;
    this.activeSessions.set(session.sessionId, session);

    // Flush headers
    res.write(`: connected to user session stream for ${session.userName}\n\n`);

    // Keepalive heartbeat every 25 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (_) {
        clearInterval(heartbeat);
      }
    }, 25000);

    res.on('close', () => {
      clearInterval(heartbeat);
      // Window or tab closed by user!
      // Provide a 7-second grace period for normal page refreshes / navigations
      setTimeout(() => {
        const current = this.activeSessions.get(session.sessionId);
        if (current && current.res === res) {
          this.activeSessions.delete(session.sessionId);
        }
      }, 7000);
    });
  }

  public terminateSession(sessionId: string, reason = 'Terminated by Administrator', adminUser?: AuthenticatedUser): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    if (session.res) {
      try {
        session.res.write(`data: ${JSON.stringify({ event: 'FORCE_LOGOUT', reason })}\n\n`);
        session.res.end();
      } catch (_) {}
    }

    this.activeSessions.delete(sessionId);
    return true;
  }

  public getActiveSessions(parishId: number | null): UserSessionInfo[] {
    const list: UserSessionInfo[] = [];
    for (const s of this.activeSessions.values()) {
      // Return sessions matching parish, or all if global admin
      if (parishId === null || s.parishId === null || s.parishId === parishId) {
        list.push({
          sessionId: s.sessionId,
          userId: s.userId,
          userName: s.userName,
          userEmail: s.userEmail,
          userRole: s.userRole,
          parishId: s.parishId,
          parishName: s.parishName,
          ipAddress: s.ipAddress,
          platformSummary: s.platformSummary,
          connectedAt: s.connectedAt,
          lastPingAt: s.lastPingAt,
        });
      }
    }
    return list.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());
  }

  public broadcastToParish(parishId: number, event: string, payload: any) {
    const data = JSON.stringify({ event, payload });
    for (const session of this.activeSessions.values()) {
      if (session.res && (session.parishId === parishId || session.parishId === null)) {
        try {
          session.res.write(`data: ${data}\n\n`);
        } catch (_) {}
      }
    }
  }

  public broadcastToAll(event: string, payload: any) {
    const data = JSON.stringify({ event, payload });
    for (const session of this.activeSessions.values()) {
      if (session.res) {
        try {
          session.res.write(`data: ${data}\n\n`);
        } catch (_) {}
      }
    }
  }

  // ==========================================================================
  // CONCURRENT EDITING / COLLISION GUARD
  // ==========================================================================

  public startEditingFamily(familyId: number, userId: number, userName: string, userRole: string, parishId: number) {
    if (!this.familyEditors.has(familyId)) {
      this.familyEditors.set(familyId, new Map());
    }
    const editors = this.familyEditors.get(familyId)!;
    editors.set(userId, { userId, userName, userRole, lastPing: Date.now() });

    // Broadcast to others in this parish
    const active = Array.from(editors.values()).filter((e) => e.userId !== userId);
    this.broadcastToParish(parishId, 'FAMILY_EDITORS_CHANGED', {
      familyId,
      editors: Array.from(editors.values()),
    });
    return active;
  }

  public stopEditingFamily(familyId: number, userId: number, parishId: number) {
    const editors = this.familyEditors.get(familyId);
    if (!editors) return;
    editors.delete(userId);
    if (editors.size === 0) {
      this.familyEditors.delete(familyId);
    }
    this.broadcastToParish(parishId, 'FAMILY_EDITORS_CHANGED', {
      familyId,
      editors: editors ? Array.from(editors.values()) : [],
    });
  }

  public getFamilyEditors(familyId: number, excludeUserId?: number): FamilyEditorInfo[] {
    const editors = this.familyEditors.get(familyId);
    if (!editors) return [];
    const list = Array.from(editors.values());
    if (excludeUserId) {
      return list.filter((e) => e.userId !== excludeUserId);
    }
    return list;
  }
}

export const realtimeHub = new RealtimeHub();
