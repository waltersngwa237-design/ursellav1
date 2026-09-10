import React from 'react';
import { AlertTriangle, AlertCircle, Info, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import type { BusinessAnomalyAlert } from '../../types/index.ts';

interface AnomalyAlertBannerProps {
  anomalies: BusinessAnomalyAlert[];
}

export const AnomalyAlertBanner: React.FC<AnomalyAlertBannerProps> = ({ anomalies }) => {
  if (!anomalies || anomalies.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 stroke-[1.75]" />
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          Observed Business Signals & Anomalies ({anomalies.length})
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {anomalies.map((a) => {
          let badge = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
          let icon = <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />;

          if (a.type === 'critical') {
            badge = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
            icon = <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 stroke-[1.75]" />;
          } else if (a.type === 'info') {
            badge = 'border-blue-500/30 bg-blue-500/10 text-blue-300';
            icon = <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 stroke-[1.75]" />;
          } else if (a.type === 'positive') {
            badge = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[1.75]" />;
          }

          return (
            <div
              key={a.id}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${badge}`}
            >
              {icon}
              <div className="space-y-1 text-xs min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white truncate">{a.title}</span>
                  {a.metricValue && (
                    <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-zinc-200 shrink-0">
                      {a.metricValue}
                    </span>
                  )}
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">{a.description}</p>
                {a.recommendationNote && (
                  <div className="text-[11px] text-zinc-400 pt-1 font-medium flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Action: {a.recommendationNote}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
