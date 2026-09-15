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
 * Directly derived from the keystone core inside the canonical Ursella brand mark.
 * Represents the AI Advisor intelligence layer inside the Ursella platform.
 * Clean, modern, authoritative, and recognizable down to 14px.
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
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="22" y1="2" x2="2" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3F3F46" />
              <stop offset="100%" stopColor="#18181B" />
            </linearGradient>
          </>
        ) : isLight ? (
          <>
            <linearGradient id={aiGradPriId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="60%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={aiGradPriId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id={aiGradSecId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="50%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </>
        )}
      </defs>

      <g>
        {/* Left Facet: Sweeping dynamic curve into core */}
        <path
          d="M 12 2 C 12 6.8 8.2 10.8 3.5 12 C 8.2 13.2 12 17.2 12 22 L 12 12 Z"
          fill={`url(#${aiGradPriId})`}
        />

        {/* Right Facet: Dimensional contrast */}
        <path
          d="M 12 2 L 12 22 C 12 17.2 15.8 13.2 20.5 12 C 15.8 10.8 12 6.8 12 2 Z"
          fill={`url(#${aiGradSecId})`}
        />

        {/* Center Precision Diamond Core */}
        <path
          d="M 12 8.5 L 14.5 12 L 12 15.5 L 9.5 12 Z"
          fill={isMonoWhite ? '#FFFFFF' : isMonoBlack ? '#09090B' : '#ECFDF5'}
          opacity={0.96}
        />

        {/* Satellite Micro Spark (Insight/Guidance) */}
        <path
          d="M 18.5 3 C 18.5 4.1 17.4 5.2 16.5 5.5 C 17.4 5.8 18.5 6.9 18.5 8 C 18.5 6.9 19.6 5.8 20.5 5.5 C 19.6 5.2 18.5 4.1 18.5 3 Z"
          fill={isMonoWhite ? '#FFFFFF' : isMonoBlack ? '#3F3F46' : '#34D399'}
          opacity={0.92}
        />
      </g>
    </svg>
  );
};

/**
 * UrsellaSymbolMark
 * 
 * Canonical Ursella Brand Mark: The "Vault & Prism U".
 * Engineered with pure mathematical geometry:
 * - Constant 6px stroke width across pillars and base.
 * - Robust left anchor pillar (balance sheet security, inventory capital, uptime).
 * - Semicircular bottom sweep.
 * - Ascending right pillar with a dynamic 45° angle growth apex (dx=6, dy=6).
 * - Architectural highlight facet celebrating upward momentum.
 * - Keystone Intelligence Diamond centered in the counter (shared DNA with AI Advisor).
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
  const priGradId = `ur_p_${uid}`;
  const facetGradId = `ur_f_${uid}`;
  const gemGradId = `ur_g_${uid}`;

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
            <linearGradient id={priGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id={facetGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
            <linearGradient id={gemGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F1F5F9" />
            </linearGradient>
          </>
        ) : isMonoBlack ? (
          <>
            <linearGradient id={priGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#18181B" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>
            <linearGradient id={facetGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#3F3F46" />
            </linearGradient>
            <linearGradient id={gemGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#09090B" />
              <stop offset="100%" stopColor="#18181B" />
            </linearGradient>
          </>
        ) : isLight ? (
          <>
            <linearGradient id={priGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="60%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id={facetGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id={gemGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="100%" stopColor="#065F46" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={priGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="35%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id={facetGradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#6EE7B7" />
            </linearGradient>
            <linearGradient id={gemGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ECFDF5" />
              <stop offset="50%" stopColor="#6EE7B7" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </>
        )}
      </defs>

      <g>
        {/* 1. Architectural U Foundation (Constant 6px Stroke Geometry) */}
        <path
          d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z"
          fill={`url(#${priGradId})`}
        />

        {/* 2. Apex Dynamic Growth Facet (Precision 45° Angle Chamfer Highlight) */}
        <path
          d="M 20.5 10 L 26.5 4 V 10 L 20.5 16 Z"
          fill={`url(#${facetGradId})`}
          opacity={isMonoWhite ? 0.85 : isMonoBlack ? 0.75 : 0.95}
        />

        {/* 3. Keystone Intelligence Core (Unified AI Diamond) */}
        <path
          d="M 16 6.2 L 19 10.5 L 16 14.8 L 13 10.5 Z"
          fill={`url(#${gemGradId})`}
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
        ? 'bg-white border border-emerald-200 shadow-sm'
        : 'bg-zinc-900/90 border border-emerald-500/30 shadow-md shadow-emerald-950/40';

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
        ? 'bg-white border border-emerald-200 shadow-sm'
        : 'bg-zinc-900/90 border border-emerald-500/30 shadow-md shadow-emerald-950/40';

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
          <span className="ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
        <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-emerald-500/25 shadow-lg shadow-emerald-950/40 mb-2">
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
            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 leading-none">
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
