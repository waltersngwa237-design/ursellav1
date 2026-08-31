import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  Sparkles,
  Zap,
  Phone,
  Shield,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  Users,
  Building,
  Check,
  RefreshCw,
  Info,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ExternalLink,
  Package,
} from 'lucide-react';
import { ClientSubscriptionService } from '../../services/subscription.service.ts';
import { DEFAULT_SUBSCRIPTION_PLANS, type SubscriptionPlan, type BusinessSubscription } from '../../types/index.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';

interface BillingPageProps {
  businessId?: string;
}

// Helper to convert USD baseline pricing into the business's preferred currency
function formatLocalizedPrice(usdAmount: number, currencyCode: string, billingCycle: 'monthly' | 'annual'): string {
  if (usdAmount === 0) return 'Free';

  const code = (currencyCode || 'USD').toUpperCase();
  let multiplier = 1;
  let symbol = '$';
  let position: 'prefix' | 'suffix' = 'prefix';

  switch (code) {
    case 'XAF':
    case 'XOF':
    case 'FCFA':
      multiplier = 635;
      symbol = ' FCFA';
      position = 'suffix';
      break;
    case 'NGN':
      multiplier = 1500;
      symbol = '₦';
      position = 'prefix';
      break;
    case 'GHS':
      multiplier = 15;
      symbol = 'GH₵ ';
      position = 'prefix';
      break;
    case 'KES':
      multiplier = 135;
      symbol = 'KSh ';
      position = 'prefix';
      break;
    case 'EUR':
      multiplier = 0.92;
      symbol = '€';
      position = 'prefix';
      break;
    case 'GBP':
      multiplier = 0.79;
      symbol = '£';
      position = 'prefix';
      break;
    default:
      multiplier = 1;
      symbol = '$';
      position = 'prefix';
  }

  const converted = Math.round(usdAmount * multiplier);
  const formattedNumber = converted.toLocaleString();

  if (position === 'suffix') {
    return `${formattedNumber}${symbol}`;
  }
  return `${symbol}${formattedNumber}`;
}

