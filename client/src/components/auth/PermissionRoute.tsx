import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type PermissionAction } from '../../context/AuthContext';
import { Church } from 'lucide-react';

interface PermissionRouteProps {
  module: string;
  action?: PermissionAction;
  children: React.ReactNode;
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({
  module,
  action = 'canView',
  children,
}) => {
  const { hasPermission, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-parish-bg flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-parish-primary text-white flex items-center justify-center shadow-soft animate-bounce">
          <Church className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-parish-text-muted">
          <span className="w-2 h-2 rounded-full bg-parish-primary animate-ping" />
          <span>Verifying access permissions...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user does not have permission (e.g., canView is false), disallow viewing the page even if URL is typed directly
  if (!hasPermission(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
