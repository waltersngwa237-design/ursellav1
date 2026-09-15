/**
 * Ursella Business OS - Phase 5 Proactive Intelligence & Automation Types
 */
import type { MemberRole, PaymentMethodType } from './database.types.ts';

// 1. Business Event Taxonomy
export type BusinessEventType =
  | 'sale_completed'
  | 'large_sale'
  | 'sales_drop'
  | 'sales_spike'
  | 'low_stock'
  | 'out_of_stock'
  | 'inventory_risk'
  | 'fast_moving_depletion'
  | 'expense_spike'
  | 'margin_decline'
  | 'margin_improvement'
  | 'customer_payment_received'
  | 'customer_balance_overdue'
  | 'customer_inactive'
  | 'cash_flow_risk'
  | 'business_milestone';

// 2. Insight Severity, Confidence & Status
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type InsightConfidence = 'high' | 'moderate' | 'low';
export type InsightStatus = 'new' | 'seen' | 'dismissed' | 'acted_on' | 'expired' | 'resolved';
export type InsightCategory =
  | 'sales'
  | 'inventory'
  | 'customers'
  | 'expenses'
  | 'opportunities'
  | 'health'
  | 'general';

export interface InsightExplanation {
  whatHappened: string;
  whyItMatters: string;
  whatYouCanDo: string;
}

export interface BusinessInsight {
  id: string;
  business_id: string;
  event_type: BusinessEventType;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  summary: string;
  explanation?: InsightExplanation;
  data: Record<string, any>;
  detected_at: string;
  status: InsightStatus;
  expires_at?: string | null;
  action_type?: ActionType | null;
  action_payload?: Record<string, any> | null;
  source: 'deterministic_engine' | 'ai_synthesizer' | 'hybrid';
  dedup_key: string;
  created_at: string;
  updated_at: string;
}

// 3. Controlled Action System
export type ActionType =
  | 'create_product'
  | 'create_reminder'
  | 'create_inventory_adjustment'
  | 'record_payment'
  | 'create_expense'
  | 'create_customer_followup'
  | 'send_customer_message'
  | 'create_restock_task'
  | 'view_daily_brief'
  | 'close_register';

export type ActionStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'cancelled';

export interface ActionImpactPreview {
  entityType: 'product' | 'customer' | 'sale' | 'expense' | 'general';
  entityId?: string;
  entityName?: string;
  financialAmount?: number;
  reversibility: 'reversible' | 'consequential' | 'irreversible';
  description: string;
}

export interface ActionProposal {
  id: string;
  business_id: string;
  insight_id?: string | null;
  action_type: ActionType;
  title: string;
  description: string;
  payload: Record<string, any>;
  status: ActionStatus;
  requested_by: string; // user id or 'ursella_ai'
  approved_by?: string | null;
  approved_at?: string | null;
  executed_at?: string | null;
  result?: Record<string, any> | null;
  error?: string | null;
  idempotency_key: string;
  requires_role: MemberRole[];
  impact_preview?: ActionImpactPreview;
  created_at: string;
}

// 4. Internal Business Reminders & Tasks
export interface BusinessReminder {
  id: string;
  business_id: string;
  title: string;
  description?: string | null;
  due_date: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'cancelled';
  related_entity_type?: 'product' | 'customer' | 'sale' | 'expense' | null;
  related_entity_id?: string | null;
  related_entity_name?: string | null;
  created_by?: string | null;
  created_at: string;
  completed_at?: string | null;
}

// 5. In-App Notifications
export interface AppNotification {
  id: string;
  business_id: string;
  user_id?: string;
  title: string;
  message: string;
  priority: InsightSeverity;
  category: InsightCategory;
  is_read: boolean;
  insight_id?: string | null;
  action_proposal_id?: string | null;
  action_type?: ActionType | null;
  action_payload?: Record<string, any> | null;
  created_at: string;
  read_at?: string | null;
}

// 6. Action Audit Logs
export interface ActionAuditLog {
  id: string;
  business_id: string;
  action_id: string;
  action_type: ActionType;
  actor_id: string;
  actor_role: MemberRole;
  is_ai_proposed: boolean;
  target_entity_type: string;
  target_entity_id?: string | null;
  changes: Record<string, any>;
  status: 'success' | 'failed' | 'rejected';
  timestamp: string;
  error_message?: string | null;
  ip_address?: string | null;
}

// 7. Notification & Proactive Preferences
export interface NotificationPreferences {
  enabledCategories: InsightCategory[];
  minSeverity: InsightSeverity;
  dailyBriefEnabled: boolean;
  dailyBriefTime: string; // e.g. "08:00"
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string; // e.g. "07:00"
}

// 8. Daily Priority Item ("What should I do today?")
export interface DailyPriorityItem {
  id: string;
  rank: number;
  title: string;
  reason: string;
  category: InsightCategory;
  severity: InsightSeverity;
  actionType: ActionType;
  actionPayload: Record<string, any>;
  impactDescription: string;
}
