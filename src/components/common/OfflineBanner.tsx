import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      const timer = setTimeout(() => setWasOffline(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all duration-300 ${
        isOnline
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-600 text-zinc-950 shadow-lg'
      }`}
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Back online — Connected to Ursella Cloud</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Offline Mode — Cached application shell active. Financial write operations will sync once reconnected.</span>
            </>
          )}
        </div>
        {!isOnline && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-900 text-amber-200 rounded-md text-[11px] font-bold"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
};
