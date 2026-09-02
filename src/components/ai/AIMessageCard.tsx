import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  type AIChatMessage,
} from '../../types/ai.ts';
import { UrsellaSymbolMark } from '../common/UrsellaLogo.tsx';
import {
  Sparkles,
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
} from 'lucide-react';
import { AIResponseFeedback } from '../feedback/AIResponseFeedback.tsx';

interface AIMessageCardProps {
  message: AIChatMessage;
  currencySymbol?: string;
  onSelectPrompt?: (prompt: string) => void;
  onRetry?: () => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const AIMessageCard: React.FC<AIMessageCardProps> = ({
  message,
  onSelectPrompt,
  onRetry,
  onDeleteMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const structured = message.metadata?.structured;
  const isError = Boolean(message.metadata?.error);
  const responseSource = structured?.responseSource || message.metadata?.responseSource;

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
          <div className="rounded-2xl rounded-tr-xs bg-zinc-800 border border-zinc-700/80 px-4 py-3 text-zinc-100 text-[13.5px] sm:text-sm leading-relaxed shadow-xs relative select-text break-words">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex items-center justify-end gap-2 text-[10px] text-zinc-500 font-mono pr-1">
            {onDeleteMessage && (
              <button
                onClick={() => onDeleteMessage(message.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-500 hover:text-rose-400 rounded min-w-[24px] min-h-[24px] flex items-center justify-center"
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
    <div id={`msg-${message.id}`} className="group flex items-start gap-2.5 sm:gap-3.5 my-3 sm:my-5 w-full scroll-mt-6">
      {/* Bot Avatar */}
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-zinc-900 border border-indigo-500/25 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
        <UrsellaSymbolMark sizeClass="w-4 h-4 sm:w-4.5 sm:h-4.5" theme="ai" />
      </div>

      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Main Chat Bubble */}
        <div className="rounded-2xl rounded-tl-xs bg-zinc-900/95 border border-zinc-800 p-3.5 sm:p-5 text-zinc-100 text-sm shadow-xs space-y-3.5">
          {/* Conversational Markdown Body */}
          <div className="ai-chat-markdown text-zinc-200 text-sm leading-relaxed space-y-2 select-text break-words">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 text-[13.5px] sm:text-sm leading-relaxed text-zinc-200">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                ul: ({ children }) => <ul className="space-y-1.5 my-2 pl-4 list-disc text-zinc-300 text-[13.5px] sm:text-sm">{children}</ul>,
                ol: ({ children }) => <ol className="space-y-1.5 my-2 pl-4 list-decimal text-zinc-300 text-[13.5px] sm:text-sm">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h3: ({ children }) => <h3 className="font-bold text-sm text-zinc-100 mt-3 mb-1.5 pb-1 border-b border-zinc-800/60 first:mt-0">{children}</h3>,
                h4: ({ children }) => <h4 className="font-semibold text-xs text-zinc-200 mt-2 mb-1">{children}</h4>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-amber-500/60 pl-3 my-2 text-xs text-zinc-400 italic bg-amber-500/5 py-1 rounded-r">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-amber-300">
                    {children}
                  </code>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 -mx-1 sm:mx-0 rounded-xl border border-zinc-800 bg-zinc-950/60">
                    <table className="min-w-full divide-y divide-zinc-800 text-xs text-left">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-zinc-900/90 font-semibold text-zinc-200 text-xs">
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {children}
                  </tbody>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-xs font-semibold text-zinc-300 tracking-wider">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-xs text-zinc-200 whitespace-nowrap">
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
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/60">
              {structured.keyMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs"
                >
                  <span className="text-zinc-400 text-[11px]">{metric.label}:</span>
                  <span className="font-semibold text-zinc-100 text-[12px]">
                    {metric.formattedValue || metric.value}
                  </span>
                  {metric.trend && (
                    <span>
                      {metric.trend === 'positive' ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : metric.trend === 'negative' ? (
                        <TrendingDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Minus className="w-3 h-3 text-zinc-500" />
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actionable Recommendations */}
          {structured?.recommendations && structured.recommendations.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/5 border-l-2 border-l-amber-500 border-y border-r border-zinc-800/80 text-xs space-y-1">
              <div className="font-semibold text-amber-300 text-xs">
                {structured.recommendations[0].title}
              </div>
              <p className="text-zinc-300 text-[12px] leading-relaxed">
                {structured.recommendations[0].reasoning || structured.recommendations[0].actionSuggestion}
              </p>
            </div>
          )}

          {/* Error & Retry */}
          {isError && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{message.metadata?.error || 'Failed to complete AI response.'}</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors active:scale-95"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Message Bottom Utility Bar */}
          <div className="pt-2 border-t border-zinc-800/50 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">
                {formattedTime}
              </span>

              {/* Provenance Tag */}
              {responseSource === 'GEMINI_RESPONSE' ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Cpu className="w-2.5 h-2.5" />
                  <span>Gemini AI</span>
                </span>
              ) : responseSource === 'DETERMINISTIC_FALLBACK' ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  <Database className="w-2.5 h-2.5" />
                  <span>Ledger Telemetry</span>
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800 min-h-[28px] active:scale-95"
                title="Copy response"
                aria-label="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[10px] font-medium">Copied</span>
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
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800 min-h-[28px] active:scale-95"
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

        {/* Conversational Follow-up Suggestion Chips */}
        {structured?.followUpSuggestions && structured.followUpSuggestions.length > 0 && onSelectPrompt && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {structured.followUpSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(suggestion)}
                className="text-left text-xs px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-white transition-all shadow-xs flex items-center gap-1.5 group cursor-pointer active:scale-98"
              >
                <span>{suggestion}</span>
                <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

