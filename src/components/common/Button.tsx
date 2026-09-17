import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5 font-medium min-h-[32px]',
      md: 'text-sm px-4 py-2 rounded-xl gap-2 font-semibold min-h-[40px]',
      lg: 'text-base px-5 py-2.5 rounded-xl gap-2.5 font-bold min-h-[48px]',
    };

    const variantClasses = {
      primary:
        'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs border border-emerald-600 hover:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:outline-hidden',
      secondary:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 shadow-xs focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden',
      outline:
        'bg-transparent hover:bg-slate-100 active:bg-slate-200/80 text-slate-700 dark:hover:bg-zinc-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden',
      ghost:
        'bg-transparent hover:bg-slate-100 active:bg-slate-200/80 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden',
      danger:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs border border-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 focus-visible:outline-hidden',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center cursor-pointer select-none transition-all duration-150 ease-out active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current stroke-[2]" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
