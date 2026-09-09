import webpush from 'web-push';

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  businessId?: string;
  userId?: string;
  createdAt: string;
}

// In-memory subscription registry (with fallback storage across sessions)
const subscriptions: Map<string, PushSubscriptionRecord> = new Map();

// Initialize VAPID Keys
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@ursella.app';

// If no VAPID keys are in process.env, generate a valid session keypair so push works immediately
if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = generated.publicKey;
    vapidPrivateKey = generated.privateKey;
    console.log('[WebPush] Generated fallback VAPID keypair for session');
  } catch (err) {
    console.error('[WebPush] Error generating fallback VAPID keys:', err);
  }
}

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[WebPush] VAPID configured successfully');
  } catch (err) {
    console.error('[WebPush] Failed to set VAPID details:', err);
  }
}

export class PushNotificationService {
  public static getPublicKey(): string {
    return vapidPublicKey;
  }

  public static isConfigured(): boolean {
    return Boolean(vapidPublicKey && vapidPrivateKey);
  }

  public static registerSubscription(
    businessId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userId?: string
  ): boolean {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return false;
    }

    subscriptions.set(subscription.endpoint, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      businessId,
      userId,
      createdAt: new Date().toISOString(),
    });

    console.log(`[WebPush] Registered subscription for business ${businessId}. Total subscriptions: ${subscriptions.size}`);
    return true;
  }

  public static unregisterSubscription(endpoint: string): boolean {
    if (!endpoint) return false;
    return subscriptions.delete(endpoint);
  }

  public static getSubscriptionsForBusiness(businessId: string): PushSubscriptionRecord[] {
    const result: PushSubscriptionRecord[] = [];
    for (const sub of subscriptions.values()) {
      if (!businessId || sub.businessId === businessId) {
        result.push(sub);
      }
    }
    return result;
  }

  public static async sendToSubscription(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      url?: string;
      tag?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'VAPID keys not configured on server' };
    }

    try {
      const payloadString = JSON.stringify({
        title: payload.title || 'Ursella Business Alert',
        body: payload.body || 'You have an operational update.',
        icon: payload.icon || '/pwa-192x192.png',
        badge: payload.badge || '/pwa-192x192.png',
        url: payload.url || '/#/',
        tag: payload.tag || 'general-alert',
        timestamp: Date.now(),
      });

      await webpush.sendNotification(subscription, payloadString, {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'high',
      });

      return { success: true };
    } catch (err: any) {
      console.error('[WebPush] Error sending push notification:', err?.message || err);
      // If subscription expired or invalid (410 Gone / 404 Not Found), unregister
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        subscriptions.delete(subscription.endpoint);
      }
      return { success: false, error: err?.message || 'Failed to dispatch push notification' };
    }
  }

  public static async sendToBusiness(
    businessId: string,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      url?: string;
      tag?: string;
    }
  ): Promise<{ sentCount: number; errors: string[] }> {
    const businessSubs = this.getSubscriptionsForBusiness(businessId);
    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of businessSubs) {
      const result = await this.sendToSubscription(sub, payload);
      if (result.success) {
        sentCount++;
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    return { sentCount, errors };
  }
}
