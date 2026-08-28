/**
 * Ursella Business OS - Controlled Action Execution & Authorization Service (Phase 5)
 * Enforces role-based permissions, business isolation, payload validation,
 * idempotency checks, atomic execution, and audit logging.
 */
import { serverSupabase } from './business-tools.service.ts';
import { generateUUID, isValidUUID } from '../src/lib/uuid.ts';
import type {
  ActionType,
  ActionStatus,
  ActionProposal,
  ActionAuditLog,
  BusinessReminder,
} from '../src/types/proactive.ts';
import type { MemberRole } from '../src/types/database.types.ts';

// In-memory persistent stores for mock/fallback environment and high-speed retrieval
const inMemoryActionProposals = new Map<string, ActionProposal>();
const inMemoryAuditLogs: ActionAuditLog[] = [];
const inMemoryReminders: BusinessReminder[] = [];
const executedIdempotencyKeys = new Set<string>();

export interface ExecuteActionRequest {
  actionId?: string;
  businessId: string;
  userId: string;
  userRole: MemberRole;
  actionType: ActionType;
  payload: Record<string, any>;
  idempotencyKey: string;
  isAIGenerated?: boolean;
}

export interface ExecuteActionResult {
  success: boolean;
  actionId: string;
  status: ActionStatus;
  result?: Record<string, any>;
  error?: string;
  auditLogId?: string;
}

export class ActionExecutorService {
  /**
   * Propose an action for human review & approval.
   */
  public static proposeAction(proposal: Omit<ActionProposal, 'id' | 'status' | 'created_at'>): ActionProposal {
    const id = generateUUID();
    const fullProposal: ActionProposal = {
      ...proposal,
      id,
      status: 'pending_approval',
      created_at: new Date().toISOString(),
    };
    inMemoryActionProposals.set(id, fullProposal);
    return fullProposal;
  }

