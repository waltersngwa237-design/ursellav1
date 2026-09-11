import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { ProactiveService } from '../../services/proactive.service.ts';
import {
  type AIChatMessage,
} from '../../types/ai.ts';
import { UrsellaSymbolMark } from '../common/UrsellaLogo.tsx';
import { sanitizeFollowUpSuggestions } from '../../utils/ai-prompt.utils.ts';
import {
  Check,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ArrowRight,
  Trash2,
  Database,
  Cpu,
  PackagePlus,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AIResponseFeedback } from '../feedback/AIResponseFeedback.tsx';

interface AIMessageCardProps {
  message: AIChatMessage;
  currencySymbol?: string;
  onSelectPrompt?: (prompt: string) => void;
  onInsertPrompt?: (prompt: string) => void;
  onRetry?: () => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const AIMessageCard: React.FC<AIMessageCardProps> = React.memo(({
  message,
  currencySymbol,
  onSelectPrompt,
  onInsertPrompt,
  onRetry,
  onDeleteMessage,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { activeBusiness, activeRole } = useBusiness();
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isUser = message.role === 'user';
  const structured = message.metadata?.structured;
  const proposedAction = structured?.proposedAction || (message.metadata as any)?.proposedAction;
  const isError = Boolean(message.metadata?.error);
  const responseSource = structured?.responseSource || message.metadata?.responseSource;

  const handleExecuteProposedAction = async () => {
    if (!proposedAction || !activeBusiness?.id) {
      setActionError('Active business context required to execute action.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await ProactiveService.executeAction({
        businessId: activeBusiness.id,
        userId: user?.id || 'business_operator',
        userRole: activeRole || 'owner',
        actionType: proposedAction.actionType as any,
        payload: (proposedAction.payload as Record<string, any>) || {},
        idempotencyKey: `ai_act_${message.id}_${Date.now()}`,
        isAIGenerated: true,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to execute proposed action.');
      } else {
        const msg = res.result?.message || `Successfully executed ${proposedAction.title}!`;
        setActionSuccess(msg);
      }
    } catch (err: any) {
      setActionError(err.message || 'Error executing action.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // User Message Bubble (Right-aligned, minimalist chat bubble)
  if (isUser) {
    return (
      <div id={`msg-${message.id}`} className="group flex justify-end my-3 sm:my-4 scroll-mt-6">
        <div className="max-w-[92%] sm:max-w-[80%] md:max-w-[75%] space-y-1">
          <div className={`rounded-2xl rounded-tr-xs px-4 py-3 text-[13.5px] sm:text-sm leading-relaxed shadow-xs relative select-text break-words ${
            isDark 
              ? 'bg-zinc-800 border border-zinc-700/80 text-zinc-100' 
              : 'bg-emerald-600 border border-emerald-600 text-white shadow-xs'
          }`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className={`flex items-center justify-end gap-2 text-[10px] font-mono pr-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            {onDeleteMessage && (
              <button
                onClick={() => onDeleteMessage(message.id)}
                className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded min-w-[24px] min-h-[24px] flex items-center justify-center ${
                  isDark ? 'text-zinc-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'
                }`}
                title="Delete message"
                aria-label="Delete message"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            <span>{formattedTime}</span>
          </div>
        </div>
      </div>
    );
  }

  // Assistant Message (Clean Ursella AI advisor bubble)
  return (
    <div id={`msg-${message.id}`} className="group flex items-start gap-2.5 sm:gap-3.5 my-3 sm:my-5 w-full min-w-0 scroll-mt-6">
      {/* Bot Avatar */}
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-xs mt-0.5 ${
        isDark ? 'bg-zinc-900 border-indigo-500/25' : 'bg-white border-indigo-200'
      }`}>
        <UrsellaSymbolMark sizeClass="w-4 h-4 sm:w-4.5 sm:h-4.5" theme="ai" />
      </div>

      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Main Chat Bubble */}
        <div className={`rounded-2xl rounded-tl-xs p-3.5 sm:p-5 text-sm shadow-xs space-y-3.5 border min-w-0 ${
          isDark ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          {/* Conversational Markdown Body */}
          <div className={`ai-chat-markdown text-sm leading-relaxed space-y-2 select-text break-words ${
            isDark ? 'text-zinc-200' : 'text-slate-800'
          }`}>
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className={`mb-2 last:mb-0 text-[13.5px] sm:text-sm leading-relaxed ${
                    isDark ? 'text-zinc-200' : 'text-slate-700'
                  }`}>
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul className={`space-y-1.5 my-2 pl-4 list-disc text-[13.5px] sm:text-sm ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className={`space-y-1.5 my-2 pl-4 list-decimal text-[13.5px] sm:text-sm ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h3: ({ children }) => (
                  <h3 className={`font-bold text-sm mt-3 mb-1.5 pb-1 border-b first:mt-0 ${
                    isDark ? 'text-zinc-100 border-zinc-800/60' : 'text-slate-900 border-slate-200'
                  }`}>
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className={`font-semibold text-xs mt-2 mb-1 ${
                    isDark ? 'text-zinc-200' : 'text-slate-800'
                  }`}>
                    {children}
                  </h4>
                ),
                blockquote: ({ children }) => (
                  <blockquote className={`border-l-2 pl-3 my-2 text-xs italic py-1 rounded-r ${
                    isDark 
                      ? 'border-amber-500/60 text-zinc-400 bg-amber-500/5' 
                      : 'border-amber-500 text-slate-600 bg-amber-50'
                  }`}>
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-amber-300' : 'bg-slate-100 border-slate-200 text-amber-800'
                  }`}>
                    {children}
                  </code>
                ),
                table: ({ children }) => (
                  <div className={`overflow-x-auto my-3 -mx-1 sm:mx-0 rounded-xl border ${
                    isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <table className={`min-w-full divide-y text-xs text-left ${
                      isDark ? 'divide-zinc-800' : 'divide-slate-200'
                    }`}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className={`font-semibold text-xs ${
                    isDark ? 'bg-zinc-900/90 text-zinc-200' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => (
                  <tbody className={`divide-y ${
                    isDark ? 'divide-zinc-800/60 text-zinc-300' : 'divide-slate-200 text-slate-700'
                  }`}>
                    {children}
                  </tbody>
                ),
                th: ({ children }) => (
                  <th className={`px-3 py-2 text-xs font-semibold tracking-wider ${
                    isDark ? 'text-zinc-300' : 'text-slate-700'
                  }`}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className={`px-3 py-2 text-xs whitespace-nowrap ${
                    isDark ? 'text-zinc-200' : 'text-slate-800'
                  }`}>
                    {children}
                  </td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Compact Metric Highlights */}
          {structured?.keyMetrics && structured.keyMetrics.length > 0 && (
            <div className={`flex flex-wrap gap-2 pt-2 border-t ${
              isDark ? 'border-zinc-800/60' : 'border-slate-200'
            }`}>
              {structured.keyMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                    isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200 shadow-2xs'
                  }`}
                >
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{metric.label}:</span>
                  <span className={`font-semibold text-[12px] ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                    {metric.formattedValue || metric.value}
                  </span>
                  {metric.trend && (
                    <span>
                      {metric.trend === 'positive' ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      ) : metric.trend === 'negative' ? (
                        <TrendingDown className="w-3 h-3 text-rose-500" />
                      ) : (
                        <Minus className={`w-3 h-3 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actionable Recommendations */}
          {structured?.recommendations && structured.recommendations.length > 0 && (
            <div className={`p-3 rounded-xl border-l-2 border-y border-r text-xs space-y-1 ${
              isDark 
                ? 'bg-amber-500/5 border-l-amber-500 border-zinc-800/80' 
                : 'bg-amber-50/70 border-l-amber-500 border-amber-200'
            }`}>
              <div className="font-semibold text-amber-600 dark:text-amber-300 text-xs">
                {structured.recommendations[0].title}
              </div>
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                {structured.recommendations[0].reasoning || structured.recommendations[0].actionSuggestion}
              </p>
            </div>
          )}

          {/* 1-Click Controlled Action Execution Card */}
          {proposedAction && (
            <div className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
              actionSuccess
                ? isDark ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                : isDark ? 'bg-zinc-900/90 border-indigo-500/30 shadow-xs' : 'bg-indigo-50/40 border-indigo-200 shadow-xs'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    actionSuccess 
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {actionSuccess ? <CheckCircle2 className="w-4 h-4" /> : <PackagePlus className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {proposedAction.category === 'product_creation'
                          ? 'Product Creation'
                          : proposedAction.category === 'inventory_restock'
                          ? 'Inventory Restock'
                          : 'Proactive Action'}
                      </span>
                      {actionSuccess && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Executed
                        </span>
                      )}
                    </div>
                    <h4 className={`text-xs sm:text-sm font-semibold mt-0.5 ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                      {proposedAction.title}
                    </h4>
                  </div>
                </div>
              </div>

              <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                {proposedAction.description}
              </p>

              {/* Action Parameter Telemetry Card */}
              {proposedAction.payload && (
                <div className={`p-2.5 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-3 gap-2 border ${
                  isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-300' : 'bg-white/90 border-slate-200 text-slate-700'
                }`}>
                  {proposedAction.payload.name && (
                    <div>
                      <span className="text-[10px] block text-zinc-500 uppercase font-mono">Product</span>
                      <span className="font-semibold truncate block">{String(proposedAction.payload.name)}</span>
                    </div>
                  )}
                  {(proposedAction.payload.stock_quantity !== undefined || proposedAction.payload.adjustmentQuantity !== undefined) && (
                    <div>
                      <span className="text-[10px] block text-zinc-500 uppercase font-mono">
                        {proposedAction.actionType === 'create_product' ? 'Initial Stock' : 'Qty Adjustment'}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {String(proposedAction.payload.stock_quantity ?? proposedAction.payload.adjustmentQuantity)}{' '}
                        {String(proposedAction.payload.unit_of_measure || 'units')}
                      </span>
                    </div>
                  )}
                  {proposedAction.payload.unit_of_measure && (
                    <div>
                      <span className="text-[10px] block text-zinc-500 uppercase font-mono">Unit of Measure</span>
                      <span className="font-semibold uppercase tracking-wider text-[11px] text-emerald-600 dark:text-emerald-400">
                        {String(proposedAction.payload.unit_of_measure)}
                      </span>
                    </div>
                  )}
                  {proposedAction.payload.selling_price !== undefined && Number(proposedAction.payload.selling_price) > 0 && (
                    <div>
                      <span className="text-[10px] block text-zinc-500 uppercase font-mono">Selling Price</span>
                      <span className="font-semibold">
                        {currencySymbol || 'XAF'} {Number(proposedAction.payload.selling_price).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {proposedAction.payload.cost_price !== undefined && Number(proposedAction.payload.cost_price) > 0 && (
                    <div>
                      <span className="text-[10px] block text-zinc-500 uppercase font-mono">Cost Price</span>
                      <span className="font-semibold">
                        {currencySymbol || 'XAF'} {Number(proposedAction.payload.cost_price).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Execution Error Feedback */}
              {actionError && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Action Execution Success Banner or 1-Click Button */}
              {actionSuccess ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span className="font-semibold">{actionSuccess}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExecuteProposedAction}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Applying to Business OS...</span>
                      </>
                    ) : (
                      <>
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>
                          {proposedAction.actionType === 'create_product'
                            ? 'Confirm & Add to Product Catalog'
                            : proposedAction.actionType === 'create_inventory_adjustment'
                            ? 'Confirm Stock Adjustment'
                            : 'Confirm & Execute Action'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error & Retry */}
          {isError && (
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
              isDark ? 'bg-rose-950/30 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{message.metadata?.error || 'Failed to complete AI response.'}</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 border border-rose-500/40 transition-colors active:scale-95"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Message Bottom Utility Bar */}
          <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
            isDark ? 'border-zinc-800/50 text-zinc-500' : 'border-slate-100 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                {formattedTime}
              </span>

              {/* Provenance Tag - Merchants only see Ursella AI */}
              {responseSource === 'GEMINI_RESPONSE' || responseSource === 'GROQ_RESPONSE' ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Cpu className="w-2.5 h-2.5" />
                  <span>Ursella AI</span>
                </span>
              ) : responseSource === 'DETERMINISTIC_FALLBACK' ? (
                <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <Database className="w-2.5 h-2.5" />
                  <span>Ledger Telemetry</span>
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1 text-[11px] transition-colors px-2 py-1 rounded-lg min-h-[28px] active:scale-95 ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Copy response"
                aria-label="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 text-[10px] font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>

              {onDeleteMessage && (
                <button
                  onClick={() => onDeleteMessage(message.id)}
                  className={`flex items-center gap-1 text-[11px] transition-colors px-2 py-1 rounded-lg min-h-[28px] active:scale-95 ${
                    isDark ? 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800' : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                  }`}
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {!isError && (
                <AIResponseFeedback
                  businessId={message.business_id}
                  messageId={message.id}
                  intent={message.metadata?.intent}
                />
              )}
            </div>
          </div>
        </div>

        {/* Conversational Follow-up Suggestion Chips (framed as user requests) */}
        {structured?.followUpSuggestions && structured.followUpSuggestions.length > 0 && (onSelectPrompt || onInsertPrompt) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {sanitizeFollowUpSuggestions(structured.followUpSuggestions).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (onInsertPrompt) {
                    onInsertPrompt(suggestion);
                  } else if (onSelectPrompt) {
                    onSelectPrompt(suggestion);
                  }
                }}
                className={`text-left text-xs px-3 py-1.5 rounded-full border transition-all shadow-2xs flex items-center gap-1.5 group cursor-pointer active:scale-98 ${
                  isDark 
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-white' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-amber-500/60 text-slate-700 hover:text-slate-900 shadow-xs'
                }`}
                title="Tap to put into chat composer"
              >
                <span>{suggestion}</span>
                <ArrowRight className={`w-3 h-3 group-hover:translate-x-0.5 transition-all shrink-0 ${
                  isDark ? 'text-zinc-500 group-hover:text-amber-400' : 'text-slate-400 group-hover:text-amber-600'
                }`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

AIMessageCard.displayName = 'AIMessageCard';
