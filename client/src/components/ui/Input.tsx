import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, icon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-parish-text tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-parish-text-muted pointer-events-none flex items-center">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={type}
            className={cn(
              'w-full bg-parish-surface text-parish-text text-sm rounded-lg border border-parish-border px-3 py-2 transition-all duration-150',
              'placeholder:text-parish-text-muted/60',
              'focus:outline-none focus:ring-2 focus:ring-parish-primary/30 focus:border-parish-primary',
              'disabled:bg-parish-surface-subtle disabled:opacity-60 disabled:cursor-not-allowed',
              icon && 'pl-9',
              error && 'border-red-500 focus:ring-red-400/20 focus:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
