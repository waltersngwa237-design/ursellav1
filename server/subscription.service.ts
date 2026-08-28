import { serverSupabase } from './business-tools.service.ts';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  description: string;
  monthly_price: number;
  annual_price: number;
  currency: string;
  features_json: string[];
  max_members: number;
  ai_monthly_quota: number;
  max_products: number;
  allows_csv_import: boolean;
  allows_export: boolean;
  allows_advanced_reports: boolean;
  allows_push_notifications: boolean;
  is_active: boolean;
}

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'incomplete';
  provider: 'momo' | 'stripe' | 'flutterwave' | 'paystack' | 'manual';
  provider_subscription_id?: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan?: SubscriptionPlan;
  usage?: {
    ai_queries_used: number;
    ai_monthly_quota: number;
    members_count: number;
    max_members: number;
  };
}

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free',
    name: 'Starter Free',
    tier: 'free',
    description: 'Essential POS, inventory and deterministic analytics for single-operator stores.',
    monthly_price: 0,
    annual_price: 0,
    currency: 'USD',
    features_json: [
      'Core POS Sales & Digital Receipts',
      'Deterministic Financial Metrics',
      '1 Team Member / Operator',
      '100 AI Queries / Month',
      'Standard Inventory Tracking',
      'Basic Sales & Expense Reports',
    ],
    max_members: 1,
    ai_monthly_quota: 100,
    max_products: 100,
    allows_csv_import: true,
    allows_export: true,
    allows_advanced_reports: false,
    allows_push_notifications: false,
    is_active: true,
  },
  {
    id: 'plan_pro',
    name: 'Ursella Pro',
    tier: 'pro',
    description: 'Proactive AI anomaly detection, team roles, WhatsApp reminders, and multi-device access.',
    monthly_price: 15,
    annual_price: 150,
    currency: 'USD',
    features_json: [
      'All Starter Free Capabilities',
      'Continuous Proactive Anomaly Alerts',
      'Up to 5 Team Members with RBAC',
      '1,000 AI Queries / Month',
      'Full Financial Statement Reports & PDF',
      'CSV Data Import & Bulk Migration',
      'Customer WhatsApp Debt Reminders',
    ],
    max_members: 5,
    ai_monthly_quota: 1000,
    max_products: 2500,
    allows_csv_import: true,
    allows_export: true,
    allows_advanced_reports: true,
    allows_push_notifications: true,
    is_active: true,
  },
  {
    id: 'plan_business',
    name: 'Ursella Scale',
    tier: 'business',
    description: 'High-velocity shops, wholesale distributors, and multi-branch commercial operations.',
    monthly_price: 45,
    annual_price: 450,
    currency: 'USD',
    features_json: [
      'All Ursella Pro Capabilities',
      'Unlimited Team Members & Roles',
      '10,000 AI Queries / Month',
      'Automated Action Authorizations',
      'Priority MoMo & Card Webhooks',
      'Full Audit Trail & Export API',
      'Dedicated Account Support',
    ],
    max_members: 50,
    ai_monthly_quota: 10000,
    max_products: 100000,
    allows_csv_import: true,
    allows_export: true,
    allows_advanced_reports: true,
    allows_push_notifications: true,
    is_active: true,
  },
];

// In-memory cache fallback for demo/offline resilience
const memorySubscriptions: Map<string, BusinessSubscription> = new Map();

