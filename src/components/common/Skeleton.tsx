import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-zinc-800/60 rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* Hero business card skeleton */}
      <Skeleton className="h-32 w-full rounded-2xl" />

      {/* 4 Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>

      {/* Quick actions skeleton */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* Recent activity skeleton */}
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
};
