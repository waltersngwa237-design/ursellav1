/**
 * Web Push Notification Client Service (VAPID Integration)
 * Manages out-of-app push notifications, browser permissions, and subscription lifecycle.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isVapidConfigured: boolean;
}

export class PushClientService {
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      }
    } catch {
      // Local fallback
    }
    return headers;
  }

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  public static getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  public static async getVapidPublicKey(): Promise<{ configured: boolean; publicKey: string }> {
    try {
      const res = await fetch('/api/push/config');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[PushClient] Failed to fetch VAPID config:', err);
    }
    return { configured: false, publicKey: '' };
  }

  public static async getStatus(businessId?: string): Promise<PushStatus> {
    const supported = this.isSupported();
    if (!supported) {
      return {
        isSupported: false,
        permission: 'unsupported',
        isSubscribed: false,
        isVapidConfigured: false,
      };
    }

    const permission = Notification.permission;
    let isSubscribed = false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      isSubscribed = Boolean(sub);
    } catch {
      isSubscribed = false;
    }

    const { configured } = await this.getVapidPublicKey();

    return {
      isSupported: true,
      permission,
      isSubscribed,
      isVapidConfigured: configured,
    };
  }

  public static async subscribe(businessId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Push notifications are not supported by this browser.' };
    }

    try {
      // Check iOS Safari standalone requirement
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone));
      if (isIOS && !isStandalone) {
        return {
          success: false,
          error: 'On iOS Safari, Apple requires adding Ursella to your Home Screen to enable push notifications. Tap Share in Safari, then "Add to Home Screen".',
        };
      }

      // 1. Request permission with dual Promise / Callback support for universal browser compatibility
      let permission: NotificationPermission = Notification.permission;
      if (permission !== 'granted') {
        permission = await new Promise<NotificationPermission>((resolve) => {
          try {
            const res = Notification.requestPermission((perm) => resolve(perm));
            if (res && typeof (res as any).then === 'function') {
              (res as Promise<NotificationPermission>).then(resolve).catch(() => resolve(Notification.permission));
            }
          } catch {
            resolve(Notification.permission);
          }
        });
      }

      if (permission !== 'granted') {
        return {
          success: false,
          error: permission === 'denied'
            ? 'Notification permission was denied. Please allow notifications in your browser site settings.'
            : 'Notification permission was not granted.',
        };
      }

      // 2. Fetch server VAPID public key
      const { publicKey, configured } = await this.getVapidPublicKey();
      if (!publicKey) {
        return {
          success: false,
          error: 'VAPID public key is missing or not configured on server.',
        };
      }

      // 3. Register push subscription with Service Worker
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // If the server's VAPID key was rotated or changed, unsubscribe the stale subscription
        try {
          const appKey = (subscription as any).options?.applicationServerKey;
          if (appKey) {
            const currentKeyBytes = urlBase64ToUint8Array(publicKey);
            const subKeyBytes = new Uint8Array(appKey);
            const keysMatch = subKeyBytes.length === currentKeyBytes.length &&
              subKeyBytes.every((val, i) => val === currentKeyBytes[i]);
            if (!keysMatch) {
              console.log('[PushClient] Server VAPID key changed. Re-subscribing with updated key...');
              await subscription.unsubscribe();
              subscription = null;
            }
          }
        } catch {
          // Ignore inspection error and attempt reuse
        }
      }

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 4. Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          businessId,
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server rejected push subscription');
      }

      localStorage.setItem(`ursella_push_enabled_${businessId}`, 'true');
      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Subscription error:', err);
      return { success: false, error: err?.message || 'Failed to subscribe to push notifications' };
    }
  }

  public static async unsubscribe(businessId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) return { success: true };

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Inform server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }

      localStorage.removeItem(`ursella_push_enabled_${businessId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Unsubscribe error:', err);
      return { success: false, error: err?.message || 'Failed to unsubscribe' };
    }
  }

  public static async sendTestNotification(businessId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      const response = await fetch('/api/push/send-test', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          businessId,
          subscription: subscription ? subscription.toJSON() : undefined,
        }),
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || resJson.error) {
        throw new Error(resJson.error || 'Failed to trigger test notification');
      }

      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Test push error:', err);
      return { success: false, error: err?.message || 'Failed to send test push' };
    }
  }

  public static async sendMorningBriefPush(businessId: string, businessName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/push/send-morning-brief', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          businessId,
          businessName,
        }),
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || resJson.error) {
        throw new Error(resJson.error || 'Failed to send morning brief push');
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send morning brief push' };
    }
  }
}
