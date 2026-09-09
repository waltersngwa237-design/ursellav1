import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Trash2,
  Check,
  Smartphone,
  Send,
} from 'lucide-react';
import type { AppNotification } from '../../types/proactive.ts';
import { PushClientService, type PushStatus } from '../../services/push-notification.service.ts';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onSelectNotification?: (notif: AppNotification) => void;
  onDeleteNotification?: (id: string) => void;
  onClearAll?: () => void;
  onToggleRead?: (id: string, e: React.MouseEvent) => void;
  businessId?: string;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onSelectNotification,
  onDeleteNotification,
  onClearAll,
  onToggleRead,
  businessId,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      PushClientService.getStatus(businessId).then(setPushStatus);
    }
  }, [isOpen, businessId]);

  const handleTogglePush = async () => {
    if (!businessId) return;
    setPushLoading(true);
    setPushFeedback(null);

    if (pushStatus?.isSubscribed) {
      const res = await PushClientService.unsubscribe(businessId);
      if (res.success) {
        setPushFeedback('Out-of-app push disabled.');
      } else {
        setPushFeedback(res.error || 'Failed to unsubscribe');
      }
    } else {
      const res = await PushClientService.subscribe(businessId);
      if (res.success) {
        setPushFeedback('Out-of-app push notifications active!');
      } else {
        setPushFeedback(res.error || 'Failed to enable push');
      }
    }

    const updated = await PushClientService.getStatus(businessId);
    setPushStatus(updated);
    setPushLoading(false);
  };

  const handleSendTestPush = async () => {
    if (!businessId) return;
    setPushLoading(true);
    setPushFeedback(null);
    const res = await PushClientService.sendTestNotification(businessId);
    if (res.success) {
      setPushFeedback('Test push sent to your device!');
    } else {
      setPushFeedback(res.error || 'Failed to send test push');
    }
    setPushLoading(false);
  };

  const onCloseRef = React.useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.priority === 'critical' || n.priority === 'high';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'informational':
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-sky-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div
        id="notification-drawer"
        className="w-full max-w-md bg-zinc-900 text-zinc-100 h-full shadow-2xl border-l border-zinc-800 flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div 
          className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between"
          style={{
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Notifications
              </h3>
              <p className="text-xs text-zinc-400">
                {unreadCount} unread business alert{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="p-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg inline-flex items-center gap-1 font-medium transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills & Actions */}
        <div className="px-4 py-2.5 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex gap-1.5 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors text-xs whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors text-xs whitespace-nowrap ${
                filter === 'unread'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('critical')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors text-xs whitespace-nowrap ${
                filter === 'critical'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              High Priority
            </button>
          </div>

          {notifications.length > 0 && onClearAll && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-zinc-400 hover:text-rose-400 whitespace-nowrap font-medium transition-colors"
              title="Clear all notifications"
            >
              Clear
            </button>
          )}
        </div>

        {/* Clear Confirmation Banner */}
        {showClearConfirm && (
          <div className="p-3 bg-rose-950/60 border-b border-rose-900 flex items-center justify-between gap-2 text-xs text-rose-200">
            <span>Clear all notifications?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClearAll?.();
                  setShowClearConfirm(false);
                }}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Yes, Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Notification List */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-2.5"
          style={{
            paddingBottom: 'max(1.25rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))',
          }}
        >
          {/* Out-of-App Push Notification Card */}
          <div className="p-3 rounded-xl bg-zinc-800/70 border border-zinc-700/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Out-of-App Notifications
                </span>
              </div>
              <button
                type="button"
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  pushStatus?.isSubscribed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {pushLoading ? 'Updating...' : pushStatus?.isSubscribed ? 'Active' : 'Enable Push'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Receive morning briefing and critical stock alerts on your device lockscreen even when Ursella is closed.
            </p>
            {pushFeedback && (
              <p className="text-[11px] text-indigo-300 font-medium">
                {pushFeedback}
              </p>
            )}
            {pushStatus?.isSubscribed && (
              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={pushLoading}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-300 hover:text-white bg-zinc-700/60 hover:bg-zinc-700 transition-colors"
                >
                  <Send className="w-3 h-3 text-indigo-400" />
                  <span>Send Test Push</span>
                </button>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 text-xs space-y-2">
              <Bell className="w-8 h-8 mx-auto text-zinc-600 opacity-60" />
              <p>No notifications matching current filter.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectNotification && onSelectNotification(item)}
                className={`group p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  item.is_read
                    ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    : 'bg-emerald-950/20 border-emerald-500/30 shadow-sm hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{getPriorityIcon(item.priority)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className={`text-xs font-semibold ${item.is_read ? 'text-zinc-300' : 'text-white'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>

                    {/* Quick Item Actions */}
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                        {item.category}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {onToggleRead && (
                          <button
                            type="button"
                            onClick={(e) => onToggleRead(item.id, e)}
                            className="p-1 rounded text-zinc-400 hover:text-emerald-400 transition-colors"
                            title={item.is_read ? 'Mark unread' : 'Mark read'}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteNotification && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(item.id);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

