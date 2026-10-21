import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Church } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-parish-bg flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-parish-primary text-white flex items-center justify-center shadow-soft animate-bounce">
          <Church className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-parish-text-muted">
          <span className="w-2 h-2 rounded-full bg-parish-primary animate-ping" />
          <span>Restoring secure parish session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
