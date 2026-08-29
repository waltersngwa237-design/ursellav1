import React, { useEffect, useState, useCallback } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { AnalyticsService } from '../../services/analytics.service.ts';
import { CURRENCY_MAP, type CompleteBusinessAnalytics, type DateRangePreset, type AIBusinessContextPayload, type AppNavRoute } from '../../types/index.ts';
import { DateRangePicker } from '../../components/analytics/DateRangePicker.tsx';
import { MetricTrendCard } from '../../components/analytics/MetricTrendCard.tsx';
import { BusinessHealthCard } from '../../components/analytics/BusinessHealthCard.tsx';
import { RevenueTrendsChart } from '../../components/analytics/RevenueTrendsChart.tsx';
import { ProductPerformanceTable } from '../../components/analytics/ProductPerformanceTable.tsx';
import { CustomerIntelligenceCard } from '../../components/analytics/CustomerIntelligenceCard.tsx';
import { ExpenseCashFlowCard } from '../../components/analytics/ExpenseCashFlowCard.tsx';
import { AnomalyAlertBanner } from '../../components/analytics/AnomalyAlertBanner.tsx';
import { DataSufficiencyBadge } from '../../components/analytics/DataSufficiencyBadge.tsx';
import { AIContextModal } from '../../components/analytics/AIContextModal.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Card } from '../../components/common/Card.tsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.tsx';
import { DashboardSkeleton } from '../../components/common/Skeleton.tsx';
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Package,
  Users,
  PieChart,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Activity,
  Receipt,
  FileText,
} from 'lucide-react';

interface AnalyticsPageProps {
  onNavigate?: (route: AppNavRoute, prompt?: string) => void;
}

