import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import {
  Send,
  Edit3,
  TrendingUp,
  Package,
  Users,
  PieChart,
  Sparkles,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

interface SuggestedPromptChipsProps {
  onSelectPrompt: (prompt: string) => void;
  onInsertPrompt?: (prompt: string) => void;
  onOpenDailyBriefModal?: () => void;
}

export const SuggestedPromptChips: React.FC<SuggestedPromptChipsProps> = ({
  onSelectPrompt,
  onInsertPrompt,
}) => {
  const { isDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Questions' },
    { id: 'advisory', label: 'Strategy', icon: Sparkles },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'debts', label: 'Debts', icon: Users },
    { id: 'profit', label: 'Profit', icon: PieChart },
  ];

  const suggestedQuestions = [
    {
      category: 'advisory',
      question: 'What actionable steps should I take to grow and protect my business today?',
      topic: 'Strategic Recommendations',
      subtitle: 'Prioritized operational steps based on live ledger telemetry',
    },
    {
      category: 'sales',
      question: 'How are my sales and revenue performing today?',
      topic: 'Sales & Revenue Telemetry',
      subtitle: 'Total volume, customer orders, and cash collected today',
    },
    {
      category: 'profit',
      question: 'What is my profit margin and how can I improve my profitability?',
      topic: 'Profitability Analysis',
      subtitle: 'Gross profit margins and net cash performance breakdown',
    },
    {
      category: 'sales',
      question: 'What are my best-selling products right now?',
      topic: 'Top Performing Inventory',
      subtitle: 'Highest volume and revenue contributing products',
    },
    {
      category: 'profit',
      question: 'Which products yield the highest profit margins for my store?',
      topic: 'High-Margin Catalog Items',
      subtitle: 'Products that generate the strongest gross return per unit',
    },
    {
      category: 'inventory',
      question: 'Add 50 bags of Portland Cement at 4,500 selling and 3,800 cost',
      topic: 'Add Product with Unit of Measure',
      subtitle: 'Ursella AI parses name, custom unit of measurement, initial stock & pricing',
    },
    {
      category: 'inventory',
      question: 'Do I have any critical low-stock products that need reordering?',
      topic: 'Stockout Prevention',
      subtitle: 'Identify items nearing depletion or safety replenishment thresholds',
    },
    {
      category: 'debts',
      question: 'Which customers currently owe me money and what are their balances?',
      topic: 'Receivables & Credit',
      subtitle: 'Unpaid customer receivables and overdue balances',
    },
    {
      category: 'sales',
      question: 'How is my business performing this month compared to our target?',
      topic: 'Monthly Executive Review',
      subtitle: 'Comprehensive 30-day revenue, expenses, and cashflow comparison',
    },
  ];

  const filteredQuestions =
    activeCategory === 'all'
      ? suggestedQuestions
      : suggestedQuestions.filter((q) => q.category === activeCategory);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Category Pills */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? isDark
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                    : 'bg-white text-slate-900 border border-slate-300 shadow-xs font-semibold'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-amber-500' : isDark ? 'text-zinc-500' : 'text-slate-400'
                  }`}
                />
              )}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Suggested Questions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
        {filteredQuestions.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group shadow-xs ${
              isDark
                ? 'bg-zinc-900/50 border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-900/90'
                : 'bg-white border-slate-200 hover:border-amber-500/60 hover:bg-amber-50/20'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {item.topic}
                </span>
                {onInsertPrompt && (
                  <button
                    type="button"
                    onClick={() => onInsertPrompt(item.question)}
                    className={`p-1 rounded-md text-xs transition-colors ${
                      isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Insert question into chat box to edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* The Actual Question - Prominent & Conversational */}
              <p
                onClick={() => onSelectPrompt(item.question)}
                className={`text-xs sm:text-[13px] font-semibold leading-relaxed cursor-pointer transition-colors ${
                  isDark
                    ? 'text-zinc-100 group-hover:text-amber-300'
                    : 'text-slate-900 group-hover:text-amber-800'
                }`}
              >
                "{item.question}"
              </p>

              <p className={`text-[11px] leading-normal line-clamp-1 ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}>
                {item.subtitle}
              </p>
            </div>

            {/* Direct Send Action */}
            <div className="pt-3 mt-3 border-t border-zinc-800/40 dark:border-zinc-800/80 flex items-center justify-between">
              <span className={`text-[10px] font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                Tap to ask advisor
              </span>
              <button
                type="button"
                onClick={() => onSelectPrompt(item.question)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-xs group-hover:shadow-amber-500/20 cursor-pointer"
              >
                <span>Ask</span>
                <Send className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
