import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Sliders,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingDown,
  Package,
  Users,
  DollarSign,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { ProactiveService } from '../../services/proactive.service.ts';
import type {
  BusinessInsight,
  DailyPriorityItem,
  ActionAuditLog,
  BusinessReminder,
} from '../../types/proactive.ts';
import { InsightCard } from './InsightCard.tsx';
import { ActionPreviewModal } from './ActionPreviewModal.tsx';
import { PrioritiesBanner } from './PrioritiesBanner.tsx';
import { RemindersListModal } from '../reminders/RemindersListModal.tsx';
import { NotificationPreferencesModal } from './NotificationPreferencesModal.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';

export const InsightsView: React.FC = () => {
  const { user } = useAuth();
  const { activeBusiness, activeRole } = useBusiness();
  const currentBusiness = activeBusiness;
  const currentRole = activeRole;

  const [activeTab, setActiveTab] = useState<'insights' | 'audit'>('insights');
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [priorities, setPriorities] = useState<DailyPriorityItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActionAuditLog[]>([]);
  const [reminders, setReminders] = useState<BusinessReminder[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [scanning, setScanning] = useState(false);
  const [selectedInsightForAction, setSelectedInsightForAction] = useState<BusinessInsight | null>(null);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async (forceScan = false) => {
    if (!currentBusiness) return;
    setScanning(true);

    try {
      let fetchedInsights: BusinessInsight[] = [];
      if (forceScan) {
        fetchedInsights = await ProactiveService.scanBusinessInsights(currentBusiness.id);
      } else {
        fetchedInsights = await ProactiveService.getInsights(currentBusiness.id);
        if (fetchedInsights.length === 0) {
          fetchedInsights = await ProactiveService.scanBusinessInsights(currentBusiness.id);
        }
      }

      const [prio, logs, rems] = await Promise.all([
        ProactiveService.getDailyPriorities(currentBusiness.id),
        ProactiveService.getAuditLogs(currentBusiness.id),
        ProactiveService.getReminders(currentBusiness.id),
      ]);

      setInsights(fetchedInsights);
      setPriorities(prio);
      setAuditLogs(logs);
      setReminders(rems);
    } catch (err) {
      console.error('[InsightsView] Error loading data:', err);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [currentBusiness]);

  const handleDismiss = async (id: string) => {
    if (!currentBusiness) return;
    await ProactiveService.updateInsightStatus(currentBusiness.id, id, 'dismissed');
    setInsights((prev) => prev.filter((i) => i.id !== id));
    showToast('Insight dismissed');
  };

  const handleActionExecuted = (result: any) => {
    showToast('Action executed successfully & logged to audit trail');
    loadData(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredInsights = insights.filter((ins) => {
    if (categoryFilter !== 'all' && ins.category !== categoryFilter) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && (ins.status === 'dismissed' || ins.status === 'acted_on')) return false;
      if (statusFilter === 'acted_on' && ins.status !== 'acted_on') return false;
      if (statusFilter === 'dismissed' && ins.status !== 'dismissed') return false;
    } else {
      // By default in "all", hide dismissed unless explicitly requested
      if (ins.status === 'dismissed') return false;
    }
    return true;
  });

  return (
    <div id="proactive-insights-view" className="space-y-6 animate-fadeIn pb-12">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Proactive Business Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Automated detection of revenue drops, stockouts, debts & operational opportunities
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowRemindersModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all inline-flex items-center gap-1.5 shadow-sm"
          >
            <Calendar className="w-4 h-4 text-indigo-500" />
            Tasks & Reminders
            {reminders.filter((r) => r.status === 'pending').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                {reminders.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowPreferencesModal(true)}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-sm"
            title="Notification & Alert Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={scanning}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Signals'}
          </button>
        </div>
      </div>

      {/* Daily Priorities Banner */}
      <PrioritiesBanner
        priorities={priorities}
        onSelectPriority={(prio) => {
          const matchingInsight = insights.find((i) => i.id === prio.id.replace('prio_', ''));
          if (matchingInsight) {
            setSelectedInsightForAction(matchingInsight);
          } else {
            setSelectedInsightForAction({
              id: prio.id,
              business_id: currentBusiness?.id || '',
              event_type: 'sales_spike',
              category: prio.category,
              severity: prio.severity,
              confidence: 'high',
              title: prio.title,
              summary: prio.reason,
              data: {},
              detected_at: new Date().toISOString(),
              status: 'new',
              action_type: prio.actionType,
              action_payload: prio.actionPayload,
              source: 'deterministic_engine',
              dedup_key: prio.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }}
      />

      {/* Main Tabs (Insights vs Audit Trail) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${
              activeTab === 'insights'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Active Insights ({filteredInsights.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Execution Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Insights Tab Content */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          {/* Category & Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-850/40 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Signals' },
                { id: 'sales', label: 'Sales' },
                { id: 'inventory', label: 'Inventory' },
                { id: 'customers', label: 'Customers' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'opportunities', label: 'Growth' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                    categoryFilter === c.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <option value="all">Active Insights</option>
                <option value="acted_on">Acted On</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {/* Insights Grid */}
          {filteredInsights.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No active anomalies or risks detected
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your business operations are running smoothly without any urgent inventory, debtor, or cash flow flags.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInsights.map((ins) => (
                <InsightCard
                  key={ins.id}
                  insight={ins}
                  onTakeAction={(insight) => setSelectedInsightForAction(insight)}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Trail Tab Content */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Immutable Action & Modification Log
              </h3>
              <span className="text-[11px] text-slate-400">
                All human-confirmed AI actions and operational adjustments
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No actions executed yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            log.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white capitalize">
                          {log.action_type.replace(/_/g, ' ')}
                        </span>
                        {log.is_ai_proposed && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                            AI Proposed
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {log.changes?.result?.message || JSON.stringify(log.changes?.payload || {})}
                      </p>
                      <div className="text-[10px] text-slate-400">
                        Actor Role: <strong className="text-slate-600 dark:text-slate-300 capitalize">{log.actor_role}</strong>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Preview & Confirmation Modal */}
      {selectedInsightForAction && (
        <ActionPreviewModal
          insight={selectedInsightForAction}
          onClose={() => setSelectedInsightForAction(null)}
          onExecuted={handleActionExecuted}
        />
      )}

      {/* Reminders & Tasks Modal */}
      <RemindersListModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
        reminders={reminders}
        onRefresh={() => loadData(false)}
      />

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </div>
  );
};
