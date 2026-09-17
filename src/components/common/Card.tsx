import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'outline' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingMap = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  const variantMap = {
    default: 'bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
    subtle: 'bg-slate-50/70 dark:bg-zinc-900/40 border border-slate-200/70 dark:border-zinc-800/50 text-slate-900 dark:text-zinc-100',
    outline: 'bg-transparent border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100',
    glass: 'bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-zinc-100 shadow-xs',
  };

  return (
    <div
      className={`rounded-xl sm:rounded-2xl ${variantMap[variant]} ${paddingMap[padding]} transition-all ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
