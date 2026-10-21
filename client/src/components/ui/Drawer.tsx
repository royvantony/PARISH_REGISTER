import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerBadge?: React.ReactNode;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  headerBadge,
  children,
  width = 'lg',
  closeOnBackdropClick = false,
  closeOnEsc = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (closeOnEsc) {
        window.addEventListener('keydown', handleKeyDown);
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
      if (closeOnEsc) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop - Clicking outside does NOT close drawer to protect data inspection */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
        <div
          className={cn(
            'w-screen max-w-full bg-parish-surface border-l border-parish-border shadow-drawer flex flex-col',
            'animate-in slide-in-from-right duration-300 ease-out',
            widths[width]
          )}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-parish-border flex items-center justify-between bg-parish-surface-subtle/40 gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {title && <h2 className="text-lg font-bold text-parish-text tracking-tight truncate">{title}</h2>}
                {headerBadge}
              </div>
              {description && <div className="text-xs text-parish-text-muted mt-0.5">{description}</div>}
            </div>
            <button
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close drawer"
              className="text-parish-text-muted hover:text-parish-text p-2 rounded-lg hover:bg-parish-surface-subtle transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
