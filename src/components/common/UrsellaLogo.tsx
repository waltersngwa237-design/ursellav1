import React from 'react';

export type LogoVariant = 'full' | 'symbol' | 'wordmark' | 'compact' | 'badge';
export type LogoTheme = 'default' | 'light' | 'mono-white' | 'mono-black';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface UrsellaLogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  showText?: boolean; // legacy compatibility
  showBetaBadge?: boolean;
  tagline?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * High-precision vector SVG mark for Ursella.
 * Geometry: The Ursella Nexus — an authoritative continuous architectural U-vessel
 * anchoring the business foundation, cradling the apex diamond intelligence core.
 */
export const UrsellaSymbolMark: React.FC<{
  sizeClass?: string;
  theme?: LogoTheme;
  className?: string;
}> = ({ sizeClass = 'w-8 h-8', theme = 'default', className = '' }) => {
  const isMonoWhite = theme === 'mono-white';
  const isMonoBlack = theme === 'mono-black';
  const isLight = theme === 'light';

  // Dynamic gradient/fill setup
  const vesselFill = isMonoWhite
    ? '#FFFFFF'
    : isMonoBlack
    ? '#09090B'
    : isLight
    ? '#059669'
    : 'url(#ursella_vessel_grad)';

  const diamondFill = isMonoWhite
    ? '#E4E4E7'
    : isMonoBlack
    ? '#27272A'
    : isLight
    ? '#10B981'
    : 'url(#ursella_diamond_grad)';

  const dotFill = isMonoWhite ? '#FFFFFF' : isMonoBlack ? '#09090B' : '#FFFFFF';

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClass} shrink-0 transition-transform ${className}`}
    >
      <defs>
        <linearGradient id="ursella_vessel_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="45%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="ursella_diamond_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <filter id="ursella_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#047857" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter={theme === 'default' ? 'url(#ursella_glow)' : undefined}>
        {/* Continuous Foundational U-Vessel */}
        <path
          d="M8.5 7.5 C8.5 6.1 9.6 5 11 5 C12.4 5 13.5 6.1 13.5 7.5 L13.5 15.5 C13.5 16.9 14.6 18 16 18 C17.4 18 18.5 16.9 18.5 15.5 L18.5 7.5 C18.5 6.1 19.6 5 21 5 C22.4 5 23.5 6.1 23.5 7.5 L23.5 16 C23.5 20.7 19.9 24.5 15.5 24.5 C11.1 24.5 8.5 20.7 8.5 16 Z"
          fill={vesselFill}
        />

        {/* Intelligence Apex Diamond Core */}
        <path
          d="M16 6.5 L19.2 9.7 L16 12.9 L12.8 9.7 Z"
          fill={diamondFill}
        />

        {/* Center Precision Focus Point */}
        <circle cx="16" cy="9.7" r="0.75" fill={dotFill} opacity={0.9} />
      </g>
    </svg>
  );
};

export const UrsellaLogo: React.FC<UrsellaLogoProps> = ({
  variant = 'full',
  theme = 'default',
  size = 'md',
  showText = true,
  showBetaBadge = false,
  tagline,
  className = '',
  onClick,
}) => {
  // If caller used showText=false, treat as 'symbol'
  const activeVariant: LogoVariant = !showText ? 'symbol' : variant;

  const sizeConfigs = {
    xs: {
      symbol: 'w-4 h-4',
      badge: 'w-6 h-6 rounded-lg p-1',
      text: 'text-xs font-bold tracking-tight',
      tagline: 'text-[8px]',
      gap: 'gap-1.5',
    },
    sm: {
      symbol: 'w-6 h-6',
      badge: 'w-7 h-7 rounded-lg p-1',
      text: 'text-sm font-bold tracking-tight',
      tagline: 'text-[9px]',
      gap: 'gap-2',
    },
    md: {
      symbol: 'w-8 h-8',
      badge: 'w-9 h-9 rounded-xl p-1.5',
      text: 'text-lg font-bold tracking-tight',
      tagline: 'text-[10px]',
      gap: 'gap-2.5',
    },
    lg: {
      symbol: 'w-10 h-10',
      badge: 'w-11 h-11 rounded-xl p-2',
      text: 'text-xl font-extrabold tracking-tight',
      tagline: 'text-xs',
      gap: 'gap-3',
    },
    xl: {
      symbol: 'w-12 h-12',
      badge: 'w-14 h-14 rounded-2xl p-2.5',
      text: 'text-2xl font-black tracking-tight',
      tagline: 'text-xs',
      gap: 'gap-3.5',
    },
    '2xl': {
      symbol: 'w-16 h-16',
      badge: 'w-20 h-20 rounded-3xl p-3.5',
      text: 'text-3xl font-black tracking-tight',
      tagline: 'text-sm',
      gap: 'gap-4',
    },
  };

  const currentSize = sizeConfigs[size] || sizeConfigs.md;

  // Text color based on theme
  const textColor =
    theme === 'mono-white'
      ? 'text-white'
      : theme === 'mono-black'
      ? 'text-zinc-950'
      : theme === 'light'
      ? 'text-zinc-900'
      : 'text-white';

  const taglineColor =
    theme === 'mono-white'
      ? 'text-zinc-300'
      : theme === 'mono-black'
      ? 'text-zinc-600'
      : theme === 'light'
      ? 'text-zinc-500'
      : 'text-zinc-400';

  // Standalone Symbol
  if (activeVariant === 'symbol') {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        onClick={onClick}
      >
        <UrsellaSymbolMark sizeClass={currentSize.symbol} theme={theme} />
      </div>
    );
  }

  // App Icon Badge (Container + Symbol)
  if (activeVariant === 'badge') {
    const badgeBg =
      theme === 'mono-black'
        ? 'bg-zinc-100 border border-zinc-300'
        : theme === 'light'
        ? 'bg-white border border-zinc-200 shadow-sm'
        : 'bg-zinc-900/90 border border-emerald-500/20 shadow-md shadow-emerald-950/40';

    return (
      <div
        className={`inline-flex items-center justify-center select-none ${badgeBg} ${currentSize.badge} ${className}`}
        onClick={onClick}
      >
        <UrsellaSymbolMark sizeClass="w-full h-full" theme={theme} />
      </div>
    );
  }

  // Wordmark Only
  if (activeVariant === 'wordmark') {
    return (
      <div
        className={`inline-flex items-center select-none ${textColor} ${className}`}
        onClick={onClick}
      >
        <span className={`font-sans ${currentSize.text}`}>Ursella</span>
        {showBetaBadge && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            beta
          </span>
        )}
      </div>
    );
  }

  // Stacked / Compact Lockup
  if (activeVariant === 'compact') {
    return (
      <div
        className={`inline-flex flex-col items-center select-none text-center ${className}`}
        onClick={onClick}
      >
        <div className="p-2 rounded-2xl bg-zinc-900 border border-emerald-500/20 shadow-lg shadow-emerald-950/30 mb-2">
          <UrsellaSymbolMark sizeClass={currentSize.symbol} theme={theme} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-sans ${textColor} ${currentSize.text}`}>Ursella</span>
          {showBetaBadge && (
            <span className="px-1 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              beta
            </span>
          )}
        </div>
        {tagline && (
          <span className={`font-medium tracking-wide uppercase mt-0.5 ${taglineColor} ${currentSize.tagline}`}>
            {tagline}
          </span>
        )}
      </div>
    );
  }

  // Default Primary Horizontal Lockup
  return (
    <div
      className={`inline-flex items-center select-none ${currentSize.gap} ${className}`}
      onClick={onClick}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        <UrsellaSymbolMark sizeClass={currentSize.symbol} theme={theme} />
      </div>

      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center gap-2">
          <span className={`font-sans tracking-tight ${textColor} ${currentSize.text}`}>
            Ursella
          </span>
          {showBetaBadge && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 leading-none">
              beta
            </span>
          )}
        </div>
        {tagline && (
          <span className={`font-medium tracking-wider uppercase mt-1 ${taglineColor} ${currentSize.tagline}`}>
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
};
