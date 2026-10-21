import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'DIOCESAN_ADMIN'
  | 'DIOCESAN_USER'
  | 'PARISH_SUPER_ADMIN'
  | 'PARISH_ADMIN'
  | 'PARISH_USER'
  | 'WARD_USER';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  parishId: number | null;
  mustChangePassword?: boolean;
}

export interface Parish {
  id: number;
  parishCode: string;
  parishName: string;
  city?: string;
}

// ============================================================================
// SESSION TIMEOUT CONFIGURATION (Option C: Inactivity Auto-Logout)
// ⏱️ Easily adjust inactivity thresholds right here:
// ============================================================================
export const INACTIVITY_TIMEOUT_MINUTES = 10; // ⏱️ Total idle duration before logout (Set to 5 min for testing!)
export const WARNING_BEFORE_LOGOUT_SECONDS = 60; // ⏱️ Warning popup appears 60s (1 min) before logout

export type PermissionAction =
  | 'canView'
  | 'canCreate'
  | 'canEdit'
  | 'canArchive'
  | 'canDelete'
  | 'canExport'
  | 'canApprove';

export interface ModulePermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  activeParish: Parish | null;
  availableParishes: Parish[];
  permissions: Record<string, ModulePermission>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isWarningOpen: boolean;
  remainingSeconds: number;
  hasPermission: (moduleKey: string, action?: PermissionAction) => boolean;
  staySignedIn: () => void;
  login: (email: string, password: string, overrideParishId?: number) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setActiveParishById: (parishId: number) => void;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('parish_token'));
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [availableParishes, setAvailableParishes] = useState<Parish[]>([
    { id: 1, parishCode: 'SABN', parishName: 'St. Alphonsa Syro-Malabar Parish Brisbane', city: 'Brisbane North' },
    { id: 4, parishCode: 'SMEL', parishName: 'St. Thomas Cathedral Melbourne', city: 'Melbourne' },
    { id: 5, parishCode: 'SSYD', parishName: 'St. Marys Parish Sydney', city: 'Sydney' },
    { id: 6, parishCode: 'SPER', parishName: 'St. Joseph Parish Perth', city: 'Perth' },
    { id: 7, parishCode: 'SADL', parishName: 'St. Euphrasia Parish Adelaide', city: 'Adelaide' },
  ]);
  const [activeParish, setActiveParish] = useState<Parish | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch active parishes from backend public endpoint on boot
  useEffect(() => {
    const fetchPublicParishes = async () => {
      try {
        const res = await api.get('/auth/parishes');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setAvailableParishes(res.data);
        }
      } catch (e) {
        // Fall back to seeded initial state
      }
    };
    fetchPublicParishes();
  }, []);

  // Initialize active parish from local storage or default to Brisbane
  useEffect(() => {
    const savedParishId = localStorage.getItem('parish_active_id');
    const matched = availableParishes.find((p) => p.id === Number(savedParishId));
    if (matched) {
      setActiveParish(matched);
    } else if (availableParishes.length > 0) {
      setActiveParish(availableParishes[0]);
      localStorage.setItem('parish_active_id', String(availableParishes[0].id));
    }
  }, [availableParishes]);

  const fetchPermissions = async () => {
    try {
      const res = await api.get<{ permissions: Record<string, ModulePermission> }>('/permissions/my-permissions');
      if (res.data?.permissions) {
        setPermissions(res.data.permissions);
      }
    } catch (e) {
      console.warn('Could not load user permissions:', e);
    }
  };

  const hasPermission = (moduleKey: string, action: PermissionAction = 'canView'): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'DIOCESAN_ADMIN') return true;
    const mod = permissions[moduleKey];
    if (!mod) {
      if (user.role === 'PARISH_SUPER_ADMIN' || user.role === 'PARISH_ADMIN') return true;
      if (user.role === 'PARISH_USER') {
        if (moduleKey === 'REGISTER' || moduleKey === 'REGISTER_NEW' || moduleKey === 'IMPORT_REGISTRATIONS' || moduleKey === 'WARDS') {
          return action === 'canView' || action === 'canCreate' || action === 'canEdit';
        }
      }
      return false;
    }
    return Boolean(mod[action]);
  };

  // Check existing session on boot
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('parish_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data?.user) {
          setUser(res.data.user);
          setToken(storedToken);

          if (Array.isArray(res.data.availableParishes) && res.data.availableParishes.length > 0) {
            setAvailableParishes(res.data.availableParishes);
            const savedId = localStorage.getItem('parish_active_id');
            const found =
              res.data.availableParishes.find((p: Parish) => p.id === Number(savedId)) ||
              res.data.availableParishes[0];
            setActiveParish(found);
            localStorage.setItem('parish_active_id', String(found.id));
          }

          // Fetch user permissions
          fetchPermissions();
        }
      } catch (err) {
        console.warn('Session expired or invalid, clearing local auth');
        localStorage.removeItem('parish_token');
        localStorage.removeItem('parish_user');
        setUser(null);
        setToken(null);
        setPermissions({});
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Re-fetch permissions if active parish changes
  useEffect(() => {
    if (user && token && activeParish) {
      fetchPermissions();
    }
  }, [activeParish?.id]);

  const login = async (email: string, password: string, overrideParishId?: number) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser, availableParishes: returnedParishes, defaultParishId } = res.data;

      // Persist auth
      localStorage.setItem('parish_token', receivedToken);
      localStorage.setItem('parish_user', JSON.stringify(receivedUser));
      localStorage.setItem('parish_last_activity', String(Date.now()));
      setToken(receivedToken);
      setUser(receivedUser);

      // Setup available parishes
      if (returnedParishes && returnedParishes.length > 0) {
        setAvailableParishes(returnedParishes);
        const targetId = overrideParishId || defaultParishId || returnedParishes[0].id;
        const targetParish = returnedParishes.find((p: Parish) => p.id === targetId) || returnedParishes[0];
        setActiveParish(targetParish);
        localStorage.setItem('parish_active_id', String(targetParish.id));
      } else {
        const fallbackId = overrideParishId || receivedUser.parishId || 1;
        localStorage.setItem('parish_active_id', String(fallbackId));
      }

      // Fetch user permissions
      fetchPermissions();

      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Invalid email or password. Please try again.';
      return { success: false, error: errorMsg };
    }
  };

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(WARNING_BEFORE_LOGOUT_SECONDS);

  const staySignedIn = () => {
    localStorage.setItem('parish_last_activity', String(Date.now()));
    setIsWarningOpen(false);
    setRemainingSeconds(WARNING_BEFORE_LOGOUT_SECONDS);
  };

  const logout = () => {
    localStorage.removeItem('parish_token');
    localStorage.removeItem('parish_user');
    localStorage.removeItem('parish_last_activity');
    setUser(null);
    setToken(null);
    setPermissions({});
    setIsWarningOpen(false);
    window.location.href = '/login';
  };

  // --------------------------------------------------------------------------
  // Inactivity Timeout & Warning Listener (Option C)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!token || !user) return;

    // Ensure initial activity mark exists
    if (!localStorage.getItem('parish_last_activity')) {
      localStorage.setItem('parish_last_activity', String(Date.now()));
    }

    let throttleTimer: any = null;
    const recordUserActivity = () => {
      // If the warning modal is NOT active, user interaction extends the session
      if (!isWarningOpen) {
        if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            localStorage.setItem('parish_last_activity', String(Date.now()));
            throttleTimer = null;
          }, 5000);
        }
      }
    };

    // Events that signal active user presence
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    activityEvents.forEach((ev) => window.addEventListener(ev, recordUserActivity, { passive: true }));

    // Accurate 1-second interval to track remaining seconds and trigger pre-logout warning
    const checkInterval = setInterval(() => {
      const storedLast = Number(localStorage.getItem('parish_last_activity') || Date.now());
      const elapsedSeconds = Math.floor((Date.now() - storedLast) / 1000);
      const totalTimeoutSeconds = INACTIVITY_TIMEOUT_MINUTES * 60;
      const secondsLeft = totalTimeoutSeconds - elapsedSeconds;

      if (secondsLeft <= 0) {
        setIsWarningOpen(false);
        sessionStorage.setItem(
          'inactivity_logout_notice',
          `You were automatically signed out after ${INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity for security.`
        );
        logout();
      } else if (secondsLeft <= WARNING_BEFORE_LOGOUT_SECONDS) {
        setRemainingSeconds(secondsLeft);
        setIsWarningOpen(true);
      } else {
        if (isWarningOpen) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, recordUserActivity));
      clearInterval(checkInterval);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [token, user, isWarningOpen]);

  const setActiveParishById = (parishId: number) => {
    const matched = availableParishes.find((p) => p.id === parishId);
    if (matched) {
      setActiveParish(matched);
      localStorage.setItem('parish_active_id', String(matched.id));
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await api.post('/auth/change-password', { newPassword });
      if (user) {
        const updatedUser = { ...user, mustChangePassword: false };
        setUser(updatedUser);
        localStorage.setItem('parish_user', JSON.stringify(updatedUser));
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to update password.',
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeParish,
        availableParishes,
        permissions,
        isLoading,
        isAuthenticated: !!token && !!user,
        isWarningOpen,
        remainingSeconds,
        hasPermission,
        staySignedIn,
        login,
        logout,
        setActiveParishById,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
