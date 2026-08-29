import React, { useState } from 'react';
import { Activity, ShieldCheck, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { BusinessHealthIndicator } from '../../types/index.ts';

interface BusinessHealthCardProps {
  indicator: BusinessHealthIndicator;
}

export const BusinessHealthCard: React.FC<BusinessHealthCardProps> = ({ indicator }) => {
  const [showMethodology, setShowMethodology] = useState(false);

  const { score = 50, rating = 'Good', methodology = '', drivers = [] } = indicator || {};

  let ratingColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let barColor = 'bg-emerald-500';

  if (score < 40) {
    ratingColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    barColor = 'bg-rose-500';
  } else if (score < 60) {
    ratingColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    barColor = 'bg-amber-500';
  } else if (score < 75) {
    ratingColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    barColor = 'bg-blue-500';
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-900/80 to-zinc-950 border border-zinc-800/90 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Ursella Business Health Indicator
            </h3>
            <p className="text-xs text-zinc-400">Deterministic operational health index</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-lg border font-bold text-xs ${ratingColor}`}>
            {rating} ({score}/100)
          </div>
        </div>
      </div>

      {/* Main Score Bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-zinc-400 mb-1.5 font-medium">
          <span>Overall Health Score</span>
          <span className="text-white font-bold">{score}%</span>
        </div>
        <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Breakdown Drivers */}
      <div className="space-y-3 pt-3 border-t border-zinc-800/80">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Pillar Assessment
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drivers.map((d, i) => {
            let statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            if (d.status === 'warning') {
              statusBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            } else if (d.status === 'moderate') {
              statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            }

            return (
              <div
                key={i}
                className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/70 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-zinc-200">{d.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge}`}>
                    {d.score}/100
                  </span>
                </div>
                <p className="text-xs text-zinc-400">{d.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Methodology Accordion */}
      <div className="mt-4 pt-3 border-t border-zinc-800/60">
        <button
          type="button"
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            How is this score calculated?
          </span>
          {showMethodology ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showMethodology && (
          <div className="mt-2.5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-400 space-y-1.5">
            <p className="font-medium text-zinc-300">{methodology}</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Every pillar is evaluated using deterministic mathematical bounds from verified transactional
              records (Sales, Expenses, Inventory, and Customer balances). No heuristic AI guessing is applied.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
