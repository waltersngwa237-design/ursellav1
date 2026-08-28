import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { MetricComparison, CurrencyConfig } from '../../types/index.ts';

interface MetricTrendCardProps {
  title: string;
  comparison: MetricComparison;
  currencyConfig: CurrencyConfig;
  formatAsCurrency?: boolean;
  formatSuffix?: string;
  icon?: React.ReactNode;
  invertColors?: boolean; // For expenses where an increase is negative
  tooltip?: string;
}

export const MetricTrendCard: React.FC<MetricTrendCardProps> = ({
  title,
  comparison,
  currencyConfig,
  formatAsCurrency = true,
  formatSuffix = '',
  icon,
  invertColors = false,
  tooltip,
}) => {
  const { current, prior, percentageChange, trend } = comparison;

  const formattedCurrent = formatAsCurrency
    ? currencyConfig.format(current)
    : `${current.toLocaleString()}${formatSuffix}`;

  const formattedPrior = formatAsCurrency
    ? currencyConfig.format(prior)
    : `${prior.toLocaleString()}${formatSuffix}`;

  // Determine trend styling
  const isUp = trend === 'positive';
  const isDown = trend === 'negative';

  let badgeColor = 'bg-zinc-800 text-zinc-400 border-zinc-700';
  let isGood = isUp;
  if (invertColors) {
    isGood = isDown;
  }

  if (percentageChange !== null && percentageChange !== 0) {
    if (isGood) {
      badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else {
      badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  }

  return (
    <div
      className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between"
      title={tooltip}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-zinc-400 truncate">{title}</span>
        {icon && <div className="text-zinc-500 shrink-0">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
          {formattedCurrent}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-zinc-800/60 text-xs">
        <div className="flex items-center gap-1 text-zinc-400 truncate">
          <span className="text-zinc-500">Prior:</span>
          <span className="text-zinc-300 font-medium truncate">{formattedPrior}</span>
        </div>

        {percentageChange !== null ? (
          <div
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md border font-semibold text-[11px] shrink-0 ${badgeColor}`}
          >
            {isUp ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : isDown ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span>
              {percentageChange > 0 ? '+' : ''}
              {percentageChange.toFixed(1)}%
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-500">Baseline</span>
        )}
      </div>
    </div>
  );
};
