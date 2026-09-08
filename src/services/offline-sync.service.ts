import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { isValidUUID } from '../lib/uuid.ts';
import type { CompleteSaleParams } from './sales.service.ts';

export type SyncItemType =
  | 'sale'
  | 'customer'
  | 'product'
  | 'expense'
  | 'product_stock'
  | 'inventory_movement'
  | 'debt_payment'
  | 'reminder'
  | 'proactive_action';

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

      // Listen for message from service worker Background Sync
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
            console.log('[OfflineSyncService] Triggered by Service Worker Background Sync');
            this.processQueue();
          }
        });
      }

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
    } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      // Register native Background Sync
      navigator.serviceWorker.ready
        .then((reg: any) => reg.sync?.register('ursella-offline-sync'))
        .catch(() => {});
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
        } else if (item.type === 'product') {
          await this.syncProductItem(item);
        } else if (item.type === 'expense') {
          await this.syncExpenseItem(item);
        } else if (item.type === 'inventory_movement') {
          await this.syncInventoryMovementItem(item);
        } else if (item.type === 'debt_payment') {
          await this.syncDebtPaymentItem(item);
        } else if (item.type === 'product_stock') {
          await this.syncProductStockItem(item);
        } else if (item.type === 'reminder') {
          await this.syncReminderItem(item);
        } else if (item.type === 'proactive_action') {
          await this.syncProactiveActionItem(item);
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

    if (synced > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ursella_data_changed', { detail: { syncedCount: synced } }));
    }

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

  private async syncProductItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload;
    if (!isValidUUID(payload.business_id)) return;

    const sanitizedCategoryId = payload.category_id && isValidUUID(payload.category_id) ? payload.category_id : null;
    const sanitizedSupplierId = payload.supplier_id && isValidUUID(payload.supplier_id) ? payload.supplier_id : null;

    const { data, error } = await (supabase as any)
      .from('products')
      .insert({
        id: payload.id && isValidUUID(payload.id) ? payload.id : undefined,
        business_id: payload.business_id,
        category_id: sanitizedCategoryId,
        supplier_id: sanitizedSupplierId,
        name: payload.name,
        description: payload.description || null,
        sku: payload.sku || null,
        product_type: payload.product_type || 'physical',
        unit_of_measure: payload.unit_of_measure || 'piece',
        selling_price: Number(payload.selling_price) || 0,
        cost_price: Number(payload.cost_price) || 0,
        stock_quantity: Number(payload.stock_quantity) || 0,
        minimum_stock_level: Number(payload.minimum_stock_level) || 5,
        image_url: payload.image_url || null,
        is_active: payload.is_active !== undefined ? payload.is_active : true,
      })
      .select('id')
      .maybeSingle();

    if (error && !error.message?.includes('duplicate key') && !error.message?.includes('unique constraint')) {
      throw new Error(error.message);
    }

    // Record initial stock transaction if positive quantity
    if (payload.product_type !== 'service' && Number(payload.stock_quantity) > 0) {
      const prodId = data?.id || payload.id;
      if (prodId && isValidUUID(prodId)) {
        try {
          await (supabase as any).from('inventory_transactions').insert({
            business_id: payload.business_id,
            product_id: prodId,
            transaction_type: 'initial_stock',
            quantity: Number(payload.stock_quantity),
            unit_cost: Number(payload.cost_price) || null,
            reference_type: 'initialization',
            notes: 'Initial inventory quantity logged at product creation [Synced from Offline]',
          });
        } catch {
          // non-critical
        }
      }
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

  private async syncInventoryMovementItem(item: SyncQueueItem): Promise<void> {
    const params = item.payload;
    if (!isValidUUID(params.business_id) || !isValidUUID(params.product_id)) return;

    const sanitizedRefId = params.reference_id && isValidUUID(params.reference_id)
      ? params.reference_id
      : null;

    const rpcPayload = {
      p_business_id: params.business_id,
      p_product_id: params.product_id,
      p_type: params.type || params.transaction_type || 'adjustment',
      p_quantity: Number(params.quantity),
      p_reference_type: params.reference_type || 'manual',
      p_reference_id: sanitizedRefId,
      p_notes: params.notes ? `${params.notes} [Synced from Offline Action]` : '[Synced from Offline Action]',
      p_unit_cost: params.unit_cost ?? null,
    };

    let { error } = await (supabase as any).rpc('record_inventory_movement', rpcPayload);

    // Fallback: alt parameter name
    if (error && (error.message?.includes('schema cache') || error.message?.includes('p_transaction_type') || error.message?.includes('p_type'))) {
      const altPayload = {
        ...rpcPayload,
        p_transaction_type: rpcPayload.p_type,
      };
      const fallbackRes = await (supabase as any).rpc('record_inventory_movement', altPayload);
      if (!fallbackRes.error) {
        error = null;
      }
    }

    // Direct fallback if RPC is completely absent in database
    if (error && (error.message?.includes('Could not find the function') || error.message?.includes('schema cache'))) {
      const { data: prod } = await (supabase as any)
        .from('products')
        .select('stock_quantity')
        .eq('id', params.product_id)
        .single();

      if (prod) {
        let newStock = Number(prod.stock_quantity || 0);
        const qty = Number(params.quantity);
        const movementType = params.type || params.transaction_type;

        if (['purchase', 'restock', 'return'].includes(movementType)) {
          newStock += qty;
        } else if (['sale', 'damage'].includes(movementType)) {
          newStock = Math.max(0, newStock - qty);
        } else {
          newStock = qty;
        }

        await (supabase as any)
          .from('products')
          .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
          .eq('id', params.product_id);

        await (supabase as any).from('inventory_transactions').insert({
          business_id: params.business_id,
          product_id: params.product_id,
          transaction_type: movementType,
          quantity: qty,
          unit_cost: params.unit_cost ?? null,
          reference_type: params.reference_type || 'manual',
          notes: params.notes ? `${params.notes} [Synced from Offline Action]` : '[Synced from Offline Action]',
        });
        return;
      }
    }

    if (error) {
      throw new Error(error.message);
    }
  }

  private async syncDebtPaymentItem(item: SyncQueueItem): Promise<void> {
    const { business_id, customer_id, amount, payment_method = 'cash', reference, notes } = item.payload;
    if (!isValidUUID(business_id) || !isValidUUID(customer_id) || !amount) return;

    // 1. Fetch customer's open sales
    const { data: sales } = await (supabase as any)
      .from('sales')
      .select('*')
      .eq('business_id', business_id)
      .eq('customer_id', customer_id)
      .eq('sale_status', 'completed')
      .gt('amount_due', 0)
      .order('sold_at', { ascending: true });

    let remaining = Number(amount);
    let targetSaleId = sales && sales.length > 0 && isValidUUID(sales[0].id) ? sales[0].id : null;

    if (sales && sales.length > 0) {
      for (const s of sales) {
        if (remaining <= 0) break;
        const due = Number(s.amount_due) || 0;
        const paid = Number(s.amount_paid) || 0;
        const total = Number(s.total) || 0;
        const applyAmt = Math.min(due, remaining);

        const newPaid = paid + applyAmt;
        const newDue = Math.max(0, total - newPaid);
        const newStatus = newDue === 0 ? 'paid' : 'partial';

        await (supabase as any)
          .from('sales')
          .update({
            amount_paid: newPaid,
            amount_due: newDue,
            payment_status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', s.id);

        remaining -= applyAmt;
      }
    }

    // 2. Insert into payments table
    const { error: payErr } = await (supabase as any).from('payments').insert({
      business_id,
      customer_id,
      sale_id: targetSaleId,
      amount: Number(amount),
      payment_method,
      reference: reference || null,
      notes: notes ? `${notes} [Synced from Offline Action]` : 'Customer debt payment [Synced]',
      paid_at: new Date().toISOString(),
    });

    if (payErr && !payErr.message?.includes('duplicate key')) {
      throw new Error(payErr.message);
    }
  }

  private async syncProductStockItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload;
    if (!isValidUUID(payload.product_id) || !isValidUUID(payload.business_id)) return;

    const { error } = await (supabase as any)
      .from('products')
      .update({
        stock_quantity: Number(payload.stock_quantity),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.product_id)
      .eq('business_id', payload.business_id);

    if (error) {
      throw new Error(error.message);
    }
  }

  private async syncReminderItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload;
    if (!isValidUUID(payload.business_id)) return;

    try {
      await (supabase as any).from('audit_logs').insert({
        business_id: payload.business_id,
        action: 'create_reminder',
        details: payload,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal if table not available
    }
  }

  private async syncProactiveActionItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload;
    try {
      await fetch('/api/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Retried on next sync
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
