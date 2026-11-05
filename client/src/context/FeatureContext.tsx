import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

export interface SystemFeatureItem {
  id: number;
  key: string;
  name: string;
  category: 'PAGE' | 'DASHBOARD' | 'SETTINGS' | 'USERS' | 'REGISTER' | 'GENERAL';
  description: string | null;
  route: string | null;
  isEnabled: boolean;
  parishId?: number;
}

export interface FeatureContextType {
  features: SystemFeatureItem[];
  flags: Record<string, boolean>;
  isFeatureEnabled: (key: string) => boolean;
  getStoredFlag: (key: string) => boolean;
  toggleFeature: (key: string, isEnabled: boolean, targetParishId?: number) => Promise<{ success: boolean; error?: string }>;
  batchUpdateFeatures: (updates: Array<{ key: string; isEnabled: boolean }>, targetParishId?: number) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  refreshFeatures: (targetParishId?: number) => Promise<void>;
  isDeveloper: boolean;
  activeParishId: number;
  isSimulatingClient: boolean;
  setIsSimulatingClient: (simulate: boolean) => void;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, activeParish } = useAuth();

  // Active Parish ID resolved safely with fallback to localStorage or default 1
  const activeParishId = activeParish?.id || (() => {
    try {
      const saved = localStorage.getItem('parish_active_id');
      return saved ? Number(saved) : 1;
    } catch {
      return 1;
    }
  })();

  // Developer exemption check: SUPER_ADMIN is the developer.
  // When active user is present, strictly check active user role to prevent stale developer state on role switch.
  const isDeveloper = Boolean(
    user
      ? user.role === 'SUPER_ADMIN'
      : (() => {
          try {
            const cached = localStorage.getItem('parish_user');
            return cached ? JSON.parse(cached)?.role === 'SUPER_ADMIN' : false;
          } catch {
            return false;
          }
        })()
  );

  // Client Simulation Mode: False by default. Developer has 100% full access to all features across the app.
  // Can be turned on in Developer Controls to test how a restricted/demo parish looks to end users.
  const [isSimulatingClient, setIsSimulatingClientState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parish_simulate_client_view') === 'true';
    } catch {
      return false;
    }
  });

  const setIsSimulatingClient = useCallback((simulate: boolean) => {
    setIsSimulatingClientState(simulate);
    try {
      localStorage.setItem('parish_simulate_client_view', String(simulate));
    } catch (_) {}
  }, []);

  const [features, setFeatures] = useState<SystemFeatureItem[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    try {
      const savedId = localStorage.getItem('parish_active_id') || '1';
      const cached = localStorage.getItem(`parish_feature_flags_${savedId}`) || localStorage.getItem('parish_feature_flags');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
      return {};
    } catch {
      return {};
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeatures = useCallback(async (parishIdToFetch?: number) => {
    const targetParish = parishIdToFetch || activeParish?.id || Number(localStorage.getItem('parish_active_id')) || 1;
    try {
      setIsLoading(true);
      const res = await api.get<{ features: SystemFeatureItem[]; flags: Record<string, boolean>; parishId?: number }>('/features', {
        params: { parishId: targetParish },
        headers: { 'x-parish-id': String(targetParish) },
      });
      if (res.data) {
        setFeatures(res.data.features || []);
        const loadedFlags = res.data.flags || {};
        setFlags(loadedFlags);
        try {
          localStorage.setItem(`parish_feature_flags_${targetParish}`, JSON.stringify(loadedFlags));
          localStorage.setItem('parish_feature_flags', JSON.stringify(loadedFlags));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Could not load developer feature flags, failing closed (hidden by default):', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeParish?.id]);

  // Synchronize flags whenever the active parish or auth state changes
  useEffect(() => {
    const currentId = activeParish?.id || Number(localStorage.getItem('parish_active_id')) || 1;
    try {
      const cached = localStorage.getItem(`parish_feature_flags_${currentId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          setFlags(parsed);
        } else {
          setFlags({});
        }
      } else {
        setFlags({});
      }
    } catch (_) {
      setFlags({});
    }
    fetchFeatures(currentId);
  }, [fetchFeatures, activeParish?.id, user?.id, token]);

  /**
   * Evaluates whether a feature toggle is enabled for the active parish.
   * Client-facing feature toggles configure availability for parish end-users,
   * allowing parishes to be given limited/custom/demo versions with restricted features.
   * As the Platform Developer (SUPER_ADMIN), you have 100% full unrestricted access to
   * all features across the platform at all times without being affected by client toggles
   * (unless explicitly testing via `isSimulatingClient`).
   *
   * STRICT FAIL-CLOSED / DEFAULT-HIDDEN ARCHITECTURE:
   * By default, features are HIDDEN (false). A feature is only visible if positively verified
   * as true in the loaded feature flags. If flags cannot be read, are corrupted, or the key is
   * unknown, it strictly returns false. This guarantees no restricted feature ever flashes
   * on screen before flags load or during network/cache failures.
   */
  const isFeatureEnabled = useCallback(
    (key: string): boolean => {
      // 1. Platform Developer has 100% unrestricted access ONLY when NOT simulating client view!
      if (isDeveloper && !isSimulatingClient) {
        return true;
      }
      // 2. Strict Fail-Closed / Default-Hidden:
      // If flags are loaded and key exists as a boolean, use it.
      if (flags && typeof flags[key] === 'boolean') {
        return flags[key];
      }
      // 3. Fallback to loaded features list if key is present
      const match = features.find((f) => f.key === key);
      if (match && typeof match.isEnabled === 'boolean') {
        return match.isEnabled;
      }
      // 4. Default Fail-Closed: If unreadable, missing, or in-flight -> HIDDEN (false)
      return false;
    },
    [flags, features, isDeveloper, isSimulatingClient]
  );

  /**
   * Raw stored flag state representing what is actually configured for other users in the DB
   * for the active parish. Used in Developer Controls tab so switches reflect actual user-facing status.
   * Strictly defaults to false (fail-closed) if unreadable.
   */
  const getStoredFlag = useCallback(
    (key: string): boolean => {
      if (flags && typeof flags[key] === 'boolean') {
        return flags[key];
      }
      const match = features.find((f) => f.key === key);
      if (match && typeof match.isEnabled === 'boolean') {
        return match.isEnabled;
      }
      return false;
    },
    [flags, features]
  );

  const toggleFeature = async (
    key: string,
    isEnabled: boolean,
    targetParishId?: number
  ): Promise<{ success: boolean; error?: string }> => {
    const targetParish = targetParishId || activeParishId;
    try {
      // Optimistic local update
      setFlags((prev) => {
        const next = { ...prev, [key]: isEnabled };
        try {
          localStorage.setItem(`parish_feature_flags_${targetParish}`, JSON.stringify(next));
          localStorage.setItem('parish_feature_flags', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
      setFeatures((prev) =>
        prev.map((f) => (f.key === key ? { ...f, isEnabled } : f))
      );

      const res = await api.put(
        `/features/${key}`,
        { isEnabled, parishId: targetParish },
        { headers: { 'x-parish-id': String(targetParish) } }
      );
      if (res.data?.feature) {
        const updated = res.data.feature;
        setFeatures((prev) =>
          prev.map((f) => (f.key === key ? updated : f))
        );
        setFlags((prev) => {
          const next = { ...prev, [key]: updated.isEnabled };
          try {
            localStorage.setItem(`parish_feature_flags_${targetParish}`, JSON.stringify(next));
            localStorage.setItem('parish_feature_flags', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      }
      return { success: true };
    } catch (err: any) {
      // Rollback on error
      fetchFeatures(targetParish);
      const msg = err.response?.data?.error || 'Failed to update feature toggle.';
      return { success: false, error: msg };
    }
  };

  const batchUpdateFeatures = async (
    updates: Array<{ key: string; isEnabled: boolean }>,
    targetParishId?: number
  ): Promise<{ success: boolean; error?: string }> => {
    const targetParish = targetParishId || activeParishId;
    try {
      const res = await api.post(
        '/features/batch',
        { updates, parishId: targetParish },
        { headers: { 'x-parish-id': String(targetParish) } }
      );
      if (res.data?.features) {
        setFeatures(res.data.features);
        const loadedFlags = res.data.flags || {};
        setFlags(loadedFlags);
        try {
          localStorage.setItem(`parish_feature_flags_${targetParish}`, JSON.stringify(loadedFlags));
          localStorage.setItem('parish_feature_flags', JSON.stringify(loadedFlags));
        } catch (_) {}
      }
      return { success: true };
    } catch (err: any) {
      fetchFeatures(targetParish);
      const msg = err.response?.data?.error || 'Failed to batch update features.';
      return { success: false, error: msg };
    }
  };

  return (
    <FeatureContext.Provider
      value={{
        features,
        flags,
        isFeatureEnabled,
        getStoredFlag,
        toggleFeature,
        batchUpdateFeatures,
        isLoading,
        refreshFeatures: fetchFeatures,
        isDeveloper,
        activeParishId,
        isSimulatingClient,
        setIsSimulatingClient,
      }}
    >
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};
