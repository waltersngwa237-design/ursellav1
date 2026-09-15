import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PWAUserPlatform = 'ios' | 'android' | 'desktop-chrome' | 'desktop-safari' | 'desktop-other';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [platform, setPlatform] = useState<PWAUserPlatform>('desktop-other');
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already running installed)
    const isAppStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isAppStandalone);

    // Platform detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    const isChrome = /chrome|chromium|crios/i.test(userAgent) && !/edge|edg/i.test(userAgent);
    const isSafari = /safari/i.test(userAgent) && !/chrome|chromium/i.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    if (isIOSDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else if (isChrome) {
      setPlatform('desktop-chrome');
    } else if (isSafari) {
      setPlatform('desktop-safari');
    } else {
      setPlatform('desktop-other');
    }

    // Listen to beforeinstallprompt event (Chromium, Android, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.setItem('ursella_pwa_installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for Service Worker update broadcast
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
          setHasUpdate(true);
        }
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
          setIsInstallable(false);
          setDeferredPrompt(null);
        }
        return choice.outcome;
      } catch (err) {
        console.warn('[usePWAInstall] prompt error:', err);
        return 'manual';
      }
    }
    return 'manual';
  }, [deferredPrompt]);

  const applyAppUpdate = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }, []);

  return {
    isStandalone,
    isInstallable,
    isIOS,
    isAndroid,
    platform,
    hasUpdate,
    promptInstall,
    applyAppUpdate,
  };
}
