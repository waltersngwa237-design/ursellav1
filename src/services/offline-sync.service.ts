import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { isValidUUID } from '../lib/uuid.ts';
import type { CompleteSaleParams } from './sales.service.ts';

export type SyncItemType = 'sale' | 'customer' | 'expense' | 'product_stock';

export interface SyncQueueItem {
  id: string;
  type: SyncItemType;
  businessId: string;
  payload: any;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const SYNC_QUEUE_KEY = 'ursella_offline_sync_queue';
const SYNC_EVENTS_CHANNEL = 'ursella_sync_events';

type SyncListener = (pendingCount: number, isSyncing: boolean) => void;

class OfflineSyncServiceClass {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private syncTimer: any = null;

  constructor() {
    // Listen for online status transition
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineSyncService] Connection restored. Triggering auto-sync...');
        this.processQueue();
      });

      // Periodic check every 45s when online
      window.addEventListener('load', () => {
        this.syncTimer = setInterval(() => {
          if (navigator.onLine && this.getPendingCount() > 0 && !this.isSyncing) {
            this.processQueue();
          }
        }, 45000);
      });
    }
  }

  /**
   * Subscribe to queue count changes
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getPendingCount(), this.isSyncing);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const count = this.getPendingCount();
    this.listeners.forEach((l) => l(count, this.isSyncing));
  }

  /**
   * Get all queued items
   */
  getQueue(): SyncQueueItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Pending sync count
   */
  getPendingCount(): number {
    return this.getQueue().length;
  }

  /**
   * Add a transaction/action to the offline sync queue
   */
  enqueue(type: SyncItemType, businessId: string, payload: any): SyncQueueItem {
    const queue = this.getQueue();
    const newItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      businessId,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    queue.push(newItem);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    this.notify();

    // If online, attempt immediate background processing
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => this.processQueue(), 500);
    }

    return newItem;
  }

  /**
   * Remove item from queue
   */
  private dequeue(itemId: string) {
    const queue = this.getQueue().filter((item) => item.id !== itemId);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    this.notify();
  }

  /**
   * Update item failure status
   */
  private markFailed(itemId: string, errorMsg: string) {
    const queue = this.getQueue().map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          retryCount: item.retryCount + 1,
          lastError: errorMsg,
        };
      }
      return item;
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    this.notify();
  }

  /**
   * Process all queued items when connected to Supabase
   */
  async processQueue(): Promise<{ total: number; synced: number; failed: number }> {
    if (this.isSyncing) return { total: 0, synced: 0, failed: 0 };
    if (!isSupabaseConfigured || !navigator.onLine) {
      return { total: this.getPendingCount(), synced: 0, failed: 0 };
    }

    const queue = this.getQueue();
    if (queue.length === 0) return { total: 0, synced: 0, failed: 0 };

    this.isSyncing = true;
    this.notify();

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        if (item.type === 'sale') {
          await this.syncSaleItem(item);
        } else if (item.type === 'customer') {
          await this.syncCustomerItem(item);
        } else if (item.type === 'expense') {
          await this.syncExpenseItem(item);
        }
        this.dequeue(item.id);
        synced++;
      } catch (err: any) {
        console.warn(`[OfflineSyncService] Failed to sync item ${item.id}:`, err);
        this.markFailed(item.id, err?.message || 'Sync error');
        failed++;
      }
    }

    this.isSyncing = false;
    this.notify();

    return { total: queue.length, synced, failed };
  }

  private async syncSaleItem(item: SyncQueueItem): Promise<void> {
    const params: CompleteSaleParams = item.payload;
    if (!isValidUUID(params.business_id)) return;

    const sanitizedCustomerId = params.customer_id && isValidUUID(params.customer_id)
      ? params.customer_id
      : null;

    const { error } = await (supabase as any).rpc('process_complete_sale', {
      p_business_id: params.business_id,
      p_customer_id: sanitizedCustomerId,
      p_items: params.items,
      p_discount: params.discount ?? 0.0,
      p_tax: params.tax ?? 0.0,
      p_payment_amount: params.payment_amount ?? 0.0,
      p_payment_method: params.payment_method ?? 'cash',
      p_payment_reference: params.payment_reference || null,
      p_notes: params.notes ? `${params.notes} [Synced from Offline POS]` : '[Synced from Offline POS]',
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  private async syncCustomerItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload;
    if (!isValidUUID(payload.business_id)) return;

    const { error } = await (supabase as any).from('customers').insert({
      id: payload.id && isValidUUID(payload.id) ? payload.id : undefined,
      business_id: payload.business_id,
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
      address: payload.address || null,
      notes: payload.notes || null,
    });

    if (error && !error.message?.includes('duplicate key')) {
      throw new Error(error.message);
    }
  }

  private async syncExpenseItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload;
    if (!isValidUUID(payload.business_id)) return;

    const { error } = await (supabase as any).from('expenses').insert({
      id: payload.id && isValidUUID(payload.id) ? payload.id : undefined,
      business_id: payload.business_id,
      amount: payload.amount,
      description: payload.description,
      expense_date: payload.expense_date,
      payment_method: payload.payment_method || 'cash',
      notes: payload.notes || null,
    });

    if (error && !error.message?.includes('duplicate key')) {
      throw new Error(error.message);
    }
  }

  /**
   * Clear queue (for test resets)
   */
  clearQueue() {
    localStorage.removeItem(SYNC_QUEUE_KEY);
    this.notify();
  }
}

export const OfflineSyncService = new OfflineSyncServiceClass();
