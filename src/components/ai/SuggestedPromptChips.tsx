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
      question: 'What should I focus on today?',
      topic: 'Daily Priorities',
      subtitle: 'Quick recommendations and priorities for your shop today',
    },
    {
      category: 'sales',
      question: 'How are my sales today?',
      topic: "Today's Sales",
      subtitle: 'Check today\'s revenue, customer orders, and cash collected',
    },
    {
      category: 'sales',
      question: "What's my best-selling product?",
      topic: 'Top Sellers',
      subtitle: 'See what products are moving the fastest',
    },
    {
      category: 'inventory',
      question: 'Which items are running low on stock?',
      topic: 'Low Stock',
      subtitle: 'Find out what you need to reorder soon',
    },
    {
      category: 'debts',
      question: 'Who owes me money?',
      topic: 'Customer Debts',
      subtitle: 'View customer balances and overdue payments',
    },
    {
      category: 'profit',
      question: 'What was my profit this month?',
      topic: 'Monthly Profit',
      subtitle: 'Review revenue, expenses, and net profit',
    },
    {
      category: 'profit',
      question: 'Which products make me the most profit?',
      topic: 'Highest Margins',
      subtitle: 'See which items give you the best gross return',
    },
    {
      category: 'inventory',
      question: 'Add 50 bags of Portland Cement at 4500 selling and 3800 cost',
      topic: 'Quick Add Stock',
      subtitle: 'Draft and register new stock with units and pricing',
    },
    {
      category: 'sales',
      question: 'Why are sales slower this week?',
      topic: 'Sales Trends',
      subtitle: 'Compare recent sales against earlier weeks',
    },
    {
      category: 'advisory',
      question: 'Can you explain gross margin?',
      topic: 'Business Guide',
      subtitle: 'Learn how to calculate and boost your margins',
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
                onClick={() => {
                  if (onInsertPrompt) {
                    onInsertPrompt(item.question);
                  } else {
                    onSelectPrompt(item.question);
                  }
                }}
                className={`text-xs sm:text-[13px] font-semibold leading-relaxed cursor-pointer transition-colors ${
                  isDark
                    ? 'text-zinc-100 group-hover:text-amber-300'
                    : 'text-slate-900 group-hover:text-amber-800'
                }`}
                title="Click to put into composer"
              >
                "{item.question}"
              </p>

              <p className={`text-[11px] leading-normal line-clamp-1 ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}>
                {item.subtitle}
              </p>
            </div>

            {/* Actions: Insert into composer or Ask directly */}
            <div className="pt-3 mt-3 border-t border-zinc-800/40 dark:border-zinc-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (onInsertPrompt) {
                    onInsertPrompt(item.question);
                  } else {
                    onSelectPrompt(item.question);
                  }
                }}
                className={`text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Copy to composer to edit"
              >
                <Edit3 className="w-3 h-3" />
                <span>Insert in chat</span>
              </button>
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
