import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Loader2,
  PackagePlus,
  Receipt,
  AlertCircle,
  MessageSquare,
  Calendar,
  Sparkles,
  ExternalLink,
  Tag,
  CheckCircle2,
  Boxes,
} from 'lucide-react';
import type { AIProposedAction } from '../../types/ai.ts';
import type { ActionType } from '../../types/proactive.ts';
import { ProactiveService } from '../../services/proactive.service.ts';
import { AIService } from '../../services/ai.service.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';

interface AIActionProposalCardProps {
  proposedAction: AIProposedAction;
  currencySymbol?: string;
  messageId?: string;
  conversationId?: string;
  onExecuted?: (result: any, updatedAction?: AIProposedAction) => void;
}

export const AIActionProposalCard: React.FC<AIActionProposalCardProps> = ({
  proposedAction,
  currencySymbol = 'XAF',
  messageId,
  conversationId,
  onExecuted,
}) => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const isFr = language === 'fr';
  const { user } = useAuth();
  const { activeBusiness, effectiveRole } = useBusiness();

  const payload = (proposedAction.payload || {}) as Record<string, any>;
  const actionType = (proposedAction.actionType || 'create_expense') as ActionType;

  // Derive initial execution state from proposedAction
  const initialStatus = proposedAction.executionStatus || 'pending';
  const [status, setStatus] = useState<'pending' | 'executing' | 'executed' | 'failed' | 'dismissed'>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    proposedAction.executionResult?.message ||
    (initialStatus === 'executed' ? (isFr ? 'Action déjà approuvée et exécutée.' : 'Action already approved and executed.') : null)
  );

  // Derive initial WhatsApp link if present
  const deriveInitialWhatsapp = () => {
    if (proposedAction.executionResult?.whatsappLink) return proposedAction.executionResult.whatsappLink;
    if (payload.customerPhone && (actionType === 'create_customer_followup' || actionType === 'send_customer_message')) {
      const cleanPhone = String(payload.customerPhone).replace(/[^0-9]/g, '');
      const cleanMsg = encodeURIComponent(payload.draftMessage || payload.messageText || '');
      if (cleanPhone) return `https://wa.me/${cleanPhone}?text=${cleanMsg}`;
    }
    return null;
  };
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(deriveInitialWhatsapp);

  // Keep state synchronized if proposedAction prop updates
  useEffect(() => {
    if (proposedAction.executionStatus) {
      setStatus(proposedAction.executionStatus);
      if (proposedAction.executionResult?.message) {
        setSuccessMessage(proposedAction.executionResult.message);
      }
      if (proposedAction.executionResult?.whatsappLink) {
        setWhatsappUrl(proposedAction.executionResult.whatsappLink);
      }
    }
  }, [proposedAction.executionStatus, proposedAction.executionResult]);

  // Icon mapping for action types
  const getActionIcon = () => {
    switch (actionType) {
      case 'create_expense':
        return <Receipt className="w-4 h-4 text-amber-500" />;
      case 'create_inventory_adjustment':
      case 'create_restock_task':
        return <Boxes className="w-4 h-4 text-emerald-500" />;
      case 'create_product':
        return <PackagePlus className="w-4 h-4 text-sky-500" />;
      case 'record_payment':
        return <Tag className="w-4 h-4 text-emerald-500" />;
      case 'create_customer_followup':
      case 'send_customer_message':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'create_reminder':
        return <Calendar className="w-4 h-4 text-indigo-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  const getCategoryLabel = () => {
    switch (proposedAction.category) {
      case 'inventory_restock':
        return isFr ? 'Réapprovisionnement' : 'Stock Replenishment';
      case 'expense_review':
        return isFr ? 'Dépense d\'exploitation' : 'Store Expense';
      case 'debt_reminder':
        return isFr ? 'Créance Client' : 'Customer Balance';
      case 'product_creation':
        return isFr ? 'Nouveau Produit' : 'New Product';
      case 'task_creation':
        return isFr ? 'Rappel & Tâche' : 'Task & Reminder';
      default:
        return isFr ? 'Tâche Ursella Agent' : 'Ursella Agent Task';
    }
  };

  const handleExecute = async () => {
    if (!activeBusiness?.id) {
      setErrorMessage(isFr ? 'Entreprise introuvable' : 'Business not found');
      return;
    }

    setStatus('executing');
    setErrorMessage(null);

    try {
      const res = await ProactiveService.executeAction({
        businessId: activeBusiness.id,
        userId: user?.id || 'owner_user',
        userRole: effectiveRole || 'owner',
        actionType,
        payload,
        idempotencyKey: `ai_agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        isAIGenerated: true,
      });

      if (res.success) {
        setStatus('executed');
        const customSuccess =
          res.result?.message ||
          (isFr ? 'Action exécutée et synchronisée avec succès.' : 'Action executed and synchronized successfully.');
        setSuccessMessage(customSuccess);

        // If WhatsApp message link was generated
        if (res.result?.whatsappLink) {
          setWhatsappUrl(res.result.whatsappLink);
        } else if (payload.customerPhone && (actionType === 'create_customer_followup' || actionType === 'send_customer_message')) {
          const cleanPhone = String(payload.customerPhone).replace(/[^0-9]/g, '');
          const cleanMsg = encodeURIComponent(payload.draftMessage || payload.messageText || '');
          if (cleanPhone) {
            setWhatsappUrl(`https://wa.me/${cleanPhone}?text=${cleanMsg}`);
          }
        }

        const updatedProposedAction: AIProposedAction = {
          ...proposedAction,
          executionStatus: 'executed',
          executedAt: new Date().toISOString(),
          executionResult: {
            message: customSuccess,
            whatsappLink: res.result?.whatsappLink || (payload.customerPhone ? `https://wa.me/${String(payload.customerPhone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(payload.draftMessage || payload.messageText || '')}` : undefined),
          },
        };

        if (conversationId && messageId) {
          AIService.updateMessageMetadata(conversationId, messageId, {
            proposedAction: updatedProposedAction,
          }).catch(() => {});
        }

        if (onExecuted) {
          onExecuted(res, updatedProposedAction);
        }
      } else {
        setStatus('failed');
        setErrorMessage(res.error || (isFr ? 'Échec de l\'exécution' : 'Execution failed'));
      }
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err.message || (isFr ? 'Une erreur est survenue' : 'An error occurred'));
    }
  };

  const handleDismiss = () => {
    setStatus('dismissed');
    const updatedProposedAction: AIProposedAction = {
      ...proposedAction,
      executionStatus: 'dismissed',
    };
    if (conversationId && messageId) {
      AIService.updateMessageMetadata(conversationId, messageId, {
        proposedAction: updatedProposedAction,
      }).catch(() => {});
    }
  };

  if (status === 'dismissed') {
    return (
      <div
        className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border ${
          isDark ? 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-400'
        }`}
      >
        <span className="italic">{isFr ? 'Proposition de tâche ignorée' : 'Action proposal dismissed'}</span>
        <span className="text-[10px] font-mono">{proposedAction.title}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border transition-all p-3.5 sm:p-4 my-2.5 ${
        isDark
          ? 'bg-zinc-900/90 border-zinc-800 shadow-lg shadow-black/20'
          : 'bg-white border-slate-200/90 shadow-sm'
      }`}
    >
      {/* Header bar: Agent badge + Category */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-inherit">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
              isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {getActionIcon()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Ursella Agent</span>
              </span>
              <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {getCategoryLabel()}
              </span>
            </div>
          </div>
        </div>

        {/* Phase / State badge */}
        {status === 'executed' ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isFr ? 'Exécuté' : 'Executed'}</span>
          </span>
        ) : (
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono ${
              isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isFr ? 'Confirmation requise' : 'Approval required'}
          </span>
        )}
      </div>

      {/* Title & Description */}
      <div className="space-y-1 mb-3">
        <h4 className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
          {proposedAction.title}
        </h4>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
          {proposedAction.description}
        </p>
      </div>

      {/* Itemized Parameters Matrix */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-xl border mb-3 text-xs ${
          isDark ? 'bg-zinc-950/60 border-zinc-800/80' : 'bg-slate-50/80 border-slate-200/80'
        }`}
      >
        {/* Amount */}
        {payload.amount !== undefined && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Montant' : 'Amount'}
            </div>
            <div className={`font-semibold text-[13px] ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
              {currencySymbol} {Number(payload.amount || 0).toLocaleString()}
            </div>
          </div>
        )}

        {/* Product / Item */}
        {(payload.productName || payload.name) && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Article' : 'Product'}
            </div>
            <div className={`font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-slate-900'}`} title={payload.productName || payload.name}>
              {payload.productName || payload.name}
            </div>
          </div>
        )}

        {/* Quantity delta */}
        {payload.adjustmentQuantity !== undefined && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Variation stock' : 'Stock Change'}
            </div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{payload.adjustmentQuantity}
            </div>
          </div>
        )}

        {/* Category */}
        {payload.category && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Catégorie' : 'Category'}
            </div>
            <div className={`font-medium capitalize ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              {payload.category}
            </div>
          </div>
        )}

        {/* Customer */}
        {payload.customerName && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Client' : 'Customer'}
            </div>
            <div className={`font-medium truncate ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              {payload.customerName}
            </div>
          </div>
        )}

        {/* Payment method */}
        {payload.paymentMethod && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Mode de paiement' : 'Method'}
            </div>
            <div className={`font-medium capitalize ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              {String(payload.paymentMethod).replace('_', ' ')}
            </div>
          </div>
        )}

        {/* Selling / Cost price for new product */}
        {payload.selling_price !== undefined && (
          <div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isFr ? 'Prix de vente' : 'Selling Price'}
            </div>
            <div className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
              {currencySymbol} {Number(payload.selling_price || 0).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Pre-drafted WhatsApp message preview if applicable */}
      {payload.draftMessage && status !== 'executed' && (
        <div
          className={`p-2.5 rounded-xl text-xs mb-3 border ${
            isDark ? 'bg-zinc-950 border-emerald-900/40 text-zinc-300' : 'bg-emerald-50/70 border-emerald-200 text-slate-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            {isFr ? 'Message de rappel préparé' : 'Drafted Message Preview'}
          </div>
          <p className="italic">"{payload.draftMessage}"</p>
        </div>
      )}

      {/* Error state */}
      {status === 'failed' && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 mb-3 border ${
            isDark ? 'bg-rose-950/30 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success banner */}
      {status === 'executed' && (
        <div className="space-y-2 mb-2">
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
              isDark ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>

          {/* Quick link to WhatsApp if prepared */}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors active:scale-98 shadow-sm cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isFr ? 'Ouvrir dans WhatsApp' : 'Open in WhatsApp'}</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
            </a>
          )}
        </div>
      )}

      {/* Action Buttons (Approve & Execute / Dismiss) */}
      {status !== 'executed' && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleDismiss}
            disabled={status === 'executing'}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-1">
              <X className="w-3.5 h-3.5" />
              <span>{isFr ? 'Ignorer' : 'Dismiss'}</span>
            </span>
          </button>

          <button
            onClick={handleExecute}
            disabled={status === 'executing'}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 active:scale-98 transition-all flex items-center gap-1.5 shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
          >
            {status === 'executing' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isFr ? 'Exécution...' : 'Executing...'}</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{isFr ? 'Approuver & Exécuter' : 'Approve & Execute'}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
