import React from 'react';
import { Users, UserCheck, AlertTriangle, Phone, ShoppingBag } from 'lucide-react';
import type { CustomerSegmentMetrics, CurrencyConfig } from '../../types/index.ts';

interface CustomerIntelligenceCardProps {
  metrics: CustomerSegmentMetrics;
  currencyConfig: CurrencyConfig;
}

export const CustomerIntelligenceCard: React.FC<CustomerIntelligenceCardProps> = ({
  metrics,
  currencyConfig,
}) => {
  const {
    totalCustomers,
    activeInPeriod,
    newCustomersInPeriod,
    repeatCustomers,
    inactiveCustomers,
    debtorCustomers,
    totalOutstandingDebt,
    topCustomersByRevenue,
  } = metrics;

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Customer Intelligence & Retention
          </h3>
          <p className="text-xs text-zinc-400">
            Segment distributions, repeat buyer rates, and customer credit exposure
          </p>
        </div>
      </div>

      {/* Segment Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium">Total Registered</span>
          <div className="text-lg font-bold text-white mt-1">{totalCustomers}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium">Active in Period</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">{activeInPeriod}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium">New Acquisitions</span>
          <div className="text-lg font-bold text-cyan-400 mt-1">{newCustomersInPeriod}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium">Repeat Buyers</span>
          <div className="text-lg font-bold text-blue-400 mt-1">{repeatCustomers}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium">Inactive (&gt;30d)</span>
          <div className="text-lg font-bold text-zinc-400 mt-1">{inactiveCustomers}</div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
          <span className="text-[11px] text-rose-400 font-medium">Debtors</span>
          <div className="text-lg font-bold text-rose-400 mt-1">{debtorCustomers}</div>
        </div>
      </div>

      {/* Debt Warning Banner if debt > 0 */}
      {totalOutstandingDebt > 0 && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>{debtorCustomers} customer(s)</strong> have outstanding balances totaling{' '}
              <strong className="text-rose-200">
                {currencyConfig.format(totalOutstandingDebt)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Top Customers Table */}
      <div className="pt-2">
        <h4 className="text-xs font-semibold text-zinc-300 mb-2.5 uppercase tracking-wider">
          Top Purchasing Customers (Period)
        </h4>

        {topCustomersByRevenue.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No customer-linked purchases in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 text-right font-medium">Period Spend</th>
                  <th className="pb-2 text-right font-medium">Orders</th>
                  <th className="pb-2 text-right font-medium">Lifetime Spend</th>
                  <th className="pb-2 text-right font-medium">Outstanding Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {topCustomersByRevenue.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-800/20">
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-zinc-200">{c.name}</div>
                      {c.phone && <div className="text-[11px] text-zinc-500">{c.phone}</div>}
                    </td>
                    <td className="py-2.5 text-right font-bold text-white">
                      {currencyConfig.format(c.revenueInPeriod)}
                    </td>
                    <td className="py-2.5 text-right text-zinc-400">{c.completedOrdersInPeriod}</td>
                    <td className="py-2.5 text-right text-zinc-300">
                      {currencyConfig.format(c.lifetimeSpent)}
                    </td>
                    <td className="py-2.5 text-right">
                      {c.outstandingBalance > 0 ? (
                        <span className="font-bold text-rose-400">
                          {currencyConfig.format(c.outstandingBalance)}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium">Paid in full</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