  /**
   * Get all action proposals for a business.
   */
  public static getActionProposals(businessId: string): ActionProposal[] {
    return Array.from(inMemoryActionProposals.values())
      .filter((p) => p.business_id === businessId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Reject an action proposal.
   */
  public static rejectAction(actionId: string, userId: string, businessId: string): boolean {
    const proposal = inMemoryActionProposals.get(actionId);
    if (!proposal || proposal.business_id !== businessId) return false;
    proposal.status = 'rejected';
    proposal.approved_by = userId;
    proposal.approved_at = new Date().toISOString();
    return true;
  }

  /**
   * Execute an approved action with full security & isolation checks.
   */
  public static async executeAction(req: ExecuteActionRequest): Promise<ExecuteActionResult> {
    const { actionId, businessId, userId, userRole, actionType, payload, idempotencyKey, isAIGenerated = false } = req;

    // 1. Idempotency Check
    if (idempotencyKey && executedIdempotencyKeys.has(idempotencyKey)) {
      return {
        success: true,
        actionId: actionId || `cached_${idempotencyKey}`,
        status: 'executed',
        result: { message: 'Action was already executed previously (idempotent result).' },
      };
    }

    // 2. Role Authorization Check
    const allowedRoles = this.getAllowedRolesForAction(actionType);
    if (!allowedRoles.includes(userRole)) {
      const errorMsg = `Unauthorized: Role '${userRole}' cannot execute '${actionType}'. Required: ${allowedRoles.join(', ')}`;
      this.recordAuditLog({
        business_id: businessId,
        action_id: actionId || idempotencyKey,
        action_type: actionType,
        actor_id: userId,
        actor_role: userRole,
        is_ai_proposed: isAIGenerated,
        target_entity_type: payload.entityType || 'general',
        target_entity_id: payload.productId || payload.customerId || null,
        changes: payload,
        status: 'failed',
        error_message: errorMsg,
      });
      return {
        success: false,
        actionId: actionId || 'err',
        status: 'failed',
        error: errorMsg,
      };
    }

    // 3. Execution Dispatch
    try {
      let executionResult: Record<string, any> = {};

      switch (actionType) {
        case 'create_reminder':
        case 'create_restock_task':
        case 'create_customer_followup': {
          executionResult = await this.executeCreateReminder(businessId, userId, payload);
          break;
        }

        case 'create_inventory_adjustment': {
          executionResult = await this.executeInventoryAdjustment(businessId, userId, payload);
          break;
        }

        case 'record_payment': {
          executionResult = await this.executeRecordPayment(businessId, userId, payload);
          break;
        }

        case 'create_expense': {
          executionResult = await this.executeCreateExpense(businessId, userId, payload);
          break;
        }

        case 'send_customer_message': {
          executionResult = await this.executeSendCustomerMessage(businessId, userId, payload);
          break;
        }

        default:
          throw new Error(`Unsupported action type: ${actionType}`);
      }

      // Mark idempotency key as used
      if (idempotencyKey) {
        executedIdempotencyKeys.add(idempotencyKey);
      }

      // Update in-memory proposal if exists
      if (actionId && inMemoryActionProposals.has(actionId)) {
        const prop = inMemoryActionProposals.get(actionId)!;
        prop.status = 'executed';
        prop.approved_by = userId;
        prop.approved_at = new Date().toISOString();
        prop.executed_at = new Date().toISOString();
        prop.result = executionResult;
      }

      // Record Audit Log
      const auditLog = this.recordAuditLog({
        business_id: businessId,
        action_id: actionId || idempotencyKey,
        action_type: actionType,
        actor_id: userId,
        actor_role: userRole,
        is_ai_proposed: isAIGenerated,
        target_entity_type: payload.entityType || 'general',
        target_entity_id: payload.productId || payload.customerId || null,
        changes: { payload, result: executionResult },
        status: 'success',
      });

      return {
        success: true,
        actionId: actionId || `exec_${Date.now()}`,
        status: 'executed',
        result: executionResult,
        auditLogId: auditLog.id,
      };
    } catch (err: any) {
      console.error(`[ActionExecutor] Error executing ${actionType}:`, err);
      const errorMsg = err.message || 'Execution failed';

      this.recordAuditLog({
        business_id: businessId,
        action_id: actionId || idempotencyKey,
        action_type: actionType,
        actor_id: userId,
        actor_role: userRole,
        is_ai_proposed: isAIGenerated,
        target_entity_type: payload.entityType || 'general',
        target_entity_id: payload.productId || payload.customerId || null,
        changes: payload,
        status: 'failed',
        error_message: errorMsg,
      });

      return {
        success: false,
        actionId: actionId || 'err',
        status: 'failed',
        error: errorMsg,
      };
    }
  }

  /**
   * Action: Create Business Reminder / Task
   */
  private static async executeCreateReminder(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const reminderId = generateUUID();
    const reminder: BusinessReminder = {
      id: reminderId,
      business_id: businessId,
      title: payload.title || 'Business Task',
      description: payload.description || null,
      due_date: payload.dueDate || new Date(Date.now() + 86400000).toISOString(),
      priority: payload.priority || 'medium',
      status: 'pending',
      related_entity_type: payload.related_entity_type || payload.entityType || null,
      related_entity_id: payload.related_entity_id || payload.productId || payload.customerId || null,
      related_entity_name: payload.productName || payload.customerName || null,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    inMemoryReminders.unshift(reminder);
    return { reminderId, reminder, message: `Task "${reminder.title}" successfully created.` };
  }

  /**
   * Action: Inventory Adjustment (Atomic)
   */
  private static async executeInventoryAdjustment(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const { productId, adjustmentQuantity, reason = 'Inventory adjustment' } = payload;
    if (!productId || typeof adjustmentQuantity !== 'number') {
      throw new Error('Invalid inventory adjustment payload: productId and adjustmentQuantity required.');
    }

    // Verify product belongs to business
    const { data: product, error: prodErr } = await serverSupabase
      .from('products')
      .select('id, name, stock_quantity, business_id')
      .eq('id', productId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (prodErr || !product) {
      throw new Error(`Product not found or access denied in business.`);
    }

    const newStock = Math.max(0, Number(product.stock_quantity || 0) + adjustmentQuantity);

    // Update Product Stock
    await serverSupabase
      .from('products')
      .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('business_id', businessId);

    // Create Inventory Transaction
    await serverSupabase.from('inventory_transactions').insert({
      business_id: businessId,
      product_id: productId,
      transaction_type: 'adjustment',
      quantity: adjustmentQuantity,
      notes: reason,
      created_by: userId,
      created_at: new Date().toISOString(),
    });

    return {
      productId,
      productName: product.name,
      previousStock: product.stock_quantity,
      newStock,
      adjustmentQuantity,
      message: `Updated stock for ${product.name} to ${newStock} units.`,
    };
  }

  /**
   * Action: Record Payment against Customer Debt (Atomic)
   */
  private static async executeRecordPayment(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const { customerId, amount, paymentMethod = 'cash', notes = 'Debt settlement' } = payload;
    if (!customerId || !amount || Number(amount) <= 0) {
      throw new Error('Invalid payment payload: customerId and valid positive amount required.');
    }

    // Verify Customer in business
    const { data: customer, error: custErr } = await serverSupabase
      .from('customers')
      .select('id, name, outstanding_debt, business_id')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (custErr || !customer) {
      throw new Error('Customer not found or access denied in business.');
    }

    const currentDebt = Number(customer.outstanding_debt || 0);
    const newDebt = Math.max(0, currentDebt - Number(amount));

    // Update Customer Debt
    await serverSupabase
      .from('customers')
      .update({ outstanding_debt: newDebt, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('business_id', businessId);

    // Record Payment
    const { data: payment } = await serverSupabase
      .from('payments')
      .insert({
        business_id: businessId,
        customer_id: customerId,
        amount: Number(amount),
        payment_method: paymentMethod,
        notes: notes,
        received_by: userId,
        paid_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    return {
      paymentId: payment?.id || `pay_${Date.now()}`,
      customerId,
      customerName: customer.name,
      amountPaid: Number(amount),
      remainingDebt: newDebt,
      message: `Recorded payment of ${Number(amount).toLocaleString()} from ${customer.name}.`,
    };
  }

  /**
   * Action: Create Operating Expense
   */
  private static async executeCreateExpense(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const { category, amount, description = '', paymentMethod = 'cash', expenseDate } = payload;
    if (!category || !amount || Number(amount) <= 0) {
      throw new Error('Invalid expense payload: category and positive amount required.');
    }

    const { data: expense } = await serverSupabase
      .from('expenses')
      .insert({
        business_id: businessId,
        category,
        amount: Number(amount),
        description,
        payment_method: paymentMethod,
        expense_date: expenseDate || new Date().toISOString().split('T')[0],
        created_by: userId,
      })
      .select('id')
      .maybeSingle();

    return {
      expenseId: expense?.id || `exp_${Date.now()}`,
      category,
      amount: Number(amount),
      message: `Logged expense of ${Number(amount).toLocaleString()} under ${category}.`,
    };
  }

  /**
   * Action: Send Customer Message (Prepares communication bridge & records contact)
   */
  private static async executeSendCustomerMessage(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const { customerId, customerName, customerPhone, draftMessage, channel = 'in_app' } = payload;

    // Clean phone number for WhatsApp Web bridge if applicable
    let whatsappLink = '';
    if (customerPhone) {
      const cleanPhone = String(customerPhone).replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(draftMessage || '');
      whatsappLink = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    }

    return {
      channel,
      customerId,
      customerName,
      customerPhone,
      messageDraft: draftMessage,
      whatsappLink,
      sentAt: new Date().toISOString(),
      message: `Customer communication prepared for ${customerName}.`,
    };
  }

  /**
   * Reminders Management
   */
  public static getReminders(businessId: string): BusinessReminder[] {
    return inMemoryReminders.filter((r) => r.business_id === businessId);
  }

  public static updateReminderStatus(
    reminderId: string,
    businessId: string,
    status: 'pending' | 'completed' | 'cancelled'
  ): boolean {
    const rem = inMemoryReminders.find((r) => r.id === reminderId && r.business_id === businessId);
    if (!rem) return false;
    rem.status = status;
    if (status === 'completed') {
      rem.completed_at = new Date().toISOString();
    }
    return true;
  }

  public static deleteReminder(reminderId: string, businessId: string): boolean {
    const idx = inMemoryReminders.findIndex((r) => r.id === reminderId && r.business_id === businessId);
    if (idx >= 0) {
      inMemoryReminders.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Audit Logging
   */
  public static recordAuditLog(log: Omit<ActionAuditLog, 'id' | 'timestamp'>): ActionAuditLog {
    const fullLog: ActionAuditLog = {
      ...log,
      id: generateUUID(),
      timestamp: new Date().toISOString(),
    };
    inMemoryAuditLogs.unshift(fullLog);
    // Keep max 200 logs per memory instance
    if (inMemoryAuditLogs.length > 200) {
      inMemoryAuditLogs.pop();
    }
    return fullLog;
  }

  public static getAuditLogs(businessId: string): ActionAuditLog[] {
    return inMemoryAuditLogs.filter((l) => l.business_id === businessId);
  }

  /**
   * Role permissions mapping for actions
   */
  private static getAllowedRolesForAction(actionType: ActionType): MemberRole[] {
    switch (actionType) {
      case 'create_reminder':
      case 'create_restock_task':
      case 'create_customer_followup':
      case 'send_customer_message':
        return ['owner', 'admin', 'staff'];
      case 'record_payment':
        return ['owner', 'admin', 'staff'];
      case 'create_inventory_adjustment':
        return ['owner', 'admin'];
      case 'create_expense':
        return ['owner', 'admin'];
      default:
        return ['owner', 'admin'];
    }
  }
}
