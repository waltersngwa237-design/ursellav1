import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  EyeOff,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { BusinessInsight, ActionType } from '../../types/proactive.ts';

interface InsightCardProps {
  insight: BusinessInsight;
  onTakeAction: (insight: BusinessInsight) => void;
  onDismiss: (insightId: string) => void;
  compact?: boolean;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  onTakeAction,
  onDismiss,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getSeverityBadge = () => {
    switch (insight.severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Critical Risk
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900/50">
            <Info className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            Medium
          </span>
        );
      case 'informational':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Opportunity
          </span>
        );
    }
  };

  const getCategoryIcon = () => {
    switch (insight.category) {
      case 'sales':
        return <TrendingDown className="w-4 h-4 text-indigo-500" />;
      case 'inventory':
        return <Package className="w-4 h-4 text-amber-500" />;
      case 'customers':
        return <Users className="w-4 h-4 text-sky-500" />;
      case 'expenses':
        return <DollarSign className="w-4 h-4 text-rose-500" />;
      case 'opportunities':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  const getActionLabel = (actionType?: ActionType | null) => {
    switch (actionType) {
      case 'create_restock_task':
        return 'Restock Item';
      case 'send_customer_message':
        return 'Follow Up';
      case 'create_reminder':
        return 'Set Reminder';
      case 'create_inventory_adjustment':
        return 'Adjust Stock';
      case 'record_payment':
        return 'Record Payment';
      case 'create_expense':
        return 'Log Expense';
      default:
        return 'Review';
    }
  };

  return (
    <div
      id={`insight-card-${insight.id}`}
      className={`rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 shadow-sm hover:shadow-md ${
        insight.severity === 'critical'
          ? 'border-rose-200 dark:border-rose-900/40 bg-gradient-to-r from-rose-50/20 to-transparent'
          : insight.severity === 'high'
          ? 'border-amber-200 dark:border-amber-900/40 bg-gradient-to-r from-amber-50/20 to-transparent'
          : 'border-slate-200 dark:border-slate-800'
      } ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            {getCategoryIcon()}
          </div>
          {getSeverityBadge()}
          <span className="text-[11px] font-medium text-slate-400 capitalize">
            {insight.category}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            {insight.confidence} confidence
          </span>
          {insight.status === 'acted_on' && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Acted on
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mt-3">
        <h4 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
          {insight.title}
        </h4>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {insight.summary}
        </p>
      </div>

      {/* Expandable Explanation Details */}
      {insight.explanation && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Hide explanation
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> What happened & why it matters
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-2.5 animate-fadeIn">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
                  WHAT HAPPENED:
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-normal">
                  {insight.explanation.whatHappened}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
                  WHY IT MATTERS:
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-normal">
                  {insight.explanation.whyItMatters}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-0.5">
                  WHAT YOU CAN DO:
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-normal">
                  {insight.explanation.whatYouCanDo}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer / Action System */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onDismiss(insight.id)}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Dismiss
        </button>

        {insight.action_type ? (
          <button
            type="button"
            id={`btn-act-${insight.id}`}
            onClick={() => onTakeAction(insight)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all active:scale-95"
          >
            {getActionLabel(insight.action_type)}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="text-xs text-slate-400">Informational signal</span>
        )}
      </div>
    </div>
  );
};
