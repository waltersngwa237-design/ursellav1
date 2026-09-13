import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { serverSupabase } from './business-tools.service.ts';

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  businessId?: string;
  userId?: string;
  timezone?: string;
  createdAt: string;
}

// Persistent Storage Paths
const VAPID_FILE = path.join(process.cwd(), '.vapid.json');
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), '.push_subscriptions.json');

// Subscription registry with disk persistence across server restarts
const subscriptions: Map<string, PushSubscriptionRecord> = new Map();

// Helper to save subscriptions to disk
function saveSubscriptionsToDisk() {
  try {
    const list = Array.from(subscriptions.values());
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[WebPush] Error saving subscriptions to disk:', err);
  }
}

// Helper to load subscriptions from disk
function loadSubscriptionsFromDisk() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const raw = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      const list: PushSubscriptionRecord[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((sub) => {
          if (sub?.endpoint) {
            subscriptions.set(sub.endpoint, sub);
          }
        });
        console.log(`[WebPush] Restored ${subscriptions.size} push subscriptions from disk.`);
      }
    }
  } catch (err) {
    console.error('[WebPush] Error loading subscriptions from disk:', err);
  }
}

// Initialize VAPID Keys with disk persistence
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@ursella.app';

if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
      if (saved.publicKey && saved.privateKey) {
        vapidPublicKey = saved.publicKey;
        vapidPrivateKey = saved.privateKey;
        console.log('[WebPush] Loaded persistent VAPID keypair from disk');
      }
    }
  } catch (err) {
    console.error('[WebPush] Failed reading .vapid.json:', err);
  }
}

if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = generated.publicKey;
    vapidPrivateKey = generated.privateKey;
    fs.writeFileSync(
      VAPID_FILE,
      JSON.stringify({ publicKey: vapidPublicKey, privateKey: vapidPrivateKey }, null, 2),
      'utf-8'
    );
    console.log('[WebPush] Generated and persisted new VAPID keypair to .vapid.json');
  } catch (err) {
    console.error('[WebPush] Error generating VAPID keys:', err);
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

// Load saved subscriptions on boot
loadSubscriptionsFromDisk();

// Morning brief tracking to avoid duplicates on the same calendar day
const morningBriefsSentDate = new Map<string, string>(); // businessId -> YYYY-MM-DD

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
    userId?: string,
    timezone?: string
  ): boolean {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return false;
    }

    subscriptions.set(subscription.endpoint, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      businessId,
      userId,
      timezone: timezone || 'UTC',
      createdAt: new Date().toISOString(),
    });

    saveSubscriptionsToDisk();
    console.log(`[WebPush] Registered subscription for business ${businessId} (tz: ${timezone || 'UTC'}). Total subscriptions: ${subscriptions.size}`);
    return true;
  }

  public static unregisterSubscription(endpoint: string): boolean {
    if (!endpoint) return false;
    const removed = subscriptions.delete(endpoint);
    if (removed) {
      saveSubscriptionsToDisk();
    }
    return removed;
  }

  public static getSubscriptionsForBusiness(businessId: string): PushSubscriptionRecord[] {
    const result: PushSubscriptionRecord[] = [];
    for (const sub of subscriptions.values()) {
      if (!businessId || sub.businessId === businessId || sub.businessId === 'default') {
        result.push(sub);
      }
    }
    return result;
  }

  public static getAllSubscriptions(): PushSubscriptionRecord[] {
    return Array.from(subscriptions.values());
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
        saveSubscriptionsToDisk();
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

  /**
   * Automated Morning Executive Briefing Dispatcher
   * Automatically triggered by the server scheduler every 5 minutes.
   * Evaluates each subscriber's local timezone so every business receives their morning brief at their local morning window.
   */
  public static async dispatchScheduledMorningBriefs(force = false): Promise<{
    checkedCount: number;
    dispatchedCount: number;
    details: string[];
  }> {
    const now = new Date();
    const allSubs = Array.from(subscriptions.values());
    let dispatchedCount = 0;
    const details: string[] = [];

    for (const sub of allSubs) {
      // 1. Calculate local date and local hour for this specific subscriber
      let localDateStr = now.toISOString().split('T')[0];
      let localHour = now.getUTCHours();

      const subscriberTz = sub.timezone || 'UTC';
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: subscriberTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: 'numeric',
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const y = parts.find((p) => p.type === 'year')?.value;
        const m = parts.find((p) => p.type === 'month')?.value;
        const d = parts.find((p) => p.type === 'day')?.value;
        const h = parts.find((p) => p.type === 'hour')?.value;
        if (y && m && d) localDateStr = `${y}-${m}-${d}`;
        if (h !== undefined) localHour = parseInt(h, 10);
      } catch {
        // Fallback to UTC
      }

      const targetKey = sub.businessId && sub.businessId !== 'default' ? sub.businessId : sub.endpoint;
      const lastSent = morningBriefsSentDate.get(targetKey) || morningBriefsSentDate.get(sub.endpoint);

      // Skip if already sent for this local date (unless manually forced)
      if (!force && lastSent === localDateStr) {
        continue;
      }

      // Check morning delivery window:
      // Deliver between 06:00 and 12:00 in subscriber's local timezone.
      // If force is true, bypass the hour check.
      if (!force && (localHour < 6 || localHour > 12)) {
        continue;
      }

      // Fetch business profile and inventory alerts for personalized morning message
      let bizName = 'Your Business';
      let lowStockCount = 0;

      if (sub.businessId && sub.businessId !== 'default') {
        try {
          const { data: biz } = await serverSupabase
            .from('businesses')
            .select('name')
            .eq('id', sub.businessId)
            .maybeSingle();
          if (biz?.name) bizName = biz.name;

          const { data: prods } = await serverSupabase
            .from('products')
            .select('id, stock_quantity, minimum_stock_level')
            .eq('business_id', sub.businessId);

          if (prods && Array.isArray(prods)) {
            lowStockCount = prods.filter(
              (p) => (p.stock_quantity ?? 0) <= (p.minimum_stock_level ?? 5)
            ).length;
          }
        } catch {
          // Continue with defaults if Supabase is offline or in local demo mode
        }
      }

      const body = lowStockCount > 0
        ? `Good morning! ${lowStockCount} item(s) require restock replenishment today. Tap to view your daily executive briefing.`
        : `Good morning! Your store is ready for trading. Tap to review cash collection targets and today's priorities.`;

      const result = await this.sendToSubscription(sub, {
        title: `☀️ Morning Executive Brief: ${bizName}`,
        body,
        url: '/#/home',
        tag: `morning-brief-${localDateStr}`,
      });

      if (result.success) {
        dispatchedCount++;
        morningBriefsSentDate.set(targetKey, localDateStr);
        morningBriefsSentDate.set(sub.endpoint, localDateStr);
        details.push(`Sent morning brief to ${bizName} (${sub.endpoint.slice(-8)})`);
      }
    }

    return {
      checkedCount: allSubs.length,
      dispatchedCount,
      details,
    };
  }
}
