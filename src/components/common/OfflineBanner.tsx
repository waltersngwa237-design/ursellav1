import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, CloudUpload, CheckCircle2 } from 'lucide-react';
import { OfflineSyncService } from '../../services/offline-sync.service.ts';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Auto-trigger sync when returning online
      OfflineSyncService.processQueue().then((res) => {
        if (res.synced > 0) {
          setSyncFeedback(`Successfully synced ${res.synced} offline records!`);
          setTimeout(() => setSyncFeedback(null), 5000);
        }
      });
      const timer = setTimeout(() => setWasOffline(false), 5000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to pending queue changes
    const unsubscribe = OfflineSyncService.subscribe((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) return;
    const res = await OfflineSyncService.processQueue();
    if (res.synced > 0) {
      setSyncFeedback(`Synced ${res.synced} offline records`);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  if (isOnline && !wasOffline && pendingCount === 0 && !syncFeedback) return null;

  return (
    <div
      id="app_offline_status_banner"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-xs font-semibold flex items-center justify-between transition-all duration-300 shadow-md ${
        !isOnline
          ? 'bg-amber-600 text-zinc-950'
          : syncFeedback
          ? 'bg-emerald-600 text-white'
          : pendingCount > 0
          ? 'bg-sky-700 text-white'
          : 'bg-emerald-600 text-white'
      }`}
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2.5">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-zinc-950 shrink-0" />
              <span>
                <strong>Offline Mode:</strong> Full POS, inventory deductions, & receipts remain active.
                {pendingCount > 0 && ` (${pendingCount} pending cloud sync)`}
              </span>
            </>
          ) : syncFeedback ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncFeedback}</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <CloudUpload className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>
                Back online — {pendingCount} offline transaction{pendingCount > 1 ? 's' : ''} ready to sync.
              </span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 shrink-0" />
              <span>Connected to Ursella Cloud — All offline transactions synchronized.</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOnline && pendingCount > 0 && (
            <button
              id="btn_banner_sync_now"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-md text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}

          {!isOnline && (
            <span className="px-2 py-0.5 bg-zinc-950/20 text-zinc-950 rounded text-[10px] uppercase font-black tracking-wider">
              Local Storage Ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

