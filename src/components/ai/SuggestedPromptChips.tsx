import React, { useState } from 'react';
import {
  TrendingUp,
  Package,
  Users,
  PieChart,
  Sun,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface SuggestedPromptChipsProps {
  onSelectPrompt: (prompt: string) => void;
  onOpenDailyBriefModal?: () => void;
}

export const SuggestedPromptChips: React.FC<SuggestedPromptChipsProps> = ({
  onSelectPrompt,
  onOpenDailyBriefModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Topics', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'sales', label: 'Sales & Revenue', icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'inventory', label: 'Stock & Alerts', icon: <Package className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'debts', label: 'Customer Debts', icon: <Users className="w-3.5 h-3.5 text-purple-400" /> },
    { id: 'profit', label: 'Profit & Margins', icon: <PieChart className="w-3.5 h-3.5 text-rose-400" /> },
  ];

  const prompts = [
    {
      category: 'sales',
      title: 'Today’s Performance',
      subtitle: 'Total sales, orders, and cash collected today',
      prompt: 'What are my total sales and revenue today?',
    },
    {
      category: 'inventory',
      title: 'Low Stock & Restock Alert',
      subtitle: 'Products running critically low or sold out',
      prompt: 'Which products are currently low in stock or out of stock?',
    },
    {
      category: 'debts',
      title: 'Outstanding Debts',
      subtitle: 'Who owes money and total unpaid balances',
      prompt: 'Who owes me money and what is the total outstanding debt balance?',
    },
    {
      category: 'sales',
      title: 'Top Selling Products',
      subtitle: 'Highest volume & revenue contributors',
      prompt: 'Which products are my top sellers and highest revenue generators?',
    },
    {
      category: 'profit',
      title: 'Profit Margins & Expenses',
      subtitle: 'Estimated gross profit and spending summary',
      prompt: 'What is my current gross profit margin and where am I spending most on expenses?',
    },
    {
      category: 'debts',
      title: 'Top Customers',
      subtitle: 'Best loyal buyers and recent visit history',
      prompt: 'Who are my top customers and when did they last purchase?',
    },
  ];

  const filteredPrompts =
    activeCategory === 'all'
      ? prompts
      : prompts.filter((p) => p.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category Pills */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Prompts Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPrompts.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="text-left p-3.5 sm:p-4 rounded-2xl border bg-zinc-900/60 border-zinc-800/80 hover:border-amber-500/40 hover:bg-zinc-900 transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
          >
            <div className="space-y-1">
              <div className="text-xs sm:text-[13px] font-bold text-zinc-100 group-hover:text-amber-300 transition-colors flex items-center justify-between">
                <span>{item.title}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                {item.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