export class SubscriptionService {
  /**
   * Get all active subscription plans
   */
  static async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await serverSupabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true });

      if (error || !data || data.length === 0) {
        return DEFAULT_PLANS;
      }
      return data as SubscriptionPlan[];
    } catch {
      return DEFAULT_PLANS;
    }
  }

  /**
   * Get the active subscription for a specific business with usage metrics
   */
  static async getBusinessSubscription(businessId: string): Promise<BusinessSubscription> {
    const plans = await this.getPlans();
    const defaultPlan = plans[0] || DEFAULT_PLANS[0];

    let sub: BusinessSubscription | null = null;

    try {
      const { data, error } = await serverSupabase
        .from('business_subscriptions')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (!error && data) {
        sub = data as BusinessSubscription;
      }
    } catch (e) {
      console.warn(`[SubscriptionService] Supabase query fallback for business ${businessId}:`, e);
    }

    if (!sub) {
      sub = memorySubscriptions.get(businessId) || {
        id: `sub_${businessId}`,
        business_id: businessId,
        plan_id: 'plan_free',
        status: 'active',
        provider: 'manual',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
        cancel_at_period_end: false,
      };
    }

    const matchedPlan = plans.find((p) => p.id === sub?.plan_id) || defaultPlan;
    sub.plan = matchedPlan;

    // Calculate monthly AI usage
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    let aiUsageCount = 0;
    let membersCount = 1;

    try {
      const { count: aiCount } = await serverSupabase
        .from('ai_usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', startOfMonth);

      if (typeof aiCount === 'number') aiUsageCount = aiCount;

      const { count: mCount } = await serverSupabase
        .from('business_members')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      if (typeof mCount === 'number') membersCount = mCount;
    } catch {
      // ignore
    }

    sub.usage = {
      ai_queries_used: aiUsageCount,
      ai_monthly_quota: matchedPlan.ai_monthly_quota,
      members_count: Math.max(1, membersCount),
      max_members: matchedPlan.max_members,
    };

    memorySubscriptions.set(businessId, sub);
    return sub;
  }

  /**
   * Check if a business has entitlement for a specific feature
   */
  static async checkEntitlement(
    businessId: string,
    feature: 'ai_query' | 'advanced_reports' | 'csv_import' | 'data_export' | 'push_notifications' | 'add_member'
  ): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
    const sub = await this.getBusinessSubscription(businessId);
    const plan = sub.plan || DEFAULT_PLANS[0];

    if (feature === 'ai_query') {
      const used = sub.usage?.ai_queries_used || 0;
      if (used >= plan.ai_monthly_quota) {
        return {
          allowed: false,
          reason: `You have reached your monthly AI query limit (${plan.ai_monthly_quota}). Upgrade to Ursella Pro or Scale to increase quota.`,
          upgradeRequired: true,
        };
      }
      return { allowed: true };
    }

    if (feature === 'advanced_reports' && !plan.allows_advanced_reports) {
      return {
        allowed: false,
        reason: 'Advanced financial statements and multi-period reports are available on Ursella Pro and Scale plans.',
        upgradeRequired: true,
      };
    }

    if (feature === 'push_notifications' && !plan.allows_push_notifications) {
      return {
        allowed: false,
        reason: 'Web Push and background alert delivery is available on Pro and Scale tiers.',
        upgradeRequired: true,
      };
    }

    if (feature === 'add_member') {
      const current = sub.usage?.members_count || 1;
      if (current >= plan.max_members) {
        return {
          allowed: false,
          reason: `Your current plan allows up to ${plan.max_members} team members. Upgrade to invite additional staff.`,
          upgradeRequired: true,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Update or activate a business subscription
   */
  static async activateSubscription(
    businessId: string,
    planId: string,
    provider: 'momo' | 'stripe' | 'flutterwave' | 'paystack' | 'manual',
    providerSubId?: string
  ): Promise<BusinessSubscription> {
    const plans = await this.getPlans();
    const plan = plans.find((p) => p.id === planId) || DEFAULT_PLANS[1];

    const updatedSub: BusinessSubscription = {
      id: `sub_${businessId}`,
      business_id: businessId,
      plan_id: plan.id,
      status: 'active',
      provider,
      provider_subscription_id: providerSubId || `sub_ext_${Date.now()}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: false,
      plan,
    };

    try {
      await serverSupabase.from('business_subscriptions').upsert(
        {
          business_id: businessId,
          plan_id: plan.id,
          status: 'active',
          provider,
          provider_subscription_id: updatedSub.provider_subscription_id,
          current_period_start: updatedSub.current_period_start,
          current_period_end: updatedSub.current_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      );
    } catch (e) {
      console.warn('[SubscriptionService] Error persisting subscription to Supabase, saved in memory:', e);
    }

    memorySubscriptions.set(businessId, updatedSub);
    return updatedSub;
  }
}
