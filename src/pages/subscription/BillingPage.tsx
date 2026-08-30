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
} from 'lucide-react';
import { ClientSubscriptionService } from '../../services/subscription.service.ts';
import { DEFAULT_SUBSCRIPTION_PLANS, type SubscriptionPlan, type BusinessSubscription } from '../../types/index.ts';

interface BillingPageProps {
  businessId: string;
}

export const BillingPage: React.FC<BillingPageProps> = ({ businessId }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);

  // Checkout modal state
  const [paymentProvider, setPaymentProvider] = useState<'momo' | 'stripe' | 'flutterwave'>('momo');
  const [momoPhone, setMomoPhone] = useState<string>('');
  const [momoNetwork, setMomoNetwork] = useState<'MTN' | 'ORANGE' | 'MPESA'>('MTN');
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

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

      if (res.instructions) {
        setCheckoutMessage(res.instructions);
      }

      // Re-fetch subscription after short delay to reflect status
      setTimeout(() => {
        loadSubscriptionData();
      }, 3000);
    } catch (err: any) {
      setCheckoutMessage(err.message || 'Payment initiation failed.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const activePlanId = subscription?.plan_id || 'plan_free';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Zap className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Subscription & Quota</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Commercial Billing & Usage</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Transparent pricing scaled for small merchants, pharmacies, and growing retail distributors.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-2xl">
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
              Save 17%
            </span>
          </button>
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
                    Current Plan: <span className="text-emerald-400">{subscription.plan?.name || 'Starter Free'}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 capitalize">
                    {subscription.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Active billing period renewal: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-zinc-400 text-right mr-2 hidden sm:block">
                <div className="text-white font-bold">Provider: {subscription.provider.toUpperCase()}</div>
                <div>Status: Active</div>
              </div>
            </div>
          </div>

          {/* Usage Meters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
            {/* AI Queries Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>AI Business Queries (Monthly Quota)</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {subscription.usage?.ai_queries_used || 0} / {subscription.usage?.ai_monthly_quota || 100}
                </span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription.usage?.ai_queries_used || 0) / (subscription.usage?.ai_monthly_quota || 100)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Team Members Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Team Seats (Operator Access)</span>
                </span>
                <span className="font-mono text-zinc-200 font-bold">
                  {subscription.usage?.members_count || 1} / {subscription.usage?.max_members || 1}
                </span>
              </div>
              <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription.usage?.members_count || 1) / (subscription.usage?.max_members || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === activePlanId;
          const price = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
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
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                </div>
                <p className="text-xs text-zinc-400 min-h-10 leading-relaxed">{plan.description}</p>

                <div className="mt-4 mb-6">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    ${price}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    /{billingCycle === 'annual' ? 'year' : 'month'}
                  </span>
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

              <div className="mt-8 pt-4 border-t border-zinc-800/60">
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout Modal */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-zinc-100 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Upgrade to {selectedPlanForCheckout.name}</h3>
                <p className="text-xs text-zinc-400">
                  Total:{' '}
                  <strong className="text-emerald-400">
                    ${billingCycle === 'annual' ? selectedPlanForCheckout.annual_price : selectedPlanForCheckout.monthly_price}{' '}
                    USD
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

            {checkoutMessage ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs space-y-3">
                <p className="font-semibold text-white">{checkoutMessage}</p>
                <button
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="w-full py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
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
                      <span>Credit / Debit Card</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Money Details */}
                {paymentProvider === 'momo' && (
                  <div className="space-y-3 p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                      {(['MTN', 'ORANGE', 'MPESA'] as const).map((net) => (
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
                      <span>Processing Gateway Authorization...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Authorize Payment</span>
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
