import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import {
  TrendingUp,
  Package,
  Users,
  PieChart,
  Sparkles,
  ArrowUpRight,
  Edit3,
} from 'lucide-react';

interface SuggestedPromptChipsProps {
  onSelectPrompt: (prompt: string) => void;
  onInsertPrompt?: (prompt: string) => void;
  onOpenDailyBriefModal?: () => void;
}

interface PromptItem {
  category: string;
  question: string;
  icon: React.ElementType;
  iconColor: string;
  iconBgLight: string;
  iconBgDark: string;
}

export const SuggestedPromptChips: React.FC<SuggestedPromptChipsProps> = ({
  onSelectPrompt,
  onInsertPrompt,
}) => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const isFr = language === 'fr';
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = isFr
    ? [
        { id: 'all', label: 'Tout' },
        { id: 'advisory', label: 'Priorités', icon: Sparkles },
        { id: 'sales', label: 'Ventes', icon: TrendingUp },
        { id: 'inventory', label: 'Stock', icon: Package },
        { id: 'debts', label: 'Dettes', icon: Users },
        { id: 'profit', label: 'Bénéfices', icon: PieChart },
      ]
    : [
        { id: 'all', label: 'All' },
        { id: 'advisory', label: 'Priorities', icon: Sparkles },
        { id: 'sales', label: 'Sales', icon: TrendingUp },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'debts', label: 'Debts', icon: Users },
        { id: 'profit', label: 'Profit', icon: PieChart },
      ];

  const defaultQuestions: PromptItem[] = isFr
    ? [
        {
          category: 'advisory',
          question: 'Sur quoi dois-je me concentrer aujourd’hui ?',
          icon: Sparkles,
          iconColor: 'text-amber-500',
          iconBgLight: 'bg-amber-50 border-amber-200/60',
          iconBgDark: 'bg-amber-500/10 border-amber-500/25',
        },
        {
          category: 'sales',
          question: 'Comment se portent mes ventes aujourd’hui ?',
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          iconBgLight: 'bg-emerald-50 border-emerald-200/60',
          iconBgDark: 'bg-emerald-500/10 border-emerald-500/25',
        },
        {
          category: 'sales',
          question: 'Quel est mon produit le plus vendu ?',
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          iconBgLight: 'bg-emerald-50 border-emerald-200/60',
          iconBgDark: 'bg-emerald-500/10 border-emerald-500/25',
        },
        {
          category: 'inventory',
          question: 'Quels produits sont en stock faible ?',
          icon: Package,
          iconColor: 'text-sky-500',
          iconBgLight: 'bg-sky-50 border-sky-200/60',
          iconBgDark: 'bg-sky-500/10 border-sky-500/25',
        },
        {
          category: 'debts',
          question: 'Qui me doit de l’argent actuellement ?',
          icon: Users,
          iconColor: 'text-rose-500',
          iconBgLight: 'bg-rose-50 border-rose-200/60',
          iconBgDark: 'bg-rose-500/10 border-rose-500/25',
        },
        {
          category: 'profit',
          question: 'Quel est mon bénéfice ce mois-ci ?',
          icon: PieChart,
          iconColor: 'text-indigo-500',
          iconBgLight: 'bg-indigo-50 border-indigo-200/60',
          iconBgDark: 'bg-indigo-500/10 border-indigo-500/25',
        },
        {
          category: 'profit',
          question: 'Quels produits ont la plus forte marge ?',
          icon: PieChart,
          iconColor: 'text-indigo-500',
          iconBgLight: 'bg-indigo-50 border-indigo-200/60',
          iconBgDark: 'bg-indigo-500/10 border-indigo-500/25',
        },
        {
          category: 'sales',
          question: 'Comment évoluent mes ventes cette semaine ?',
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          iconBgLight: 'bg-emerald-50 border-emerald-200/60',
          iconBgDark: 'bg-emerald-500/10 border-emerald-500/25',
        },
      ]
    : [
        {
          category: 'advisory',
          question: 'What should I focus on today?',
          icon: Sparkles,
          iconColor: 'text-amber-500',
          iconBgLight: 'bg-amber-50 border-amber-200/60',
          iconBgDark: 'bg-amber-500/10 border-amber-500/25',
        },
        {
          category: 'sales',
          question: 'How are my sales performing today?',
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          iconBgLight: 'bg-emerald-50 border-emerald-200/60',
          iconBgDark: 'bg-emerald-500/10 border-emerald-500/25',
        },
        {
          category: 'sales',
          question: 'What is my best-selling product?',
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          iconBgLight: 'bg-emerald-50 border-emerald-200/60',
          iconBgDark: 'bg-emerald-500/10 border-emerald-500/25',
        },
        {
          category: 'inventory',
          question: 'Which items are running low on stock?',
          icon: Package,
          iconColor: 'text-sky-500',
          iconBgLight: 'bg-sky-50 border-sky-200/60',
          iconBgDark: 'bg-sky-500/10 border-sky-500/25',
        },
        {
          category: 'debts',
          question: 'Who owes me money right now?',
          icon: Users,
          iconColor: 'text-rose-500',
          iconBgLight: 'bg-rose-50 border-rose-200/60',
          iconBgDark: 'bg-rose-500/10 border-rose-500/25',
        },
        {
          category: 'profit',
          question: 'What is my net profit this month?',
          icon: PieChart,
          iconColor: 'text-indigo-500',
          iconBgLight: 'bg-indigo-50 border-indigo-200/60',
          iconBgDark: 'bg-indigo-500/10 border-indigo-500/25',
        },
        {
          category: 'profit',
          question: 'Which products have the highest margins?',
          icon: PieChart,
          iconColor: 'text-indigo-500',
          iconBgLight: 'bg-indigo-50 border-indigo-200/60',
          iconBgDark: 'bg-indigo-500/10 border-indigo-500/25',
        },
        {
          category: 'sales',
          question: 'How do this week’s sales compare to last week?',
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          iconBgLight: 'bg-emerald-50 border-emerald-200/60',
          iconBgDark: 'bg-emerald-500/10 border-emerald-500/25',
        },
      ];

  const filteredQuestions =
    activeCategory === 'all'
      ? defaultQuestions
      : defaultQuestions.filter((q) => q.category === activeCategory);

  return (
    <div className="space-y-3.5 max-w-2xl mx-auto w-full px-1 sm:px-0">
      {/* Category Filter Chips - Slim horizontal scrollable bar */}
      <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95 ${
                isActive
                  ? isDark
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                    : 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                  : isDark
                  ? 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? 'text-emerald-400'
                      : isDark
                      ? 'text-zinc-500'
                      : 'text-slate-400'
                  }`}
                />
              )}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Modern Compact Prompt Starter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
        {filteredQuestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              onClick={() => onSelectPrompt(item.question)}
              className={`group flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer text-left active:scale-[0.99] select-none ${
                isDark
                  ? 'bg-zinc-900/70 border-zinc-800/90 hover:bg-zinc-850 hover:border-zinc-700 shadow-xs'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                    isDark ? item.iconBgDark : item.iconBgLight
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <p
                  className={`text-xs sm:text-[13px] font-medium leading-snug line-clamp-2 transition-colors ${
                    isDark
                      ? 'text-zinc-200 group-hover:text-white'
                      : 'text-slate-800 group-hover:text-slate-950'
                  }`}
                >
                  {item.question}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-1">
                {onInsertPrompt && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertPrompt(item.question);
                    }}
                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 ${
                      isDark
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title={isFr ? 'Insérer dans le champ' : 'Insert into composer'}
                    aria-label={isFr ? 'Insérer dans le champ' : 'Insert into composer'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                    isDark
                      ? 'text-zinc-500 group-hover:text-zinc-300 group-hover:bg-zinc-800/80'
                      : 'text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
