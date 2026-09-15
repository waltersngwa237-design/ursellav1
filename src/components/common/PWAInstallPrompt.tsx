import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  Smartphone,
  Share,
  PlusSquare,
  Laptop,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Apple,
  RefreshCw,
  Monitor,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { UrsellaLogo, UrsellaSymbolMark } from './UrsellaLogo.tsx';

/**
 * PWAInstallButton
 * 
 * Reusable compact button to mount in navigation bars, sidebars, or settings menus.
 * Hides automatically when running inside installed standalone PWA.
 */
export const PWAInstallButton: React.FC<{
  className?: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'sidebar';
  label?: string;
}> = ({
  className = '',
  variant = 'primary',
  label,
}) => {
  const { isStandalone, isInstallable, isIOS, promptInstall } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isStandalone) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'manual') {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const defaultLabel = label || (isIOS ? 'Add to Home Screen' : 'Install App');

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/30 transition-all shadow-xs group ${className}`}
          title="Install Ursella POS Application"
        >
          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
            <Download className="w-3.5 h-3.5" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <span className="block truncate font-bold">{defaultLabel}</span>
            <span className="block text-[10px] text-zinc-400 font-normal">Offline POS &amp; Receipts</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
        </button>

        {showModal && <PWAInstallModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
          variant === 'primary'
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-950/40'
            : variant === 'outline'
            ? 'border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white bg-zinc-900/60'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
        } ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>{defaultLabel}</span>
      </button>

      {showModal && <PWAInstallModal onClose={() => setShowModal(false)} />}
    </>
  );
};

/**
 * PWAInstallModal
 * 
 * Guided installation dialog tailored by OS (iOS, Android, Desktop).
 */
export const PWAInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isInstallable, isIOS, isAndroid, promptInstall } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>(() => {
    if (isIOS) return 'ios';
    if (isAndroid) return 'android';
    return 'desktop';
  });
  const [installedSuccess, setInstalledSuccess] = useState(false);

  const handleNativePrompt = async () => {
    const res = await promptInstall();
    if (res === 'accepted') {
      setInstalledSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-zinc-950 border border-emerald-500/25 shadow-md shadow-emerald-950/30">
              <UrsellaSymbolMark sizeClass="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Install Ursella App
                </h3>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PWA
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Full-screen standalone register with instant offline mode
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Value Proposition Pills */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-center">
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-emerald-400 text-xs font-bold block">100% Offline</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">Sell without internet</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-emerald-400 text-xs font-bold block">Hardware Ready</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">ESC/POS printers</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-emerald-400 text-xs font-bold block">Zero Delay</span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">Instant launch</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex p-1 rounded-xl bg-zinc-950 border border-zinc-800 mb-4">
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'ios'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>iPhone / iPad</span>
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'android'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android</span>
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'desktop'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Mac / PC</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="space-y-3 mb-5">
          {activeTab === 'ios' && (
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">Open in Apple Safari</p>
                  <p className="text-zinc-400 mt-0.5">
                    Tap the <strong>Share button</strong> in Safari's bottom navigation toolbar (the square icon with an upward arrow).
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">Select "Add to Home Screen"</p>
                  <p className="text-zinc-400 mt-0.5">
                    Scroll down through the share options sheet and tap <strong>Add to Home Screen</strong> with the plus icon.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Tap "Add" in Top Right</p>
                  <p className="text-zinc-400 mt-0.5">
                    Confirm by tapping <strong>Add</strong>. Ursella will appear on your home screen as a standalone application.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-3 text-xs text-zinc-300">
              {isInstallable ? (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                  <p className="font-bold text-white text-sm mb-1">Direct Installation Ready</p>
                  <p className="text-zinc-400 mb-3 text-xs">
                    Your browser supports 1-click PWA installation.
                  </p>
                  <button
                    onClick={handleNativePrompt}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
                  >
                    Install Ursella on Android
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-white">Tap the Browser Menu</p>
                      <p className="text-zinc-400 mt-0.5">
                        In Chrome or Edge, tap the <strong>three dots (⋮)</strong> in the top right corner.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-white">Tap "Install app" or "Add to Home Screen"</p>
                      <p className="text-zinc-400 mt-0.5">
                        Follow the native prompt to add Ursella to your app drawer and home screen.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-3 text-xs text-zinc-300">
              {isInstallable && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center mb-2">
                  <p className="font-bold text-white text-sm mb-1">Desktop Application Available</p>
                  <p className="text-zinc-400 mb-3 text-xs">
                    Run Ursella in a dedicated, high-performance window on macOS or Windows.
                  </p>
                  <button
                    onClick={handleNativePrompt}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
                  >
                    Install Desktop Application
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">Check the Address Bar (Omnibox)</p>
                  <p className="text-zinc-400 mt-0.5">
                    Look for the <strong>Install icon (monitor with a down arrow)</strong> on the right side of the browser address bar in Chrome, Edge, or Brave.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">Launch in Standalone Mode</p>
                  <p className="text-zinc-400 mt-0.5">
                    Click <strong>Install</strong> to run Ursella in its own independent desktop window, pinned to your Dock or Taskbar.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {installedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Ursella installed successfully! Opening app...</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * PWAInstallPrompt
 * 
 * Root-mounted component. Listens for user requests to open guide,
 * and displays an app update banner when a new service worker version is detected.
 */
export const PWAInstallPrompt: React.FC = () => {
  const { isStandalone, hasUpdate, applyAppUpdate } = usePWAInstall();
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    // Listen for custom open event triggered anywhere in the app
    const handleOpen = () => setShowManualModal(true);
    window.addEventListener('ursella_open_install_guide', handleOpen);

    return () => {
      window.removeEventListener('ursella_open_install_guide', handleOpen);
    };
  }, []);

  return (
    <>
      {/* Service Worker Update Toast */}
      {hasUpdate && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/95 border border-emerald-500/40 shadow-2xl backdrop-blur-md text-xs text-white max-w-sm">
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">New Version Available</p>
            <p className="text-[11px] text-zinc-400">Restart app to update offline caches.</p>
          </div>
          <button
            onClick={applyAppUpdate}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0"
          >
            Update
          </button>
        </div>
      )}

      {showManualModal && <PWAInstallModal onClose={() => setShowManualModal(false)} />}
    </>
  );
};
