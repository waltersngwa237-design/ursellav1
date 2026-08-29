import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  type AIChatMessage,
} from '../../types/ai.ts';
import {
  Sparkles,
  Check,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  Trash2,
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
  currencySymbol = '$',
  onSelectPrompt,
  onRetry,
  onDeleteMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const structured = message.metadata?.structured;
  const isError = Boolean(message.metadata?.error);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // User Message Bubble (Right-aligned, chat style)
  if (isUser) {
    return (
      <div className="group flex justify-end my-3 sm:my-4">
        <div className="max-w-[85%] sm:max-w-[70%] space-y-1">
          <div className="rounded-2xl rounded-tr-xs bg-emerald-600/20 border border-emerald-500/30 px-4 py-3 text-zinc-100 text-sm leading-relaxed shadow-sm relative">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="flex items-center justify-end gap-2 text-[10px] text-zinc-400 font-mono pr-1">
            {onDeleteMessage && (
              <button
                onClick={() => onDeleteMessage(message.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-zinc-500 hover:text-rose-400 rounded"
                title="Delete message"
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

  // Assistant Message (Chatbot conversational bubble)
  return (
    <div className="group flex items-start gap-3 my-3 sm:my-5 w-full">
      {/* Bot Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-400/30 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300 shadow-sm mt-0.5">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Main Chat Bubble */}
        <div className="rounded-2xl rounded-tl-xs bg-zinc-900/90 border border-zinc-800/90 p-4 sm:p-4.5 text-zinc-100 text-sm shadow-sm space-y-3">
          {/* Conversational Markdown Body */}
          <div className="ai-chat-markdown text-zinc-200 text-sm leading-relaxed space-y-2">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 text-[13.5px] sm:text-sm leading-relaxed text-zinc-200">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                ul: ({ children }) => <ul className="space-y-1.5 my-2 pl-4 list-disc text-zinc-300 text-[13.5px] sm:text-sm">{children}</ul>,
                ol: ({ children }) => <ol className="space-y-1.5 my-2 pl-4 list-decimal text-zinc-300 text-[13.5px] sm:text-sm">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h3: ({ children }) => <h3 className="font-bold text-sm text-zinc-100 mt-2 mb-1">{children}</h3>,
                h4: ({ children }) => <h4 className="font-semibold text-xs text-zinc-200 mt-1.5 mb-1">{children}</h4>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Compact Metric Highlights (Conversational badges) */}
          {structured?.keyMetrics && structured.keyMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-800/60">
              {structured.keyMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs"
                >
                  <span className="text-zinc-400 text-[11px]">{metric.label}:</span>
                  <span className="font-semibold text-white text-[12px]">
                    {metric.formattedValue || metric.value}
                  </span>
                  {metric.trend && (
                    <span>
                      {metric.trend === 'positive' ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : metric.trend === 'negative' ? (
                        <TrendingDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Minus className="w-3 h-3 text-zinc-400" />
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actionable Tip if provided */}
          {structured?.recommendations && structured.recommendations.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                <span>{structured.recommendations[0].title}</span>
              </div>
              <p className="text-zinc-300 text-[12px] leading-relaxed pl-5">
                {structured.recommendations[0].reasoning || structured.recommendations[0].actionSuggestion}
              </p>
            </div>
          )}

          {/* Error & Retry */}
          {isError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{message.metadata?.error || 'Failed to complete AI response.'}</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Message Bottom Utility Bar */}
          <div className="pt-2 border-t border-zinc-800/40 flex items-center justify-between text-xs text-zinc-400">
            <span className="text-[10px] text-zinc-400 font-mono">
              ursella • {formattedTime}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] hover:text-zinc-200 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
                title="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {onDeleteMessage && (
                <button
                  onClick={() => onDeleteMessage(message.id)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800"
                  title="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Delete</span>
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
          <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
            {structured.followUpSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(suggestion)}
                className="text-left text-xs px-3 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-white transition-all shadow-xs flex items-center gap-1.5 group"
              >
                <span>{suggestion}</span>
                <ArrowRight className="w-3 h-3 text-zinc-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
