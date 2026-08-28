import type { SubscriptionPlan, BusinessSubscription } from '../types/index.ts';

export class ClientSubscriptionService {
  static async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const res = await fetch('/api/subscription/plans');
      if (!res.ok) throw new Error('Failed to fetch plans');
      return await res.json();
    } catch {
      return [];
    }
  }

  static async getBusinessSubscription(businessId: string): Promise<BusinessSubscription | null> {
    try {
      const res = await fetch(`/api/subscription?businessId=${encodeURIComponent(businessId)}`);
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return await res.json();
    } catch {
      return null;
    }
  }

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
    const res = await fetch('/api/subscription/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to initiate checkout');
    }
    return await res.json();
  }
}
