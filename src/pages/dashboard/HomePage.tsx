import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { AnalyticsService } from '../../services/analytics.service.ts';
import {
  CURRENCY_MAP,
  type CompleteBusinessAnalytics,
  type DateRangePreset,
  type AppNavRoute,
} from '../../types/index.ts';
import { MetricTrendCard } from '../../components/analytics/MetricTrendCard.tsx';
import { BusinessHealthCard } from '../../components/analytics/BusinessHealthCard.tsx';
import { RevenueTrendsChart } from '../../components/analytics/RevenueTrendsChart.tsx';
import { AnomalyAlertBanner } from '../../components/analytics/AnomalyAlertBanner.tsx';
import { DataSufficiencyBadge } from '../../components/analytics/DataSufficiencyBadge.tsx';
import { HomeAIInsightCard } from '../../components/ai/HomeAIInsightCard.tsx';
import { Card } from '../../components/common/Card.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { Button } from '../../components/common/Button.tsx';
import { DashboardSkeleton } from '../../components/common/Skeleton.tsx';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { ErrorAlert } from '../../components/common/ErrorAlert.tsx';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Plus,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Clock,
  Package,
  CheckCircle2,
  Users,
  ShieldCheck,
  BarChart3,
  PieChart,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (route: AppNavRoute, prompt?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { profile, user } = useAuth();
  const { activeBusiness, activeRole, currency, loading: businessLoading } = useBusiness();

  const [preset, setPreset] = useState<DateRangePreset>('last_30_days');
  const [analytics, setAnalytics] = useState<CompleteBusinessAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currencyConfig = CURRENCY_MAP[currency] || CURRENCY_MAP.XAF || CURRENCY_MAP.USD;

  const loadData = useCallback(
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

        const data = await AnalyticsService.getCompleteAnalytics(activeBusiness.id, preset);
        setAnalytics(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard metrics.';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeBusiness?.id, preset, businessLoading]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  if ((loading || businessLoading) && !analytics) {
    return <DashboardSkeleton />;
  }

  if (!activeBusiness) {
    return (
      <div className="py-12 px-4 max-w-xl mx-auto text-center space-y-4">
        <EmptyState
          icon={<Package className="w-10 h-10 text-amber-400" />}
          title="No Active Business Found"
          description="Create your first business workspace or select an existing one to access the Ursella dashboard."
          actionLabel="Create Business Workspace"
          onAction={() => onNavigate('business')}
        />
      </div>
    );
  }

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Partner';

  return (
    <div className="space-y-6 pb-10">
      {/* ========================================================================= */}
      {/* 1. TOP GREETING & STATUS BANNER                                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {greeting}, {displayName}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Operational and business intelligence overview for{' '}
            <span className="font-semibold text-zinc-200">{activeBusiness?.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {analytics?.dataSufficiency && (
            <DataSufficiencyBadge info={analytics.dataSufficiency} />
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('analytics')}
            leftIcon={<BarChart3 className="w-3.5 h-3.5 text-emerald-400" />}
            className="text-xs text-zinc-300"
          >
            Full Analytics
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            isLoading={refreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            className="text-xs text-zinc-300"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('sell')}
            leftIcon={<ShoppingCart className="w-4 h-4" />}
            className="text-xs"
          >
            Record Sale
          </Button>
        </div>
      </div>

      {error && (
        <ErrorAlert
          title="Could not load real-time metrics"
          message={error}
          onRetry={() => loadData(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. TENANT BUSINESS INFO & TIMEFRAME SELECTOR                              */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900/70 border border-zinc-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">
              {activeBusiness?.name?.charAt(0) || 'B'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">{activeBusiness?.name}</h2>
                <Badge variant="emerald" size="sm">
                  {activeRole?.toUpperCase()}
                </Badge>
                <Badge variant="zinc" size="sm">
                  {activeBusiness?.business_type || 'Retail'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {activeBusiness?.country} • Currency:{' '}
                <span className="font-semibold text-zinc-200">
                  {currencyConfig.code} ({currencyConfig.symbol})
                </span>{' '}
                • Timezone: {activeBusiness?.timezone}
              </p>
            </div>
          </div>

          {/* Timeframe Presets */}
          <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 self-start md:self-auto">
            {(['today', 'last_7_days', 'last_30_days', 'this_month'] as DateRangePreset[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    preset === p
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  {p === 'today'
                    ? 'Today'
                    : p === 'last_7_days'
                    ? '7 Days'
                    : p === 'last_30_days'
                    ? '30 Days'
                    : 'This Month'}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2.5 URSELLA AI PROACTIVE ADVISORY & INSIGHTS                               */}
      {/* ========================================================================= */}
      {activeBusiness && (
        <HomeAIInsightCard
          businessId={activeBusiness.id}
          businessName={activeBusiness.name}
          currency={currencyConfig.symbol}
          onNavigateToAI={(prompt) => onNavigate('ai', prompt)}
          onNavigateToInsights={() => onNavigate('insights')}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. CORE FINANCIAL KPI METRIC CARDS WITH PERIOD COMPARISON                 */}
      {/* ========================================================================= */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Metric 1: Revenue */}
          <MetricTrendCard
            title={`Sales Revenue (${analytics.window.label})`}
            comparison={analytics.comparison.revenue}
            currencyConfig={currencyConfig}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            tooltip="Total completed invoice revenue in this window"
          />

          {/* Metric 2: Gross Profit */}
          <MetricTrendCard
            title={`Gross Profit (${(analytics.financialOverview.grossMargin ?? 0).toFixed(1)}% margin)`}
            comparison={analytics.comparison.grossProfit}
            currencyConfig={currencyConfig}
            icon={<DollarSign className="w-4 h-4 text-cyan-400" />}
            tooltip="Revenue minus historical Cost of Goods Sold"
          />

          {/* Metric 3: Operating Expenses */}
          <MetricTrendCard
            title="Operating Expenses"
            comparison={analytics.comparison.operatingExpenses}
            currencyConfig={currencyConfig}
            invertColors={true}
            icon={<PieChart className="w-4 h-4 text-rose-400" />}
            tooltip="Total expenses in period"
          />

          {/* Metric 4: Estimated Net Profit */}
          <MetricTrendCard
            title="Estimated Net Profit"
            comparison={analytics.comparison.estimatedNetProfit}
            currencyConfig={currencyConfig}
            icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
            tooltip="Gross Profit minus Operating Expenses"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BUSINESS HEALTH INDICATOR & NOTICES                                    */}
      {/* ========================================================================= */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BusinessHealthCard indicator={analytics.healthIndicator} />
          </div>

          <div className="space-y-4">
            {/* Low stock callout */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-zinc-400 font-medium">Inventory Stock Alerts</span>
                <div className="text-lg font-bold text-white mt-0.5">
                  {analytics.inventorySummary.lowStockCount}{' '}
                  <span className="text-xs font-normal text-zinc-400">low / </span>
                  {analytics.inventorySummary.outOfStockCount}{' '}
                  <span className="text-xs font-normal text-zinc-400">out of stock</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('business')}
                className="text-xs text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
              >
                Stock List →
              </Button>
            </div>

            {/* Receivables callout */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-zinc-400 font-medium">Customer Receivables</span>
                <div className="text-lg font-bold text-rose-400 mt-0.5">
                  {currencyConfig.format(analytics.financialOverview.outstandingReceivables ?? 0)}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('customers')}
                className="text-xs text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
              >
                Ledgers →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Anomalies Banner */}
      {analytics?.anomalies && analytics.anomalies.length > 0 && (
        <AnomalyAlertBanner anomalies={analytics.anomalies} />
      )}

      {/* ========================================================================= */}
      {/* 5. VISUAL REVENUE & PROFIT TRAJECTORY CHART                               */}
      {/* ========================================================================= */}
      {analytics && (
        <RevenueTrendsChart data={analytics.timeSeries} currencyConfig={currencyConfig} />
      )}

      {/* ========================================================================= */}
      {/* 6. QUICK ACTION WORKFLOWS                                                 */}
      {/* ========================================================================= */}
      <div>
        <h3 className="text-sm font-bold text-zinc-300 mb-3 uppercase tracking-wider">
          Quick Actions & Modules
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('sell')}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 transition-all text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-100 block">New Sale</span>
              <span className="text-[10px] text-zinc-400">Launch POS terminal</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('business')}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 transition-all text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-100 block">Inventory</span>
              <span className="text-[10px] text-zinc-400">Catalog & stock</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('customers')}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 transition-all text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-100 block">Customers</span>
              <span className="text-[10px] text-zinc-400">Ledgers & debt</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('analytics')}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 transition-all text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-100 block">Analytics Hub</span>
              <span className="text-[10px] text-zinc-400">BI & Deep Insights</span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. TOP PRODUCTS & RECENT TRANSACTIONS                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              Top Performing Products ({analytics?.window.label})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('analytics')}
              className="text-xs text-zinc-400 hover:text-white"
            >
              View all products →
            </Button>
          </div>

          {analytics?.topProducts && analytics.topProducts.length > 0 ? (
            <div className="space-y-2">
              {analytics.topProducts.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-100 truncate">{p.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {p.unitsSold ?? 0} units sold • Margin: {(p.grossMargin ?? 0).toFixed(1)}% •{' '}
                      {(p.observedVelocityUnitsPerDay ?? 0).toFixed(2)}/day
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-400">
                      {currencyConfig.format(p.revenue ?? 0)}
                    </p>
                    <span className="text-[10px] text-zinc-500">
                      Profit: {currencyConfig.format(p.grossProfit ?? 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingCart className="w-6 h-6 text-zinc-400" />}
              title="No sales transactions recorded in this period"
              description="Start recording customer sales through the Point of Sale terminal to populate product intelligence."
              actionLabel="Launch POS Terminal"
              onAction={() => onNavigate('sell')}
            />
          )}
        </div>

        {/* AI Readiness Hub Card */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            AI Operating Layer
          </h3>

          <Card
            variant="glass"
            className="space-y-3.5 border-emerald-500/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Business Intelligence Active
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Ursella tracks and synthesizes your core financial facts in real time: revenue, FIFO inventory margins,
              cash collections, and customer receivables to power instant AI advisory and automated insights.
            </p>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Deterministic Analytics Active
              </div>
              <p className="text-[10px] text-zinc-400">
                All business facts are verified and pre-computed with zero LLM financial calculation.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              onClick={() => onNavigate('analytics')}
            >
              Explore Business Intelligence Hub →
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
