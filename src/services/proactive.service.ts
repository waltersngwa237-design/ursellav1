/**
 * Ursella Business OS - Client Proactive Service (Phase 5)
 * Handles client-side communication with the proactive event engine,
 * action execution framework, reminders, notifications, and preferences.
 */
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type {
  BusinessInsight,
  ActionProposal,
  ActionAuditLog,
  BusinessReminder,
  AppNotification,
  DailyPriorityItem,
  NotificationPreferences,
  ActionType,
} from '../types/proactive.ts';
import type { MemberRole } from '../types/database.types.ts';
import type { Product } from '../types/index.ts';
import { CustomerService } from './customer.service.ts';
import { InventoryService } from './inventory.service.ts';
import { ExpenseService } from './expense.service.ts';
import { ProductService } from './product.service.ts';
import { OfflineSyncService, type SyncItemType } from './offline-sync.service.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { isDeviceOnline, fastRaceWithFallback } from '../lib/offline-fast.ts';

const CACHED_INSIGHTS_KEY = 'ursella_cached_insights_';
const INSIGHT_STATUS_KEY = 'ursella_insight_status_';
const LOCAL_AUDIT_LOGS_KEY = 'ursella_local_audit_logs_';
const LOCAL_REMINDERS_KEY = 'ursella_local_reminders_';
const LOCAL_PRODUCTS_PREFIX = 'ursella_products_';

