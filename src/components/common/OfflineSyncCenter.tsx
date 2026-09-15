import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Trash2,
  X,
  Layers,
  ArrowUpRight,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync.ts';
import { SyncQueueItem } from '../../services/offline-sync.service.ts';

interface OfflineSyncCenterProps {
  className?: string;
  showAlways?: boolean;
}

export const OfflineSyncIndicator: React.FC<OfflineSyncCenterProps> = ({
  className = '',
  showAlways = false,
}) => {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If online and zero pending, hide on mobile unless showAlways is requested
  const isPristine = isOnline && pendingCount === 0 && !isSyncing;

  if (isPristine && !showAlways) {
    return (
      <>
        {/* Discreet desktop-only status dot */}
        <button
          onClick={() => setIsModalOpen(true)}
          className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 hover:bg-emerald-950/70 transition-colors ${className}`}
          title="Ursella Offline Engine: Connected & In Sync"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>In Sync</span>
        </button>

        {isModalOpen && <OfflineSyncModal onClose={() => setIsModalOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
          !isOnline
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            : isSyncing
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            : pendingCount > 0
            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
        } ${className}`}
        title="View Offline Sync Queue"
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>
              Offline{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span>Syncing ({pendingCount})</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span>{pendingCount} queued</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Online</span>
          </>
        )}
      </button>

      {isModalOpen && <OfflineSyncModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

export const OfflineSyncModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isOnline, pendingCount, isSyncing, queue, syncNow, clearStaleQueue } = useOfflineSync();
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleManualSync = async () => {
    setSyncStatusMsg('Synchronizing queued transactions with cloud...');
    const res = await syncNow();
    if (res) {
      setSyncStatusMsg(
        `Sync completed: ${res.synced} processed, ${res.failed} retried, ${res.total} total.`
      );
    } else {
      setSyncStatusMsg('Ready.');
    }
  };

  const formatItemDescription = (item: SyncQueueItem): string => {
    switch (item.type) {
      case 'sale': {
        const total = item.payload?.payment_amount || item.payload?.total || 0;
        const itemCount = item.payload?.items?.length || 1;
        return `Sale ticket: ${itemCount} items (${typeof total === 'number' ? `$${total.toFixed(2)}` : total})`;
      }
      case 'customer':
        return `Customer creation: ${item.payload?.full_name || 'New Client'}`;
      case 'expense':
        return `Expense record: ${item.payload?.category || 'General'} ($${item.payload?.amount || 0})`;
      case 'debt_payment':
        return `Debt payment received: $${item.payload?.amount || 0}`;
      case 'inventory_movement':
        return `Stock adjustment: ${item.payload?.transaction_type || 'movement'}`;
      default:
        return `${item.type.replace('_', ' ')} record`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                !isOnline
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {!isOnline ? <WifiOff className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Offline Queue &amp; Sync Engine
              </h3>
              <p className="text-xs text-zinc-400">
                {isOnline ? 'Connected to cloud services' : 'Operating in offline local cache'}
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

        {/* Real-time Status Card */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Network Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-sm font-bold text-white">
                {isOnline ? 'Online (Connected)' : 'Offline (Local)'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Pending Queue
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                {pendingCount} {pendingCount === 1 ? 'transaction' : 'transactions'}
              </span>
            </div>
          </div>
        </div>

        {/* Offline Resilience Guarantee */}
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 mb-4 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Zero Data Loss Guarantee:</strong> Point-of-Sale checkouts, inventory stock deductions, and customer debt records continue uninterrupted while offline. As soon as connectivity returns, items sync automatically.
          </p>
        </div>

        {/* Queue List */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold mb-1">
            <span>Queued Actions</span>
            {pendingCount > 0 && (
              <span className="text-[11px] text-zinc-500">
                Sorted by creation timestamp
              </span>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-zinc-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-zinc-200">Everything is in sync</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                No pending transactions in local storage.
              </p>
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase bg-zinc-800 text-zinc-200 border border-zinc-700">
                      {item.type}
                    </span>
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                    {item.retryCount > 0 && (
                      <span className="text-[10px] text-amber-400">
                        Retry #{item.retryCount}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-200 font-medium truncate">
                    {formatItemDescription(item)}
                  </p>
                  {item.lastError && (
                    <p className="text-[10px] text-rose-400 truncate mt-0.5">
                      Note: {item.lastError}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                    Queued
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {syncStatusMsg && (
          <p className="text-xs text-zinc-400 mb-3 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
            {syncStatusMsg}
          </p>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
          {pendingCount > 0 ? (
            <button
              onClick={clearStaleQueue}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Clear failed queue items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Queue</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
