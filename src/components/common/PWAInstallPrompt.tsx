import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if user hasn't dismissed recently
      const dismissed = localStorage.getItem('ursella_pwa_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('ursella_pwa_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-sm w-full bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl shadow-emerald-950/40 text-zinc-100 flex items-start gap-3">
      <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
        <Smartphone className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
          Install Ursella PWA
        </h4>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
          Install on your home screen for instant full-screen POS, offline caching, and faster load times.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
          <button
            onClick={handleDismiss}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-medium"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-zinc-500 hover:text-zinc-300 p-1"
        aria-label="Close install prompt"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
