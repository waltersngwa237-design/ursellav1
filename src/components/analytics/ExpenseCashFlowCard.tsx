import React from 'react';
import { DollarSign, ArrowDownRight, ArrowUpRight, PieChart, Info } from 'lucide-react';
import type { CompleteBusinessAnalytics, CurrencyConfig } from '../../types/index.ts';

interface ExpenseCashFlowCardProps {
  analytics: CompleteBusinessAnalytics;
  currencyConfig: CurrencyConfig;
}

export const ExpenseCashFlowCard: React.FC<ExpenseCashFlowCardProps> = ({
  analytics,
  currencyConfig,
}) => {
  const { expenseAnalytics, cashFlow, financialOverview } = analytics;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. Expense Distribution */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-rose-400" />
              Operating Expenses Breakdown
            </h3>
            <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
              {currencyConfig.format(expenseAnalytics.totalExpenses)}
            </span>
          </div>

          <p className="text-xs text-zinc-400 mb-4">
            Operating expenses represent{' '}
            <strong className="text-zinc-200">{expenseAnalytics.expenseToRevenueRatio}%</strong> of
            period revenue.
          </p>

          {expenseAnalytics.categories.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-6 text-center">
              No operating expenses recorded in this period.
            </p>
          ) : (
            <div className="space-y-3">
              {expenseAnalytics.categories.map((cat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-300">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{currencyConfig.format(cat.amount)}</span>
                      <span className="text-zinc-500 text-[11px]">({cat.percentageOfTotalExpenses}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, cat.percentageOfTotalExpenses)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses Footer */}
        {expenseAnalytics.recentExpenses.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-800/80">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Recent Expense Records
            </span>
            <div className="space-y-1.5">
              {expenseAnalytics.recentExpenses.slice(0, 3).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-zinc-950/40 border border-zinc-800/50"
                >
                  <span className="text-zinc-300 truncate max-w-[180px]">{e.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[10px]">{e.expense_date}</span>
                    <span className="font-bold text-rose-400">{currencyConfig.format(e.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Cash Flow & Accrual Reconciliation */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Cash Flow & Reconciliation
            </h3>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                cashFlow.netCashFlow >= 0
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              }`}
            >
              Net Flow: {currencyConfig.format(cashFlow.netCashFlow)}
            </span>
          </div>

          <p className="text-xs text-zinc-400 mb-4">
            Distinguishing earned revenue from actual cash inflows and disbursements.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <ArrowDownRight className="w-4 h-4" />
                Cash Collected (Inflows)
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {currencyConfig.format(cashFlow.cashInflows)}
              </div>
              <span className="text-[10px] text-zinc-500">Payments deposited</span>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                <ArrowUpRight className="w-4 h-4" />
                Expenses Paid (Outflows)
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {currencyConfig.format(cashFlow.cashOutflows)}
              </div>
              <span className="text-[10px] text-zinc-500">Operating payments</span>
            </div>
          </div>

          {/* Accrual vs Cash Callout */}
          <div className="p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-zinc-300">
              <span>Earned Sales Revenue (Accrual):</span>
              <strong className="text-white">
                {currencyConfig.format(financialOverview.revenue)}
              </strong>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span>Actual Cash Inflows Received:</span>
              <strong className="text-emerald-400">
                {currencyConfig.format(cashFlow.cashInflows)}
              </strong>
            </div>
            <div className="flex justify-between items-center text-zinc-300 pt-1 border-t border-zinc-800">
              <span>Uncollected Period Credit:</span>
              <strong className="text-amber-400">
                {currencyConfig.format(cashFlow.outstandingCreditAdded)}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[1.75]" />
          <span><em>Accounting Principle:</em> Revenue represents goods sold at invoice price; cash flow tracks liquid funds collected from transactions.</span>
        </div>
      </div>
    </div>
  );
};
