import React, { useState, useEffect } from 'react';
import { AIService } from '../../services/ai.service.ts';
import { UrsellaSymbolMark } from '../common/UrsellaLogo.tsx';
import { Sun, ArrowRight, Activity } from 'lucide-react';
import { DailyBriefModal } from './DailyBriefModal.tsx';

interface HomeAIInsightCardProps {
  businessId: string;
  businessName: string;
  currency: string;
  onNavigateToAI: (initialPrompt?: string) => void;
  onNavigateToInsights?: () => void;
}

export const HomeAIInsightCard: React.FC<HomeAIInsightCardProps> = ({
  businessId,
  businessName,
  currency,
  onNavigateToAI,
  onNavigateToInsights,
}) => {
  const [isDailyBriefOpen, setIsDailyBriefOpen] = useState<boolean>(false);
  const [proactiveData, setProactiveData] = useState<{
    healthScore: number;
    healthRating: string;
    insights: Array<{
      id: string;
      type: 'warning' | 'critical' | 'info' | 'positive';
      title: string;
      message: string;
      actionPrompt: string;
    }>;
  } | null>(null);

  useEffect(() => {
    if (businessId) {
      AIService.fetchProactiveInsights(businessId).then(setProactiveData);
    }
  }, [businessId]);

  const topInsight = proactiveData?.insights?.[0];

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-indigo-950/20 border border-zinc-800 hover:border-indigo-500/30 transition-all p-4 sm:p-5 shadow-sm">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider font-mono">
                <UrsellaSymbolMark sizeClass="w-3 h-3" theme="ai" />
                <span>Ursella Intelligence</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                {proactiveData?.healthRating ? `Health: ${proactiveData.healthRating} (${proactiveData.healthScore}/100)` : 'Proactive Live'}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {topInsight ? topInsight.title : `Real-time Business Advisor for ${businessName}`}
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {topInsight
                ? topInsight.message
                : 'Ask questions about revenue velocity, product margins, inventory stockouts, or customer credit in natural language.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            {onNavigateToInsights && (
              <button
                onClick={onNavigateToInsights}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 text-indigo-200 text-xs font-semibold transition-all"
                title="View Proactive Insights"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>Insights Hub</span>
              </button>
            )}

            <button
              onClick={() => setIsDailyBriefOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-all"
            >
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Daily Brief</span>
            </button>

            <button
              onClick={() => onNavigateToAI(topInsight?.actionPrompt)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 group"
            >
              <span>Ask Ursella</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Daily Brief Modal */}
      <DailyBriefModal
        isOpen={isDailyBriefOpen}
        onClose={() => setIsDailyBriefOpen(false)}
        businessId={businessId}
        businessName={businessName}
        currency={currency}
        onAskFollowUp={(prompt) => onNavigateToAI(prompt)}
      />
    </>
  );
};

