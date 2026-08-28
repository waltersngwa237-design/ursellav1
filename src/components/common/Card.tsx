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
    default: 'bg-zinc-900/90 border border-zinc-800/90 shadow-sm shadow-zinc-950/40',
    subtle: 'bg-zinc-900/40 border border-zinc-800/50',
    outline: 'bg-transparent border border-zinc-800',
    glass: 'bg-zinc-900/70 backdrop-blur-md border border-zinc-800/80',
  };

  return (
    <div
      className={`rounded-2xl ${variantMap[variant]} ${paddingMap[padding]} transition-all ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
