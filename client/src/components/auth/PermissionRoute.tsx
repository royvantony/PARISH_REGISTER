import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type PermissionAction } from '../../context/AuthContext';
import { useFeatures } from '../../context/FeatureContext';
import { Church } from 'lucide-react';
import { NotFoundScreen } from '../ui/NotFoundScreen';

interface PermissionRouteProps {
  module: string;
  action?: PermissionAction;
  featureKey?: string;
  children: React.ReactNode;
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({
  module,
  action = 'canView',
  featureKey,
  children,
}) => {
  const { user, hasPermission, isLoading, isAuthenticated } = useAuth();
  const { isFeatureEnabled, isLoading: isFeatureLoading, isDeveloper, isSimulatingClient } = useFeatures();

  if (isLoading || isFeatureLoading) {
    return (
      <div className="min-h-screen bg-parish-bg flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-parish-primary text-white flex items-center justify-center shadow-soft animate-bounce">
          <Church className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-parish-text-muted">
          <span className="w-2 h-2 rounded-full bg-parish-primary animate-ping" />
          <span>Loading screen...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Developer Bypass: Developer (SUPER_ADMIN) has access to all routes UNLESS simulating client view
  if ((isDeveloper || user?.role === 'SUPER_ADMIN') && !isSimulatingClient) {
    return <>{children}</>;
  }

  // 1. If feature is disabled by developer for this parish, render stealth 404
  if (featureKey && !isFeatureEnabled(featureKey)) {
    return <NotFoundScreen />;
  }

  // 2. Role Permissions Check from database:
  if (module && !hasPermission(module, action)) {
    return <NotFoundScreen />;
  }

  return <>{children}</>;
};
