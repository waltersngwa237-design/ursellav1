import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  Smartphone,
  Share,
  PlusSquare,
  HelpCircle,
  Laptop,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Apple,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running already in standalone mode (installed PWA)
    const isAppStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    setIsStandalone(isAppStandalone);
    if (isAppStandalone) return;

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    if (isIOS) {
      setActiveTab('ios');
    } else if (isAndroid) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    // Capture standard browser beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      const dismissed = sessionStorage.getItem('ursella_install_banner_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If on iOS or mobile browsers where beforeinstallprompt doesn't fire, show initial install helper
    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem('ursella_install_banner_dismissed');
      if (!dismissed && !isAppStandalone) {
        setShowPrompt(true);
      }
    }, 1800);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // If browser doesn't support 1-click trigger (e.g. Safari iOS or Chrome desktop without prompt yet), show guide directory
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('ursella_install_banner_dismissed', 'true');
  };

  if (isStandalone) return null;

  return (
    <>
      {/* 1. Floating Quick Action Banner */}
      {showPrompt && !showGuideModal && (
        <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] bg-zinc-900/95 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 shadow-2xl shadow-emerald-950/50 text-zinc-100 backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Install Ursella App
                </h4>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  Fast & Offline
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-300 mt-1 leading-relaxed">
                Add to your home screen for full-screen checkout, instant offline sales sync, and fast daily access.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleNativeInstall}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{deferredPrompt ? 'Install Now' : 'Install App'}</span>
                </button>

                <button
                  onClick={() => setShowGuideModal(true)}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>How to install</span>
                </button>

                <button
                  onClick={handleDismiss}
                  className="px-2 py-1.5 text-zinc-400 hover:text-zinc-200 text-xs ml-auto transition-colors"
                >
                  Later
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-zinc-500 hover:text-zinc-300 p-1 -mr-1 -mt-1 rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Comprehensive Multi-Platform Step-by-Step Directory Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 text-zinc-100 shadow-2xl relative space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">How to Install Ursella</h3>
                  <p className="text-xs text-zinc-400">Install as a native progressive web app</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800/80">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'android'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android / Chrome</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'ios'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>iPhone / Safari</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'desktop'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>PC / Mac</span>
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3 bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800 text-xs">
              {activeTab === 'android' && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200">Tap the browser menu (3 dots ⋮)</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Located in the top-right or bottom of Google Chrome.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200 flex items-center gap-1">
                        Select <span className="text-emerald-400 font-bold">"Install app"</span> or <span className="text-emerald-400 font-bold">"Add to Home screen"</span>
                      </p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Chrome will create a fast standalone icon on your phone.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200">Open Ursella from Home Screen</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Enjoy full-screen POS experience with offline storage.</p>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'ios' && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        Tap the Safari <span className="inline-flex items-center gap-1 text-emerald-400 font-bold"><Share className="w-3.5 h-3.5" /> Share</span> button
                      </p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Located in the bottom navigation bar of Safari.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        Scroll down and tap <span className="inline-flex items-center gap-1 text-emerald-400 font-bold"><PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen</span>
                      </p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Choose a title and tap "Add" in the top right.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200">Launch Ursella from Home Screen</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">Runs in clean standalone app mode without Safari browser bars.</p>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'desktop' && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200">Look for the Install Icon in the URL Address Bar</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">In Chrome, Edge, or Brave, look at the right end of the address bar.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-200">Click "Install Ursella"</p>
                      <p className="text-zinc-400 text-[11px] mt-0.5">The app opens in a dedicated window with desktop shortcut.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Direct Try button if prompt available */}
            {deferredPrompt && (
              <button
                onClick={handleNativeInstall}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Launch Direct Install Prompt</span>
              </button>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Got it, Close Guide
            </button>
          </div>
        </div>
      )}
    </>
  );
};
