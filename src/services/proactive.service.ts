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
   * In-App Notifications API
   */
  public static async getNotifications(businessId: string): Promise<AppNotification[]> {
    try {
      const response = await fetch(`/api/notifications?businessId=${encodeURIComponent(businessId)}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  public static async markAllNotificationsRead(businessId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public static async deleteNotification(notificationId: string, businessId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}?businessId=${encodeURIComponent(businessId)}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public static async toggleNotificationRead(notificationId: string, businessId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/toggle-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public static async clearAllNotifications(businessId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/notifications/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      return response.ok;
    } catch {
      return false;
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
