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

export class ProactiveService {
  /**
   * Scan business data to detect events and generate proactive insights.
   */
  public static async scanBusinessInsights(businessId: string): Promise<BusinessInsight[]> {
    try {
      const response = await fetch('/api/insights/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });

      if (!response.ok) {
        throw new Error(`Scan failed with status ${response.status}`);
      }

      const data = await response.json();
      return data.insights || [];
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
      const response = await fetch(`/api/insights?businessId=${encodeURIComponent(businessId)}&category=${category}&status=${status}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return await response.json();
    } catch (err) {
      console.warn('[ProactiveService] Error fetching insights:', err);
      return [];
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
    try {
      const response = await fetch(`/api/insights/${encodeURIComponent(insightId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch daily prioritized actions ("What should I do today?").
   */
  public static async getDailyPriorities(businessId: string): Promise<DailyPriorityItem[]> {
    try {
      const response = await fetch(`/api/priorities/today?businessId=${encodeURIComponent(businessId)}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
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

      const data = await response.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Execution request failed' };
    }
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
}
