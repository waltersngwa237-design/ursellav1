import React from 'react';
import { Button } from './Button.tsx';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900/40 border border-dashed border-slate-200 dark:border-zinc-800/80 shadow-xs ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-center text-slate-500 dark:text-zinc-300 mb-3.5 shadow-xs">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-zinc-200">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button size="sm" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
