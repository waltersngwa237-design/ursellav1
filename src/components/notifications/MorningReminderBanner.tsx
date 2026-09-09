import React, { useState, useEffect } from 'react';
import { Bell, X, ArrowRight, Sun, Sparkles } from 'lucide-react';
import type { AppNotification } from '../../types/proactive.ts';

interface MorningReminderBannerProps {
  businessId: string;
  businessName: string;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
}

export const MorningReminderBanner: React.FC<MorningReminderBannerProps> = ({
  businessId,
  businessName,
  notifications,
  onOpenNotifications,
}) => {
  const [showReminder, setShowReminder] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!businessId) return;

    const now = new Date();
    const currentHour = now.getHours();
    const todayStr = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const storageKey = `ursella_morning_reminder_date_${businessId}`;

    // Condition 1: Check if already shown/dismissed today (Strict once a day)
    const lastShown = localStorage.getItem(storageKey);
    if (lastShown === todayStr) {
      setShowReminder(false);
      return;
    }

    // Condition 2: Check if currently morning (before 12:00 PM)
    const isMorning = currentHour < 12;
    if (!isMorning) {
      setShowReminder(false);
      return;
    }

    // Condition 3: Check if there are active unread notifications or alerts
    const unread = notifications.filter((n) => !n.is_read).length;
    setUnreadCount(unread);

    if (unread > 0) {
      setShowReminder(true);
    } else {
      setShowReminder(false);
    }
  }, [businessId, notifications]);

  const handleDismiss = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(`ursella_morning_reminder_date_${businessId}`, todayStr);
    setShowReminder(false);
  };

  const handleReview = () => {
    handleDismiss();
    onOpenNotifications();
  };

  if (!showReminder) return null;

  return (
    <div className="relative mx-3 sm:mx-4 md:mx-6 mb-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-zinc-900/90 to-indigo-950/40 border border-amber-500/30 p-3.5 sm:p-4 text-zinc-100 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
            <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                Morning Alert Briefing
              </span>
              <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">
                Once a day summary
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white mt-1">
              Good morning! You have{' '}
              <span className="text-amber-400 font-bold">{unreadCount}</span> unread business{' '}
              {unreadCount === 1 ? 'alert' : 'alerts'} for {businessName}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Dismiss today's morning reminder"
            aria-label="Dismiss today's morning reminder"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
