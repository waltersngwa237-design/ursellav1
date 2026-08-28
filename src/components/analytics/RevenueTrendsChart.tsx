import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { TimeSeriesPoint, CurrencyConfig } from '../../types/index.ts';

interface RevenueTrendsChartProps {
  data: TimeSeriesPoint[];
  currencyConfig: CurrencyConfig;
}

export const RevenueTrendsChart: React.FC<RevenueTrendsChartProps> = ({
  data,
  currencyConfig,
}) => {
  const [activeSeries, setActiveSeries] = useState<{
    revenue: boolean;
    grossProfit: boolean;
    expenses: boolean;
    netProfit: boolean;
    cashCollected: boolean;
  }>({
    revenue: true,
    grossProfit: true,
    expenses: false,
    netProfit: true,
    cashCollected: false,
  });

  const toggleSeries = (key: keyof typeof activeSeries) => {
    setActiveSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chartData = data.map((d) => ({
    date: d.date.length > 5 ? d.date.slice(5) : d.date, // e.g. "08-26"
    fullDate: d.date,
    revenue: d.revenue,
    grossProfit: d.grossProfit,
    expenses: d.expenses,
    netProfit: d.estimatedNetProfit,
    cashCollected: d.cashCollected,
    transactionCount: d.transactionCount,
  }));

  const hasData = chartData.some(
    (d) => d.revenue > 0 || d.expenses > 0 || d.cashCollected > 0
  );

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Financial Trajectory & Trends</h3>
          <p className="text-xs text-zinc-400">Revenue, margins, and profit over time</p>
        </div>

        {/* Series Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleSeries('revenue')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border ${
              activeSeries.revenue
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            ● Revenue
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('grossProfit')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border ${
              activeSeries.grossProfit
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            ● Gross Profit
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('expenses')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border ${
              activeSeries.expenses
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            ● Expenses
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('netProfit')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border ${
              activeSeries.netProfit
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            ● Net Profit
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('cashCollected')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border ${
              activeSeries.cashCollected
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            ● Cash Collected
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
          <p className="text-sm font-medium text-zinc-400">No activity recorded in this period</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Sales, expenses, and payment records created in this window will plot here automatically.
          </p>
        </div>
      ) : (
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#27272a',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any) => {
                  const val = Number(value) || 0;
                  const labelMap: Record<string, string> = {
                    revenue: 'Revenue',
                    grossProfit: 'Gross Profit',
                    expenses: 'Expenses',
                    netProfit: 'Net Profit',
                    cashCollected: 'Cash Collected',
                  };
                  return [currencyConfig.format(val), labelMap[name] || name];
                }}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.fullDate ? `Date: ${item.fullDate}` : label;
                }}
              />
              {activeSeries.revenue && (
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              )}
              {activeSeries.grossProfit && (
                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGross)"
                />
              )}
              {activeSeries.expenses && (
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExp)"
                />
              )}
              {activeSeries.netProfit && (
                <Area
                  type="monotone"
                  dataKey="netProfit"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNet)"
                />
              )}
              {activeSeries.cashCollected && (
                <Area
                  type="monotone"
                  dataKey="cashCollected"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCash)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
