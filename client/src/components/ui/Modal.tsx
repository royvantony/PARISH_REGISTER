import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  closeOnBackdropClick = false,
  closeOnEsc = false,
}) => {
  // Handle escape key only if explicitly configured
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

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop - Clicking outside does NOT close modal to protect user input */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Modal Dialog Card */}
      <div
        className={cn(
          'relative w-full bg-parish-surface rounded-2xl border border-parish-border shadow-soft-hover z-10 overflow-hidden',
          'animate-in zoom-in-95 duration-200',
          maxWidths[maxWidth]
        )}
      >
        {/* Header */}
        {(title || description) ? (
          <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-parish-border flex items-start justify-between">
            <div className="space-y-1 pr-4 sm:pr-6">
              {title && <h3 className="text-base sm:text-lg font-bold text-parish-text tracking-tight">{title}</h3>}
              {description && <p className="text-xs sm:text-sm text-parish-text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-parish-text-muted hover:text-parish-text p-1.5 rounded-lg hover:bg-parish-surface-subtle transition-colors shrink-0"
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-parish-text-muted hover:text-parish-text p-1.5 rounded-lg hover:bg-parish-surface-subtle transition-colors"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div className="px-3 sm:px-6 py-4 sm:py-5 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
