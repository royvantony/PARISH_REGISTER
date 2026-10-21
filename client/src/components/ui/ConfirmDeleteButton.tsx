import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ConfirmDeleteButtonProps {
  onDelete: () => void | Promise<void>;
  title?: string;
  confirmLabel?: string;
  hasContent?: boolean;
  timeoutMs?: number;
  className?: string;
  disabled?: boolean;
}

export const ConfirmDeleteButton: React.FC<ConfirmDeleteButtonProps> = ({
  onDelete,
  title = 'Delete item',
  confirmLabel = 'Delete?',
  hasContent = true,
  timeoutMs = 4000,
  className,
  disabled = false,
}) => {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount
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
    if (disabled) return;

    // If row is completely blank, delete immediately without prompting
    if (!hasContent) {
      onDelete();
      return;
    }

    setIsConfirming(true);
  };

  const handleCancel = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsConfirming(false);
  };

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsConfirming(false);
    await onDelete();
  };

  if (isConfirming) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'inline-flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150 select-none shrink-0',
          className
        )}
      >
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          title="Click to confirm deletion"
        >
          <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{confirmLabel}</span>
        </button>

        <button
          type="button"
          onClick={handleCancel}
          className="p-1 text-parish-text-muted hover:text-parish-text bg-parish-surface hover:bg-parish-surface-subtle border border-parish-border rounded-lg transition-colors cursor-pointer"
          title="Cancel"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInitialClick}
      disabled={disabled}
      className={cn(
        'p-1.5 text-parish-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center shrink-0',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      title={title}
      aria-label={title}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
};
