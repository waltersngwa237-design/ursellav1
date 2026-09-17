import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  Sparkles,
  Zap,
  Shield,
  RefreshCw,
  Cpu,
  Users,
  Package,
  CheckCircle2,
  Check,
  Gift,
  Layers,
  Database,
} from 'lucide-react';
import { ClientSubscriptionService } from '../../services/subscription.service.ts';
import { DEFAULT_SUBSCRIPTION_PLANS, type SubscriptionPlan, type BusinessSubscription } from '../../types/index.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { ProductService } from '../../services/product.service.ts';
import { isSupabaseConfigured } from '../../lib/supabase/client.ts';

interface BillingPageProps {
  businessId?: string;
}

export const BillingPage: React.FC<BillingPageProps> = ({ businessId: propBusinessId }) => {
  const { activeBusiness, currency: preferredCurrency } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const businessId = propBusinessId || activeBusiness?.id || 'demo_biz_1';

  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);

  const loadSubscriptionData = async () => {
    setLoading(true);
    try {
      const [fetchedPlans, fetchedSub, fetchedProducts] = await Promise.all([
        ClientSubscriptionService.getPlans(),
        ClientSubscriptionService.getBusinessSubscription(businessId),
        ProductService.getProducts(businessId).catch(() => []),
      ]);
      setPlans(fetchedPlans);
      setSubscription(fetchedSub);
      setTotalProductsCount(Array.isArray(fetchedProducts) ? fetchedProducts.length : 0);
    } catch (e) {
      console.error('Error loading billing info:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      loadSubscriptionData();
    }
  }, [businessId]);

  const activePlan = plans[0] || DEFAULT_SUBSCRIPTION_PLANS[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {actionSuccessToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Gift className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {isFr ? 'Accès Gratuit & Quotas' : 'Free Access & Quotas'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isFr ? 'Offre Communautaire Gratuite' : 'Free Community Tier'}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {isFr
              ? 'Toutes les fonctionnalités Ursella sont 100% gratuites et débloquées pour '
              : 'All Ursella features are 100% free and unlocked for '}
            <strong className="text-zinc-200 font-semibold">{activeBusiness?.name || (isFr ? 'Votre Boutique' : 'Your Store')}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            <span>{isFr ? 'Offre 100% Gratuite Active' : '100% Free Plan Active'}</span>
          </span>
        </div>
      </div>

      {/* Free Tier Callout Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {isFr ? 'Toutes les fonctionnalités incluses sans frais' : 'Full Platform Features Included at Zero Cost'}
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed max-w-2xl">
              {isFr
                ? 'Profitez des encaissements caisse illimités, du suivi FIFO des stocks, du copilote IA Ursella, du carnet de crédits clients et des rapports financiers sans aucun abonnement requis.'
                : 'Enjoy unlimited Point of Sale checkouts, FIFO inventory tracking, Ursella AI co-pilot, customer credit ledgers, and financial reports without any payment required.'}
            </p>
          </div>
        </div>

        <button
          onClick={loadSubscriptionData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isFr ? 'Actualiser' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Usage & Active Subscription Summary Card */}
      {subscription && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    {isFr ? 'Offre Active :' : 'Current Plan:'}{' '}
                    <span className="text-emerald-400">{subscription.plan?.name || activePlan.name}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 capitalize">
                    {isFr && subscription.status === 'active' ? 'Active' : subscription.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {isFr ? 'Accès complet activé • Aucun paiement requis' : 'Full tier access enabled • No billing required'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                {isFr ? '0 FCFA / Gratuit à vie' : '$0 / Free Forever'}
              </span>
            </div>
          </div>

          {/* Usage Meters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
            {/* AI Queries Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>{isFr ? 'Requêtes Mensuelles Ursella IA' : 'Ursella AI Monthly Queries'}</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {subscription.usage?.ai_queries_used || 0} / {(subscription.usage?.ai_monthly_quota || activePlan.ai_monthly_quota).toLocaleString()}
                </span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription.usage?.ai_queries_used || 0) / (subscription.usage?.ai_monthly_quota || activePlan.ai_monthly_quota || 100)) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {isFr ? 'Quota généreux inclus pour toutes vos analyses' : 'Generous quota included for all business prompts & analysis'}
              </p>
            </div>

            {/* Team Members Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>{isFr ? 'Comptes Équipe (Accès Caissiers)' : 'Team Seats (Operator Access)'}</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {subscription.usage?.members_count || 1} / {subscription.usage?.max_members || activePlan.max_members}
                </span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription.usage?.members_count || 1) / (subscription.usage?.max_members || activePlan.max_members || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {isFr ? 'Prise en charge de multiples caissiers & rôles' : 'Supports multiple cashier logins & role management'}
              </p>
            </div>

            {/* Catalog Capacity Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>{isFr ? 'Articles du Catalogue' : 'Catalog Products'} ({totalProductsCount})</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {totalProductsCount} / {activePlan.max_products.toLocaleString()} SKUs
                </span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (totalProductsCount / (activePlan.max_products || 100)) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {isFr ? 'Suivi du coût FIFO & gestion par codes-barres' : 'FIFO cost tracking & barcode stock management'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Included Features Overview */}
      <div className="rounded-3xl bg-zinc-900/70 border border-zinc-800 p-6 sm:p-8">
        <div className="mb-6">
          <h3 className="text-base font-bold text-white">
            {isFr ? 'Toutes les Fonctionnalités Incluses' : 'All Included Free Capabilities'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {isFr
              ? 'Tout le nécessaire pour gérer, sécuriser et développer votre boutique est inclus gratuitement.'
              : 'Everything you need to run, manage, and scale your store operations is completely free.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activePlan.features_json.map((feat, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-3 hover:border-zinc-700 transition-colors"
            >
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-200 block">{feat}</span>
                <span className="text-[10px] text-emerald-400/90 font-medium">
                  {isFr ? 'Inclus Gratuitement' : 'Included Free'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
