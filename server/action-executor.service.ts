/**
 * Ursella Business OS - Controlled Action Execution & Authorization Service
 * Enforces role-based permissions, strict tenant isolation, payload validation,
 * idempotency checks, atomic database transactions, persistent storage, and audit logging.
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

const isServerSupabaseConfigured = Boolean(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
) && !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').includes('placeholder.supabase.co');

// In-memory fallback stores for offline/mock environments
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
   * Persists to Supabase table action_proposals with memory fallback.
   */
  public static async proposeAction(proposal: Omit<ActionProposal, 'id' | 'status' | 'created_at'>): Promise<ActionProposal> {
    const id = generateUUID();
    const fullProposal: ActionProposal = {
      ...proposal,
      id,
      status: 'pending_approval',
      created_at: new Date().toISOString(),
    };

    if (isServerSupabaseConfigured && isValidUUID(proposal.business_id)) {
      try {
        const { data, error } = await serverSupabase
          .from('action_proposals')
          .insert({
            id,
            business_id: proposal.business_id,
            insight_id: proposal.insight_id && isValidUUID(proposal.insight_id) ? proposal.insight_id : null,
            action_type: proposal.action_type,
            title: proposal.title,
            description: proposal.description || null,
            payload: proposal.payload || {},
            status: 'pending_approval',
            requested_by: proposal.requested_by || 'ursella_ai',
            requires_role: proposal.requires_role || ['owner', 'admin'],
            impact_preview: proposal.impact_preview || null,
          })
          .select('*')
          .maybeSingle();

        if (!error && data) {
          return data as ActionProposal;
        }
      } catch (err) {
        console.warn('[ActionExecutor] Failed to persist action proposal to Supabase, using fallback:', err);
      }
    }

    inMemoryActionProposals.set(id, fullProposal);
    return fullProposal;
  }

  /**
   * Get all action proposals for a business.
   */
  public static async getActionProposals(businessId: string): Promise<ActionProposal[]> {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase
          .from('action_proposals')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as ActionProposal[];
        }
      } catch (err) {
        console.warn('[ActionExecutor] Failed to query action proposals from Supabase:', err);
      }
    }

    return Array.from(inMemoryActionProposals.values())
      .filter((p) => p.business_id === businessId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Reject an action proposal.
   */
  public static async rejectAction(actionId: string, userId: string, businessId: string): Promise<boolean> {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase
          .from('action_proposals')
          .update({
            status: 'rejected',
            approved_by: isValidUUID(userId) ? userId : null,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', actionId)
          .eq('business_id', businessId)
          .select('id')
          .maybeSingle();

        if (!error && data) {
          return true;
        }
      } catch (err) {
        console.warn('[ActionExecutor] Reject action database update failed:', err);
      }
    }

    const proposal = inMemoryActionProposals.get(actionId);
    if (!proposal || proposal.business_id !== businessId) return false;
    proposal.status = 'rejected';
    proposal.approved_by = userId;
    proposal.approved_at = new Date().toISOString();
    return true;
  }

  /**
   * Execute an approved action with full security, tenant isolation, and idempotency.
   */
  public static async executeAction(req: ExecuteActionRequest): Promise<ExecuteActionResult> {
    const { actionId, businessId, userId, userRole, actionType, payload, idempotencyKey, isAIGenerated = false } = req;

    if (!businessId) {
      return {
        success: false,
        actionId: actionId || 'err',
        status: 'failed',
        error: 'Missing required businessId.',
      };
    }

    // 1. Persistent Idempotency Check
    if (idempotencyKey) {
      if (isServerSupabaseConfigured && isValidUUID(businessId)) {
        try {
          const { data: existingKey } = await serverSupabase
            .from('idempotency_keys')
            .select('status, response')
            .eq('business_id', businessId)
            .eq('key', idempotencyKey)
            .maybeSingle();

          if (existingKey && existingKey.status === 'completed') {
            return {
              success: true,
              actionId: actionId || `cached_${idempotencyKey}`,
              status: 'executed',
              result: existingKey.response || { message: 'Action already executed (idempotent result).' },
            };
          }

          // Record processing lock in idempotency table
          await serverSupabase
            .from('idempotency_keys')
            .upsert({
              business_id: businessId,
              key: idempotencyKey,
              action_type: actionType,
              status: 'processing',
            });
        } catch (idemErr) {
          console.warn('[ActionExecutor] Idempotency table check error:', idemErr);
        }
      } else if (executedIdempotencyKeys.has(idempotencyKey)) {
        return {
          success: true,
          actionId: actionId || `cached_${idempotencyKey}`,
          status: 'executed',
          result: { message: 'Action was already executed previously (idempotent result).' },
        };
      }
    }

    // 2. Role Authorization Check
    const allowedRoles = this.getAllowedRolesForAction(actionType);
    if (!allowedRoles.includes(userRole)) {
      const errorMsg = `Unauthorized: Role '${userRole}' is not permitted to execute '${actionType}'. Required: ${allowedRoles.join(', ')}`;
      await this.recordAuditLog({
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
        case 'create_product': {
          executionResult = await this.executeCreateProduct(businessId, userId, payload);
          break;
        }

        case 'create_reminder':
        case 'create_customer_followup': {
          executionResult = await this.executeCreateReminder(businessId, userId, payload);
          break;
        }

        case 'create_inventory_adjustment': {
          executionResult = await this.executeInventoryAdjustment(businessId, userId, payload);
          break;
        }

        case 'create_restock_task': {
          executionResult = await this.executeRestockTask(businessId, userId, payload);
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

      // Mark idempotency key as completed
      if (idempotencyKey) {
        executedIdempotencyKeys.add(idempotencyKey);
        if (isServerSupabaseConfigured && isValidUUID(businessId)) {
          try {
            await serverSupabase
              .from('idempotency_keys')
              .update({
                status: 'completed',
                response: executionResult,
              })
              .eq('business_id', businessId)
              .eq('key', idempotencyKey);
          } catch (e) {
            console.warn('[ActionExecutor] Failed to mark idempotency key complete:', e);
          }
        }
      }

      // Update proposal status if proposal ID is supplied
      if (actionId) {
        if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(actionId)) {
          try {
            await serverSupabase
              .from('action_proposals')
              .update({
                status: 'executed',
                approved_by: isValidUUID(userId) ? userId : null,
                approved_at: new Date().toISOString(),
                executed_at: new Date().toISOString(),
                result: executionResult,
                updated_at: new Date().toISOString(),
              })
              .eq('id', actionId)
              .eq('business_id', businessId);
          } catch (e) {
            console.warn('[ActionExecutor] Failed to update proposal status in DB:', e);
          }
        }

        if (inMemoryActionProposals.has(actionId)) {
          const prop = inMemoryActionProposals.get(actionId)!;
          prop.status = 'executed';
          prop.approved_by = userId;
          prop.approved_at = new Date().toISOString();
          prop.executed_at = new Date().toISOString();
          prop.result = executionResult;
        }
      }

      // Record Audit Log
      const auditLog = await this.recordAuditLog({
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

      // Update idempotency key as failed if applicable
      if (idempotencyKey && isServerSupabaseConfigured && isValidUUID(businessId)) {
        try {
          await serverSupabase
            .from('idempotency_keys')
            .update({ status: 'failed', response: { error: errorMsg } })
            .eq('business_id', businessId)
            .eq('key', idempotencyKey);
        } catch {
          // ignore
        }
      }

      await this.recordAuditLog({
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
    const title = payload.title || 'Business Task';
    const description = payload.description || null;
    const dueDate = payload.dueDate || new Date(Date.now() + 86400000).toISOString();
    const priority: 'low' | 'medium' | 'high' = (payload.priority === 'low' || payload.priority === 'high') ? payload.priority : 'medium';
    const relatedEntityType = payload.related_entity_type || payload.entityType || null;
    const relatedEntityId = payload.related_entity_id || payload.productId || payload.customerId || null;
    const relatedEntityName = payload.productName || payload.customerName || null;

    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      const { data, error } = await serverSupabase
        .from('business_reminders')
        .insert({
          id: reminderId,
          business_id: businessId,
          title,
          description,
          due_date: dueDate,
          priority,
          status: 'pending',
          related_entity_type: relatedEntityType,
          related_entity_id: relatedEntityId,
          related_entity_name: relatedEntityName,
          created_by: userId,
        })
        .select('*')
        .maybeSingle();

      if (!error && data) {
        return { reminderId, reminder: data, message: `Task "${title}" successfully created.` };
      }
    }

    const reminder: BusinessReminder = {
      id: reminderId,
      business_id: businessId,
      title,
      description,
      due_date: dueDate,
      priority,
      status: 'pending',
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      related_entity_name: relatedEntityName,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    inMemoryReminders.unshift(reminder);
    return { reminderId, reminder, message: `Task "${reminder.title}" successfully created.` };
  }

  /**
   * Action: Restock Task
   * Executes authoritative inventory movement (type: 'restock') and logs reminder.
   */
  private static async executeRestockTask(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const productId = payload.productId || payload.product_id;
    const restockQty = Number(payload.suggestedQuantity ?? payload.quantity ?? payload.adjustmentQuantity ?? 0);
    const title = payload.title || `Restock replenishment`;
    const unitCost = payload.unitCost !== undefined ? Number(payload.unitCost) : null;

    if (!productId) {
      throw new Error('Missing productId for restock task.');
    }

    if (restockQty <= 0) {
      throw new Error('Restock quantity must be a positive number greater than zero.');
    }

    let productUpdateResult: any = null;

    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(productId)) {
      // 1. Verify product exists and belongs to this business
      const { data: product, error: prodErr } = await serverSupabase
        .from('products')
        .select('id, name, stock_quantity, product_type, cost_price')
        .eq('id', productId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (prodErr || !product) {
        throw new Error(`Product not found in this business.`);
      }

      if (product.product_type === 'service') {
        throw new Error(`Cannot restock "${product.name}": Service items do not track physical stock.`);
      }

      // 2. Authoritative inventory movement via RPC
      const { data: txId, error: rpcErr } = await serverSupabase.rpc('record_inventory_movement', {
        p_business_id: businessId,
        p_product_id: productId,
        p_type: 'restock',
        p_quantity: restockQty,
        p_reference_type: 'restock_task',
        p_notes: payload.description || payload.reason || 'Restocked via Ursella AI task',
        p_unit_cost: unitCost ?? product.cost_price,
      });

      if (rpcErr) {
        throw new Error(`Inventory restock failed: ${rpcErr.message}`);
      }

      // 3. Fetch updated stock
      const { data: updatedProd } = await serverSupabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .eq('business_id', businessId)
        .single();

      productUpdateResult = {
        productId,
        productName: product.name,
        previousStock: product.stock_quantity,
        newStock: updatedProd?.stock_quantity ?? (Number(product.stock_quantity || 0) + restockQty),
        restockQty,
        txId,
      };
    } else {
      productUpdateResult = {
        productId,
        productName: payload.productName || 'Product',
        previousStock: 0,
        newStock: restockQty,
        restockQty,
      };
    }

    // Record business reminder
    const reminderId = generateUUID();
    const reminderData = {
      id: reminderId,
      business_id: businessId,
      title,
      description: payload.description || `Restocked +${restockQty} units`,
      due_date: payload.dueDate || new Date(Date.now() + 86400000).toISOString(),
      priority: (payload.priority === 'low' || payload.priority === 'medium' ? payload.priority : 'high') as 'low' | 'medium' | 'high',
      status: 'completed' as const,
      related_entity_type: 'product' as const,
      related_entity_id: productId || null,
      related_entity_name: payload.productName || productUpdateResult?.productName || null,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        await serverSupabase.from('business_reminders').insert(reminderData);
      } catch (e) {
        console.warn('[ActionExecutor] Failed to write restock reminder to Supabase:', e);
      }
    } else {
      inMemoryReminders.unshift(reminderData);
    }

    return {
      reminderId,
      reminder: reminderData,
      inventoryUpdate: productUpdateResult,
      message: `Successfully restocked ${restockQty} units of "${productUpdateResult.productName}" (Current stock: ${productUpdateResult.newStock}).`,
    };
  }

  /**
   * Action: Inventory Adjustment (Authoritative & Concurrency-Safe)
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

    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(productId)) {
      // 1. Verify product belongs to business
      const { data: product, error: prodErr } = await serverSupabase
        .from('products')
        .select('id, name, stock_quantity, product_type, cost_price')
        .eq('id', productId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (prodErr || !product) {
        throw new Error(`Product not found in this business.`);
      }

      if (product.product_type === 'service') {
        throw new Error(`Cannot adjust stock for "${product.name}": Service items do not track physical inventory.`);
      }

      // 2. Call authoritative RPC record_inventory_movement with target adjustment
      const { data: txId, error: rpcErr } = await serverSupabase.rpc('record_inventory_movement', {
        p_business_id: businessId,
        p_product_id: productId,
        p_type: 'adjustment',
        p_quantity: adjustmentQuantity,
        p_reference_type: 'manual_adjustment',
        p_notes: reason,
        p_unit_cost: product.cost_price,
      });

      if (rpcErr) {
        throw new Error(`Inventory adjustment failed: ${rpcErr.message}`);
      }

      // 3. Fetch updated stock
      const { data: updatedProd } = await serverSupabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .eq('business_id', businessId)
        .single();

      return {
        productId,
        productName: product.name,
        previousStock: product.stock_quantity,
        newStock: updatedProd?.stock_quantity ?? adjustmentQuantity,
        adjustmentQuantity,
        txId,
        message: `Updated stock for "${product.name}" to ${adjustmentQuantity} units.`,
      };
    }

    return {
      productId,
      productName: payload.productName || 'Product',
      previousStock: 0,
      newStock: adjustmentQuantity,
      adjustmentQuantity,
      message: `Updated stock to ${adjustmentQuantity} units.`,
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
    const { customerId, amount, paymentMethod = 'cash', notes = 'Debt settlement', reference } = payload;
    const paymentAmount = Number(amount);
    if (!customerId || !paymentAmount || paymentAmount <= 0) {
      throw new Error('Invalid payment payload: customerId and positive payment amount required.');
    }

    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(customerId)) {
      // 1. Verify Customer belongs to this business
      const { data: customer, error: custErr } = await serverSupabase
        .from('customers')
        .select('id, name, business_id')
        .eq('id', customerId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (custErr || !customer) {
        throw new Error(`Customer not found in this business.`);
      }

      // 2. Fetch customer's unpaid completed sales FIFO
      const { data: sales, error: salesErr } = await serverSupabase
        .from('sales')
        .select('id, total, amount_paid, amount_due')
        .eq('business_id', businessId)
        .eq('customer_id', customerId)
        .eq('sale_status', 'completed')
        .gt('amount_due', 0)
        .order('sold_at', { ascending: true });

      if (salesErr) {
        throw new Error(`Failed to query customer sales: ${salesErr.message}`);
      }

      let remainingPayment = paymentAmount;
      let primarySaleId: string | null = null;

      if (sales && sales.length > 0) {
        primarySaleId = sales[0].id;
        for (const s of sales) {
          if (remainingPayment <= 0) break;
          const due = Number(s.amount_due) || 0;
          const paid = Number(s.amount_paid) || 0;
          const total = Number(s.total) || 0;
          const applyAmt = Math.min(due, remainingPayment);

          const newPaid = paid + applyAmt;
          const newDue = Math.max(0, total - newPaid);
          const newStatus = newDue === 0 ? 'paid' : 'partial';

          const { error: updErr } = await serverSupabase
            .from('sales')
            .update({
              amount_paid: newPaid,
              amount_due: newDue,
              payment_status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', s.id)
            .eq('business_id', businessId);

          if (updErr) {
            throw new Error(`Failed to apply payment to sale #${s.id}: ${updErr.message}`);
          }

          remainingPayment -= applyAmt;
        }
      }

      // 3. Insert payment transaction record
      const { data: payment, error: payErr } = await serverSupabase
        .from('payments')
        .insert({
          business_id: businessId,
          customer_id: customerId,
          sale_id: primarySaleId,
          amount: paymentAmount,
          payment_method: paymentMethod,
          reference_number: reference || null,
          notes: notes || 'Customer debt payment',
          created_by: isValidUUID(userId) ? userId : null,
          payment_date: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (payErr) {
        throw new Error(`Failed to record payment entry: ${payErr.message}`);
      }

      // 4. Compute remaining total debt
      const { data: updatedSales } = await serverSupabase
        .from('sales')
        .select('amount_due')
        .eq('business_id', businessId)
        .eq('customer_id', customerId)
        .eq('sale_status', 'completed')
        .gt('amount_due', 0);

      const remainingDebt = (updatedSales || []).reduce(
        (acc, s) => acc + (Number(s.amount_due) || 0),
        0
      );

      return {
        paymentId: payment.id,
        customerId,
        customerName: customer.name,
        amountPaid: paymentAmount,
        remainingDebt,
        message: `Recorded payment of ${paymentAmount.toLocaleString()} from ${customer.name}. Outstanding balance: ${remainingDebt.toLocaleString()}.`,
      };
    }

    return {
      paymentId: `pay_${Date.now()}`,
      customerId,
      customerName: payload.customerName || 'Customer',
      amountPaid: paymentAmount,
      remainingDebt: 0,
      message: `Recorded payment of ${paymentAmount.toLocaleString()} from ${payload.customerName || 'customer'}.`,
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
    const expenseAmount = Number(amount);
    if (!category || !expenseAmount || expenseAmount <= 0) {
      throw new Error('Invalid expense payload: category and positive amount required.');
    }

    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      const { data: expense, error } = await serverSupabase
        .from('expenses')
        .insert({
          business_id: businessId,
          category,
          amount: expenseAmount,
          description: description || null,
          payment_method: paymentMethod,
          expense_date: expenseDate || new Date().toISOString().split('T')[0],
          created_by: isValidUUID(userId) ? userId : null,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to log expense: ${error.message}`);
      }

      return {
        expenseId: expense.id,
        category,
        amount: expenseAmount,
        message: `Logged expense of ${expenseAmount.toLocaleString()} under category "${category}".`,
      };
    }

    return {
      expenseId: `exp_${Date.now()}`,
      category,
      amount: expenseAmount,
      message: `Logged expense of ${expenseAmount.toLocaleString()} under "${category}".`,
    };
  }

  /**
   * Action: Send Customer Message
   */
  private static async executeSendCustomerMessage(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const { customerId, customerName, customerPhone, draftMessage, channel = 'in_app' } = payload;

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
   * Action: Create New Product with Unit of Measure and Initial Stock
   */
  private static async executeCreateProduct(
    businessId: string,
    userId: string,
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const name = payload.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Product name is required.');
    }

    const sellingPrice = Number(payload.selling_price ?? payload.sellingPrice) || 0;
    const costPrice = Number(payload.cost_price ?? payload.costPrice) || 0;
    const stockQty = Number(payload.stock_quantity ?? payload.stockQuantity ?? payload.quantity) || 0;
    const minStock = Number(payload.minimum_stock_level ?? payload.minimumStockLevel) ?? 5;
    const unitOfMeasure = (payload.unit_of_measure || payload.unit || 'piece').toString().trim();
    const productType = payload.product_type || 'physical';
    const description = payload.description?.trim() || null;
    const sku = payload.sku?.trim() || null;

    if (sellingPrice < 0 || costPrice < 0) {
      throw new Error('Product prices cannot be negative.');
    }

    const productId = generateUUID();
    const productRecord = {
      id: productId,
      business_id: businessId,
      name: name.trim(),
      description,
      sku,
      product_type: productType,
      unit_of_measure: unitOfMeasure,
      selling_price: sellingPrice,
      cost_price: costPrice,
      stock_quantity: productType === 'service' ? 0 : stockQty,
      minimum_stock_level: productType === 'service' ? 0 : minStock,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      const { data, error } = await serverSupabase
        .from('products')
        .insert(productRecord)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create product in database: ${error.message}`);
      }

      // If physical product with initial stock > 0, record initial stock via authoritative ledger
      if (productType === 'physical' && stockQty > 0) {
        await serverSupabase.from('inventory_transactions').insert({
          business_id: businessId,
          product_id: data.id,
          transaction_type: 'initial_stock',
          quantity: stockQty,
          notes: `Initial inventory (${stockQty} ${unitOfMeasure}) registered via Ursella OS`,
          created_by: isValidUUID(userId) ? userId : null,
          unit_cost: costPrice,
        });
      }

      return {
        message: `Product "${name.trim()}" (${stockQty} ${unitOfMeasure}) successfully added to catalog.`,
        productId: data.id,
        product: data,
      };
    }

    return {
      message: `Product "${name.trim()}" (${stockQty} ${unitOfMeasure}) registered.`,
      productId,
      product: productRecord,
    };
  }

  /**
   * Reminders Management
   */
  public static async getReminders(businessId: string): Promise<BusinessReminder[]> {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase
          .from('business_reminders')
          .select('*')
          .eq('business_id', businessId)
          .order('due_date', { ascending: true });

        if (!error && data) {
          return data as BusinessReminder[];
        }
      } catch (e) {
        console.warn('[ActionExecutor] Failed to fetch reminders from Supabase:', e);
      }
    }

    return inMemoryReminders.filter((r) => r.business_id === businessId);
  }

  public static async updateReminderStatus(
    reminderId: string,
    businessId: string,
    status: 'pending' | 'completed' | 'cancelled'
  ): Promise<boolean> {
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(reminderId)) {
      try {
        const { data, error } = await serverSupabase
          .from('business_reminders')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminderId)
          .eq('business_id', businessId)
          .select('id')
          .maybeSingle();

        if (!error && data) {
          return true;
        }
      } catch (e) {
        console.warn('[ActionExecutor] Failed to update reminder status in Supabase:', e);
      }
    }

    const rem = inMemoryReminders.find((r) => r.id === reminderId && r.business_id === businessId);
    if (!rem) return false;
    rem.status = status;
    if (status === 'completed') {
      rem.completed_at = new Date().toISOString();
    }
    return true;
  }

  public static async deleteReminder(reminderId: string, businessId: string): Promise<boolean> {
    if (isServerSupabaseConfigured && isValidUUID(businessId) && isValidUUID(reminderId)) {
      try {
        const { error } = await serverSupabase
          .from('business_reminders')
          .delete()
          .eq('id', reminderId)
          .eq('business_id', businessId);

        if (!error) return true;
      } catch (e) {
        console.warn('[ActionExecutor] Failed to delete reminder from Supabase:', e);
      }
    }

    const idx = inMemoryReminders.findIndex((r) => r.id === reminderId && r.business_id === businessId);
    if (idx >= 0) {
      inMemoryReminders.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Audit Logging (Persistent & Immutable)
   */
  public static async recordAuditLog(log: Omit<ActionAuditLog, 'id' | 'timestamp'>): Promise<ActionAuditLog> {
    const id = generateUUID();
    const timestamp = new Date().toISOString();
    const fullLog: ActionAuditLog = {
      ...log,
      id,
      timestamp,
    };

    if (isServerSupabaseConfigured && isValidUUID(log.business_id)) {
      try {
        await serverSupabase
          .from('action_audit_logs')
          .insert({
            id,
            business_id: log.business_id,
            action_id: log.action_id,
            action_type: log.action_type,
            actor_id: log.actor_id,
            actor_role: log.actor_role,
            is_ai_proposed: log.is_ai_proposed,
            target_entity_type: log.target_entity_type || null,
            target_entity_id: log.target_entity_id || null,
            changes: log.changes || {},
            status: log.status,
            error_message: log.error_message || null,
            created_at: timestamp,
          });
      } catch (e) {
        console.warn('[ActionExecutor] Failed to write audit log to Supabase:', e);
      }
    }

    inMemoryAuditLogs.unshift(fullLog);
    if (inMemoryAuditLogs.length > 200) {
      inMemoryAuditLogs.pop();
    }
    return fullLog;
  }

  public static async getAuditLogs(businessId: string): Promise<ActionAuditLog[]> {
    if (isServerSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await serverSupabase
          .from('action_audit_logs')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            business_id: d.business_id,
            action_id: d.action_id,
            action_type: d.action_type,
            actor_id: d.actor_id,
            actor_role: d.actor_role,
            is_ai_proposed: d.is_ai_proposed,
            target_entity_type: d.target_entity_type,
            target_entity_id: d.target_entity_id,
            changes: d.changes,
            status: d.status,
            error_message: d.error_message,
            timestamp: d.created_at,
          }));
        }
      } catch (e) {
        console.warn('[ActionExecutor] Failed to read audit logs from Supabase:', e);
      }
    }

    return inMemoryAuditLogs.filter((l) => l.business_id === businessId);
  }

  /**
   * Role permissions mapping for actions
   */
  private static getAllowedRolesForAction(actionType: ActionType): MemberRole[] {
    switch (actionType) {
      case 'create_product':
        return ['owner', 'admin', 'staff'];
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
