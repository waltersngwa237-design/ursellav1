import React, { useId } from 'react';

export type LogoVariant = 'full' | 'symbol' | 'wordmark' | 'compact' | 'badge' | 'ai-symbol' | 'ai-badge';
export type LogoTheme = 'default' | 'blue' | 'purple' | 'ai' | 'light' | 'mono-white' | 'mono-black';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface UrsellaLogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: LogoSize;
  showText?: boolean;
  showBetaBadge?: boolean;
  tagline?: string;
  className?: string;
  isAnimated?: boolean;
  width?: number | string;
  height?: number | string;
  onClick?: () => void;
  'aria-label'?: string;
}

export interface UrsellaGlyphProps {
  sizeClass?: string;
  theme?: 'default' | 'light' | 'mono-white' | 'mono-black' | 'glow';
  className?: string;
  isAnimated?: boolean;
  width?: number | string;
  height?: number | string;
  'aria-label'?: string;
}

/**
 * UrsellaAIGlyph
 * 
 * Distinctive four-point geometric intelligence diamond/spark.
 * Represents the AI Advisor intelligence layer inside the Ursella platform.
 * Clean, modern, futuristic, and recognizable at 16–24px.
 */
export const UrsellaAIGlyph: React.FC<UrsellaGlyphProps> = ({
  sizeClass = 'w-5 h-5',
  theme = 'default',
  className = '',
  isAnimated = false,
  width,
  height,
  'aria-label': ariaLabel = 'Ursella AI Advisor',
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const aiGradPriId = `ur_ai_pri_${uid}`;
  const aiGradSecId = `ur_ai_sec_${uid}`;
  const aiGlowId = `ur_ai_glow_${uid}`;

  const isMonoWhite = theme === 'mono-white';
  const isMonoBlack = theme === 'mono-black';
  const isLight = theme === 'light';

  const dimensionStyle: React.CSSProperties = {};
  if (width) dimensionStyle.width = width;
  if (height) dimensionStyle.height = height;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClass} shrink-0 block transition-transform duration-200 ${isAnimated ? 'ursella-ai-pulse' : ''} ${className}`}
      style={dimensionStyle}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        {isMonoWhite ? (
          <>
            <linearGradient id={aiGradPriId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="22" y1="2" x2="2" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
          </>
        ) : isMonoBlack ? (
          <>
            <linearGradient id={aiGradPriId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="22" y1="2" x2="2" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </>
        ) : isLight ? (
          <>
            <linearGradient id={aiGradPriId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="22" y1="2" x2="2" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="60%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={aiGradPriId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="45%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="22" y1="2" x2="2" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="55%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </>
        )}
        <filter id={aiGlowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.5"
            floodColor={isMonoBlack || isMonoWhite ? '#000000' : '#38BDF8'}
            floodOpacity={isMonoBlack || isMonoWhite ? 0 : 0.45}
          />
        </filter>
      </defs>

      <g filter={`url(#${aiGlowId})`}>
        {/* Primary Left/Upper Intelligence Facet */}
        <path
          d="M12 2 C12 7.2 7.8 11.5 2.5 12 C7.8 12.5 12 16.8 12 22 L12 12 Z"
          fill={`url(#${aiGradPriId})`}
        />

        {/* Primary Right/Lower Facet with Dimensional Contrast */}
        <path
          d="M12 2 L12 22 C12 16.8 16.2 12.5 21.5 12 C16.2 11.5 12 7.2 12 2 Z"
          fill={`url(#${aiGradSecId})`}
        />

        {/* Center Luminous Intelligence Aperture */}
        <path
          d="M12 8.5 L14.8 12 L12 15.5 L9.2 12 Z"
          fill={isMonoWhite ? '#FFFFFF' : isMonoBlack ? '#0F172A' : '#E0F2FE'}
          opacity={0.92}
        />

        {/* Orbiting Satellite Insight Spark */}
        <path
          d="M19 3 C19 4.3 17.7 5.5 16.5 5.5 C17.7 5.5 19 6.7 19 8 C19 6.7 20.3 5.5 21.5 5.5 C20.3 5.5 19 4.3 19 3 Z"
          fill={isMonoWhite ? '#FFFFFF' : isMonoBlack ? '#334155' : '#38BDF8'}
          opacity={0.88}
        />
      </g>
    </svg>
  );
};

