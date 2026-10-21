import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Button, type ButtonProps } from './Button';
import { Check, X, Loader2 } from 'lucide-react';

export interface ConfirmButtonProps extends Omit<ButtonProps, 'onClick'> {
  label?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: (e?: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  beforeConfirm?: () => boolean;
  onCancel?: () => void;
  confirmVariant?: 'primary' | 'success' | 'danger';
  timeoutMs?: number;
  showCancelText?: boolean;
}

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  label,
  children,
  confirmLabel = 'Confirm?',
  icon,
  variant = 'primary',
  confirmVariant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className,
  timeoutMs = 4500,
  showCancelText = false,
  onConfirm,
  beforeConfirm,
  onCancel,
  ...props
}) => {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Handle outside click & escape key to cancel confirmation state
  useEffect(() => {
    if (!isConfirming) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    // Auto-revert countdown timer
    timerRef.current = setTimeout(() => {
      handleCancel();
    }, timeoutMs);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isConfirming, timeoutMs]);

  const handleInitialClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isLoading) return;
    if (beforeConfirm && !beforeConfirm()) {
      return; // Validation failed, do not enter confirm state
    }
    setIsConfirming(true);
  };

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsConfirming(false);
    if (onCancel) onCancel();
  };

  const handleActualConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    await onConfirm(e);
    setIsConfirming(false);
  };

  const displayContent = label || children;

  // Confirming state: morphs in place into [✓ Confirm?] and [✕]
  if (isConfirming) {
    const confirmStyles =
      confirmVariant === 'success'
        ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 focus:ring-emerald-500 font-bold shadow-sm'
        : confirmVariant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 focus:ring-red-500 font-bold shadow-sm'
        : 'bg-parish-primary hover:bg-parish-primary-hover text-white border-parish-primary focus:ring-parish-primary font-bold shadow-sm';

    return (
      <div
        ref={containerRef}
        className={cn(
          'inline-flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150 select-none',
          className
        )}
      >
        {/* The Action Confirm Button */}
        <Button
          type="button"
          size={size}
          disabled={disabled || isLoading}
          onClick={handleActualConfirm}
          className={cn(confirmStyles)}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <Check className="w-3.5 h-3.5 mr-1 shrink-0 stroke-[2.5]" />
          )}
          <span>{confirmLabel}</span>
        </Button>

        {/* The Cancel / Back Button */}
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={disabled || isLoading}
          onClick={handleCancel}
          className="border-parish-border bg-white text-parish-text hover:bg-parish-surface-subtle px-2"
          title="Cancel and revert"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5 text-parish-text-muted hover:text-parish-text shrink-0" />
          {showCancelText && <span className="text-xs">Cancel</span>}
        </Button>
      </div>
    );
  }

  // Idle state: normal button appearance
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={icon}
      isLoading={isLoading}
      disabled={disabled}
      onClick={handleInitialClick}
      className={className}
      {...props}
    >
      {displayContent}
    </Button>
  );
};