type AnalyticsTab = 'overview' | 'sales' | 'products' | 'customers' | 'expenses';

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate }) => {
  const { activeBusiness, currency, loading: businessLoading } = useBusiness();
  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF || CURRENCY_MAP.USD;

  const [activePreset, setActivePreset] = useState<DateRangePreset>('last_30_days');
  const [customStart, setCustomStart] = useState<string | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<string | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [analytics, setAnalytics] = useState<CompleteBusinessAnalytics | null>(null);
  const [aiPayload, setAiPayload] = useState<AIBusinessContextPayload | null>(null);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(
    async (isManual = false) => {
      if (!activeBusiness?.id) {
        if (!businessLoading) {
          setLoading(false);
        }
        return;
      }
      try {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const data = await AnalyticsService.getCompleteAnalytics(
          activeBusiness.id,
          activePreset,
          customStart,
          customEnd
        );
        setAnalytics(data);

        // Also fetch AI context payload for transparency modal
        const payload = await AnalyticsService.getAIBusinessContext(activeBusiness.id, 30);
        setAiPayload(payload);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to compute business analytics.';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeBusiness?.id, activePreset, customStart, customEnd, businessLoading]
  );

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleCustomRange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setActivePreset('custom');
  };

  if ((loading || businessLoading) && !analytics) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & DATE RANGE CONTROLS                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
              Business Intelligence & Analytics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Authoritative, deterministic financial intelligence for{' '}
            <span className="font-semibold text-zinc-200">{activeBusiness?.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {analytics?.dataSufficiency && (
            <DataSufficiencyBadge info={analytics.dataSufficiency} />
          )}

          {onNavigate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('ai', `Can you analyze my business performance for ${analytics?.window.label || 'this period'} and provide strategic advice?`)}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Ask Ursella
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiModal(true)}
            leftIcon={<FileText className="w-3.5 h-3.5 text-zinc-400" />}
            className="text-xs text-zinc-300"
          >
            Data Payload
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAnalytics(true)}
            isLoading={refreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            className="text-xs text-zinc-300"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <DateRangePicker
          activePreset={activePreset}
          onSelectPreset={setActivePreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={handleCustomRange}
          windowLabel={analytics?.window.label}
          priorLabel={analytics?.window.priorLabel}
        />
      </div>

      {error && (
        <ErrorAlert
          title="Could not calculate analytics"
          message={error}
          onRetry={() => loadAnalytics(true)}
        />
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Executive Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'sales'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Sales & Trajectory
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Product Performance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'customers'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Customer Intelligence
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-emerald-500 text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          Expenses & Cash Flow
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB CONTENT: EXECUTIVE OVERVIEW                                        */}
      {/* ========================================================================= */}
      {analytics && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Trend Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <MetricTrendCard
              title="Sales Revenue (Accrual)"
              comparison={analytics.comparison.revenue}
              currencyConfig={currencyConfig}
              icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
              tooltip="Total completed invoice value in selected period"
            />

            <MetricTrendCard
              title="Gross Profit"
              comparison={analytics.comparison.grossProfit}
              currencyConfig={currencyConfig}
              icon={<DollarSign className="w-4 h-4 text-cyan-400" />}
              tooltip="Revenue minus Cost of Goods Sold (using historical cost basis)"
            />

            <MetricTrendCard
              title="Operating Expenses"
              comparison={analytics.comparison.operatingExpenses}
              currencyConfig={currencyConfig}
              invertColors={true}
              icon={<PieChart className="w-4 h-4 text-rose-400" />}
              tooltip="Total operational expenses incurred in period"
            />

            <MetricTrendCard
              title="Estimated Net Profit"
              comparison={analytics.comparison.estimatedNetProfit}
              currencyConfig={currencyConfig}
              icon={<Activity className="w-4 h-4 text-amber-400" />}
              tooltip="Gross Profit minus Operating Expenses"
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <MetricTrendCard
              title="Cash Collected (Inflows)"
              comparison={analytics.comparison.amountCollected}
              currencyConfig={currencyConfig}
              icon={<Receipt className="w-4 h-4 text-purple-400" />}
              tooltip="Actual cash payments deposited in period"
            />

            <MetricTrendCard
              title="Transactions (Orders)"
              comparison={analytics.comparison.transactionCount}
              currencyConfig={currencyConfig}
              formatAsCurrency={false}
              icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
              tooltip="Completed sales volume"
            />

            <MetricTrendCard
              title="Average Order Value"
              comparison={analytics.comparison.averageOrderValue}
              currencyConfig={currencyConfig}
              icon={<DollarSign className="w-4 h-4 text-zinc-400" />}
              tooltip="Revenue divided by completed transactions"
            />
          </div>

          {/* Business Health Indicator & Anomalies */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BusinessHealthCard indicator={analytics.healthIndicator} />
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  Inventory Valuation & Risk
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Total Valuation at Cost:</span>
                    <strong className="text-white text-sm">
                      {currencyConfig.format(analytics.inventorySummary.totalValuation)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Active Product SKUs:</span>
                    <span className="text-zinc-200 font-semibold">
                      {analytics.inventorySummary.totalActiveSKUs}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Low Stock Items:</span>
                    <span
                      className={`font-semibold ${
                        analytics.inventorySummary.lowStockCount > 0
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {analytics.inventorySummary.lowStockCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Out of Stock Items:</span>
                    <span
                      className={`font-semibold ${
                        analytics.inventorySummary.outOfStockCount > 0
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {analytics.inventorySummary.outOfStockCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Outstanding Receivables card */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Receivables Summary
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Total Unpaid Debt:</span>
                    <strong className="text-rose-400 text-sm font-bold">
                      {currencyConfig.format(analytics.financialOverview.outstandingReceivables)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Debtor Customers:</span>
                    <span className="text-zinc-200 font-semibold">
                      {analytics.customerAnalytics.debtorCustomers}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Anomaly Alerts Banner */}
          <AnomalyAlertBanner anomalies={analytics.anomalies} />

          {/* Visual Trend Chart */}
          <RevenueTrendsChart data={analytics.timeSeries} currencyConfig={currencyConfig} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB CONTENT: SALES & TRAJECTORY                                        */}
      {/* ========================================================================= */}
      {analytics && activeTab === 'sales' && (
        <div className="space-y-6">
          <RevenueTrendsChart data={analytics.timeSeries} currencyConfig={currencyConfig} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-xs text-zinc-400">Gross Margin Rate</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {analytics.financialOverview.grossMargin.toFixed(1)}%
              </div>
              <span className="text-[11px] text-zinc-500">Gross profit / total revenue</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-xs text-zinc-400">Net Margin Rate</span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {analytics.financialOverview.netMargin.toFixed(1)}%
              </div>
              <span className="text-[11px] text-zinc-500">Net profit / total revenue</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-xs text-zinc-400">Total Units Sold</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {analytics.financialOverview.unitsSold} units
              </div>
              <span className="text-[11px] text-zinc-500">Across completed sales</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB CONTENT: PRODUCT PERFORMANCE                                       */}
      {/* ========================================================================= */}
      {analytics && activeTab === 'products' && (
        <div className="space-y-6">
          <ProductPerformanceTable
            products={analytics.topProducts}
            currencyConfig={currencyConfig}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB CONTENT: CUSTOMER INTELLIGENCE                                     */}
      {/* ========================================================================= */}
      {analytics && activeTab === 'customers' && (
        <div className="space-y-6">
          <CustomerIntelligenceCard
            metrics={analytics.customerAnalytics}
            currencyConfig={currencyConfig}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB CONTENT: EXPENSES & CASH FLOW                                      */}
      {/* ========================================================================= */}
      {analytics && activeTab === 'expenses' && (
        <div className="space-y-6">
          <ExpenseCashFlowCard analytics={analytics} currencyConfig={currencyConfig} />
        </div>
      )}

      {/* AI Context JSON Inspector Modal */}
      <AIContextModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        payload={aiPayload}
      />
    </div>
  );
};
