import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, CloudUpload, CheckCircle2, X } from 'lucide-react';
import { OfflineSyncService } from '../../services/offline-sync.service.ts';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const feedbackTimerRef = useRef<any>(null);

  // Subscribe to queue changes and sync on mount if online
  useEffect(() => {
    // Check initial queue count
    const initialCount = OfflineSyncService.getPendingCount();
    setPendingCount(initialCount);

    if (navigator.onLine && initialCount > 0) {
      setIsSyncing(true);
      OfflineSyncService.processQueue().then((res) => {
        setIsSyncing(false);
        if (res.synced > 0) {
          setSyncFeedback(`Successfully synced ${res.synced} offline record${res.synced > 1 ? 's' : ''}!`);
          if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = setTimeout(() => {
            setSyncFeedback(null);
          }, 2500);
        }
      }).catch(() => {
        setIsSyncing(false);
      });
    }

    const handleOnline = () => {
      setIsOnline(true);
      setIsDismissed(false);
      // Auto-trigger sync when returning online
      OfflineSyncService.processQueue().then((res) => {
        if (res.synced > 0) {
          setSyncFeedback(`All offline records synchronized!`);
          if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = setTimeout(() => {
            setSyncFeedback(null);
          }, 2500);
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false);
      setSyncFeedback(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to pending queue changes
    const unsubscribe = OfflineSyncService.subscribe((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
      // If queue emptied and we were syncing, show brief success then disappear
      if (count === 0 && !syncing && initialCount > 0) {
        setSyncFeedback('All offline records synchronized!');
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
          setSyncFeedback(null);
        }, 2500);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      unsubscribe();
    };
  }, []);

  // Update layout CSS variable
  const shouldShow = (!isOnline || (isOnline && pendingCount > 0) || !!syncFeedback) && !isDismissed;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty(
        '--offline-banner-height',
        shouldShow ? '36px' : '0px'
      );
    }
  }, [shouldShow]);

  const handleManualSync = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      const res = await OfflineSyncService.processQueue();
      if (res.synced > 0) {
        setSyncFeedback(`Synced ${res.synced} record${res.synced > 1 ? 's' : ''}`);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setSyncFeedback(null), 2500);
      } else if (res.total === 0 || OfflineSyncService.getPendingCount() === 0) {
        setSyncFeedback('All records are up to date');
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setSyncFeedback(null), 2000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // If online, no pending records, and no temporary feedback, banner DISAPPEARS completely!
  if (!shouldShow) return null;

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
      style={{
        paddingTop: 'max(0.5rem, calc(0.35rem + env(safe-area-inset-top, 0px)))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
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
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-100" />
              <span>{syncFeedback}</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <CloudUpload className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>
                Back online — {pendingCount} offline record{pendingCount > 1 ? 's' : ''} ready to sync.
              </span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 shrink-0" />
              <span>Connected to Ursella Cloud — Synchronized.</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOnline && pendingCount > 0 && (
            <button
              id="btn_banner_sync_now"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-md text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95"
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

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded hover:bg-black/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

