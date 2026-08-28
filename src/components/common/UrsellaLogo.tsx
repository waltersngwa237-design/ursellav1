import React from 'react';

interface UrsellaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showBetaBadge?: boolean;
  className?: string;
}

export const UrsellaLogo: React.FC<UrsellaLogoProps> = ({
  size = 'md',
  showText = true,
  showBetaBadge = false,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-base font-bold',
    md: 'text-lg font-bold',
    lg: 'text-xl font-bold tracking-tight',
    xl: 'text-2xl font-black tracking-tight',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Ursella Geometric Bear Mark */}
      <div
        className={`${iconSizes[size]} relative rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-sm shadow-emerald-950/40 ring-1 ring-emerald-400/20`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/5 h-3/5 text-white"
        >
          {/* Stylized U + Bear ears mark */}
          <path d="M7 4a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0V6a2 2 0 0 1 2-2z" fill="currentColor" fillOpacity="0.4" />
          <path d="M17 4a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0V6a2 2 0 0 1 2-2z" fill="currentColor" fillOpacity="0.4" />
          <path d="M6 10v4a6 6 0 0 0 12 0v-4" />
          <circle cx="12" cy="15" r="1" fill="currentColor" />
        </svg>
      </div>

      {showText && (
        <div className="flex items-center gap-2">
          <span className={`font-sans tracking-tight text-white ${textSizes[size]}`}>
            ursella
          </span>
          {showBetaBadge && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              beta
            </span>
          )}
        </div>
      )}
    </div>
  );
};
