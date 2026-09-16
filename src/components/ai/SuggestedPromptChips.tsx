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
        { id: 'all', label: 'Toutes les questions' },
        { id: 'advisory', label: 'Stratégie', icon: Sparkles },
        { id: 'sales', label: 'Ventes', icon: TrendingUp },
        { id: 'inventory', label: 'Stock', icon: Package },
        { id: 'debts', label: 'Créances', icon: Users },
        { id: 'profit', label: 'Bénéfice', icon: PieChart },
      ]
    : [
        { id: 'all', label: 'All Questions' },
        { id: 'advisory', label: 'Strategy', icon: Sparkles },
        { id: 'sales', label: 'Sales', icon: TrendingUp },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'debts', label: 'Debts', icon: Users },
        { id: 'profit', label: 'Profit', icon: PieChart },
      ];

  const defaultQuestions = isFr
    ? [
        {
          category: 'advisory',
          question: 'Sur quoi dois-je me concentrer aujourd’hui ?',
          topic: 'Priorités du Jour',
          subtitle: 'Recommandations clés et actions prioritaires pour votre commerce',
        },
        {
          category: 'sales',
          question: 'Comment se portent mes ventes aujourd’hui ?',
          topic: 'Ventes du Jour',
          subtitle: 'Chiffre d’affaires, nombre de commandes et espèces collectées',
        },
        {
          category: 'sales',
          question: 'Quel est mon produit le plus vendu ?',
          topic: 'Meilleures Ventes',
          subtitle: 'Découvrez quels produits génèrent le plus de revenus',
        },
        {
          category: 'inventory',
          question: 'Quels sont les produits en rupture ou stock faible ?',
          topic: 'Alertes de Stock',
          subtitle: 'Identifiez les produits à réapprovisionner d’urgence',
        },
        {
          category: 'debts',
          question: 'Qui me doit de l’argent ?',
          topic: 'Créances Clients',
          subtitle: 'Consultez les soldes impayés et retards de paiement',
        },
        {
          category: 'profit',
          question: 'Quel est mon bénéfice ce mois-ci ?',
          topic: 'Bénéfice Mensuel',
          subtitle: 'Détail du chiffre d’affaires net, coût d’achat et marge brute',
        },
        {
          category: 'profit',
          question: 'Quels produits ont la marge la plus élevée ?',
          topic: 'Meilleures Marges',
          subtitle: 'Voyez les articles générant la plus forte rentabilité',
        },
        {
          category: 'sales',
          question: 'Comment se portent mes ventes cette semaine ?',
          topic: 'Tendances Hebdo',
          subtitle: 'Comparez la performance par rapport aux semaines précédentes',
        },
      ]
    : [
        {
          category: 'advisory',
          question: 'What should I focus on today?',
          topic: 'Daily Priorities',
          subtitle: 'Key recommendations and urgent actions for your store today',
        },
        {
          category: 'sales',
          question: 'How are my sales today?',
          topic: "Today's Sales",
          subtitle: 'Check revenue, order count, and total cash collected today',
        },
        {
          category: 'sales',
          question: "What's my best-selling product?",
          topic: 'Top Sellers',
          subtitle: 'Find out which products are generating the most revenue',
        },
        {
          category: 'inventory',
          question: 'Which items are running low on stock?',
          topic: 'Low Stock Alerts',
          subtitle: 'Identify products near depletion that need reordering',
        },
        {
          category: 'debts',
          question: 'Who owes me money?',
          topic: 'Customer Debts',
          subtitle: 'Review outstanding customer balances and overdue payments',
        },
        {
          category: 'profit',
          question: 'What was my profit this month?',
          topic: 'Monthly Profit',
          subtitle: 'Breakdown of net revenue, product costs, and gross profit',
        },
        {
          category: 'profit',
          question: 'Which products have the highest profit margins?',
          topic: 'Highest Margins',
          subtitle: 'See which inventory items generate the best percentage returns',
        },
        {
          category: 'sales',
          question: 'Why are sales different this week?',
          topic: 'Sales Trends',
          subtitle: 'Compare current performance against prior week patterns',
        },
      ];

  const filteredQuestions =
    activeCategory === 'all'
      ? defaultQuestions
      : defaultQuestions.filter((q) => q.category === activeCategory);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Category Filter Pills */}
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
                    isActive ? 'text-sky-400' : isDark ? 'text-zinc-500' : 'text-slate-400'
                  }`}
                />
              )}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Suggested Questions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredQuestions.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectPrompt(item.question)}
            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer text-left ${
              isDark
                ? 'bg-zinc-900/60 border-zinc-800 hover:border-sky-500/50 hover:bg-zinc-850'
                : 'bg-white border-slate-200 hover:border-sky-500/60 hover:bg-sky-50/30 shadow-xs'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {item.topic}
                </span>

                <div className="flex items-center gap-1">
                  {onInsertPrompt && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertPrompt(item.question);
                      }}
                      className={`p-1 rounded-md text-xs transition-colors opacity-0 group-hover:opacity-100 ${
                        isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Edit question in composer before sending"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-sky-400 transition-colors shrink-0" />
                </div>
              </div>

              <p
                className={`text-xs sm:text-[13px] font-semibold leading-snug transition-colors ${
                  isDark
                    ? 'text-zinc-100 group-hover:text-white'
                    : 'text-slate-900 group-hover:text-sky-900'
                }`}
              >
                "{item.question}"
              </p>

              <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}>
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
