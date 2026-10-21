import React from 'react';
import {
  Home,
  Users,
  UserPlus,
  FileSpreadsheet,
  MapPin,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export interface AppSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onQuickRegister?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: string | number;
  module?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  onQuickRegister,
}) => {
  const { hasPermission } = useAuth();

  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'register', label: 'Parish Register', icon: <Users className="w-4 h-4" />, module: 'REGISTER' },
    { id: 'register-family', label: 'Register New Family', icon: <UserPlus className="w-4 h-4" />, module: 'REGISTER_NEW' },
    { id: 'import-registrations', label: 'Import Registrations', icon: <FileSpreadsheet className="w-4 h-4" />, module: 'IMPORT_REGISTRATIONS' },
    { id: 'units', label: 'Wards & Units', icon: <MapPin className="w-4 h-4" />, module: 'WARDS' },
    { id: 'users', label: 'Users & Roles', icon: <Shield className="w-4 h-4" />, module: 'USERS' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, module: 'SETTINGS' },
  ];

  const navItems = allNavItems.filter((item) => !item.module || hasPermission(item.module, 'canView'));

  return (
    <aside
      className={cn(
        'shrink-0 hidden md:flex flex-col border-r border-parish-border min-h-[calc(100vh-4rem)] p-3 bg-parish-bg/60 transition-all duration-200 select-none justify-between',
        isCollapsed ? 'w-18 items-center' : 'w-64'
      )}
    >
      {/* Upper Area: Sidebar Header & Toggle, and Normal Navigation */}
      <div className="space-y-3 w-full">
        {/* Sidebar Header with Collapse Button INSIDE Sidebar */}
        <div
          className={cn(
            'flex items-center pb-1 pt-0.5',
            isCollapsed ? 'justify-center' : 'justify-between px-2'
          )}
        >
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-parish-text-muted">
              Main Menu
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1.5 rounded-lg text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle border border-parish-border transition-colors flex items-center justify-center"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-parish-primary" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1 w-full">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (item.id === 'register-family' && onQuickRegister) {
                    onQuickRegister();
                  }
                }}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 relative group',
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-parish-primary text-white shadow-soft font-bold'
                    : 'text-parish-text hover:bg-parish-surface-subtle hover:text-parish-text'
                )}
              >
                <span className={cn('shrink-0', isActive ? 'text-white' : 'text-parish-text-muted')}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.count && (
                      <span
                        className={cn(
                          'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-parish-surface-subtle text-parish-text-muted border border-parish-border'
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </>
                )}

                {/* Floating tooltip on collapsed view */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1 bg-parish-surface text-parish-text text-xs rounded-lg shadow-soft-hover border border-parish-border pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.label} {item.count ? `(${item.count})` : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lower Area: Collapse Bar Toggle */}
      <div className="w-full pt-4 space-y-2">
        {!isCollapsed ? (
          <>
            {/* Collapse Bar Toggle */}
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle border border-transparent hover:border-parish-border transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Collapse Sidebar</span>
            </button>
          </>
        ) : (
          /* Expand Button in Collapsed Mode */
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={onToggleCollapse}
              title="Expand Sidebar"
              className="w-9 h-9 rounded-xl text-parish-text-muted hover:text-parish-text hover:bg-parish-surface-subtle border border-parish-border flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
