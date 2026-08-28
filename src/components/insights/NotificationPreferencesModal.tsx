import React, { useState, useEffect } from 'react';
import { X, Sliders, Bell, Moon, Check, Save } from 'lucide-react';
import type { NotificationPreferences, InsightCategory } from '../../types/proactive.ts';
import { ProactiveService } from '../../services/proactive.service.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeBusiness } = useBusiness();
  const currentBusiness = activeBusiness;
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    enabledCategories: ['sales', 'inventory', 'customers', 'expenses', 'opportunities', 'health'],
    minSeverity: 'low',
    dailyBriefEnabled: true,
    dailyBriefTime: '08:00',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentBusiness) {
      ProactiveService.getPreferences(currentBusiness.id).then((p) => {
        if (p) setPrefs(p);
      });
    }
  }, [isOpen, currentBusiness]);

  if (!isOpen) return null;

  const toggleCategory = (cat: InsightCategory) => {
    setPrefs((prev) => {
      const exists = prev.enabledCategories.includes(cat);
      const enabledCategories: InsightCategory[] = exists
        ? prev.enabledCategories.filter((c) => c !== cat)
        : [...prev.enabledCategories, cat];
      return { ...prev, enabledCategories };
    });
  };

  const handleSave = async () => {
    if (!currentBusiness) return;
    setLoading(true);
    await ProactiveService.savePreferences(currentBusiness.id, prefs);
    setLoading(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        id="notification-preferences-modal"
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Intelligence & Alert Settings
              </h3>
              <p className="text-xs text-slate-400">
                Customize proactive triggers & notification delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Categories */}
          <div>
            <label className="font-bold text-slate-900 dark:text-white block mb-2">
              Monitored Business Domains
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'sales', label: 'Sales & Revenue' },
                  { id: 'inventory', label: 'Inventory & Stock' },
                  { id: 'customers', label: 'Customer Receivables' },
                  { id: 'expenses', label: 'Expenses & Leaks' },
                  { id: 'opportunities', label: 'Growth Opportunities' },
                  { id: 'health', label: 'Business Health' },
                ] as { id: InsightCategory; label: string }[]
              ).map((cat) => {
                const checked = prefs.enabledCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      checked
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-60'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity Threshold */}
          <div>
            <label className="font-bold text-slate-900 dark:text-white block mb-1">
              Minimum Alert Priority
            </label>
            <select
              value={prefs.minSeverity}
              onChange={(e) => setPrefs({ ...prefs, minSeverity: e.target.value as any })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="low">Low & Above (All actionable signals)</option>
              <option value="medium">Medium & Above (Standard alerts)</option>
              <option value="high">High & Critical Only (Urgent risks)</option>
            </select>
          </div>

          {/* Daily Brief */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Morning Executive Brief
              </span>
              <span className="text-[11px] text-slate-500">
                Daily synthesis of yesterday's sales & today's key priorities
              </span>
            </div>
            <input
              type="checkbox"
              checked={prefs.dailyBriefEnabled}
              onChange={(e) => setPrefs({ ...prefs, dailyBriefEnabled: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl inline-flex items-center gap-1.5 shadow-sm"
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