export class ProactiveService {
  /**
   * Generates authorization headers with Supabase session access token.
   */
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
      // Local / preview fallback
    }
    return headers;
  }

  /**
   * Scan business data to detect events and generate proactive insights.
   */
  public static async scanBusinessInsights(businessId: string): Promise<BusinessInsight[]> {
    const getLocal = () => this.getLocalOrCachedInsights(businessId, 'all', 'all');

    if (!isDeviceOnline() || !businessId) {
      return this.applyLocalStatusOverrides(businessId, getLocal());
    }

    return fastRaceWithFallback(
      async () => {
        const snapshot = this.collectLocalSnapshot(businessId);
        const headers = await this.getAuthHeaders();

        const response = await fetch('/api/insights/scan', {
          method: 'POST',
          headers,
          body: JSON.stringify({ businessId, snapshot }),
        });

        if (!response.ok) {
          throw new Error(`Scan failed with status ${response.status}`);
        }

        const data = await response.json();
        let insights: BusinessInsight[] = data.insights || [];

        // If server returned 0 insights, fallback to local generation so anomalous local data is not missed
        if (insights.length === 0) {
          const localGenerated = this.generateOfflineInsights(businessId);
          if (localGenerated.length > 0) {
            insights = localGenerated;
          }
        }

        if (insights.length > 0) {
          this.cacheInsights(businessId, insights);
        }

        return this.applyLocalStatusOverrides(businessId, insights);
      },
      () => this.applyLocalStatusOverrides(businessId, getLocal()),
      2500
    );
  }

  /**
   * Fetch active or filtered insights.
   */
  public static async getInsights(
    businessId: string,
    category = 'all',
    status = 'all'
  ): Promise<BusinessInsight[]> {
    const getLocal = () => this.getLocalOrCachedInsights(businessId, category, status);

    if (!isDeviceOnline() || !businessId) {
      return this.applyLocalStatusOverrides(businessId, getLocal());
    }

    return fastRaceWithFallback(
      async () => {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`/api/insights?businessId=${encodeURIComponent(businessId)}&category=${category}&status=${status}`, {
          headers,
        });
        if (!response.ok) throw new Error('Failed to fetch insights');
        let data: BusinessInsight[] = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          this.cacheInsights(businessId, data);
        } else {
          const fallback = this.getLocalOrCachedInsights(businessId, category, status);
          if (fallback.length > 0) {
            data = fallback;
          }
        }

        return this.applyLocalStatusOverrides(businessId, data);
      },
      () => this.applyLocalStatusOverrides(businessId, getLocal()),
      2000
    );
  }

  private static collectLocalSnapshot(businessId: string) {
    try {
      const prodsRaw = localStorage.getItem(`ursella_products_${businessId}`);
      const custRaw = localStorage.getItem(`ursella_customers_${businessId}`);
      const salesRaw = localStorage.getItem(`ursella_sales_${businessId}`);
      const expRaw = localStorage.getItem(`ursella_expenses_${businessId}`);

      return {
        products: prodsRaw ? JSON.parse(prodsRaw) : [],
        customers: custRaw ? JSON.parse(custRaw) : [],
        sales: salesRaw ? JSON.parse(salesRaw) : [],
        expenses: expRaw ? JSON.parse(expRaw) : [],
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Update insight status (e.g. dismissed, seen, acted_on).
   */
  public static async updateInsightStatus(
    businessId: string,
    insightId: string,
    status: BusinessInsight['status']
  ): Promise<boolean> {
    // 1. Immediately store status in local overrides for instant UI update
    this.setLocalInsightStatus(businessId, insightId, status);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
      }

      const response = await fetch(`/api/insights/${encodeURIComponent(insightId)}/status`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ businessId, status }),
      });
      return response.ok;
    } catch {
      return true;
    }
  }

  /**
   * Fetch daily prioritized actions ("What should I do today?").
   */
  public static async getDailyPriorities(businessId: string): Promise<DailyPriorityItem[]> {
    try {
      let priorities: DailyPriorityItem[] = [];

      if (typeof navigator === 'undefined' || navigator.onLine) {
        const response = await fetch(`/api/priorities/today?businessId=${encodeURIComponent(businessId)}`, {
          headers: await this.getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            priorities = data;
          }
        }
      }

      if (priorities.length === 0) {
        priorities = this.getLocalDailyPriorities(businessId);
      }

      return this.filterActivePriorities(businessId, priorities);
    } catch {
      return this.filterActivePriorities(businessId, this.getLocalDailyPriorities(businessId));
    }
  }

  /**
   * Propose a controlled action.
   */
  public static async proposeAction(proposal: Partial<ActionProposal> & { business_id: string; action_type: ActionType; title: string }): Promise<ActionProposal | null> {
    try {
      const response = await fetch('/api/actions/propose', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          businessId: proposal.business_id,
          insightId: proposal.insight_id,
          actionType: proposal.action_type,
          title: proposal.title,
          description: proposal.description,
          payload: proposal.payload,
          requestedBy: proposal.requested_by,
          requiresRole: proposal.requires_role,
          impactPreview: proposal.impact_preview,
        }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Execute an approved action with human confirmation.
   * Works smoothly both online (via server executor) and offline (via client engine & sync queue).
   */
  public static async executeAction(params: {
    actionId?: string;
    businessId: string;
    userId: string;
    userRole?: MemberRole;
    actionType: ActionType;
    payload: Record<string, any>;
    idempotencyKey?: string;
    isAIGenerated?: boolean;
  }): Promise<{ success: boolean; result?: any; error?: string; status?: string }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    let localResult: any = null;

    // 1. Always execute local state changes (inventory, debts, reminders, expenses)
    try {
      localResult = await this.executeLocalAction(params);
    } catch (localErr) {
      console.warn('[ProactiveService] Local action execution warning:', localErr);
    }

    // 2. Mark insight and priority status as 'acted_on' locally and synchronise to server
    const insightId = params.payload?.insightId;
    if (insightId) {
      this.updateInsightStatus(params.businessId, insightId, 'acted_on').catch(() => {});
    }

    // 3. Online sync to server for centralized logging and backend updates
    if (isOnline) {
      try {
        const response = await fetch('/api/actions/execute', {
          method: 'POST',
          headers: await this.getAuthHeaders(),
          body: JSON.stringify({
            actionId: params.actionId,
            businessId: params.businessId,
            userId: params.userId,
            userRole: params.userRole || 'owner',
            actionType: params.actionType,
            payload: params.payload,
            idempotencyKey: params.idempotencyKey || generateUUID(),
            isAIGenerated: params.isAIGenerated,
          }),
        });

        if (response.ok) {
          const serverData = await response.json();
          if (serverData.success) {
            // Synchronize returned server product stock changes to local cache
            try {
              const prodKey = `${LOCAL_PRODUCTS_PREFIX}${params.businessId}`;
              const prodStored = localStorage.getItem(prodKey);
              let prods: Product[] = prodStored ? JSON.parse(prodStored) : [];

              const itemsToUpdate = serverData.result?.restockedItems || (serverData.result?.inventoryUpdate ? [serverData.result.inventoryUpdate] : []);
              if (Array.isArray(itemsToUpdate) && itemsToUpdate.length > 0) {
                for (const item of itemsToUpdate) {
                  const idx = prods.findIndex((p) => p.id === item.productId || p.name.toLowerCase() === (item.productName || '').toLowerCase());
                  if (idx !== -1 && item.newStock !== undefined) {
                    prods[idx] = {
                      ...prods[idx],
                      stock_quantity: Number(item.newStock),
                      updated_at: new Date().toISOString(),
                    };
                  }
                }
                localStorage.setItem(prodKey, JSON.stringify(prods));
              }
            } catch (syncErr) {
              console.warn('[ProactiveService] Local cache sync from server result warning:', syncErr);
            }

            this.recordLocalAuditLog(params.businessId, {
              id: serverData.auditLogId || `audit_${Date.now()}`,
              business_id: params.businessId,
              action_id: params.actionId || `act_${Date.now()}`,
              action_type: params.actionType,
              actor_id: params.userId,
              actor_role: params.userRole || 'owner',
              is_ai_proposed: Boolean(params.isAIGenerated),
              target_entity_type: params.actionType,
              target_entity_id: params.payload.customerId || params.payload.productId || null,
              changes: { payload: params.payload, result: serverData.result || localResult },
              status: 'success',
              timestamp: new Date().toISOString(),
            });

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ursella_data_changed'));
            }
            return {
              success: true,
              status: 'completed',
              result: serverData.result || localResult,
            };
          }
        }
      } catch (err) {
        console.warn('[ProactiveService] Server sync error, local action remains effective:', err);
      }
    }

    // 4. Record audit log locally
    this.recordLocalAuditLog(params.businessId, {
      id: `audit_${Date.now()}`,
      business_id: params.businessId,
      action_id: params.actionId || `act_${Date.now()}`,
      action_type: params.actionType,
      actor_id: params.userId,
      actor_role: params.userRole || 'owner',
      is_ai_proposed: Boolean(params.isAIGenerated),
      target_entity_type: params.actionType,
      target_entity_id: params.payload.customerId || params.payload.productId || null,
      changes: { payload: params.payload, result: localResult },
      status: 'success',
      timestamp: new Date().toISOString(),
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ursella_data_changed'));
    }

    return {
      success: true,
      status: 'completed',
      result: localResult || { message: 'Action executed successfully.' },
    };
  }

  /**
   * Smart product resolution: finds product by ID, SKU, or name
   */
  public static async resolveProduct(
    businessId: string,
    searchId?: string,
    searchName?: string
  ): Promise<Product | null> {
    const cleanId = (searchId || '').trim();
    const cleanName = (searchName || '').trim();
    if (!cleanId && !cleanName) return null;

    // 1. Check local storage products
    const prodKey = `${LOCAL_PRODUCTS_PREFIX}${businessId}`;
    const prodStored = localStorage.getItem(prodKey);
    const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];

    if (cleanId) {
      const byId = prods.find((p) => p.id === cleanId);
      if (byId) return byId;
    }

    const term = (cleanName || cleanId).toLowerCase();
    // Exact name match
    const byExactName = prods.find((p) => p.name.toLowerCase() === term);
    if (byExactName) return byExactName;

    // SKU match
    const bySku = prods.find((p) => p.sku && p.sku.toLowerCase() === term);
    if (bySku) return bySku;

    // Substring match
    const bySubstring = prods.find(
      (p) => p.name.toLowerCase().includes(term) || term.includes(p.name.toLowerCase())
    );
    if (bySubstring) return bySubstring;

    // 2. Query Supabase if available
    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        if (cleanId && isValidUUID(cleanId)) {
          const { data: dbById } = await (supabase as any)
            .from('products')
            .select('*')
            .eq('id', cleanId)
            .eq('business_id', businessId)
            .maybeSingle();
          if (dbById) {
            const updated = [...prods.filter((p) => p.id !== dbById.id), dbById];
            localStorage.setItem(prodKey, JSON.stringify(updated));
            return dbById as Product;
          }
        }

        const { data: dbByName } = await (supabase as any)
          .from('products')
          .select('*')
          .eq('business_id', businessId)
          .ilike('name', `%${term}%`)
          .limit(1);

        if (dbByName && dbByName.length > 0) {
          const found = dbByName[0];
          const updated = [...prods.filter((p) => p.id !== found.id), found];
          localStorage.setItem(prodKey, JSON.stringify(updated));
          return found as Product;
        }
      } catch {
        // fallback
      }
    }

    return null;
  }

  /**
   * Execute action directly against local client services and enqueue for sync
   */
  private static async executeLocalAction(params: {
    businessId: string;
    userId: string;
    actionType: ActionType;
    payload: Record<string, any>;
  }): Promise<Record<string, any>> {
    const { businessId, actionType, payload } = params;

    if (actionType === 'create_product') {
      const name = payload.name;
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('Product name is required.');
      }

      const createdProd = await ProductService.createProduct({
        business_id: businessId,
        name: name.trim(),
        selling_price: Number(payload.selling_price ?? payload.sellingPrice) || 0,
        cost_price: Number(payload.cost_price ?? payload.costPrice) || 0,
        stock_quantity: Number(payload.stock_quantity ?? payload.stockQuantity ?? payload.quantity) || 0,
        minimum_stock_level: Number(payload.minimum_stock_level ?? payload.minimumStockLevel ?? payload.minStock) ?? 5,
        unit_of_measure: payload.unit_of_measure || payload.unit || 'piece',
        description: payload.description || null,
        sku: payload.sku || null,
        category_id: payload.category_id || payload.categoryId || null,
        supplier_id: payload.supplier_id || payload.supplierId || null,
      });

      return {
        message: `Product "${createdProd.name}" (${createdProd.stock_quantity} ${createdProd.unit_of_measure || 'units'}) created successfully.`,
        productId: createdProd.id,
        product: createdProd,
      };
    }

    if (actionType === 'record_payment') {
      const customerId = payload.customerId || payload.customer_id;
      const amount = Number(payload.amount);
      if (!customerId || !amount || amount <= 0) {
        throw new Error('Customer ID and positive amount are required.');
      }

      await CustomerService.recordDebtPayment({
        business_id: businessId,
        customer_id: customerId,
        amount,
        payment_method: payload.paymentMethod || 'cash',
        reference: payload.reference,
        notes: payload.notes || 'Recorded from Proactive Intelligence',
      });

      OfflineSyncService.enqueue('debt_payment', businessId, {
        business_id: businessId,
        customer_id: customerId,
        amount,
        payment_method: payload.paymentMethod || 'cash',
        reference: payload.reference,
        notes: payload.notes || 'Recorded from Proactive Intelligence',
      });

      return {
        message: `Payment of ${amount.toLocaleString()} recorded successfully.`,
        amountPaid: amount,
        customerId,
      };
    }

    if (actionType === 'create_inventory_adjustment') {
      const rawProductId = payload.productId || payload.product_id;
      const rawProductName = payload.productName || payload.product_name || payload.name;
      const qty = Number(payload.adjustmentQuantity ?? payload.quantity);
      if (isNaN(qty) || qty < 0) {
        throw new Error('Non-negative adjustment quantity required.');
      }

      const resolved = await this.resolveProduct(businessId, rawProductId, rawProductName);
      const targetId = resolved ? resolved.id : rawProductId;

      if (targetId) {
        await InventoryService.recordMovement({
          business_id: businessId,
          product_id: targetId,
          type: 'adjustment',
          quantity: qty,
          notes: payload.reason || 'Proactive inventory adjustment',
        });
      }

      return {
        message: `Inventory stock adjusted to ${qty} units for ${resolved?.name || rawProductName || 'product'}.`,
        productId: targetId,
        targetQuantity: qty,
      };
    }

    if (actionType === 'create_restock_task' || actionType === 'create_reminder') {
      const title = payload.title || 'Stock replenishment reminder';
      const remId = `rem_${Date.now()}`;

      // Support batch restock items if payload.items is provided
      const itemsList: Array<{ productId?: string; productName?: string; quantity: number }> =
        Array.isArray(payload.items) && payload.items.length > 0
          ? payload.items.map((it: any) => ({
              productId: it.productId || it.product_id || it.id,
              productName: it.productName || it.product_name || it.name,
              quantity: Number(it.quantity ?? it.suggestedQuantity ?? it.restockQty ?? 0),
            }))
          : [
              {
                productId: payload.productId || payload.product_id || payload.id,
                productName: payload.productName || payload.product_name || payload.name,
                quantity: Number(
                  payload.suggestedQuantity ??
                    payload.quantity ??
                    payload.adjustmentQuantity ??
                    payload.restockQty ??
                    0
                ),
              },
            ];

      const validItems = itemsList.filter((it) => it.quantity > 0 && (it.productId || it.productName));
      const restockedList: Array<{ product: Product; addedQty: number; newStock: number }> = [];

      if (actionType === 'create_restock_task' && validItems.length > 0) {
        for (const item of validItems) {
          const resolved = await this.resolveProduct(businessId, item.productId, item.productName);
          if (resolved) {
            try {
              await InventoryService.recordMovement({
                business_id: businessId,
                product_id: resolved.id,
                type: 'restock',
                quantity: item.quantity,
                notes: payload.description || `Replenishment from restock action: ${title}`,
              });

              // Fetch updated local product stock
              const prodKey = `${LOCAL_PRODUCTS_PREFIX}${businessId}`;
              const prodStored = localStorage.getItem(prodKey);
              const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];
              const updatedP = prods.find((p) => p.id === resolved.id);
              const currentStock = updatedP ? updatedP.stock_quantity : (resolved.stock_quantity + item.quantity);

              restockedList.push({
                product: resolved,
                addedQty: item.quantity,
                newStock: currentStock,
              });
            } catch (invErr) {
              console.warn('[Proactive] Auto-restock recordMovement error:', invErr);
            }
          }
        }
      }

      const didRestock = restockedList.length > 0;
      const totalUnits = restockedList.reduce((acc, curr) => acc + curr.addedQty, 0);
      const firstItem = restockedList[0];

      const reminder: BusinessReminder = {
        id: remId,
        business_id: businessId,
        title,
        description:
          payload.description ||
          (didRestock
            ? `Restocked +${totalUnits} units (${restockedList.map((r) => `${r.product.name}: +${r.addedQty}`).join(', ')})`
            : `Target quantity: ${payload.suggestedQuantity || 'as needed'}`),
        due_date: payload.dueDate || new Date(Date.now() + 86400000).toISOString(),
        priority: payload.priority || 'high',
        status: didRestock ? 'completed' : 'pending',
        related_entity_type: payload.relatedEntityType || 'product',
        related_entity_id: firstItem?.product.id || payload.productId || payload.product_id,
        related_entity_name: firstItem?.product.name || payload.productName,
        created_at: new Date().toISOString(),
      };

      const rems = this.getLocalReminders(businessId);
      rems.unshift(reminder);
      localStorage.setItem(`${LOCAL_REMINDERS_KEY}${businessId}`, JSON.stringify(rems));

      const summaryText = didRestock
        ? `Successfully restocked ${restockedList.map((r) => `+${r.addedQty} ${r.product.name} (Now: ${r.newStock} units)`).join(', ')}.`
        : `Task "${title}" created successfully.`;

      return {
        message: summaryText,
        reminderId: remId,
        restocked: didRestock,
        totalUnitsRestocked: totalUnits,
        restockedItems: restockedList.map((r) => ({
          productId: r.product.id,
          productName: r.product.name,
          addedQty: r.addedQty,
          newStock: r.newStock,
        })),
      };
    }

    if (actionType === 'create_expense') {
      const category = payload.category || 'Operations';
      const amount = Number(payload.amount);
      if (!amount || amount <= 0) {
        throw new Error('Valid expense amount is required.');
      }

      const created = await ExpenseService.createExpense({
        business_id: businessId,
        category,
        amount,
        description: payload.description || 'Proactive expense log',
        expense_date: payload.expenseDate || new Date().toISOString().split('T')[0],
        payment_method: payload.paymentMethod || 'cash',
      });

      return {
        message: `Expense of ${amount.toLocaleString()} logged under ${category}.`,
        expenseId: created.id,
        amount,
        category,
      };
    }

    if (actionType === 'create_customer_followup') {
      const title = payload.title || `Follow up with ${payload.customerName || 'customer'}`;
      const remId = `rem_${Date.now()}`;
      const reminder: BusinessReminder = {
        id: remId,
        business_id: businessId,
        title,
        description: payload.description || payload.draftMessage || 'Contact customer regarding overdue balance or re-engagement',
        due_date: payload.dueDate || new Date(Date.now() + 86400000).toISOString(),
        priority: payload.priority || 'high',
        status: 'pending',
        related_entity_type: 'customer',
        related_entity_id: payload.customerId,
        related_entity_name: payload.customerName,
        created_at: new Date().toISOString(),
      };

      const rems = this.getLocalReminders(businessId);
      rems.unshift(reminder);
      localStorage.setItem(`${LOCAL_REMINDERS_KEY}${businessId}`, JSON.stringify(rems));

      OfflineSyncService.enqueue('reminder', businessId, {
        business_id: businessId,
        title,
        description: reminder.description,
        due_date: reminder.due_date,
        priority: reminder.priority,
        related_entity_type: 'customer',
        related_entity_id: payload.customerId,
        related_entity_name: payload.customerName,
      });

      return {
        message: `Follow-up reminder for "${payload.customerName || 'customer'}" created successfully.`,
        reminderId: remId,
      };
    }

    if (actionType === 'send_customer_message') {
      return {
        message: `Customer communication prepared for ${payload.customerName || 'customer'}.`,
        recipient: payload.customerName,
      };
    }

    // Default queue
    OfflineSyncService.enqueue('proactive_action', businessId, params);
    return {
      message: 'Action recorded offline and queued for synchronization.',
    };
  }

  /**
   * Reject an action proposal.
   */
  public static async rejectAction(actionId: string, userId: string, businessId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/actions/reject', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ actionId, userId, businessId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch action audit logs / execution history.
   * Merges server-authoritative logs with instant local logs.
   */
  public static async getAuditLogs(businessId: string): Promise<ActionAuditLog[]> {
    let localLogs: ActionAuditLog[] = [];
    try {
      const raw = localStorage.getItem(`${LOCAL_AUDIT_LOGS_KEY}${businessId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localLogs = parsed;
      }
    } catch {}

    try {
      const response = await fetch(`/api/actions/audit-logs?businessId=${encodeURIComponent(businessId)}`, {
        headers: await this.getAuthHeaders(),
      });
      if (response.ok) {
        const serverLogs: ActionAuditLog[] = await response.json();
        if (Array.isArray(serverLogs)) {
          const map = new Map<string, ActionAuditLog>();
          serverLogs.forEach((l) => map.set(l.id, l));
          localLogs.forEach((l) => {
            if (!map.has(l.id)) map.set(l.id, l);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }
      }
    } catch {
      // Fallback to local logs
    }
    return localLogs;
  }

  /**
   * Public helper to record an operational or system audit log.
   * Immediately saves locally, dispatches real-time UI events, and syncs to server.
   */
  public static async recordAuditLog(businessId: string, log: ActionAuditLog): Promise<void> {
    this.recordLocalAuditLog(businessId, log);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ursella_data_changed'));
    }

    try {
      const headers = await this.getAuthHeaders();
      await fetch('/api/actions/audit-logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ businessId, log }),
      });
    } catch (err) {
      console.warn('[ProactiveService] Background audit log sync failed:', err);
    }
  }

  /**
   * Reminders API
   */
  public static async getReminders(businessId: string): Promise<BusinessReminder[]> {
    try {
      const response = await fetch(`/api/reminders?businessId=${encodeURIComponent(businessId)}`, {
        headers: await this.getAuthHeaders(),
      });
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  public static async createReminder(params: {
    businessId: string;
    userId: string;
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
    relatedEntityType?: 'product' | 'customer' | 'sale' | 'expense';
    relatedEntityId?: string;
    relatedEntityName?: string;
  }): Promise<{ success: boolean; reminder?: BusinessReminder; error?: string }> {
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create reminder' };
    }
  }

  public static async updateReminderStatus(
    reminderId: string,
    businessId: string,
    status: 'pending' | 'completed' | 'cancelled'
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/reminders/${encodeURIComponent(reminderId)}`, {
        method: 'PATCH',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ businessId, status }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public static async deleteReminder(reminderId: string, businessId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/reminders/${encodeURIComponent(reminderId)}?businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Scan local storage for offline / preview business alerts
   */
  public static scanLocalAlerts(businessId: string): AppNotification[] {
    const alerts: AppNotification[] = [];
    try {
      // 1. Check local catalog
      const prodsRaw = localStorage.getItem(`ursella_products_${businessId}`);
      if (prodsRaw) {
        const products = JSON.parse(prodsRaw);
        if (Array.isArray(products)) {
          for (const prod of products) {
            const stock = Number(prod.stock_quantity ?? 0);
            const minStock = Number(prod.minimum_stock_level ?? 5);
            if (stock <= 0) {
              alerts.push({
                id: `alert_stock_out_${prod.id}`,
                business_id: businessId,
                title: `Out of Stock: ${prod.name}${stock < 0 ? ` (${stock} deficit)` : ''}`,
                message: `Current inventory is ${stock} units. Replenish immediately to prevent lost sales.`,
                priority: 'critical',
                category: 'inventory',
                is_read: false,
                action_type: 'create_restock_task',
                action_payload: { productId: prod.id, productName: prod.name, currentStock: stock, suggestedQuantity: Math.max(minStock * 2, 10) },
                created_at: new Date().toISOString(),
              });
            } else if (stock <= minStock) {
              alerts.push({
                id: `alert_stock_low_${prod.id}`,
                business_id: businessId,
                title: `Low Stock: ${prod.name}`,
                message: `Only ${stock} unit(s) remaining (threshold: ${minStock}). Consider reordering.`,
                priority: 'high',
                category: 'inventory',
                is_read: false,
                action_type: 'create_restock_task',
                action_payload: { productId: prod.id, productName: prod.name, currentStock: stock, suggestedQuantity: minStock * 2 },
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }

      // 2. Check local customer debts
      const custRaw = localStorage.getItem(`ursella_customers_${businessId}`);
      if (custRaw) {
        const customers = JSON.parse(custRaw);
        if (Array.isArray(customers)) {
          for (const cust of customers) {
            const debt = Number(cust.outstanding_balance || cust.total_debt || cust.outstanding_debt || cust.debt || 0);
            if (debt > 0) {
              alerts.push({
                id: `alert_debt_${cust.id}`,
                business_id: businessId,
                title: `Overdue Balance: ${cust.name}`,
                message: `${cust.name} has an outstanding credit balance of ${debt.toLocaleString()}.`,
                priority: debt >= 50000 ? 'critical' : 'high',
                category: 'customers',
                is_read: false,
                action_type: 'send_customer_message',
                action_payload: { customerId: cust.id, customerName: cust.name, phone: cust.phone, debtAmount: debt },
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }

      // 3. Morning Executive Briefing in Notification Center (Bell Icon)
      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = now.toISOString().split('T')[0];

      let dailyBriefEnabled = true;
      try {
        const prefRaw = localStorage.getItem(`ursella_notif_prefs_${businessId}`);
        if (prefRaw) {
          const parsed = JSON.parse(prefRaw);
          if (typeof parsed.dailyBriefEnabled === 'boolean') {
            dailyBriefEnabled = parsed.dailyBriefEnabled;
          }
        }
      } catch {}

      if (dailyBriefEnabled && currentHour < 12) {
        alerts.unshift({
          id: `alert_brief_morning_${businessId}_${todayStr}`,
          business_id: businessId,
          title: `Morning Executive Brief`,
          message: `Your morning business briefing is ready. Tap to review cash collection, stockout risks, and today's priorities.`,
          priority: 'medium',
          category: 'sales',
          is_read: false,
          action_type: 'view_daily_brief',
          created_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30, 0).toISOString(),
        });
      }
    } catch {
      // ignore local scan error
    }
    return alerts;
  }

  /**
   * In-App Notifications API with combined server and local detection
   */
  public static async getNotifications(businessId: string): Promise<AppNotification[]> {
    let serverNotifications: AppNotification[] = [];
    try {
      const response = await fetch(`/api/notifications?businessId=${encodeURIComponent(businessId)}`, {
        headers: await this.getAuthHeaders(),
      });
      if (response.ok) {
        serverNotifications = await response.json();
      }
    } catch {
      // offline / fallback
    }

    const localAlerts = this.scanLocalAlerts(businessId);

    // Read local override state (marked read, deleted)
    let readIds = new Set<string>();
    let deletedIds = new Set<string>();
    try {
      const stateRaw = localStorage.getItem(`ursella_notif_states_${businessId}`);
      if (stateRaw) {
        const state = JSON.parse(stateRaw);
        if (Array.isArray(state.readIds)) readIds = new Set(state.readIds);
        if (Array.isArray(state.deletedIds)) deletedIds = new Set(state.deletedIds);
      }
    } catch {}

    // Combine and deduplicate by title or ID
    const combined: AppNotification[] = [];
    const seenTitles = new Set<string>();

    for (const notif of [...serverNotifications, ...localAlerts]) {
      if (deletedIds.has(notif.id)) continue;
      const normalizedTitle = notif.title.trim().toLowerCase();
      if (seenTitles.has(normalizedTitle)) continue;
      seenTitles.add(normalizedTitle);

      combined.push({
        ...notif,
        is_read: readIds.has(notif.id) ? true : notif.is_read,
      });
    }

    return combined;
  }

  /**
   * Explicitly trigger a fresh background business scan and get updated notifications
   */
  public static async triggerAlertScan(businessId: string): Promise<AppNotification[]> {
    try {
      await this.scanBusinessInsights(businessId);
    } catch {}
    return this.getNotifications(businessId);
  }

  public static async markAllNotificationsRead(businessId: string): Promise<boolean> {
    try {
      const stateRaw = localStorage.getItem(`ursella_notif_states_${businessId}`);
      const state = stateRaw ? JSON.parse(stateRaw) : { readIds: [], deletedIds: [] };
      const current = await this.getNotifications(businessId);
      state.readIds = current.map((n) => n.id);
      localStorage.setItem(`ursella_notif_states_${businessId}`, JSON.stringify(state));
    } catch {}

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ businessId }),
      });
      return response.ok;
    } catch {
      return true;
    }
  }

  public static async deleteNotification(notificationId: string, businessId: string): Promise<boolean> {
    try {
      const stateRaw = localStorage.getItem(`ursella_notif_states_${businessId}`);
      const state = stateRaw ? JSON.parse(stateRaw) : { readIds: [], deletedIds: [] };
      if (!state.deletedIds.includes(notificationId)) {
        state.deletedIds.push(notificationId);
      }
      localStorage.setItem(`ursella_notif_states_${businessId}`, JSON.stringify(state));
    } catch {}

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}?businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return true;
    }
  }

  public static async toggleNotificationRead(notificationId: string, businessId: string): Promise<boolean> {
    try {
      const stateRaw = localStorage.getItem(`ursella_notif_states_${businessId}`);
      const state = stateRaw ? JSON.parse(stateRaw) : { readIds: [], deletedIds: [] };
      const idx = state.readIds.indexOf(notificationId);
      if (idx >= 0) {
        state.readIds.splice(idx, 1);
      } else {
        state.readIds.push(notificationId);
      }
      localStorage.setItem(`ursella_notif_states_${businessId}`, JSON.stringify(state));
    } catch {}

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/toggle-read`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ businessId }),
      });
      return response.ok;
    } catch {
      return true;
    }
  }

  public static async clearAllNotifications(businessId: string): Promise<boolean> {
    try {
      const current = await this.getNotifications(businessId);
      const state = { readIds: [], deletedIds: current.map((n) => n.id) };
      localStorage.setItem(`ursella_notif_states_${businessId}`, JSON.stringify(state));
    } catch {}

    try {
      const response = await fetch('/api/notifications/clear-all', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ businessId }),
      });
      return response.ok;
    } catch {
      return true;
    }
  }

  /**
   * Notification Preferences API
   */
  public static async getPreferences(businessId: string): Promise<NotificationPreferences> {
    try {
      const response = await fetch(`/api/preferences/notifications?businessId=${encodeURIComponent(businessId)}`, {
        headers: await this.getAuthHeaders(),
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      return {
        enabledCategories: ['sales', 'inventory', 'customers', 'expenses', 'opportunities', 'health'],
        minSeverity: 'low',
        dailyBriefEnabled: true,
        dailyBriefTime: '08:00',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      };
    }
  }

  public static async savePreferences(
    businessId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences | null> {
    try {
      const response = await fetch('/api/preferences/notifications', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ businessId, preferences }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  // --- Offline & Resilient Storage Helpers ---

  private static cacheInsights(businessId: string, insights: BusinessInsight[]): void {
    try {
      localStorage.setItem(`${CACHED_INSIGHTS_KEY}${businessId}`, JSON.stringify(insights));
    } catch {}
  }

  public static setLocalInsightStatus(
    businessId: string,
    insightId: string,
    status: BusinessInsight['status']
  ): void {
    try {
      const cleanId = insightId.replace(/^(prio_|dp_)/, '');
      const raw = localStorage.getItem(`${INSIGHT_STATUS_KEY}${businessId}`);
      const map: Record<string, BusinessInsight['status']> = raw ? JSON.parse(raw) : {};
      map[insightId] = status;
      map[cleanId] = status;
      map[`prio_${cleanId}`] = status;
      map[`dp_${cleanId}`] = status;
      localStorage.setItem(`${INSIGHT_STATUS_KEY}${businessId}`, JSON.stringify(map));

      // Also update inside cached insights array if present
      const cachedRaw = localStorage.getItem(`${CACHED_INSIGHTS_KEY}${businessId}`);
      if (cachedRaw) {
        const cached: BusinessInsight[] = JSON.parse(cachedRaw);
        const updated = cached.map((item) => {
          const itemClean = item.id.replace(/^(prio_|dp_)/, '');
          if (item.id === insightId || itemClean === cleanId || item.id === cleanId) {
            return { ...item, status };
          }
          return item;
        });
        localStorage.setItem(`${CACHED_INSIGHTS_KEY}${businessId}`, JSON.stringify(updated));
      }
    } catch {}
  }

  private static applyLocalStatusOverrides(
    businessId: string,
    insights: BusinessInsight[]
  ): BusinessInsight[] {
    try {
      const raw = localStorage.getItem(`${INSIGHT_STATUS_KEY}${businessId}`);
      if (!raw) return insights;
      const map: Record<string, BusinessInsight['status']> = JSON.parse(raw);

      return insights.map((ins) => {
        const cleanId = ins.id.replace(/^(prio_|dp_)/, '');
        const overrideStatus = map[ins.id] || map[cleanId] || map[`prio_${cleanId}`] || map[`dp_${cleanId}`];
        if (overrideStatus) {
          return { ...ins, status: overrideStatus };
        }
        return ins;
      });
    } catch {
      return insights;
    }
  }

  private static filterActivePriorities(
    businessId: string,
    priorities: DailyPriorityItem[]
  ): DailyPriorityItem[] {
    try {
      const raw = localStorage.getItem(`${INSIGHT_STATUS_KEY}${businessId}`);
      if (!raw) return priorities;
      const map: Record<string, BusinessInsight['status']> = JSON.parse(raw);
      return priorities.filter((p) => {
        const cleanId = p.id.replace(/^(prio_|dp_)/, '');
        const status = map[p.id] || map[cleanId] || map[`prio_${cleanId}`] || map[`dp_${cleanId}`];
        return status !== 'dismissed' && status !== 'acted_on';
      });
    } catch {
      return priorities;
    }
  }

  private static getLocalOrCachedInsights(
    businessId: string,
    category = 'all',
    status = 'all'
  ): BusinessInsight[] {
    let insights: BusinessInsight[] = [];

    // 1. Try to load cached server insights
    try {
      const raw = localStorage.getItem(`${CACHED_INSIGHTS_KEY}${businessId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          insights = parsed;
        }
      }
    } catch {}

    // 2. If no cached insights, generate dynamically from local storage data
    if (insights.length === 0) {
      insights = this.generateOfflineInsights(businessId);
    }

    insights = this.applyLocalStatusOverrides(businessId, insights);

    // Apply filtering
    return insights.filter((ins) => {
      if (category !== 'all' && ins.category !== category) return false;
      if (status !== 'all') {
        if (status === 'active' && (ins.status === 'dismissed' || ins.status === 'acted_on')) return false;
        if (status === 'acted_on' && ins.status !== 'acted_on') return false;
        if (status === 'dismissed' && ins.status !== 'dismissed') return false;
      } else {
        if (ins.status === 'dismissed') return false;
      }
      return true;
    });
  }

  /**
   * Generates real proactive insights directly from client-side stored products, customers, and sales
   */
  private static generateOfflineInsights(businessId: string): BusinessInsight[] {
    const generated: BusinessInsight[] = [];

    try {
      // Products
      const prodsRaw = localStorage.getItem(`ursella_products_${businessId}`);
      if (prodsRaw) {
        const products = JSON.parse(prodsRaw);
        if (Array.isArray(products)) {
          for (const prod of products) {
            const stock = Number(prod.stock_quantity ?? 0);
            const minStock = Number(prod.minimum_stock_level ?? 5);

            if (stock <= 0) {
              generated.push({
                id: `offline_stockout_${prod.id}`,
                business_id: businessId,
                event_type: 'out_of_stock',
                category: 'inventory',
                severity: 'critical',
                confidence: 'high',
                status: 'new',
                title: `${prod.name} is Out of Stock`,
                summary: `Current inventory is 0 units. Replenish immediately to protect daily sales volume.`,
                explanation: {
                  whatHappened: `"${prod.name}" has reached 0 units in stock.`,
                  whyItMatters: `Out of stock products cause immediate lost revenue and risk customer churn.`,
                  whatYouCanDo: `Initiate a stock order with your supplier to restore inventory.`,
                },
                data: { productId: prod.id, productName: prod.name },
                detected_at: new Date().toISOString(),
                source: 'deterministic_engine',
                dedup_key: `offline_stockout_${prod.id}`,
                action_type: 'create_restock_task',
                action_payload: {
                  productId: prod.id,
                  productName: prod.name,
                  suggestedQuantity: minStock * 2,
                  title: `Restock: ${prod.name}`,
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            } else if (stock <= minStock) {
              generated.push({
                id: `offline_lowstock_${prod.id}`,
                business_id: businessId,
                event_type: 'low_stock',
                category: 'inventory',
                severity: 'medium',
                confidence: 'high',
                status: 'new',
                title: `Low Stock Alert: ${prod.name} (${stock} left)`,
                summary: `Stock is at or below minimum threshold of ${minStock} units.`,
                explanation: {
                  whatHappened: `"${prod.name}" has only ${stock} units remaining.`,
                  whyItMatters: `Stock is susceptible to rapid depletion during unexpected customer demand.`,
                  whatYouCanDo: `Plan an inventory replenishment or adjust stock levels.`,
                },
                data: { productId: prod.id, productName: prod.name, stock, minStock },
                detected_at: new Date().toISOString(),
                source: 'deterministic_engine',
                dedup_key: `offline_lowstock_${prod.id}`,
                action_type: 'create_restock_task',
                action_payload: {
                  productId: prod.id,
                  productName: prod.name,
                  suggestedQuantity: minStock * 2,
                  title: `Replenish: ${prod.name}`,
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }

      // Customers & Debts
      const custRaw = localStorage.getItem(`ursella_customers_${businessId}`);
      if (custRaw) {
        const customers = JSON.parse(custRaw);
        if (Array.isArray(customers)) {
          for (const c of customers) {
            const debt = Number(c.outstanding_balance || c.total_debt || c.outstanding_debt || 0);
            if (debt > 0) {
              generated.push({
                id: `offline_debt_${c.id}`,
                business_id: businessId,
                event_type: 'customer_balance_overdue',
                category: 'customers',
                severity: debt >= 50000 ? 'high' : 'medium',
                confidence: 'high',
                status: 'new',
                title: `Outstanding Balance: ${c.name} (${debt.toLocaleString()})`,
                summary: `${c.name} has an unsettled credit balance of ${debt.toLocaleString()}.`,
                explanation: {
                  whatHappened: `${c.name} has an open credit balance of ${debt.toLocaleString()}.`,
                  whyItMatters: `Uncollected customer balances lock working capital needed for operating costs.`,
                  whatYouCanDo: `Record a debt payment or contact ${c.name} with a friendly reminder.`,
                },
                data: { customerId: c.id, customerName: c.name, phone: c.phone, debt },
                detected_at: new Date().toISOString(),
                source: 'deterministic_engine',
                dedup_key: `offline_debt_${c.id}`,
                action_type: 'record_payment',
                action_payload: {
                  customerId: c.id,
                  customerName: c.name,
                  customerPhone: c.phone,
                  amount: debt,
                  paymentMethod: 'cash',
                  notes: 'Debt settlement from proactive intelligence',
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {}

    return generated;
  }

  private static getLocalDailyPriorities(businessId: string): DailyPriorityItem[] {
    const rawInsights = this.getLocalOrCachedInsights(businessId, 'all', 'active');
    const insights = rawInsights.filter((ins) => ins.status === 'new' || ins.status === 'seen');
    return insights.slice(0, 3).map((ins, idx) => ({
      id: `dp_${ins.id.replace(/^(prio_|dp_)/, '')}`,
      rank: idx + 1,
      title: ins.title,
      reason: ins.explanation?.whyItMatters || ins.summary,
      category: ins.category,
      severity: ins.severity,
      actionType: ins.action_type || 'create_reminder',
      actionPayload: ins.action_payload || {},
      impactDescription: ins.explanation?.whatYouCanDo || ins.summary,
    }));
  }

  public static getLocalReminders(businessId: string): BusinessReminder[] {
    try {
      const raw = localStorage.getItem(`${LOCAL_REMINDERS_KEY}${businessId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private static recordLocalAuditLog(businessId: string, log: ActionAuditLog): void {
    try {
      const raw = localStorage.getItem(`${LOCAL_AUDIT_LOGS_KEY}${businessId}`);
      const logs: ActionAuditLog[] = raw ? JSON.parse(raw) : [];
      logs.unshift(log);
      localStorage.setItem(`${LOCAL_AUDIT_LOGS_KEY}${businessId}`, JSON.stringify(logs.slice(0, 50)));
    } catch {}
  }
}
