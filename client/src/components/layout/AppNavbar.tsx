import React from 'react';
import {
  Church,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ThemeSelector } from './ThemeSelector';

export interface AppNavbarProps {
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  activeParishName?: string;
  activeParishCode?: string;
  userName?: string;
  userRole?: string;
  availableParishes?: { id: number; parishCode: string; parishName: string }[];
  onSelectParish?: (id: number) => void;
  onLogout?: () => void;
  onGoHome?: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  activeParishName = 'St. Alphonsa Syro-Malabar Parish',
  activeParishCode = 'SABN',
  userName = 'Super Admin',
  userRole = 'DIOCESAN_ADMIN',
  onLogout,
  onGoHome,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-parish-border transition-colors shadow-xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Parish Switcher */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={onGoHome}
            title="Go to Home"
            className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-parish-primary rounded-xl transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-parish-primary text-white flex items-center justify-center shadow-sm shrink-0 group-hover:bg-parish-primary-hover transition-colors">
              <Church className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-parish-text uppercase hidden sm:inline-block group-hover:text-parish-primary transition-colors">
                PARISH REGISTER
              </span>
            </div>
          </button>

          <div className="h-5 w-[1px] bg-parish-border hidden sm:block" />

          {/* Active Parish Display (Locked per session - To switch, logout and log in) */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-parish-surface-subtle text-parish-text text-xs font-semibold border border-parish-border select-none"
            title={`Active Parish: ${activeParishName} (${activeParishCode}) - To switch parish, please log out and sign in.`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
            <span className="truncate max-w-[225px] sm:max-w-[310px] md:max-w-[360px]">{activeParishName}</span>
            <Badge variant="subtle" size="sm" className="font-mono text-[10px] bg-white/70">
              {activeParishCode}
            </Badge>
          </div>
        </div>

        {/* Right: User Info, Theme Selector & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Selector */}
          <ThemeSelector />

          {/* User profile */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-parish-primary-light text-parish-primary font-bold text-xs flex items-center justify-center border border-parish-primary/20 shrink-0">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-parish-text leading-tight">{userName}</div>
              <div className="text-[10px] text-parish-text-muted font-medium">{userRole}</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Sign Out"
            className="text-parish-text-muted hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Navigation Toggle Button (Visible on screens < 768px) */}
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              className="md:hidden p-2 rounded-xl text-parish-text hover:bg-parish-surface-subtle border border-parish-border transition-colors flex items-center justify-center"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-parish-primary" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

