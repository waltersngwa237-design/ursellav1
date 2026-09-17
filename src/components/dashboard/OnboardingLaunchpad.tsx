import React from 'react';
import { Card } from '../common/Card.tsx';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import {
  ShoppingCart,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Boxes,
  Zap,
  X,
} from 'lucide-react';
import type { AppNavRoute } from '../../types/index.ts';

interface OnboardingLaunchpadProps {
  businessName: string;
  hasProducts: boolean;
  hasSales: boolean;
  hasAIInteraction: boolean;
  onNavigate: (route: AppNavRoute, prompt?: string) => void;
  onDismiss?: () => void;
}

export const OnboardingLaunchpad: React.FC<OnboardingLaunchpadProps> = ({
  businessName,
  hasProducts,
  hasSales,
  hasAIInteraction,
  onNavigate,
  onDismiss,
}) => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const steps = [
    {
      id: 'products',
      title: isFr ? 'Ajouter Votre Catalogue Initial' : 'Add Initial Inventory Catalog',
      description: isFr
        ? 'Créez vos articles avec prix d’achat (suivi PEPS), prix de vente et alertes de stock.'
        : 'Create products with cost price (FIFO tracking), selling price, and stock alerts.',
      icon: <Boxes className="w-5 h-5" />,
      completed: hasProducts,
      actionText: hasProducts
        ? isFr ? 'Gérer le Stock' : 'Manage Stock'
        : isFr ? 'Ajouter des Produits' : 'Add Products',
      route: 'business' as AppNavRoute,
      badge: hasProducts
        ? isFr ? 'Terminé' : 'Completed'
        : isFr ? 'Étape 1' : 'Step 1',
    },
    {
      id: 'sell',
      title: isFr ? 'Enregistrer une Première Vente' : 'Record First Point of Sale',
      description: isFr
        ? 'Testez la caisse enregistreuse ultra-rapide avec espèces, Mobile Money ou vente à crédit.'
        : 'Test the rapid POS counter with cash, Mobile Money, or credit invoicing.',
      icon: <ShoppingCart className="w-5 h-5" />,
      completed: hasSales,
      actionText: hasSales
        ? isFr ? 'Ouvrir la Caisse' : 'Open POS'
        : isFr ? 'Faire une Vente' : 'Start Sale',
      route: 'sell' as AppNavRoute,
      badge: hasSales
        ? isFr ? 'Terminé' : 'Completed'
        : isFr ? 'Étape 2' : 'Step 2',
    },
    {
      id: 'ai',
      title: isFr ? 'Activer le Co-pilote Financier IA' : 'Get Instant Financial Intelligence',
      description: isFr
        ? 'Interrogez Ursella IA pour connaître vos marges réelles, votre bénéfice et vos alertes de stock.'
        : 'Ask Ursella AI for real-time ledger metrics, gross profit, and restock guidance.',
      icon: <Sparkles className="w-5 h-5" />,
      completed: hasAIInteraction,
      actionText: isFr ? 'Conseiller IA' : 'Ask AI Advisor',
      route: 'ai' as AppNavRoute,
      prompt: isFr
        ? 'Fais-moi un résumé de notre configuration initiale et des priorités du commerce.'
        : 'Give me an executive summary of our initial setup and first operational priorities.',
      badge: hasAIInteraction
        ? isFr ? 'Actif' : 'Active'
        : isFr ? 'Étape 3' : 'Step 3',
    },
  ];

  const completedCount = [hasProducts, hasSales, hasAIInteraction].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Automatically disappear once all steps are completed
  if (completedCount === steps.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-emerald-950/20 p-5 sm:p-6 shadow-xl space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {isFr ? 'Bienvenue dans' : 'Welcome to'} {businessName}
            </h2>
            <Badge variant="emerald" size="sm">
              {isFr ? 'Guide de Démarrage' : 'Setup Guide'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            {isFr
              ? 'Suivez ces 3 étapes simples pour rendre votre commerce opérationnel et débloquer les rapports financiers en direct.'
              : 'Follow these 3 quick milestones to get your store operational and unlock automated real-time financial reporting.'}
          </p>
        </div>

        {/* Progress Pill & Dismiss Button */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-800/80 px-3.5 py-2 rounded-xl">
            <div className="text-right">
              <div className="text-xs font-bold text-white">
                {isFr ? `${completedCount} sur 3 terminées` : `${completedCount} of 3 Complete`}
              </div>
              <div className="text-[10px] text-zinc-400">
                {progressPercent}% {isFr ? 'Prêt' : 'Ready'}
              </div>
            </div>
            <div className="w-12 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-xl border border-zinc-800/80 transition-colors cursor-pointer"
              title={isFr ? 'Masquer le guide' : 'Dismiss Setup Guide'}
              aria-label={isFr ? 'Masquer le guide' : 'Dismiss Setup Guide'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3 Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
              step.completed
                ? 'bg-zinc-950/60 border-emerald-500/20'
                : 'bg-zinc-950/90 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    step.completed
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                  }`}
                >
                  {step.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : step.icon}
                </div>
                <Badge
                  variant={step.completed ? 'emerald' : 'zinc'}
                  size="sm"
                >
                  {step.badge}
                </Badge>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white mb-1">
                {step.title}
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                {step.description}
              </p>
            </div>

            <Button
              variant={step.completed ? 'outline' : 'primary'}
              size="sm"
              onClick={() => onNavigate(step.route, step.prompt)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />}
              className="w-full text-xs cursor-pointer group"
            >
              {step.actionText}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
