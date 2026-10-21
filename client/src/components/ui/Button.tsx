import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, icon, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none';

    const variants = {
      primary:
        'bg-parish-primary hover:bg-parish-primary-hover text-white shadow-sm focus:ring-parish-primary',
      secondary:
        'bg-parish-surface-subtle hover:bg-[#ebe4d7] text-parish-text border border-parish-border focus:ring-parish-primary',
      outline:
        'bg-transparent hover:bg-parish-surface-subtle text-parish-text border border-parish-border focus:ring-parish-primary',
      ghost:
        'bg-transparent hover:bg-parish-surface-subtle text-parish-text focus:ring-parish-primary',
      danger:
        'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
