import React, { useState } from 'react';
import { Package, AlertTriangle, ArrowUpDown, Clock } from 'lucide-react';
import type { ProductPerformanceItem, CurrencyConfig } from '../../types/index.ts';

interface ProductPerformanceTableProps {
  products: ProductPerformanceItem[];
  currencyConfig: CurrencyConfig;
}

type SortField = 'revenue' | 'unitsSold' | 'grossProfit' | 'grossMargin' | 'velocity';

export const ProductPerformanceTable: React.FC<ProductPerformanceTableProps> = ({
  products,
  currencyConfig,
}) => {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = products.filter((p) => {
    if (filterStatus === 'all') return true;
    return p.stockStatus === filterStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'revenue') return b.revenue - a.revenue;
    if (sortField === 'unitsSold') return b.unitsSold - a.unitsSold;
    if (sortField === 'grossProfit') return b.grossProfit - a.grossProfit;
    if (sortField === 'grossMargin') return b.grossMargin - a.grossMargin;
    if (sortField === 'velocity') return b.observedVelocityUnitsPerDay - a.observedVelocityUnitsPerDay;
    return 0;
  });

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            Product & Inventory Performance
          </h3>
          <p className="text-xs text-zinc-400">
            Observed sales velocity, margins, and inventory health
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Products ({products.length})</option>
            <option value="low_stock">Low Stock Alerts</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="slow_moving">Slow Moving</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="p-8 text-center bg-zinc-950/40 rounded-xl border border-zinc-800/60">
          <p className="text-sm text-zinc-400">No products match this filter criteria.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                <th className="pb-3 pr-4">Product Name</th>
                <th className="pb-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSortField('revenue')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Revenue
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="pb-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSortField('unitsSold')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Units Sold
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="pb-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSortField('grossMargin')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Margin %
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="pb-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSortField('velocity')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Velocity
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="pb-3 px-3 text-center">Stock Status</th>
                <th className="pb-3 pl-3 text-right">Runway</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sorted.map((item) => {
                let badge = (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {item.currentStock} in stock
                  </span>
                );

                if (item.stockStatus === 'out_of_stock') {
                  badge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Out of Stock
                    </span>
                  );
                } else if (item.stockStatus === 'low_stock') {
                  badge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Low: {item.currentStock} left
                    </span>
                  );
                } else if (item.stockStatus === 'slow_moving') {
                  badge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Slow Moving
                    </span>
                  );
                }

                return (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-zinc-100">{item.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {item.sku ? `SKU: ${item.sku} • ` : ''}
                        Cost: {currencyConfig.format(item.costPrice)} • Price:{' '}
                        {currencyConfig.format(item.sellingPrice)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-zinc-100">
                      {currencyConfig.format(item.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300 font-medium">
                      {item.unitsSold}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      <span
                        className={
                          item.grossMargin >= 30
                            ? 'text-emerald-400'
                            : item.grossMargin >= 15
                            ? 'text-amber-400'
                            : 'text-zinc-400'
                        }
                      >
                        {item.grossMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400">
                      {item.observedVelocityUnitsPerDay.toFixed(2)}/day
                    </td>
                    <td className="py-3 px-3 text-center">{badge}</td>
                    <td className="py-3 pl-3 text-right text-zinc-400">
                      {item.daysOfInventoryRemaining !== null ? (
                        <span className="font-medium text-zinc-300">
                          ~{item.daysOfInventoryRemaining}d
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
