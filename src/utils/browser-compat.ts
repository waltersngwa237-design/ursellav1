/**
 * Universal Browser Compatibility Engine for Ursella
 * Ensures seamless operation across:
 * - Safari (iOS Safari 12-17+, macOS Safari)
 * - Chromium browsers (Google Chrome, Microsoft Edge, Opera, Brave, Vivaldi, Arc)
 * - Mozilla Firefox (Desktop & Mobile, Gecko engine)
 * - Samsung Internet & Android WebViews
 * - Private Browsing / Incognito mode (Safari QuotaExceeded / SecurityError mitigation)
 */

export function initBrowserCompatibility(): void {
  if (typeof window === 'undefined') return;

  // 1. Safe Storage Proxy (Protects against Safari Private Mode / Brave Shields / Sandboxed iframe exceptions)
  initSafeStorage();

  // 2. AudioContext Vendor Prefix Normalization
  try {
    if (!('AudioContext' in window) && 'webkitAudioContext' in window) {
      (window as any).AudioContext = (window as any).webkitAudioContext;
    }
  } catch {}

  // 3. Viewport 100vh normalization for Mobile Safari & Chrome Address Bar
  initViewportHeight();

  // 4. RequestAnimationFrame fallback
  try {
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (callback: FrameRequestCallback) => {
        return window.setTimeout(() => callback(Date.now()), 1000 / 60);
      };
      window.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }
  } catch {}

  // 5. Global Error Interceptor for browser-specific benign warnings
  window.addEventListener('error', (event) => {
    // Suppress benign resize observer loop errors common in Safari & Firefox
    if (
      event.message?.includes('ResizeObserver loop completed with undelivered notifications') ||
      event.message?.includes('ResizeObserver loop limit exceeded')
    ) {
      event.stopImmediatePropagation();
    }
  });

  console.log('[Ursella] Universal browser compatibility layer active.');
}

/**
 * Ensures localStorage and sessionStorage do not crash in Safari Private Browsing
 * or when cookies/third-party storage are blocked by browser privacy settings.
 */
function initSafeStorage(): void {
  const testKey = '__ursella_compat_test__';
  let localStorageAvailable = false;
  let sessionStorageAvailable = false;

  try {
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }

  try {
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    sessionStorageAvailable = true;
  } catch {
    sessionStorageAvailable = false;
  }

  if (!localStorageAvailable) {
    console.warn('[Ursella Compat] Native localStorage is restricted. Initializing resilient in-memory storage fallback.');
    const memory = new Map<string, string>();
    const polyfill: Storage = {
      get length() {
        return memory.size;
      },
      clear: () => {
        memory.clear();
      },
      getItem: (key: string) => memory.get(key) ?? null,
      key: (index: number) => Array.from(memory.keys())[index] ?? null,
      removeItem: (key: string) => {
        memory.delete(key);
      },
      setItem: (key: string, value: string) => {
        memory.set(key, String(value));
      },
    };

    try {
      Object.defineProperty(window, 'localStorage', {
        value: polyfill,
        configurable: true,
        writable: true,
      });
    } catch {
      // Patch Storage prototype if property is not configurable
      try {
        const proto = Storage.prototype;
        const origGet = proto.getItem;
        const origSet = proto.setItem;
        const origRemove = proto.removeItem;
        const origClear = proto.clear;

        proto.getItem = function (k: string) {
          try {
            return origGet.call(this, k);
          } catch {
            return memory.get(k) ?? null;
          }
        };

        proto.setItem = function (k: string, v: string) {
          try {
            origSet.call(this, k, v);
          } catch {
            memory.set(k, String(v));
          }
        };

        proto.removeItem = function (k: string) {
          try {
            origRemove.call(this, k);
          } catch {
            memory.delete(k);
          }
        };

        proto.clear = function () {
          try {
            origClear.call(this);
          } catch {
            memory.clear();
          }
        };
      } catch {}
    }
  }

  if (!sessionStorageAvailable) {
    const memory = new Map<string, string>();
    const polyfill: Storage = {
      get length() {
        return memory.size;
      },
      clear: () => {
        memory.clear();
      },
      getItem: (key: string) => memory.get(key) ?? null,
      key: (index: number) => Array.from(memory.keys())[index] ?? null,
      removeItem: (key: string) => {
        memory.delete(key);
      },
      setItem: (key: string, value: string) => {
        memory.set(key, String(value));
      },
    };

    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: polyfill,
        configurable: true,
        writable: true,
      });
    } catch {}
  }
}

/**
 * Mobile Safari / Android Chrome Dynamic Viewport Height fix
 * Calculates exact innerHeight to avoid layout jumping when address bar expands/contracts.
 */
function initViewportHeight(): void {
  const updateVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  updateVh();
  window.addEventListener('resize', updateVh, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(updateVh, 100);
  }, { passive: true });
}
