import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useFeatures } from '../../context/FeatureContext';
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
  KeyRound,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { SessionTimeoutWarningModal } from '../auth/SessionTimeoutWarningModal';
import { LogoutConfirmModal } from '../auth/LogoutConfirmModal';
import { UserProfileModal } from '../profile/UserProfileModal';

export const AppLayout: React.FC = () => {
  const {
    user,
    activeParish,
    parishLogo,
    logout,
    requestLogout,
    isLogoutConfirmOpen,
    closeLogoutConfirm,
    hasPermission,
  } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'details' | 'security'>('details');

  const handleOpenProfile = (tab: 'details' | 'security' = 'details') => {
    setProfileModalTab(tab);
    setIsProfileModalOpen(true);
  };
  const navigate = useNavigate();
  const location = useLocation();

  // Record page navigation in system activity log
  const lastLoggedPathRef = useRef<string>('');
  useEffect(() => {
    if (!user || !location.pathname) return;
    if (lastLoggedPathRef.current === location.pathname) return;
    lastLoggedPathRef.current = location.pathname;

    const pageTitles: Record<string, string> = {
      '/': 'Home / Dashboard',
      '/dashboard': 'Dashboard Overview',
      '/register': 'Parish Register Directory',
      '/register/new': 'Register New Family',
      '/register/import': 'Import Registrations (CSV)',
      '/units': 'Family Units / Wards',
      '/users': 'Users & Roles Management',
      '/settings': 'System Settings & Masters',
    };

    const title = pageTitles[location.pathname] || (location.pathname.startsWith('/register/edit') ? 'Edit Family Record' : location.pathname);
    api.post('/activity/page-view', { path: location.pathname, pageTitle: title }).catch(() => {});
  }, [location.pathname, user]);

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

  const { isFeatureEnabled, isDeveloper, isSimulatingClient, setIsSimulatingClient } = useFeatures();
  const isDevUser = isDeveloper || user?.role === 'SUPER_ADMIN';

  const allMobileNavItems: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    count?: string | number;
    module?: string;
    featureKey?: string;
    action?: 'canView' | 'canCreate';
  }> = [
    { id: 'dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'register', label: 'Parish Register', icon: <Users className="w-5 h-5" />, module: 'REGISTER', featureKey: 'PAGE_REGISTER' },
    { id: 'register-family', label: 'Register New Family', icon: <UserPlus className="w-5 h-5" />, module: 'REGISTER_NEW', featureKey: 'PAGE_REGISTER_NEW', action: 'canCreate' },
    { id: 'import-registrations', label: 'Import Registrations', icon: <FileSpreadsheet className="w-5 h-5" />, module: 'IMPORT_REGISTRATIONS', featureKey: 'PAGE_REGISTER_IMPORT', action: 'canCreate' },
    { id: 'units', label: 'Wards & Units', icon: <MapPin className="w-5 h-5" />, module: 'WARDS', featureKey: 'PAGE_UNITS' },
    { id: 'users', label: 'Users & Roles', icon: <Shield className="w-5 h-5" />, module: 'USERS', featureKey: 'PAGE_USERS' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, module: 'SETTINGS', featureKey: 'PAGE_SETTINGS' },
  ];

  const mobileNavItems = allMobileNavItems.filter((item) => {
    // Platform Developer is never restricted unless explicitly simulating client view
    if (isDevUser && !isSimulatingClient) return true;
    // 1. Feature Toggle Check: If this page feature is disabled for the parish, hide it!
    if (item.featureKey && !isFeatureEnabled(item.featureKey)) return false;
    // 2. Role Permissions Matrix Check from database:
    if (item.module && !hasPermission(item.module, item.action || 'canView')) return false;
    return true;
  });


  return (
    <div className="min-h-screen bg-parish-bg text-parish-text flex flex-col font-sans selection:bg-parish-primary-light selection:text-parish-primary overflow-x-hidden w-full max-w-full">
      {/* Simulation Active Top Banner - Persistent across all screens so developer can always return */}
      {isSimulatingClient && (
        <aside
          aria-label="Simulation Mode Banner"
          className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-3 sm:px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between gap-2 sm:gap-3 z-50 sticky top-0 border-b border-amber-500/50 flex-wrap"
        >
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-200"></span>
            </span>
            <span className="truncate">
              <strong className="tracking-wide uppercase text-[10px] sm:text-[11px] bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-400/40 mr-1.5">
                Simulating Client View
              </strong>
              Parish:{' '}
              <span className="font-bold underline decoration-amber-300">
                {activeParish?.parishName || 'Parish'} ({activeParish?.parishCode || ''})
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/settings?tab=developer')}
              className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-900 text-white text-[11px] font-bold border border-amber-400/50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-amber-200" />
              <span>Developer Controls</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSimulatingClient(false)}
              className="px-3 py-1 rounded-lg bg-white text-amber-950 hover:bg-amber-100 text-[11px] font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <X className="w-3.5 h-3.5 text-amber-900" />
              <span>Exit<span className="hidden sm:inline"> Simulation (Return to Normal)</span></span>
            </button>
          </div>
        </aside>
      )}
      {/* 1. Frosted Glass Top Navbar with Mobile Hamburger Button */}
      <AppNavbar
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        activeParishName={activeParish?.parishName || 'St. Alphonsa Parish Brisbane'}
        activeParishCode={activeParish?.parishCode || 'SABN'}
        userName={user?.fullName || 'Super Admin'}
        userRole={user?.role || 'PARISH_ADMIN'}
        onLogout={requestLogout}
        onGoHome={() => handleSelectTab('dashboard')}
        onOpenProfile={handleOpenProfile}
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
                <div className="flex items-center gap-2.5">
                  <div className="h-8 px-1.5 py-0.5 rounded-lg bg-white border border-parish-border shadow-xs flex items-center justify-center shrink-0">
                    <img
                      src={parishLogo}
                      alt={activeParish?.parishName || 'Parish Official Seal'}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/branding/logo.png';
                      }}
                      className="h-6 w-auto object-contain shrink-0"
                    />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm tracking-tight text-parish-text uppercase">
                      PARISH REGISTER
                    </span>
                    <div className="text-[10px] text-parish-text-muted">
                      {activeParish?.parishName || 'St. Alphonsa Brisbane'}
                    </div>
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

            {/* Mobile Footer: User Info & Logout */}
            <div className="pt-4 border-t border-parish-border space-y-3">
              <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 rounded-full bg-parish-primary-light text-parish-primary font-bold text-xs flex items-center justify-center border border-parish-primary/20 shrink-0">
                  {(user?.fullName || 'Super Admin').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-parish-text truncate leading-tight">
                    {user?.fullName || 'Super Admin'}
                  </div>
                  <div className="text-[10px] text-parish-text-muted font-medium truncate">
                    {user?.role || 'PARISH_ADMIN'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenProfile('details');
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-parish-border bg-parish-surface text-parish-text text-xs font-bold hover:bg-parish-surface-subtle transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-parish-primary" />
                <span>My Profile & Security</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  requestLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
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
          <Outlet />
        </main>
      </div>

      {/* 4. Mandatory First-Login Password Change Modal */}
      <ChangePasswordModal isOpen={!!user?.mustChangePassword} />

      {/* 5. Pre-Logout Inactivity Warning Modal (Live Countdown) */}
      <SessionTimeoutWarningModal />

      {/* 6. User Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={closeLogoutConfirm}
        onConfirm={logout}
        userName={user?.fullName}
        userRole={user?.role}
        parishName={activeParish?.parishName}
      />

      {/* 7. Self-Service Profile & Security Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </div>
  );
};
