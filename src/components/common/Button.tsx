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
        'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs shadow-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950 focus-visible:outline-none',
      secondary:
        'bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-100 border border-zinc-700/70 shadow-xs focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950 focus-visible:outline-none',
      outline:
        'bg-transparent hover:bg-zinc-800/70 active:bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:border-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:outline-none',
      ghost:
        'bg-transparent hover:bg-zinc-800/60 active:bg-zinc-800 text-zinc-300 hover:text-white border border-transparent focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:outline-none',
      danger:
        'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-xs shadow-rose-950/40 border border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950 focus-visible:outline-none',
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
