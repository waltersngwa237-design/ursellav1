import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Package,
  Users,
  DollarSign,
  Calendar,
  Send,
  CheckCircle,
  Copy,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import type { BusinessInsight, ActionType } from '../../types/proactive.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { ProactiveService } from '../../services/proactive.service.ts';

interface ActionPreviewModalProps {
  insight: BusinessInsight;
  onClose: () => void;
  onExecuted: (result: any) => void;
}

export const ActionPreviewModal: React.FC<ActionPreviewModalProps> = ({
  insight,
  onClose,
  onExecuted,
}) => {
  const { user } = useAuth();
  const { activeBusiness, activeRole } = useBusiness();
  const currentBusiness = activeBusiness;
  const currentRole = activeRole;

  // Form states based on action type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Editable fields depending on action
  const [draftMessage, setDraftMessage] = useState(
    insight.action_payload?.draftMessage || ''
  );
  const [taskTitle, setTaskTitle] = useState(
    insight.action_payload?.title || (insight.action_type === 'create_customer_followup' ? `Follow up with ${insight.action_payload?.customerName || 'customer'}` : insight.title)
  );
  const [taskDescription, setTaskDescription] = useState(
    insight.action_payload?.description || insight.summary
  );
  const [adjustmentQty, setAdjustmentQty] = useState<number>(
    insight.action_payload?.suggestedQuantity ?? insight.action_payload?.targetQuantity ?? insight.action_payload?.currentStock ?? 10
  );
  const [inventoryReason, setInventoryReason] = useState<string>(
    insight.action_payload?.reason || 'Proactive safety stock adjustment'
  );
  const [expenseCategory, setExpenseCategory] = useState<string>(
    insight.action_payload?.category || 'Operations'
  );
  const [expenseAmount, setExpenseAmount] = useState<number>(
    insight.action_payload?.amount || 0
  );
  const [expenseDesc, setExpenseDesc] = useState<string>(
    insight.action_payload?.description || insight.summary || 'Proactive expense log'
  );
  const [followupDate, setFollowupDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [paymentAmount, setPaymentAmount] = useState<number>(
    insight.action_payload?.debtAmount || insight.action_payload?.amount || 0
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'bank_transfer'>(
    'cash'
  );

  const actionType = insight.action_type || 'create_reminder';

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(draftMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExecute = async () => {
    if (!currentBusiness || !user) return;
    setLoading(true);
    setError(null);

    let payload: Record<string, any> = {
      ...insight.action_payload,
      insightId: insight.id,
    };

    if (actionType === 'send_customer_message') {
      payload.draftMessage = draftMessage;
    } else if (actionType === 'create_restock_task' || actionType === 'create_reminder') {
      payload.title = taskTitle;
      payload.description = taskDescription;
      payload.suggestedQuantity = adjustmentQty;
    } else if (actionType === 'create_inventory_adjustment') {
      payload.adjustmentQuantity = Number(adjustmentQty);
      payload.quantity = Number(adjustmentQty);
      payload.reason = inventoryReason;
    } else if (actionType === 'record_payment') {
      payload.amount = Number(paymentAmount);
      payload.paymentMethod = paymentMethod;
    } else if (actionType === 'create_expense') {
      payload.category = expenseCategory;
      payload.amount = Number(expenseAmount);
      payload.description = expenseDesc;
      payload.paymentMethod = paymentMethod;
    } else if (actionType === 'create_customer_followup') {
      payload.title = taskTitle;
      payload.description = taskDescription;
      payload.dueDate = followupDate;
    }

    try {
      const res = await ProactiveService.executeAction({
        businessId: currentBusiness.id,
        userId: user.id,
        userRole: currentRole || 'owner',
        actionType,
        payload,
        idempotencyKey: `act_${insight.id}_${Date.now()}`,
        isAIGenerated: true,
      });

      if (!res.success) {
        setError(res.error || 'Action execution failed. Please verify permissions.');
        setLoading(false);
        return;
      }

      onExecuted(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Execution failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        id="action-preview-modal"
        className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Review & Confirm Action
              </h3>
              <p className="text-xs text-slate-500">
                Human-in-the-loop operational authorization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Context Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Triggering Signal
            </span>
            <h4 className="font-semibold text-slate-900 dark:text-white">
              {insight.title}
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {insight.summary}
            </p>
          </div>

          {/* Dynamic Configuration based on Action Type */}
          {actionType === 'send_customer_message' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                  Draft Customer Message
                </label>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
              </div>

              <textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed"
                placeholder="Draft customer message..."
              />

              {insight.action_payload?.customerPhone && (
                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Recipient: <strong className="text-slate-800 dark:text-slate-200">{insight.action_payload.customerName}</strong> ({insight.action_payload.customerPhone})
                  </span>
                  <a
                    href={`https://wa.me/${String(insight.action_payload.customerPhone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(draftMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                  >
                    Open in WhatsApp
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {(actionType === 'create_restock_task' || actionType === 'create_reminder') && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Task / Reminder Title
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {actionType === 'create_restock_task' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Suggested Restock Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Calculated from minimum safety stock & recent 7-day sales velocity.
                  </span>
                </div>
              )}
            </div>
          )}

          {actionType === 'create_inventory_adjustment' && (
            <div className="space-y-3">
              {insight.action_payload?.productName && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Target Product</span>
                  <span className="font-bold text-slate-900 dark:text-white">{insight.action_payload.productName}</span>
                  {insight.action_payload?.currentStock !== undefined && (
                    <span className="text-slate-500 ml-2">(Current Stock: {insight.action_payload.currentStock})</span>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Adjusted Stock Quantity (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Adjustment Reason / Notes
                </label>
                <input
                  type="text"
                  value={inventoryReason}
                  onChange={(e) => setInventoryReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Physical inventory audit, damaged stock, safety buffer"
                />
              </div>
            </div>
          )}

          {actionType === 'create_expense' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Expense Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Utilities">Utilities (Power, Water)</option>
                    <option value="Supplies">Supplies / Packaging</option>
                    <option value="Logistics">Transport & Delivery</option>
                    <option value="Rent">Rent & Facilities</option>
                    <option value="Salaries">Staff / Wages</option>
                    <option value="Marketing">Marketing / Promotion</option>
                    <option value="Other">Other Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="mobile_money">Mobile Money (MoMo / Orange)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Reference
                </label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Utility bill payment or vendor invoice"
                />
              </div>
            </div>
          )}

          {actionType === 'create_customer_followup' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Follow-up Action Title
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes & Details
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                  placeholder="Call notes or customer agreement..."
                />
              </div>
            </div>
          )}

          {actionType === 'record_payment' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Amount Received
                </label>
                <input
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Channel
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="mobile_money">Mobile Money (MoMo / Orange)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>
          )}

          {/* Connection & Audit Notice */}
          <div className="space-y-2">
            {!isOnline ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <strong>Offline Mode:</strong> This action will update your local records instantly and automatically sync with the cloud once your connection is restored.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <strong>Live Database Sync:</strong> Changes will be committed directly to your business database and logged to the permanent audit trail.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-confirm-action"
            onClick={handleExecute}
            disabled={loading}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm hover:shadow transition-all inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isOnline ? 'Approve & Execute' : 'Approve & Save Offline'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
