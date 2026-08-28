import React from 'react';
import { Database, AlertCircle, CheckCircle } from 'lucide-react';
import type { DataSufficiencyInfo } from '../../types/index.ts';

interface DataSufficiencyBadgeProps {
  info: DataSufficiencyInfo;
}

export const DataSufficiencyBadge: React.FC<DataSufficiencyBadgeProps> = ({ info }) => {
  const { confidence, transactionCount, daysEvaluated, description } = info;

  let pill = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  let label = 'High Statistical Confidence';
  let icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;

  if (confidence === 'insufficient_data') {
    pill = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    label = 'Preliminary Sample';
    icon = <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  } else if (confidence === 'moderate_confidence') {
    pill = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    label = 'Moderate Sample Size';
    icon = <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${pill}`}
      title={description}
    >
      {icon}
      <span className="font-semibold">{label}</span>
      <span className="text-zinc-500 hidden sm:inline">•</span>
      <span className="text-zinc-400 text-[11px] hidden sm:inline">
        {transactionCount} txs over {daysEvaluated}d
      </span>
    </div>
  );
};
