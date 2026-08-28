import React from 'react';
import { Sparkles, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { DailyPriorityItem } from '../../types/proactive.ts';

interface PrioritiesBannerProps {
  priorities: DailyPriorityItem[];
  onSelectPriority: (priority: DailyPriorityItem) => void;
}

export const PrioritiesBanner: React.FC<PrioritiesBannerProps> = ({
  priorities,
  onSelectPriority,
}) => {
  if (!priorities || priorities.length === 0) return null;

  return (
    <div
      id="daily-priorities-banner"
      className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden"
    >
      {/* Subtle decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Today's Key Priorities
            </h3>
            <p className="text-xs text-indigo-200/70">
              Ranked recommendations for maximum operational impact
            </p>
          </div>
        </div>
      </div>

      {/* Priority Items Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
        {priorities.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => onSelectPriority(item)}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
                  {idx + 1}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                  {item.category}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                {item.title}
              </h4>
              <p className="mt-1 text-[11px] text-slate-300/80 line-clamp-2 leading-relaxed">
                {item.reason}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-300 font-medium group-hover:text-white">
              <span>Take action</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
