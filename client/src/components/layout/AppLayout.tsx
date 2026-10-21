import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppNavbar } from './AppNavbar';
import { AppSidebar } from './AppSidebar';
import {
  Home,
  Users,
  UserPlus,
  FileSpreadsheet,
  MapPin,
  Shield,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { SessionTimeoutWarningModal } from '../auth/SessionTimeoutWarningModal';

export const AppLayout: React.FC = () => {
  const { user, activeParish, availableParishes, setActiveParishById, logout, hasPermission } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from current URL path
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith('/register/new')) return 'register-family';
    if (path.startsWith('/register/import')) return 'import-registrations';
    if (path.startsWith('/register')) return 'register';
    if (path.startsWith('/units')) return 'units';
    if (path.startsWith('/users')) return 'users';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleSelectTab = (tabId: string) => {
    setIsMobileMenuOpen(false);
    switch (tabId) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'register':
        navigate('/register');
        break;
      case 'register-family':
        navigate('/register/new');
        break;
      case 'import-registrations':
        navigate('/register/import');
        break;
      case 'units':
        navigate('/units');
        break;
      case 'users':
        navigate('/users');
        break;
      case 'settings':
        navigate('/settings');
        break;
      default:
        navigate('/dashboard');
        break;
    }
  };

  const allMobileNavItems: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    count?: string | number;
    module?: string;
  }> = [
    { id: 'dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'register', label: 'Parish Register', icon: <Users className="w-5 h-5" />, module: 'REGISTER' },
    { id: 'register-family', label: 'Register New Family', icon: <UserPlus className="w-5 h-5" />, module: 'REGISTER_NEW' },
    { id: 'import-registrations', label: 'Import Registrations', icon: <FileSpreadsheet className="w-5 h-5" />, module: 'IMPORT_REGISTRATIONS' },
    { id: 'units', label: 'Wards & Units', icon: <MapPin className="w-5 h-5" />, module: 'WARDS' },
    { id: 'users', label: 'Users & Roles', icon: <Shield className="w-5 h-5" />, module: 'USERS' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, module: 'SETTINGS' },
  ];

  const mobileNavItems = allMobileNavItems.filter((item) => !item.module || hasPermission(item.module, 'canView'));

  return (
    <div className="min-h-screen bg-parish-bg text-parish-text flex flex-col font-sans selection:bg-parish-primary-light selection:text-parish-primary">
      {/* 1. Frosted Glass Top Navbar with Mobile Hamburger Button */}
      <AppNavbar
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        activeParishName={activeParish?.parishName || 'St. Alphonsa Parish Brisbane'}
        activeParishCode={activeParish?.parishCode || 'SABN'}
        userName={user?.fullName || 'Super Admin'}
        userRole={user?.role || 'DIOCESAN_ADMIN'}
        availableParishes={availableParishes}
        onSelectParish={(id) => setActiveParishById(id)}
        onLogout={logout}
        onGoHome={() => handleSelectTab('dashboard')}
      />

      {/* 2. Responsive Mobile Navigation Drawer (< 768px screens) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Menu Content */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-parish-surface border-r border-parish-border shadow-drawer z-10 flex flex-col justify-between p-4 animate-in slide-in-from-left duration-250 ease-out">
            <div className="space-y-4">
              {/* Header with Close */}
              <div className="flex items-center justify-between pb-3 border-b border-parish-border">
                <div>
                  <span className="font-extrabold text-sm tracking-tight text-parish-text uppercase">
                    PARISH REGISTER
                  </span>
                  <div className="text-[10px] text-parish-text-muted">
                    {activeParish?.parishName || 'St. Alphonsa Brisbane'}
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-parish-text-muted hover:bg-parish-surface-subtle"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {mobileNavItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all',
                        isActive
                          ? 'bg-parish-primary text-white shadow-soft font-bold'
                          : 'text-parish-text hover:bg-parish-surface-subtle'
                      )}
                    >
                      <span className={cn('shrink-0', isActive ? 'text-white' : 'text-parish-text-muted')}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                      {item.count && (
                        <span
                          className={cn(
                            'ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded-md',
                            isActive ? 'bg-white/20 text-white' : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                          )}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer: Logout */}
            <div className="pt-4 border-t border-parish-border">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out ({user?.fullName || 'Super Admin'})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Body with Desktop Collapsible Sidebar & Full Canvas */}
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        <AppSidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onQuickRegister={() => navigate('/register/new')}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 overflow-x-hidden">
          <Outlet key={activeParish?.id || 'default'} />
        </main>
      </div>

      {/* 4. Mandatory First-Login Password Change Modal */}
      <ChangePasswordModal isOpen={!!user?.mustChangePassword} />

      {/* 5. Pre-Logout Inactivity Warning Modal (Live Countdown) */}
      <SessionTimeoutWarningModal />
    </div>
  );
};
