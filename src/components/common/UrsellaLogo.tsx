import React, { useId } from 'react';

export type LogoVariant = 'full' | 'symbol' | 'wordmark' | 'compact' | 'badge' | 'ai-symbol' | 'ai-badge';
export type LogoTheme = 'default' | 'purple' | 'ai' | 'light' | 'mono-white' | 'mono-black';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface UrsellaLogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  showText?: boolean; // legacy compatibility
  showBetaBadge?: boolean;
  tagline?: string;
  className?: string;
  isAnimated?: boolean;
  width?: number | string;
  height?: number | string;
  onClick?: () => void;
  'aria-label'?: string;
}

/**
 * UrsellaSymbolMark
 * 
 * Central symbol mark representing the Ursella intelligence core.
 */
export const UrsellaSymbolMark: React.FC<{
  sizeClass?: string;
  theme?: LogoTheme;
  className?: string;
  isAnimated?: boolean;
  width?: number | string;
  height?: number | string;
  'aria-label'?: string;
}> = ({
  sizeClass = 'w-8 h-8',
  theme = 'default',
  className = '',
  isAnimated = false,
  width,
  height,
  'aria-label': ariaLabel = 'Ursella Mark',
}) => {
  const isMonoWhite = theme === 'mono-white';
  const isMonoBlack = theme === 'mono-black';
  const isAiTheme = theme === 'ai' || theme === 'purple';
  const isLight = theme === 'light';

  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const gradPrimaryId = `ur_grad_pri_${uid}`;
  const gradCoreId = `ur_grad_core_${uid}`;
  const glowFilterId = `ur_glow_${uid}`;

  const dimensionStyle: React.CSSProperties = {};
  if (width) dimensionStyle.width = width;
  if (height) dimensionStyle.height = height;

  const nodeFillColor = isMonoWhite
    ? '#FFFFFF'
    : isMonoBlack
    ? '#09090B'
    : isAiTheme
    ? '#C7D2FE'
    : '#A7F3D0';

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClass} shrink-0 block transition-transform duration-200 ${className}`}
      style={dimensionStyle}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        {isMonoWhite ? (
          <>
            <linearGradient id={gradPrimaryId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E4E4E7" />
            </linearGradient>
            <linearGradient id={gradCoreId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D4D4D8" />
            </linearGradient>
          </>
        ) : isMonoBlack ? (
          <>
            <linearGradient id={gradPrimaryId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>
            <linearGradient id={gradCoreId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3F3F46" />
              <stop offset="100%" stopColor="#18181B" />
            </linearGradient>
          </>
        ) : isAiTheme ? (
          <>
            <linearGradient id={gradPrimaryId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="45%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
            <linearGradient id={gradCoreId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0E7FF" />
              <stop offset="100%" stopColor="#818CF8" />
            </linearGradient>
          </>
        ) : isLight ? (
          <>
            <linearGradient id={gradPrimaryId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="60%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id={gradCoreId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={gradPrimaryId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="45%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id={gradCoreId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </>
        )}
        <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.5"
            floodColor={isAiTheme ? '#6366F1' : '#10B981'}
            floodOpacity={isMonoBlack || isMonoWhite ? 0 : 0.35}
          />
        </filter>
      </defs>
      <g filter={`url(#${glowFilterId})`}>
        <g className={isAnimated ? 'ursella-part-mantle' : ''}>
          <path
            d="M10.8 11.8 C10.8 6.6 13.1 4.5 16 4.5 C18.9 4.5 21.2 6.6 21.2 11.8 C21.2 14.2 19.8 16 16 16 C12.2 16 10.8 14.2 10.8 11.8 Z"
            fill={`url(#${gradPrimaryId})`}
          />
          <path
            d="M16 7.5 L18.4 9.9 L16 12.3 L13.6 9.9 Z"
            fill={`url(#${gradCoreId})`}
          />
          <circle cx="16" cy="9.9" r="0.75" fill="#FFFFFF" opacity="0.95" />
        </g>
        <path
          d="M11 9 C7.5 9.5 4.5 12 4.5 15.5 C4.5 19 6.8 21.5 8 21.5 C9.2 21.5 9.5 20.2 9 19 C8.2 17.2 7 15.8 7 14.2 C7 12.5 9.2 11 11.8 10.5 Z"
          fill={`url(#${gradPrimaryId})`}
          className={isAnimated ? 'ursella-part-tentacle ursella-t1' : ''}
        />
        <path
          d="M21 9 C24.5 9.5 27.5 12 27.5 15.5 C27.5 19 25.2 21.5 24 21.5 C22.8 21.5 22.5 20.2 23 19 C23.8 17.2 25 15.8 25 14.2 C25 12.5 22.8 11 20.2 10.5 Z"
          fill={`url(#${gradPrimaryId})`}
          className={isAnimated ? 'ursella-part-tentacle ursella-t5' : ''}
        />
        <path
          d="M12.5 13.5 C10.2 14.8 7.8 17.5 7.8 21 C7.8 24.2 10 26.5 11.5 26.5 C12.8 26.5 13.2 25 12.5 23.8 C11.5 22 10.2 20.5 10.2 19 C10.2 17.2 11.8 15.8 13.8 14.8 Z"
          fill={`url(#${gradPrimaryId})`}
          className={isAnimated ? 'ursella-part-tentacle ursella-t2' : ''}
        />
        <path
          d="M19.5 13.5 C21.8 14.8 24.2 17.5 24.2 21 C24.2 24.2 22 26.5 20.5 26.5 C19.2 26.5 18.8 25 19.5 23.8 C20.5 22 21.8 20.5 21.8 19 C21.8 17.2 20.2 15.8 18.2 14.8 Z"
          fill={`url(#${gradPrimaryId})`}
          className={isAnimated ? 'ursella-part-tentacle ursella-t4' : ''}
        />
        <path
          d="M14.2 15.2 C13 16.8 12.5 19.5 12.5 22.5 C12.5 25.8 14.2 27.5 16 27.5 C17.8 27.5 19.5 25.8 19.5 22.5 C19.5 19.5 19 16.8 17.8 15.2 C16.9 15.8 15.1 15.8 14.2 15.2 Z"
          fill={`url(#${gradPrimaryId})`}
          className={isAnimated ? 'ursella-part-tentacle ursella-t3' : ''}
        />
        <circle cx="8" cy="21.5" r="0.75" fill={nodeFillColor} className={isAnimated ? 'ursella-node ursella-n1' : ''} />
        <circle cx="11.5" cy="26.5" r="0.75" fill={nodeFillColor} className={isAnimated ? 'ursella-node ursella-n2' : ''} />
        <circle cx="16" cy="27.5" r="0.75" fill={nodeFillColor} className={isAnimated ? 'ursella-node ursella-n3' : ''} />
        <circle cx="20.5" cy="26.5" r="0.75" fill={nodeFillColor} className={isAnimated ? 'ursella-node ursella-n4' : ''} />
        <circle cx="24" cy="21.5" r="0.75" fill={nodeFillColor} className={isAnimated ? 'ursella-node ursella-n5' : ''} />
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
  isAnimated = false,
  width,
  height,
  onClick,
  'aria-label': ariaLabel,
}) => {
  const activeVariant = showText ? variant : 'symbol';

  const sizeConfigs = {
    xs: {
      symbol: 'w-4 h-4',
      badge: 'w-6 h-6 rounded-lg p-1',
      text: 'text-xs font-bold tracking-tight',
      tagline: 'text-[8px]',
      gap: 'gap-1.5',
    },
    sm: {
      symbol: 'w-5 h-5 sm:w-6 sm:h-6',
      badge: 'w-7 h-7 rounded-lg p-1',
      text: 'text-sm font-bold tracking-tight',
      tagline: 'text-[9px]',
      gap: 'gap-2',
    },
    md: {
      symbol: 'w-7 h-7 sm:w-8 sm:h-8',
      badge: 'w-9 h-9 rounded-xl p-1.5',
      text: 'text-base sm:text-lg font-bold tracking-tight',
      tagline: 'text-[10px]',
      gap: 'gap-2.5',
    },
    lg: {
      symbol: 'w-9 h-9 sm:w-10 sm:h-10',
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

  if (activeVariant === 'symbol' || activeVariant === 'ai-symbol') {
    const symbolTheme = activeVariant === 'ai-symbol' ? 'ai' : theme;
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella Logo'}
      >
        <UrsellaSymbolMark
          sizeClass={currentSize.symbol}
          theme={symbolTheme}
          isAnimated={isAnimated}
          width={width}
          height={height}
        />
      </div>
    );
  }

  if (activeVariant === 'badge' || activeVariant === 'ai-badge') {
    const isAi = activeVariant === 'ai-badge' || theme === 'ai' || theme === 'purple';
    const badgeStyle =
      theme === 'mono-black'
        ? 'bg-zinc-100 border border-zinc-300'
        : theme === 'light'
        ? 'bg-white border border-zinc-200 shadow-sm'
        : isAi
        ? 'bg-zinc-900/90 border border-indigo-500/30 shadow-md shadow-indigo-950/50'
        : 'bg-zinc-900/90 border border-emerald-500/20 shadow-md shadow-emerald-950/40';

    return (
      <div
        className={`inline-flex items-center justify-center select-none ${badgeStyle} ${currentSize.badge} ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella Icon Badge'}
      >
        <UrsellaSymbolMark
          sizeClass="w-full h-full"
          theme={isAi ? 'ai' : theme}
          isAnimated={isAnimated}
        />
      </div>
    );
  }

  if (activeVariant === 'wordmark') {
    return (
      <div
        className={`inline-flex items-center select-none ${textColor} ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella'}
      >
        <span className={`font-sans tracking-tight ${currentSize.text}`}>Ursella</span>
        {showBetaBadge && (
          <span className="ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            beta
          </span>
        )}
      </div>
    );
  }

  if (activeVariant === 'compact') {
    return (
      <div
        className={`inline-flex flex-col items-center select-none text-center ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella'}
      >
        <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-emerald-500/20 shadow-lg shadow-emerald-950/30 mb-2">
          <UrsellaSymbolMark
            sizeClass={currentSize.symbol}
            theme={theme}
            isAnimated={isAnimated}
            width={width}
            height={height}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-sans ${textColor} ${currentSize.text}`}>Ursella</span>
          {showBetaBadge && (
            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
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

  return (
    <div
      className={`inline-flex items-center select-none ${currentSize.gap} ${className}`}
      onClick={onClick}
      role="img"
      aria-label={ariaLabel || 'Ursella'}
    >
      <div className={`relative shrink-0 flex items-center justify-center ${currentSize.symbol}`}>
        <UrsellaSymbolMark
          sizeClass="w-full h-full"
          theme={theme}
          isAnimated={isAnimated}
          width={width}
          height={height}
        />
      </div>

      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center gap-2">
          <span className={`font-sans tracking-tight ${textColor} ${currentSize.text}`}>
            Ursella
          </span>
          {showBetaBadge && (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 leading-none">
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
