import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import {
  ArrowRight,
  TrendingUp,
  Package,
  Users,
  PieChart,
  Sparkles,
} from 'lucide-react';

interface SuggestedPromptChipsProps {
  onSelectPrompt: (prompt: string) => void;
  onOpenDailyBriefModal?: () => void;
}

export const SuggestedPromptChips: React.FC<SuggestedPromptChipsProps> = ({
  onSelectPrompt,
}) => {
  const { isDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Topics' },
    { id: 'advisory', label: 'Strategy', icon: Sparkles },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'debts', label: 'Debts', icon: Users },
    { id: 'profit', label: 'Profit', icon: PieChart },
  ];

  const prompts = [
    {
      category: 'advisory',
      title: 'Actionable Recommendations',
      subtitle: 'Prioritized operational steps based on latest telemetry',
      prompt: 'Any recommendations?',
    },
    {
      category: 'sales',
      title: 'Sales & Revenue Summary',
      subtitle: 'Total volume, customer orders, and cash collected today',
      prompt: 'How are my sales today?',
    },
    {
      category: 'profit',
      title: 'Profitability Diagnostics',
      subtitle: 'Gross profit margins and net cash performance breakdown',
      prompt: 'How profitable am I?',
    },
    {
      category: 'sales',
      title: 'Top-Selling Products',
      subtitle: 'Highest volume and revenue contributing inventory',
      prompt: 'What are my best-selling products?',
    },
    {
      category: 'profit',
      title: 'High-Margin Catalog Items',
      subtitle: 'Products that yield the strongest gross margins',
      prompt: 'Which products have the best margins?',
    },
    {
      category: 'inventory',
      title: 'Critical Low Stock Alerts',
      subtitle: 'Identify products nearing depletion or safety threshold',
      prompt: 'Do I have any low-stock products?',
    },
    {
      category: 'debts',
      title: 'Outstanding Customer Debts',
      subtitle: 'Unpaid customer receivables and overdue balances',
      prompt: 'Who owes me money?',
    },
    {
      category: 'sales',
      title: '30-Day Executive Performance',
      subtitle: 'Comprehensive monthly revenue, expenses, and cashflow',
      prompt: 'How is my business performing this month?',
    },
  ];

  const filteredPrompts =
    activeCategory === 'all'
      ? prompts
      : prompts.filter((p) => p.category === activeCategory);

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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? isDark
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                    : 'bg-white text-slate-900 border border-slate-300 shadow-xs font-semibold'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-500' : isDark ? 'text-zinc-500' : 'text-slate-400'}`} />}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Prompts Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2.5 sm:gap-3">
        {filteredPrompts.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col justify-between group shadow-xs cursor-pointer ${
              isDark 
                ? 'bg-zinc-900/40 border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900/80' 
                : 'bg-white border-slate-200 hover:border-amber-500/60 hover:bg-amber-50/30 shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <div className="space-y-1 min-w-0 flex-1">
                <div className={`text-xs sm:text-[13px] font-semibold transition-colors ${
                  isDark ? 'text-zinc-100 group-hover:text-amber-300' : 'text-slate-900 group-hover:text-amber-700'
                }`}>
                  {item.title}
                </div>
                <p className={`text-[11px] line-clamp-1 leading-normal ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}>
                  {item.subtitle}
                </p>
              </div>
              <ArrowRight className={`w-3.5 h-3.5 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5 ${
                isDark ? 'text-zinc-600 group-hover:text-amber-400' : 'text-slate-400 group-hover:text-amber-600'
              }`} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

