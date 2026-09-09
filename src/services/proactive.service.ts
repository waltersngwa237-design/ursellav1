/**
 * Ursella Business OS - Client Proactive Service (Phase 5)
 * Handles client-side communication with the proactive event engine,
 * action execution framework, reminders, notifications, and preferences.
 */
import { generateUUID } from '../lib/uuid.ts';
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
import { CustomerService } from './customer.service.ts';
import { InventoryService } from './inventory.service.ts';
import { ExpenseService } from './expense.service.ts';
import { OfflineSyncService, type SyncItemType } from './offline-sync.service.ts';

const CACHED_INSIGHTS_KEY = 'ursella_cached_insights_';
const INSIGHT_STATUS_KEY = 'ursella_insight_status_';
const LOCAL_AUDIT_LOGS_KEY = 'ursella_local_audit_logs_';
const LOCAL_REMINDERS_KEY = 'ursella_local_reminders_';

export class ProactiveService {
  /**
   * Scan business data to detect events and generate proactive insights.
   */
  public static async scanBusinessInsights(businessId: string): Promise<BusinessInsight[]> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return this.getInsights(businessId);
      }

      const response = await fetch('/api/insights/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });

      if (!response.ok) {
        throw new Error(`Scan failed with status ${response.status}`);
      }

      const data = await response.json();
      const insights: BusinessInsight[] = data.insights || [];

      if (insights.length > 0) {
        this.cacheInsights(businessId, insights);
      }

      return this.applyLocalStatusOverrides(businessId, insights);
    } catch (err) {
      console.warn('[ProactiveService] Failed to scan server insights:', err);
      // Fallback to local get
      return this.getInsights(businessId);
    }
  }

  /**
   * Fetch active or filtered insights.
   */
  public static async getInsights(
    businessId: string,
    category = 'all',
    status = 'all'
  ): Promise<BusinessInsight[]> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return this.getLocalOrCachedInsights(businessId, category, status);
      }

      const response = await fetch(`/api/insights?businessId=${encodeURIComponent(businessId)}&category=${category}&status=${status}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data: BusinessInsight[] = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        this.cacheInsights(businessId, data);
      }

      return this.applyLocalStatusOverrides(businessId, data);
    } catch (err) {
      console.warn('[ProactiveService] Error fetching insights, using offline cache:', err);
      return this.getLocalOrCachedInsights(businessId, category, status);
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
        headers: { 'Content-Type': 'application/json' },
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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return this.getLocalDailyPriorities(businessId);
      }

      const response = await fetch(`/api/priorities/today?businessId=${encodeURIComponent(businessId)}`);
      if (!response.ok) return this.getLocalDailyPriorities(businessId);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data;
      return this.getLocalDailyPriorities(businessId);
    } catch {
      return this.getLocalDailyPriorities(businessId);
    }
  }

  /**
   * Propose a controlled action.
   */
  public static async proposeAction(proposal: Partial<ActionProposal> & { business_id: string; action_type: ActionType; title: string }): Promise<ActionProposal | null> {
    try {
      const response = await fetch('/api/actions/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    // 1. Try server execution if online
    if (isOnline) {
      try {
        const response = await fetch('/api/actions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          const data = await response.json();
          if (params.payload?.insightId) {
            this.setLocalInsightStatus(params.businessId, params.payload.insightId, 'acted_on');
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ursella_data_changed'));
          }
          return data;
        }
      } catch (err) {
        console.warn('[ProactiveService] Online execution failed, falling back to local offline execution:', err);
      }
    }

    // 2. Offline / Local fallback execution with queueing
    try {
      const localResult = await this.executeLocalAction(params);
      if (params.payload?.insightId) {
        this.setLocalInsightStatus(params.businessId, params.payload.insightId, 'acted_on');
      }

      // Record audit log entry locally
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
        changes: params.payload,
        status: 'success',
        timestamp: new Date().toISOString(),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ursella_data_changed'));
      }

      return {
        success: true,
        status: 'completed',
        result: localResult,
      };
    } catch (localErr: any) {
      return { success: false, error: localErr.message || 'Action execution failed' };
    }
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

    if (actionType === 'record_payment') {
      const customerId = payload.customerId;
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
        message: `Payment of ${amount.toLocaleString()} recorded successfully offline. Queued for synchronization.`,
        amountPaid: amount,
        customerId,
      };
    }

    if (actionType === 'create_inventory_adjustment') {
      const productId = payload.productId;
      const qty = Number(payload.adjustmentQuantity ?? payload.quantity);
      if (!productId || isNaN(qty) || qty < 0) {
        throw new Error('Product ID and non-negative quantity required.');
      }

      await InventoryService.recordMovement({
        business_id: businessId,
        product_id: productId,
        type: 'adjustment',
        quantity: qty,
        notes: payload.reason || 'Proactive inventory adjustment',
      });

      OfflineSyncService.enqueue('inventory_movement', businessId, {
        business_id: businessId,
        product_id: productId,
        type: 'adjustment',
        quantity: qty,
        notes: payload.reason || 'Proactive inventory adjustment',
      });

      return {
        message: `Inventory stock adjusted to ${qty} offline. Queued for synchronization.`,
        productId,
        targetQuantity: qty,
      };
    }

    if (actionType === 'create_restock_task' || actionType === 'create_reminder') {
      const title = payload.title || 'Stock replenishment reminder';
      const remId = `rem_${Date.now()}`;
      const reminder: BusinessReminder = {
        id: remId,
        business_id: businessId,
        title,
        description: payload.description || `Target quantity: ${payload.suggestedQuantity || 'as needed'}`,
        due_date: payload.dueDate || new Date(Date.now() + 86400000).toISOString(),
        priority: payload.priority || 'high',
        status: 'pending',
        related_entity_type: payload.relatedEntityType || 'product',
        related_entity_id: payload.productId,
        related_entity_name: payload.productName,
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
        related_entity_type: reminder.related_entity_type,
        related_entity_id: reminder.related_entity_id,
        related_entity_name: reminder.related_entity_name,
      });

      return {
        message: `Task "${title}" created successfully offline.`,
        reminderId: remId,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, userId, businessId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch action audit logs / execution history.
   */
  public static async getAuditLogs(businessId: string): Promise<ActionAuditLog[]> {
    try {
      const response = await fetch(`/api/actions/audit-logs?businessId=${encodeURIComponent(businessId)}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  /**
   * Reminders API
   */
  public static async getReminders(businessId: string): Promise<BusinessReminder[]> {
    try {
      const response = await fetch(`/api/reminders?businessId=${encodeURIComponent(businessId)}`);
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
                title: `Out of Stock: ${prod.name}`,
                message: `Current inventory is 0 units. Replenish immediately to prevent lost sales.`,
                priority: 'critical',
                category: 'inventory',
                is_read: false,
                action_type: 'create_restock_task',
                action_payload: { productId: prod.id, productName: prod.name, suggestedQuantity: minStock * 2 },
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
                action_payload: { productId: prod.id, productName: prod.name, suggestedQuantity: minStock * 2 },
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
            const debt = Number(cust.total_debt ?? 0);
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
          title: `☀️ Morning Executive Brief`,
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
      const response = await fetch(`/api/notifications?businessId=${encodeURIComponent(businessId)}`);
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`/api/preferences/notifications?businessId=${encodeURIComponent(businessId)}`);
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
        headers: { 'Content-Type': 'application/json' },
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
      const raw = localStorage.getItem(`${INSIGHT_STATUS_KEY}${businessId}`);
      const map: Record<string, BusinessInsight['status']> = raw ? JSON.parse(raw) : {};
      map[insightId] = status;
      localStorage.setItem(`${INSIGHT_STATUS_KEY}${businessId}`, JSON.stringify(map));

      // Also update inside cached insights array if present
      const cachedRaw = localStorage.getItem(`${CACHED_INSIGHTS_KEY}${businessId}`);
      if (cachedRaw) {
        const cached: BusinessInsight[] = JSON.parse(cachedRaw);
        const updated = cached.map((item) =>
          item.id === insightId ? { ...item, status } : item
        );
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
        if (map[ins.id]) {
          return { ...ins, status: map[ins.id] };
        }
        return ins;
      });
    } catch {
      return insights;
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
    const insights = this.getLocalOrCachedInsights(businessId, 'all', 'active');
    return insights.slice(0, 3).map((ins, idx) => ({
      id: `dp_${ins.id}`,
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