/**
 * UrsellaSymbolMark
 * 
 * Canonical Ursella brand symbol: An abstract interwoven ribbon-style U-shaped emblem.
 * Clean, geometric, mature, technical, and engineered for a serious business operating system.
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
  // If the caller requested an AI theme, route directly to the dedicated AI Advisor glyph
  if (theme === 'ai' || theme === 'purple') {
    return (
      <UrsellaAIGlyph
        sizeClass={sizeClass}
        theme="default"
        className={className}
        isAnimated={isAnimated}
        width={width}
        height={height}
        aria-label={ariaLabel}
      />
    );
  }

  const isMonoWhite = theme === 'mono-white';
  const isMonoBlack = theme === 'mono-black';
  const isLight = theme === 'light';

  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ribbonLeftGradId = `ur_ribbon_l_${uid}`;
  const ribbonRightGradId = `ur_ribbon_r_${uid}`;
  const ribbonFoldGradId = `ur_ribbon_f_${uid}`;
  const ribbonShadowId = `ur_ribbon_s_${uid}`;
  const glowFilterId = `ur_glow_${uid}`;

  const dimensionStyle: React.CSSProperties = {};
  if (width) dimensionStyle.width = width;
  if (height) dimensionStyle.height = height;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClass} shrink-0 block transition-transform duration-200 ${isAnimated ? 'ursella-symbol-pulse' : ''} ${className}`}
      style={dimensionStyle}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        {isMonoWhite ? (
          <>
            <linearGradient id={ribbonLeftGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <linearGradient id={ribbonRightGradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
            <linearGradient id={ribbonFoldGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
          </>
        ) : isMonoBlack ? (
          <>
            <linearGradient id={ribbonLeftGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id={ribbonRightGradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id={ribbonFoldGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
          </>
        ) : isLight ? (
          <>
            <linearGradient id={ribbonLeftGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="40%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id={ribbonRightGradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="45%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id={ribbonFoldGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={ribbonLeftGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="35%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id={ribbonRightGradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="45%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id={ribbonFoldGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </>
        )}
        <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1.5"
            stdDeviation="1.5"
            floodColor="#2563EB"
            floodOpacity={isMonoBlack || isMonoWhite ? 0 : 0.38}
          />
        </filter>
      </defs>

      <g filter={`url(#${glowFilterId})`}>
        {/* 1. Right Ribbon Strand: Underweave Loop curving across base */}
        <path
          d="M22 4 C22 3.45 22.45 3 23 3 H26 C26.55 3 27 3.45 27 4 V18 C27 23.5 22.5 28 16 28 C12.8 28 9.8 26.5 7.8 24.2 L11.2 20.8 C12.4 22.2 14.1 23 16 23 C19.3 23 22 20.3 22 17 V4 Z"
          fill={`url(#${ribbonRightGradId})`}
        />

        {/* 2. Optical Under-Weave Depth Shadow */}
        <path
          d="M12.8 22.2 C13.7 23 14.8 23.4 16 23.4 L17.2 20.2 C16.2 20.2 15.2 19.8 14.4 19.2 Z"
          fill="#0B132B"
          opacity={isMonoBlack || isMonoWhite ? 0.3 : 0.8}
        />

        {/* 3. Left Ribbon Strand: Main Foreground Loop */}
        <path
          d="M5 4 C5 3.45 5.45 3 6 3 H9 C9.55 3 10 3.45 10 4 V17 C10 20.3 12.7 23 16 23 C17.8 23 19.4 22.2 20.5 20.9 L23.8 24.2 C21.8 26.5 19.1 28 16 28 C9.5 28 5 23.5 5 18 V4 Z"
          fill={`url(#${ribbonLeftGradId})`}
        />

        {/* 4. Upper Interlocking Crest Ribbon Fold */}
        <path
          d="M10 13.5 C10 11.2 12.4 9.2 16 9.2 C19.6 9.2 22 11.2 22 13.5 L19.8 14.6 C19.8 13.2 18.2 11.8 16 11.8 C13.8 11.8 12.2 13.2 12.2 14.6 Z"
          fill={`url(#${ribbonFoldGradId})`}
        />

        {/* 5. Central Luminous Core Focal Node */}
        <circle
          cx="16"
          cy="15.5"
          r="1"
          fill={isMonoWhite ? '#FFFFFF' : isMonoBlack ? '#0F172A' : '#E0F2FE'}
          opacity={0.95}
        />
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

  if (activeVariant === 'ai-symbol') {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella AI Advisor'}
      >
        <UrsellaAIGlyph
          sizeClass={currentSize.symbol}
          theme={theme === 'mono-white' ? 'mono-white' : theme === 'mono-black' ? 'mono-black' : 'default'}
          isAnimated={isAnimated}
          width={width}
          height={height}
        />
      </div>
    );
  }

  if (activeVariant === 'symbol') {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella Logo'}
      >
        <UrsellaSymbolMark
          sizeClass={currentSize.symbol}
          theme={theme}
          isAnimated={isAnimated}
          width={width}
          height={height}
        />
      </div>
    );
  }

  if (activeVariant === 'ai-badge') {
    const badgeStyle =
      theme === 'mono-black'
        ? 'bg-zinc-100 border border-zinc-300'
        : theme === 'light'
        ? 'bg-white border border-sky-200 shadow-sm'
        : 'bg-zinc-900/90 border border-sky-500/30 shadow-md shadow-sky-950/50';

    return (
      <div
        className={`inline-flex items-center justify-center select-none ${badgeStyle} ${currentSize.badge} ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella AI Advisor Badge'}
      >
        <UrsellaAIGlyph
          sizeClass="w-full h-full"
          theme={theme === 'mono-white' ? 'mono-white' : theme === 'mono-black' ? 'mono-black' : 'default'}
          isAnimated={isAnimated}
        />
      </div>
    );
  }

  if (activeVariant === 'badge') {
    const badgeStyle =
      theme === 'mono-black'
        ? 'bg-zinc-100 border border-zinc-300'
        : theme === 'light'
        ? 'bg-white border border-blue-200 shadow-sm'
        : 'bg-zinc-900/90 border border-blue-500/30 shadow-md shadow-blue-950/40';

    return (
      <div
        className={`inline-flex items-center justify-center select-none ${badgeStyle} ${currentSize.badge} ${className}`}
        onClick={onClick}
        role="img"
        aria-label={ariaLabel || 'Ursella Icon Badge'}
      >
        <UrsellaSymbolMark
          sizeClass="w-full h-full"
          theme={theme}
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
          <span className="ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/20">
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
        <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-blue-500/25 shadow-lg shadow-blue-950/40 mb-2">
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
            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/20">
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
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/20 leading-none">
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
