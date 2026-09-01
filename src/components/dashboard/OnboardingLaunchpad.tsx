import React from 'react';
import { Card } from '../common/Card.tsx';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';
import {
  PackagePlus,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Boxes,
  Zap,
  TrendingUp,
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
  const steps = [
    {
      id: 'products',
      title: 'Add Initial Inventory Catalog',
      description: 'Create products with cost price (FIFO tracking), selling price, and stock alerts.',
      icon: <Boxes className="w-5 h-5" />,
      completed: hasProducts,
      actionText: hasProducts ? 'Manage Stock' : 'Add Products',
      route: 'business' as AppNavRoute,
      badge: hasProducts ? 'Completed' : 'Step 1',
    },
    {
      id: 'sell',
      title: 'Record First Point of Sale',
      description: 'Test the rapid POS counter with cash, Mobile Money, or credit invoicing.',
      icon: <ShoppingCart className="w-5 h-5" />,
      completed: hasSales,
      actionText: hasSales ? 'Open POS' : 'Start Sale',
      route: 'sell' as AppNavRoute,
      badge: hasSales ? 'Completed' : 'Step 2',
    },
    {
      id: 'ai',
      title: 'Get Instant Financial Intelligence',
      description: 'Ask Ursella AI for real-time ledger metrics, gross profit, and restock guidance.',
      icon: <Sparkles className="w-5 h-5" />,
      completed: hasAIInteraction,
      actionText: 'Ask AI Advisor',
      route: 'ai' as AppNavRoute,
      prompt: 'Give me an executive summary of our initial setup and first operational priorities.',
      badge: hasAIInteraction ? 'Active' : 'Step 3',
    },
  ];

  const completedCount = [hasProducts, hasSales, hasAIInteraction].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-emerald-950/20 p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Welcome to {businessName}
            </h2>
            <Badge variant="emerald" size="sm">
              Setup Guide
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Follow these 3 quick milestones to get your store operational and unlock automated real-time financial reporting.
          </p>
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-800/80 px-3.5 py-2 rounded-xl self-start sm:self-auto">
          <div className="text-right">
            <div className="text-xs font-bold text-white">{completedCount} of 3 Complete</div>
            <div className="text-[10px] text-zinc-400">{progressPercent}% Ready</div>
          </div>
          <div className="w-12 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
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
                  className="text-[10px]"
                >
                  {step.badge}
                </Badge>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-zinc-100">{step.title}</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                {step.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800/80">
              <Button
                variant={step.completed ? 'outline' : 'primary'}
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => onNavigate(step.route, step.prompt)}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                {step.actionText}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
