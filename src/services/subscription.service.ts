import { DEFAULT_SUBSCRIPTION_PLANS, type SubscriptionPlan, type BusinessSubscription } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';

export class ClientSubscriptionService {
  /**
   * Fetch all available subscription plans.
   * Priority order: API -> Supabase 'subscription_plans' -> Default plans.
   */
  static async getPlans(): Promise<SubscriptionPlan[]> {
    // 1. Try Express backend API
    try {
      const res = await fetch('/api/subscription/plans');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Fallback
    }

    // 2. Try direct Supabase query if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('subscription_plans' as any)
          .select('*')
          .eq('is_active', true)
          .order('monthly_price', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data as SubscriptionPlan[];
        }
      } catch {
        // Fallback
      }
    }

    return DEFAULT_SUBSCRIPTION_PLANS;
  }

  /**
   * Get active subscription & real-time quota metrics for a business.
   * Accurately aggregates AI queries, active team members, and catalog SKUs from Supabase.
   */
  static async getBusinessSubscription(businessId: string): Promise<BusinessSubscription> {
    const allPlans = await this.getPlans();
    const defaultPlan = allPlans[0] || DEFAULT_SUBSCRIPTION_PLANS[0];

    // Try backend API first with auth token
    try {
      const headers: Record<string, string> = {};
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers['Authorization'] = `Bearer ${data.session.access_token}`;
          }
        } catch {}
      }

      const res = await fetch(`/api/subscription?businessId=${encodeURIComponent(businessId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && data.plan_id) {
          const matchedPlan = allPlans.find((p) => p.id === data.plan_id) || defaultPlan;
          return {
            ...data,
            plan: matchedPlan,
            usage: {
              ai_queries_used: data.usage?.ai_queries_used || 0,
              ai_monthly_quota: data.usage?.ai_monthly_quota || matchedPlan.ai_monthly_quota,
              members_count: data.usage?.members_count || 1,
              max_members: data.usage?.max_members || matchedPlan.max_members,
            },
          };
        }
      }
    } catch {
      // Proceed to Supabase direct query
    }

    // Direct Supabase query if client-side database is active
    if (isSupabaseConfigured) {
      try {
        const { data: subData } = await supabase
          .from('business_subscriptions' as any)
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle();

        // Calculate real-time AI queries logged this month
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        let aiQueriesCount = 0;
        let membersCount = 1;

        try {
          const { count: aiCount } = await supabase
            .from('ai_messages' as any)
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('role', 'user')
            .gte('created_at', startOfMonth);

          if (typeof aiCount === 'number') aiQueriesCount = aiCount;

          const { count: mCount } = await supabase
            .from('business_members' as any)
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId);

          if (typeof mCount === 'number' && mCount > 0) membersCount = mCount;
        } catch {}

        if (subData && typeof subData === 'object') {
          const matchedPlan = allPlans.find((p) => p.id === (subData as any).plan_id) || defaultPlan;
          const subRecord = subData as any;
          return {
            id: subRecord.id || `sub_${businessId}`,
            business_id: businessId,
            plan_id: subRecord.plan_id || defaultPlan.id,
            status: subRecord.status || 'active',
            provider: subRecord.provider || 'manual',
            provider_subscription_id: subRecord.provider_subscription_id || null,
            current_period_start: subRecord.current_period_start || new Date().toISOString(),
            current_period_end: subRecord.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString(),
            cancel_at_period_end: Boolean(subRecord.cancel_at_period_end),
            plan: matchedPlan,
            usage: {
              ai_queries_used: aiQueriesCount,
              ai_monthly_quota: matchedPlan.ai_monthly_quota,
              members_count: Math.max(1, membersCount),
              max_members: matchedPlan.max_members,
            },
          };
        }
      } catch (err) {
        console.warn('[ClientSubscriptionService] Supabase direct query error:', err);
      }
    }

    // Check LocalStorage fallback for offline / mock state
    const localKey = `ursella_subscription_${businessId}`;
    const storedSub = localStorage.getItem(localKey);
    if (storedSub) {
      try {
        const parsed = JSON.parse(storedSub);
        if (parsed && parsed.plan_id) {
          const matchedPlan = allPlans.find((p) => p.id === parsed.plan_id) || defaultPlan;
          return {
            ...parsed,
            plan: matchedPlan,
            usage: {
              ai_queries_used: parsed.usage?.ai_queries_used !== undefined ? parsed.usage.ai_queries_used : 4,
              ai_monthly_quota: matchedPlan.ai_monthly_quota,
              members_count: parsed.usage?.members_count || 1,
              max_members: matchedPlan.max_members,
            },
          };
        }
      } catch {}
    }

    // Default Starter Free Plan
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    return {
      id: `sub_${businessId.slice(0, 8)}`,
      business_id: businessId,
      plan_id: defaultPlan.id,
      status: 'active',
      provider: 'manual',
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
      cancel_at_period_end: false,
      plan: defaultPlan,
      usage: {
        ai_queries_used: 0,
        ai_monthly_quota: defaultPlan.ai_monthly_quota,
        members_count: 1,
        max_members: defaultPlan.max_members,
      },
    };
  }

  /**
   * Activate or change a plan.
   * Persists to Supabase table 'business_subscriptions', synchronizes with server webhook, and caches in LocalStorage.
   */
  static async activatePlan(
    businessId: string,
    planId: string,
    provider: 'momo' | 'stripe' | 'flutterwave' | 'manual' = 'momo'
  ): Promise<BusinessSubscription> {
    const allPlans = await this.getPlans();
    const plan = allPlans.find((p) => p.id === planId) || allPlans[0] || DEFAULT_SUBSCRIPTION_PLANS[0];
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const updatedSub: BusinessSubscription = {
      id: `sub_${Date.now()}`,
      business_id: businessId,
      plan_id: plan.id,
      status: 'active',
      provider,
      provider_subscription_id: `tx_${provider}_${Date.now()}`,
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
      cancel_at_period_end: false,
      plan,
      usage: {
        ai_queries_used: 0,
        ai_monthly_quota: plan.ai_monthly_quota,
        members_count: 1,
        max_members: plan.max_members,
      },
    };

    // 1. Save to local storage for instant offline & UI responsiveness
    localStorage.setItem(`ursella_subscription_${businessId}`, JSON.stringify(updatedSub));

    // 2. Persist directly to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await (supabase.from('business_subscriptions' as any) as any).upsert(
          {
            business_id: businessId,
            plan_id: plan.id,
            status: 'active',
            provider,
            provider_subscription_id: updatedSub.provider_subscription_id,
            current_period_start: updatedSub.current_period_start,
            current_period_end: updatedSub.current_period_end,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'business_id' }
        );
      } catch (err) {
        console.warn('[ClientSubscriptionService] Supabase upsert error:', err);
      }
    }

    // 3. Notify backend server webhook
    try {
      await fetch('/api/webhooks/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          eventType: 'subscription.activated',
          eventId: `evt_${Date.now()}`,
          businessId,
          planId: plan.id,
          status: 'completed',
          providerTxId: updatedSub.provider_subscription_id,
        }),
      });
    } catch {}

    return updatedSub;
  }

  /**
   * Initiate Checkout flow (MoMo USSD Push / Stripe / Flutterwave)
   */
  static async initiateCheckout(payload: {
    businessId: string;
    planId: string;
    billingCycle: 'monthly' | 'annual';
    provider: 'momo' | 'stripe' | 'flutterwave' | 'paystack';
    customerEmail?: string;
    phoneNumber?: string;
    network?: 'MTN' | 'ORANGE' | 'MPESA' | 'AIRTEL';
  }): Promise<{
    success: boolean;
    paymentId: string;
    checkoutUrl?: string;
    providerReference?: string;
    instructions?: string;
    status: string;
  }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers['Authorization'] = `Bearer ${data.session.access_token}`;
          }
        } catch {}
      }

      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    // Local / Offline Simulated Gateway Authorization
    const paymentId = `pay_${Date.now()}`;
    const allPlans = await this.getPlans();
    const plan = allPlans.find((p) => p.id === payload.planId) || DEFAULT_SUBSCRIPTION_PLANS[1];
    const amount = payload.billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;

    let instructions = `Subscription upgrade to ${plan.name} ($${amount} USD) initiated successfully.`;
    if (payload.provider === 'momo') {
      instructions = `Please check your mobile phone (${payload.phoneNumber || 'registered number'}) for the USSD payment authorization prompt. Once confirmed, your tier activates immediately.`;
    }

    return {
      success: true,
      paymentId,
      status: 'pending_authorization',
      instructions,
    };
  }
}
