import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'zinc';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold rounded-md',
    md: 'text-xs px-2.5 py-1 font-semibold rounded-lg',
  };

  const variantClasses = {
    default: 'bg-zinc-800 text-zinc-300 border border-zinc-700/60',
    emerald: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    blue: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    zinc: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 leading-none tracking-wide select-none whitespace-nowrap ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
