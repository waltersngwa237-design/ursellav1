import { useState, useEffect, useCallback } from 'react';
import { OfflineSyncService, SyncQueueItem } from '../services/offline-sync.service.ts';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(() => OfflineSyncService.getPendingCount());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queue, setQueue] = useState<SyncQueueItem[]>(() => OfflineSyncService.getQueue());
  const [lastSyncResult, setLastSyncResult] = useState<{ total: number; synced: number; failed: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      refresh();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refresh();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to OfflineSyncService updates
    const unsubscribe = OfflineSyncService.subscribe((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
      setQueue(OfflineSyncService.getQueue());
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(() => {
    setPendingCount(OfflineSyncService.getPendingCount());
    setQueue(OfflineSyncService.getQueue());
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return null;
    try {
      setIsSyncing(true);
      const result = await OfflineSyncService.processQueue();
      setLastSyncResult(result);
      refresh();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refresh]);

  const clearStaleQueue = useCallback(() => {
    OfflineSyncService.clearStaleQueue();
    refresh();
  }, [refresh]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    queue,
    lastSyncResult,
    syncNow,
    clearStaleQueue,
    refresh,
  };
}