export const BillingPage: React.FC<BillingPageProps> = ({ businessId: propBusinessId }) => {
  const { activeBusiness, currency: preferredCurrency, activeSettings } = useBusiness();
  const businessId = propBusinessId || activeBusiness?.id || 'demo_biz_1';

  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);

  // Checkout modal state
  const [paymentProvider, setPaymentProvider] = useState<'momo' | 'stripe' | 'flutterwave'>('momo');
  const [momoPhone, setMomoPhone] = useState<string>('+237 670 000 000');
  const [momoNetwork, setMomoNetwork] = useState<'MTN' | 'ORANGE' | 'MPESA' | 'AIRTEL'>('MTN');
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'simulated_prompt' | 'success'>('details');
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [simulatedPin, setSimulatedPin] = useState<string>('1234');
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);

  const loadSubscriptionData = async () => {
    setLoading(true);
    try {
      const [fetchedPlans, fetchedSub] = await Promise.all([
        ClientSubscriptionService.getPlans(),
        ClientSubscriptionService.getBusinessSubscription(businessId),
      ]);
      setPlans(fetchedPlans);
      setSubscription(fetchedSub);
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

  const handleOpenCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlanForCheckout(plan);
    setCheckoutStep('details');
    setCheckoutMessage(null);
  };

  const handleExecuteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForCheckout || !businessId) return;

    setCheckoutLoading(true);
    setCheckoutMessage(null);
    try {
      const res = await ClientSubscriptionService.initiateCheckout({
        businessId,
        planId: selectedPlanForCheckout.id,
        billingCycle,
        provider: paymentProvider,
        phoneNumber: momoPhone || undefined,
        network: momoNetwork,
      });

      if (paymentProvider === 'momo') {
        // Switch to the simulated USSD push stage for testing while awaiting MoMo API
        setCheckoutStep('simulated_prompt');
      } else {
        // Direct or card
        const updated = await ClientSubscriptionService.activatePlan(
          businessId,
          selectedPlanForCheckout.id,
          paymentProvider
        );
        setSubscription(updated);
        setCheckoutStep('success');
      }
    } catch (err: any) {
      setCheckoutMessage(err.message || 'Payment initiation failed.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSimulateUssdApproval = async () => {
    if (!selectedPlanForCheckout || !businessId) return;
    setCheckoutLoading(true);
    try {
      const updated = await ClientSubscriptionService.activatePlan(
        businessId,
        selectedPlanForCheckout.id,
        'momo'
      );
      setSubscription(updated);
      setCheckoutStep('success');
      setActionSuccessToast(`Upgraded to ${selectedPlanForCheckout.name} successfully.`);
      setTimeout(() => setActionSuccessToast(null), 4000);
    } catch (err: any) {
      setCheckoutMessage(err.message || 'USSD Simulation failed.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleDirectPlanSwitch = async (plan: SubscriptionPlan) => {
    setLoading(true);
    try {
      const updated = await ClientSubscriptionService.activatePlan(businessId, plan.id, 'manual');
      setSubscription(updated);
      setActionSuccessToast(`Active plan set to ${plan.name}`);
      setTimeout(() => setActionSuccessToast(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activePlanId = subscription?.plan_id || 'plan_free';
  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];

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
            <Zap className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Subscription & Quota</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Commercial Billing & Usage</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Managing commercial tier for <strong className="text-zinc-200 font-semibold">{activeBusiness?.name || 'Your Store'}</strong> ({preferredCurrency || 'USD'}).
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-2xl self-start sm:self-auto">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              billingCycle === 'annual'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Annual</span>
            <span className="px-1.5 py-0.2 bg-emerald-400/20 text-emerald-300 text-[10px] rounded-full uppercase">
              Save ~17%
            </span>
          </button>
        </div>
      </div>

      {/* MoMo Gateway Status Banner (Awaiting MoMo Production Keys) */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-amber-200">
                Mobile Money (MoMo) Gateway: Sandbox Test Mode Active
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300">
                Awaiting Production API Keys
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
              You can test the complete MTN MoMo, Orange Money, and M-Pesa authorization flow with instant USSD push simulation and live quota tier upgrades.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-amber-300/80 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/20">
            Preferred Currency: {preferredCurrency || 'USD'}
          </span>
        </div>
      </div>

      {/* Usage & Active Subscription Summary Card */}
      {subscription && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    Current Plan: <span className="text-emerald-400">{subscription.plan?.name || activePlan.name}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 capitalize">
                    {subscription.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Active billing period renewal: {new Date(subscription.current_period_end).toLocaleDateString()} • Provider: <span className="font-semibold text-zinc-300 uppercase">{subscription.provider}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadSubscriptionData}
                className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                title="Refresh Quota"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Usage Meters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
            {/* AI Queries Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Ursella AI Monthly Queries</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {subscription.usage?.ai_queries_used || 0} / {subscription.usage?.ai_monthly_quota || activePlan.ai_monthly_quota}
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
                {(subscription.usage?.ai_monthly_quota || activePlan.ai_monthly_quota) - (subscription.usage?.ai_queries_used || 0)} queries remaining this cycle
              </p>
            </div>

            {/* Team Members Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Team Seats (Operator Access)</span>
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
                Supports role-based POS checkouts & auditing
              </p>
            </div>

            {/* Catalog Capacity Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Catalog SKU Limit</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {activePlan.max_products.toLocaleString()} SKUs
                </span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div className="h-full bg-amber-500 rounded-full w-full opacity-80" />
              </div>
              <p className="text-[11px] text-zinc-500">
                FIFO stock auditing & batch barcode tracking
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === activePlanId;
          const rawPrice = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
          const displayPrice = formatLocalizedPrice(rawPrice, preferredCurrency, billingCycle);
          const isPro = plan.tier === 'pro';

          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-6 flex flex-col justify-between transition-all ${
                isPro
                  ? 'bg-zinc-900 border-2 border-emerald-500/60 shadow-2xl shadow-emerald-950/40 relative'
                  : 'bg-zinc-900/60 border border-zinc-800'
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-500 text-zinc-950 text-[10px] font-black uppercase tracking-wider rounded-full shadow-md">
                  Most Popular for Merchants
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                </div>
                <p className="text-xs text-zinc-400 min-h-10 leading-relaxed">{plan.description}</p>

                <div className="mt-4 mb-6">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {displayPrice}
                  </span>
                  {rawPrice > 0 && (
                    <span className="text-xs text-zinc-400 font-medium ml-1">
                      /{billingCycle === 'annual' ? 'year' : 'month'}
                    </span>
                  )}
                  {preferredCurrency !== 'USD' && rawPrice > 0 && (
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      (approx. ${rawPrice} USD)
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800/80 pt-4 space-y-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Included Capabilities:
                  </span>
                  {plan.features_json.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-800/60 space-y-2">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold cursor-default flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Current Active Tier</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenCheckout(plan)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm ${
                      isPro
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    <span>Upgrade to {plan.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Instant Sandbox Switch Button for Quick Review / Demo Testing */}
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleDirectPlanSwitch(plan)}
                    className="w-full py-1.5 text-[11px] text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800/50 rounded-lg font-medium transition-colors"
                  >
                    Quick Switch (Sandbox Test)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout Modal */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-zinc-100 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Upgrade to {selectedPlanForCheckout.name}</h3>
                <p className="text-xs text-zinc-400">
                  Total:{' '}
                  <strong className="text-emerald-400 font-bold">
                    {formatLocalizedPrice(
                      billingCycle === 'annual'
                        ? selectedPlanForCheckout.annual_price
                        : selectedPlanForCheckout.monthly_price,
                      preferredCurrency,
                      billingCycle
                    )}
                  </strong>{' '}
                  ({billingCycle})
                </p>
              </div>
              <button
                onClick={() => setSelectedPlanForCheckout(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                ✕
              </button>
            </div>

            {checkoutStep === 'success' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Subscription Activated!</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Your account now has access to {selectedPlanForCheckout.name} quotas ({selectedPlanForCheckout.ai_monthly_quota.toLocaleString()} AI queries/month, {selectedPlanForCheckout.max_members} seats).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlanForCheckout(null);
                    loadSubscriptionData();
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

            {checkoutStep === 'simulated_prompt' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 text-xs text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    <span>USSD Prompt Push Simulation</span>
                  </div>
                  <p className="leading-relaxed">
                    A USSD prompt for <strong>{formatLocalizedPrice(
                      billingCycle === 'annual'
                        ? selectedPlanForCheckout.annual_price
                        : selectedPlanForCheckout.monthly_price,
                      preferredCurrency,
                      billingCycle
                    )}</strong> has been sent to <strong>{momoPhone}</strong> ({momoNetwork}).
                  </p>
                  <p className="text-[11px] text-amber-300/80">
                    <em>Dial *126# on device or confirm prompt below to finalize sandbox authorization.</em>
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                  <label className="block text-[11px] text-zinc-400">Enter PIN / Simulation Token</label>
                  <input
                    type="password"
                    value={simulatedPin}
                    onChange={(e) => setSimulatedPin(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white text-center tracking-widest focus:outline-hidden focus:border-emerald-500"
                    placeholder="••••"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('details')}
                    className="w-1/3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateUssdApproval}
                    disabled={checkoutLoading}
                    className="w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
                  >
                    {checkoutLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Authorize & Upgrade</span>
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === 'details' && (
              <form onSubmit={handleExecuteCheckout} className="space-y-4">
                {/* Payment Gateway Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentProvider('momo')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        paymentProvider === 'momo'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                      }`}
                    >
                      <Phone className="w-5 h-5 text-amber-400" />
                      <span>Mobile Money</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentProvider('stripe')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        paymentProvider === 'stripe'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-indigo-400" />
                      <span>Card / Online</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Money Details */}
                {paymentProvider === 'momo' && (
                  <div className="space-y-3 p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                      {(['MTN', 'ORANGE', 'MPESA', 'AIRTEL'] as const).map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setMomoNetwork(net)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            momoNetwork === net
                              ? 'bg-amber-500 text-zinc-950'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                          }`}
                        >
                          {net}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                        Registered Mobile Money Phone
                      </label>
                      <input
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="+237 670 000 000"
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  {checkoutLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Initiating Payment Prompt...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>{paymentProvider === 'momo' ? 'Continue with MoMo Prompt' : 'Authorize Payment'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
