import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  Menu,
  X,
  Eye,
  ChevronDown,
  User as UserIcon,
  KeyRound,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ThemeSelector } from './ThemeSelector';
import { CLIENT_BRANDING } from '../../config/branding';
import { useAuth } from '../../context/AuthContext';
import { useFeatures } from '../../context/FeatureContext';
import { UserProfileModal } from '../profile/UserProfileModal';

export interface AppNavbarProps {
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  activeParishName?: string;
  activeParishCode?: string;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  onGoHome?: () => void;
  onOpenProfile?: (initialTab?: 'details' | 'security') => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  activeParishName = 'St. Alphonsa Syro-Malabar Parish',
  activeParishCode = 'SABN',
  userName = 'Super Admin',
  userRole = 'PARISH_ADMIN',
  onLogout,
  onGoHome,
  onOpenProfile,
}) => {
  const { user, activeParish } = useAuth();
  const { isSimulatingClient, setIsSimulatingClient } = useFeatures();
  const isGlobalUser = user?.role === 'SUPER_ADMIN' || user?.role === 'DIOCESAN_ADMIN';

  const formatRole = (role?: string) => {
    switch (role) {
      case 'PARISH_PRIEST':
        return 'Parish Priest';
      case 'PARISH_ADMIN':
        return 'Parish Admin';
      case 'PARISH_USER':
        return 'Parish User';
      case 'WARD_USER':
        return 'Ward User';
      case 'SUPER_ADMIN':
        return 'Platform Developer';
      case 'DIOCESAN_ADMIN':
        return 'Diocesan Admin';
      case 'DIOCESAN_USER':
        return 'Diocesan User';
      default:
        return role || '';
    }
  };

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const displayName = activeParish?.parishName || activeParishName;
  const displayCode = activeParish?.parishCode || activeParishCode;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-parish-border transition-colors shadow-xs">
      <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand & Parish Switcher */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 sm:flex-initial">
          <button
            type="button"
            onClick={onGoHome}
            title="Go to Home"
            className="flex items-center gap-2 sm:gap-3 text-left outline-none focus:outline-none focus:ring-0 focus-visible:outline-none rounded-xl transition-all cursor-pointer group select-none shrink-0"
          >
            <div className="h-9 px-1.5 sm:h-10 sm:px-2 py-0.5 rounded-xl bg-white border border-parish-border shadow-xs flex items-center justify-center shrink-0 group-hover:border-parish-primary/40 transition-colors">
              <img
                src={CLIENT_BRANDING.logoUrl}
                alt={CLIENT_BRANDING.logoAlt}
                className="h-7 sm:h-8 w-auto object-contain shrink-0"
              />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-parish-text uppercase hidden md:inline-block group-hover:text-parish-primary transition-colors">
                PARISH REGISTER
              </span>
            </div>
          </button>

          <div className="h-5 w-[1px] bg-parish-border hidden sm:block shrink-0" />

          {/* Active Parish Display (Locked in all cases - parish is chosen at login) */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-parish-surface-subtle text-parish-text text-xs font-semibold border border-parish-border select-none min-w-0 max-w-[160px] sm:max-w-[280px] md:max-w-[360px]"
            title={`${displayName} (${displayCode})`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
            <span className="truncate min-w-0">{displayName}</span>
            <Badge variant="subtle" size="sm" className="font-mono text-[10px] bg-white/70 shrink-0 hidden sm:inline-flex">
              {displayCode}
            </Badge>
          </div>
        </div>

        {/* Right: User Info, Theme Selector & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Client Simulation Active Indicator */}
          {isGlobalUser && isSimulatingClient && (
            <button
              type="button"
              onClick={() => setIsSimulatingClient(false)}
              title="Currently simulating limited client/demo view. Click to exit and return to full developer view."
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer animate-pulse shrink-0"
            >
              <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="hidden md:inline">Simulating Client</span>
              <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-mono">EXIT</span>
            </button>
          )}

          {/* Theme Selector */}
          <ThemeSelector />

          {/* User Profile Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-parish-surface-subtle border border-transparent hover:border-parish-border transition-all cursor-pointer group"
              title="Account settings & password"
              aria-expanded={isDropdownOpen}
            >
              <div className="w-8 h-8 rounded-full bg-parish-primary-light text-parish-primary font-bold text-xs flex items-center justify-center border border-parish-primary/20 shrink-0 group-hover:scale-105 transition-transform">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-parish-text leading-tight group-hover:text-parish-primary transition-colors">{userName}</div>
                <div className="text-[10px] text-parish-text-muted font-medium">{formatRole(userRole)}</div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-parish-text-muted transition-transform duration-200 hidden sm:block ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-parish-surface border border-parish-border shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-parish-border">
                  <div className="text-xs font-bold text-parish-text truncate">{userName}</div>
                  <div className="text-[11px] text-parish-text-muted truncate">{user?.email}</div>
                  <div className="mt-1.5">
                    <Badge variant="subtle" size="sm" className="text-[10px] font-medium">
                      {formatRole(userRole)}
                    </Badge>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      if (onOpenProfile) {
                        onOpenProfile('details');
                      } else {
                        setIsProfileModalOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-parish-text hover:bg-parish-surface-subtle transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-parish-primary" />
                    <span>My Profile & Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      if (onOpenProfile) {
                        onOpenProfile('security');
                      } else {
                        setIsProfileModalOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-parish-text hover:bg-parish-surface-subtle transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    <span>Reset / Change Password</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-parish-border">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Logout (Visible on tablet & desktop; on mobile, logout is in the navigation drawer) */}
          <button
            onClick={onLogout}
            title="Sign Out"
            className="hidden sm:flex text-parish-text-muted hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Navigation Toggle Button (Visible on screens < 768px) */}
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              className="md:hidden p-2 rounded-xl text-parish-text hover:bg-parish-surface-subtle border border-parish-border transition-colors flex items-center justify-center shrink-0"
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

      {/* User Profile & Security Modal (Fallback if onOpenProfile is not passed from layout) */}
      {!onOpenProfile && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </header>
  );
};
