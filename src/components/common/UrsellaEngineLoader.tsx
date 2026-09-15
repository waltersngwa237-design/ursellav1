import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { UrsellaSymbolMark } from './UrsellaLogo.tsx';

interface UrsellaEngineLoaderProps {
  className?: string;
  isExiting?: boolean;
}

export const UrsellaEngineLoader: React.FC<UrsellaEngineLoaderProps> = ({
  className = '',
  isExiting = false,
}) => {
  const { isDark } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div
      id="ursella-engine-loader"
      role="status"
      aria-live="polite"
      aria-label="Initializing Ursella engine"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-300 ${
        isDark ? 'bg-[#070809] text-zinc-100' : 'bg-[#f8fafc] text-slate-900'
      } ${
        isExiting ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'
      } ${className}`}
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right, 0px))',
      }}
    >
      <div
        className={`flex flex-col items-center justify-center max-w-sm w-full mx-auto px-6 transition-all duration-500 transform ${
          mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
        }`}
      >
        <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 mb-8">
          <div
            className="absolute inset-0 rounded-full bg-blue-600/20 blur-2xl pointer-events-none transition-opacity duration-1000 animate-pulse"
            style={{ animationDuration: '3s' }}
          />

          <svg
            viewBox="0 0 72 72"
            fill="none"
            className="absolute inset-0 w-full h-full ursella-orbit-ring pointer-events-none origin-center"
            style={{ transformOrigin: 'center' }}
          >
            <circle
              cx="36"
              cy="36"
              r="33"
              stroke={isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(5, 150, 105, 0.3)'}
              strokeWidth="1.5"
              strokeDasharray="18 42"
              strokeLinecap="round"
            />
            <circle
              cx="36"
              cy="36"
              r="33"
              stroke={isDark ? 'rgba(52, 211, 153, 0.7)' : 'rgba(16, 185, 129, 0.8)'}
              strokeWidth="2"
              strokeDasharray="6 96"
              strokeLinecap="round"
            />
          </svg>

          <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            <UrsellaSymbolMark
              sizeClass="w-full h-full"
              theme={isDark ? 'default' : 'light'}
              isAnimated={true}
            />
          </div>
        </div>

        <div className="w-40 sm:w-44 h-1 rounded-full overflow-hidden mb-4 relative bg-opacity-100 transition-colors">
          <div
            className={`absolute inset-0 rounded-full ${
              isDark ? 'bg-zinc-800/80' : 'bg-slate-200'
            }`}
          />
          <div
            className={`absolute inset-y-0 w-1/3 rounded-full ursella-loading-beam ${
              isDark
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300'
                : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400'
            }`}
          />
        </div>

        <p
          className={`text-xs sm:text-[13px] font-medium tracking-wide transition-colors duration-300 ursella-status-text ${
            isDark ? 'text-zinc-400' : 'text-slate-500'
          }`}
        >
          Initializing Ursella engine...
        </p>
      </div>
    </div>
  );
};
