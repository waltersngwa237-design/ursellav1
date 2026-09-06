import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';

interface UrsellaEngineLoaderProps {
  className?: string;
  isExiting?: boolean;
}

/**
 * UrsellaEngineLoader
 * 
 * Production-grade, theme-aware engine initialization loading screen.
 * Features:
 * - Abstract geometric Ursella octopus brand mark with sequential operational channel activation
 * - 6 micro data telemetry nodes (Sales, Inventory, Finance, Customers, Analytics, Operations)
 * - Refined orbital progress ring with emerald-cyan data pulse
 * - Exact status indicator: "Initializing Ursella engine..."
 * - Full Light / Dark mode responsiveness with zero theme flash
 * - Native prefers-reduced-motion support
 */
export const UrsellaEngineLoader: React.FC<UrsellaEngineLoaderProps> = ({
  className = '',
  isExiting = false,
}) => {
  const { isDark } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Staggered entry transition
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
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
      }}
    >
      {/* Visual Center Container with generous negative space */}
      <div
        className={`flex flex-col items-center justify-center max-w-sm w-full mx-auto px-6 transition-all duration-500 transform ${
          mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
        }`}
      >
        {/* =================================================================== */}
        {/* 1. CENTRAL OCTOPUS BRAND MARK & REFINED PROGRESS RING               */}
        {/* =================================================================== */}
        <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 mb-8">
          {/* Subtle Ambient Backlight Glow (Dark Mode only) */}
          {isDark && (
            <div
              className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl pointer-events-none transition-opacity duration-1000 animate-pulse"
              style={{ animationDuration: '3s' }}
            />
          )}

          {/* SVG Composition: Orbital Horizon Ring + Octopus Geometry + Micro-Nodes */}
          <svg
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full relative z-10 transition-transform duration-700 ursella-engine-svg"
            aria-hidden="true"
          >
            <defs>
              {/* Primary Emerald Gradient */}
              <linearGradient id="loader_emerald_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isDark ? '#34D399' : '#10B981'} />
                <stop offset="60%" stopColor={isDark ? '#10B981' : '#059669'} />
                <stop offset="100%" stopColor={isDark ? '#059669' : '#047857'} />
              </linearGradient>

              {/* Apex Core Gradient */}
              <linearGradient id="loader_core_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isDark ? '#A7F3D0' : '#34D399'} />
                <stop offset="100%" stopColor={isDark ? '#34D399' : '#10B981'} />
              </linearGradient>

              {/* Progress Ring Gradient (Emerald -> Cyan data head) */}
              <linearGradient id="loader_ring_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isDark ? '#10B981' : '#059669'} stopOpacity="0.2" />
                <stop offset="60%" stopColor={isDark ? '#34D399' : '#10B981'} stopOpacity="0.8" />
                <stop offset="100%" stopColor={isDark ? '#22D3EE' : '#06B6D4'} stopOpacity="1" />
              </linearGradient>

              {/* Subtle Drop Shadow for Dark Mode */}
              {isDark && (
                <filter id="loader_shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="2.5"
                    floodColor="#10B981"
                    floodOpacity="0.3"
                  />
                </filter>
              )}
            </defs>

            {/* ------------------------------------------------------------- */}
            {/* A. REFINED PROGRESS ORBITAL RING                              */}
            {/* ------------------------------------------------------------- */}
            {/* Background Track */}
            <circle
              cx="36"
              cy="36"
              r="32"
              stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}
              strokeWidth="1.5"
              fill="none"
            />
            {/* Animated Horizon Sweep Ring */}
            <circle
              cx="36"
              cy="36"
              r="32"
              stroke="url(#loader_ring_grad)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeDasharray="60 141"
              className="ursella-orbit-ring origin-center"
            />

            {/* ------------------------------------------------------------- */}
            {/* B. GEOMETRIC OCTOPUS ARMS & MANTLE DOME (Centered at x=36, y=36) */}
            {/* Original coordinates mapped from 32x32 into 72x72 box (scale 1.35, offset +14.4) */}
            {/* ------------------------------------------------------------- */}
            <g
              transform="translate(14.4, 14.4) scale(1.35)"
              filter={isDark ? 'url(#loader_shadow)' : undefined}
              className="ursella-octopus-body"
            >
              {/* 1. Central Mantle Dome (Intelligence Hub) */}
              <path
                d="M10.8 11.8 C10.8 6.6 13.1 4.5 16 4.5 C18.9 4.5 21.2 6.6 21.2 11.8 C21.2 14.2 19.8 16 16 16 C12.2 16 10.8 14.2 10.8 11.8 Z"
                fill="url(#loader_emerald_grad)"
                className="ursella-part-mantle"
              />

              {/* 2. Outer Left Tentacle (Operations Reach) */}
              <path
                d="M11 9 C7.5 9.5 4.5 12 4.5 15.5 C4.5 19 6.8 21.5 8 21.5 C9.2 21.5 9.5 20.2 9 19 C8.2 17.2 7 15.8 7 14.2 C7 12.5 9.2 11 11.8 10.5 Z"
                fill="url(#loader_emerald_grad)"
                className="ursella-part-tentacle ursella-t1"
              />

              {/* 3. Outer Right Tentacle (Operations Reach) */}
              <path
                d="M21 9 C24.5 9.5 27.5 12 27.5 15.5 C27.5 19 25.2 21.5 24 21.5 C22.8 21.5 22.5 20.2 23 19 C23.8 17.2 25 15.8 25 14.2 C25 12.5 22.8 11 20.2 10.5 Z"
                fill="url(#loader_emerald_grad)"
                className="ursella-part-tentacle ursella-t2"
              />

              {/* 4. Mid Left Tentacle (Sales / Commerce Channel) */}
              <path
                d="M12.5 13.5 C10.2 14.8 7.8 17.5 7.8 21 C7.8 24.2 10 26.5 11.5 26.5 C12.8 26.5 13.2 25 12.5 23.8 C11.5 22 10.2 20.5 10.2 19 C10.2 17.2 11.8 15.8 13.8 14.8 Z"
                fill="url(#loader_emerald_grad)"
                className="ursella-part-tentacle ursella-t3"
              />

              {/* 5. Mid Right Tentacle (Inventory / Logistics Channel) */}
              <path
                d="M19.5 13.5 C21.8 14.8 24.2 17.5 24.2 21 C24.2 24.2 22 26.5 20.5 26.5 C19.2 26.5 18.8 25 19.5 23.8 C20.5 22 21.8 20.5 21.8 19 C21.8 17.2 20.2 15.8 18.2 14.8 Z"
                fill="url(#loader_emerald_grad)"
                className="ursella-part-tentacle ursella-t4"
              />

              {/* 6. Inner Foundation Tentacles (U-shape Base / Financial Ledger) */}
              <path
                d="M14.2 15.2 C13 16.8 12.5 19.5 12.5 22.5 C12.5 25.8 14.2 27.5 16 27.5 C17.8 27.5 19.5 25.8 19.5 22.5 C19.5 19.5 19 16.8 17.8 15.2 C16.9 15.8 15.1 15.8 14.2 15.2 Z"
                fill="url(#loader_emerald_grad)"
                className="ursella-part-tentacle ursella-t5"
              />

              {/* 7. Central Apex Intelligence Core (AI Nexus Diamond) */}
              <path
                d="M16 7.5 L18.4 9.9 L16 12.3 L13.6 9.9 Z"
                fill="url(#loader_core_grad)"
                className="ursella-part-core"
              />

              {/* 8. Precision Focal Node */}
              <circle
                cx="16"
                cy="9.9"
                r="0.8"
                fill={isDark ? '#FFFFFF' : '#0F172A'}
                opacity={isDark ? 0.95 : 0.85}
              />
            </g>

            {/* ------------------------------------------------------------- */}
            {/* C. MICRO DATA TELEMETRY NODES (6 Core Functions)              */}
            {/* Subtly positioned near operational channels                   */}
            {/* ------------------------------------------------------------- */}
            <g className="ursella-nodes-group">
              {/* Node 1: Sales (Left outer apex) */}
              <circle
                cx="21"
                cy="37"
                r="1.2"
                fill={isDark ? '#34D399' : '#059669'}
                className="ursella-node ursella-n1"
              />

              {/* Node 2: Inventory (Left lower reach) */}
              <circle
                cx="27"
                cy="48"
                r="1.2"
                fill={isDark ? '#22D3EE' : '#0891B2'}
                className="ursella-node ursella-n2"
              />

              {/* Node 3: Finance / Ledger (Central 'U' Base) */}
              <circle
                cx="36"
                cy="51"
                r="1.3"
                fill={isDark ? '#34D399' : '#059669'}
                className="ursella-node ursella-n3"
              />

              {/* Node 4: Customers (Right lower reach) */}
              <circle
                cx="45"
                cy="48"
                r="1.2"
                fill={isDark ? '#22D3EE' : '#0891B2'}
                className="ursella-node ursella-n4"
              />

              {/* Node 5: Analytics (Right outer apex) */}
              <circle
                cx="51"
                cy="37"
                r="1.2"
                fill={isDark ? '#34D399' : '#059669'}
                className="ursella-node ursella-n5"
              />

              {/* Node 6: Operations (Apex Dome) */}
              <circle
                cx="36"
                cy="21"
                r="1.2"
                fill={isDark ? '#67E8F9' : '#0284C7'}
                className="ursella-node ursella-n6"
              />
            </g>
          </svg>
        </div>

        {/* =================================================================== */}
        {/* 2. REFINED SUBTLE PROGRESS BAR INDICATOR                            */}
        {/* =================================================================== */}
        <div className="w-40 sm:w-44 h-1 rounded-full overflow-hidden mb-4 relative bg-opacity-100 transition-colors">
          {/* Track */}
          <div
            className={`absolute inset-0 rounded-full ${
              isDark ? 'bg-zinc-800/80' : 'bg-slate-200'
            }`}
          />
          {/* Animated Pulse Beam */}
          <div
            className={`absolute inset-y-0 w-1/3 rounded-full ursella-loading-beam ${
              isDark
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                : 'bg-gradient-to-r from-emerald-600 to-teal-500'
            }`}
          />
        </div>

        {/* =================================================================== */}
        {/* 3. EXACT STATUS TELEMETRY TEXT                                      */}
        {/* Subordinate, pristine typography, no wordmark                       */}
        {/* =================================================================== */}
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
