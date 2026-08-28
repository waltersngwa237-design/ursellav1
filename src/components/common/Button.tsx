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
      sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5 font-medium',
      md: 'text-sm px-4 py-2.5 rounded-xl gap-2 font-semibold',
      lg: 'text-base px-5 py-3 rounded-xl gap-2.5 font-bold',
    };

    const variantClasses = {
      primary:
        'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm shadow-emerald-950/50 ring-1 ring-emerald-500/30 transition-colors focus:ring-2 focus:ring-emerald-400 focus:outline-none',
      secondary:
        'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-100 ring-1 ring-zinc-700/60 transition-colors focus:ring-2 focus:ring-zinc-500 focus:outline-none',
      outline:
        'bg-transparent hover:bg-zinc-800/80 active:bg-zinc-800 text-zinc-200 border border-zinc-700/80 transition-colors focus:ring-2 focus:ring-zinc-500 focus:outline-none',
      ghost:
        'bg-transparent hover:bg-zinc-800/60 active:bg-zinc-800 text-zinc-300 hover:text-white transition-colors focus:ring-2 focus:ring-zinc-600 focus:outline-none',
      danger:
        'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-sm shadow-rose-950/50 ring-1 ring-rose-500/30 transition-colors focus:ring-2 focus:ring-rose-400 focus:outline-none',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
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
