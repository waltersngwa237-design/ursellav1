import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { AIService } from '../../services/ai.service.ts';
import { generateUUID, isValidUUID } from '../../lib/uuid.ts';
import {
  type AIChatMessage,
  type AIConversationSummary,
} from '../../types/ai.ts';
import { AIMessageCard } from '../../components/ai/AIMessageCard.tsx';
import { SuggestedPromptChips } from '../../components/ai/SuggestedPromptChips.tsx';
import { DailyBriefModal } from '../../components/ai/DailyBriefModal.tsx';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Sun,
  History,
  MessageSquare,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Edit2,
  Check,
  Copy,
  CheckCheck,
} from 'lucide-react';

interface UrsellaAIPageProps {
  initialPrompt?: string;
}

export const UrsellaAIPage: React.FC<UrsellaAIPageProps> = ({ initialPrompt }) => {
  const { user } = useAuth();
  const { activeBusiness, currency } = useBusiness();

  // Conversations & Messages State
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(false);
  const [isDailyBriefOpen, setIsDailyBriefOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Chat Management States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showClearActiveConfirm, setShowClearActiveConfirm] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversations when active business changes
  const loadConversations = useCallback(async () => {
    if (!activeBusiness?.id) return;
    try {
      const list = await AIService.listConversations(activeBusiness.id);
      setConversations(list);

      if (list.length > 0) {
        setActiveConversationId((prev) => prev || list[0].id);
      } else {
        // Create initial default conversation
        const newConv = await AIService.createConversation(
          activeBusiness.id,
          user?.id || 'demo-user',
          'Business Advisory'
        );
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
  }, [activeBusiness?.id, user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages whenever activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    AIService.getMessages(activeConversationId).then((msgs) => {
      setMessages(msgs);
    });
  }, [activeConversationId]);

  // Handle Initial Prompt (e.g. from Home page or quick action)
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0 && activeBusiness?.id) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt, activeBusiness?.id]);

  // Send message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend || !textToSend.trim() || !activeBusiness?.id || loading) return;

    setError(null);
    setInputText('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Ensure we have an active conversation
    let convId = activeConversationId;
    if (!convId) {
      const newConv = await AIService.createConversation(
        activeBusiness.id,
        user?.id || 'demo-user',
        AIService.generateTitleFromMessage(textToSend)
      );
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      convId = newConv.id;
    }

    const userMessageId = generateUUID();
    const userMsg: AIChatMessage = {
      id: userMessageId,
      conversation_id: convId,
      business_id: activeBusiness.id,
      role: 'user',
      content: textToSend.trim(),
      created_at: new Date().toISOString(),
    };

    // Optimistically update message state
    setMessages((prev) => [...prev, userMsg]);
    await AIService.saveMessage(userMsg);

    setLoading(true);

    try {
      // Build conversation history window (last 6 turns)
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

      const res = await AIService.sendChatMessage({
        businessId: activeBusiness.id,
        conversationId: convId,
        message: textToSend.trim(),
        history: historyPayload,
        businessContext: {
          businessName: activeBusiness.name,
          businessType: activeBusiness.business_type || 'Retail & Trade',
          currency: activeBusiness.currency || currency || 'USD',
          currencySymbol: currency || activeBusiness.currency || '$',
          timezone: activeBusiness.timezone || 'UTC',
          ownerName: user?.user_metadata?.full_name || user?.email || 'Store Owner',
          address: (activeBusiness as any).address || '',
          taxRate: (activeBusiness as any).tax_rate || 0,
        },
      });

      const assistantMsg: AIChatMessage = {
        id: (res.messageId && isValidUUID(res.messageId)) ? res.messageId : generateUUID(),
        conversation_id: convId,
        business_id: activeBusiness.id,
        role: 'assistant',
        content: res.response.answer,
        metadata: {
          intent: res.intent,
          structured: res.response,
          toolsUsed: res.toolsUsed,
          latencyMs: res.latencyMs,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      await AIService.saveMessage(assistantMsg);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to obtain AI response.';
      setError(errMsg);

      const errorAssistantMsg: AIChatMessage = {
        id: generateUUID(),
        conversation_id: convId,
        business_id: activeBusiness.id,
        role: 'assistant',
        content: 'I encountered an issue analyzing your business records. Please try again.',
        metadata: {
          error: errMsg,
        },
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Create new conversation
  const handleNewConversation = async () => {
    if (!activeBusiness?.id) return;
    try {
      const newConv = await AIService.createConversation(
        activeBusiness.id,
        user?.id || 'demo-user',
        'New Conversation'
      );
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setIsSidebarOpen(false);
    } catch (e) {
      console.warn(e);
    }
  };

  // Delete single conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeBusiness?.id) return;

    await AIService.deleteConversation(activeBusiness.id, convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));

    if (activeConversationId === convId) {
      const remaining = conversations.filter((c) => c.id !== convId);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        handleNewConversation();
      }
    }
  };

  // Rename conversation
  const handleStartRename = (conv: AIConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = async (convId: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (!activeBusiness?.id || !editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }

    const trimmed = editingTitle.trim();
    await AIService.renameConversation(activeBusiness.id, convId, trimmed);
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c))
    );
    setEditingConvId(null);
  };

  // Delete individual message
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeBusiness?.id || !activeConversationId) return;
    await AIService.deleteMessage(activeBusiness.id, activeConversationId, messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Clear current active conversation messages
  const handleClearActiveConversation = async () => {
    if (!activeBusiness?.id || !activeConversationId) return;
    await AIService.clearMessagesInConversation(activeBusiness.id, activeConversationId);
    setMessages([]);
    setShowClearActiveConfirm(false);
  };

  // Clear all conversations
  const handleClearAllConversations = async () => {
    if (!activeBusiness?.id) return;
    await AIService.clearAllConversations(activeBusiness.id);
    setShowClearConfirm(false);
    handleNewConversation();
  };

  // Copy full chat transcript to clipboard
  const handleCopyTranscript = () => {
    if (messages.length === 0) return;
    const transcript = messages
      .map(
        (m) =>
          `[${m.role === 'user' ? 'Merchant' : 'Ursella AI'}] (${new Date(
            m.created_at
          ).toLocaleTimeString()}):\n${m.content}\n`
      )
      .join('\n');
    navigator.clipboard.writeText(transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Handle textarea enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!activeBusiness) {
    return (
      <div className="p-8 text-center text-zinc-400">
        Please select a business to start chat.
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full min-h-0 w-full overflow-hidden bg-zinc-950 relative">
      {/* ========================================================================= */}
      {/* 1. CONVERSATION HISTORY SIDEBAR                                           */}
      {/* ========================================================================= */}
      <div
        className={`fixed md:relative inset-y-0 left-0 z-40 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0 w-72 sm:w-80' : '-translate-x-full md:translate-x-0'
        } ${
          isDesktopSidebarCollapsed ? 'md:hidden' : 'md:w-72 lg:w-80'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-zinc-200">
              Chats
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation Search Bar */}
        {conversations.length > 2 && (
          <div className="px-2.5 pt-2.5 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400">
              <Search className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 focus:outline-hidden text-xs text-zinc-200 placeholder-zinc-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-zinc-400 text-xs">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              const isEditing = editingConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (!isEditing) {
                      setActiveConversationId(conv.id);
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                    isActive
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  }`}
                >
                  {isEditing ? (
                    <div
                      className="flex items-center gap-1 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(conv.id);
                          if (e.key === 'Escape') setEditingConvId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-zinc-950 border border-amber-500/60 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-hidden"
                      />
                      <button
                        onClick={(e) => handleSaveRename(conv.id, e)}
                        className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                        title="Save title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingConvId(null)}
                        className="p-1 text-zinc-400 hover:bg-zinc-800 rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{conv.title}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => handleStartRename(conv, e)}
                          className="p-1 rounded hover:text-amber-300 transition-colors"
                          title="Rename chat"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="p-1 rounded hover:text-rose-400 transition-colors"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: Manage All Chats */}
        {conversations.length > 0 && (
          <div className="p-2.5 border-t border-zinc-800 shrink-0">
            {showClearConfirm ? (
              <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-900/60 space-y-1.5">
                <p className="text-[11px] text-rose-200 font-medium leading-tight">
                  Clear all chat history?
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleClearAllConversations}
                    className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                  >
                    Yes, Clear All
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/60 text-[11px] font-medium transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All Chats</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Backdrop for Mobile Sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN CHAT WORKSPACE                                                    */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 h-full overflow-hidden">
        {/* Top Workspace Header */}
        <div className="h-14 px-4 sm:px-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
              title="Chat History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
              className="hidden md:flex p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
              title={isDesktopSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            >
              {isDesktopSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-100 truncate leading-none">
                  Ursella AI
                </h2>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {activeBusiness.name}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Transcript Button */}
            {messages.length > 0 && (
              <button
                onClick={handleCopyTranscript}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
                title="Copy chat transcript"
              >
                {copiedTranscript ? (
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Clear Current Chat Button */}
            {messages.length > 0 && (
              showClearActiveConfirm ? (
                <div className="flex items-center gap-1 bg-rose-950/40 border border-rose-500/30 rounded-xl px-2 py-1">
                  <span className="text-[11px] text-rose-300">Clear chat?</span>
                  <button
                    onClick={handleClearActiveConversation}
                    className="px-1.5 py-0.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20 rounded"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowClearActiveConfirm(false)}
                    className="px-1.5 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearActiveConfirm(true)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors"
                  title="Clear current chat messages"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}

            <button
              onClick={() => setIsDailyBriefOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-amber-500/40 text-zinc-300 hover:text-amber-300 text-xs font-medium transition-all shadow-xs"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Daily Brief</span>
            </button>

            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Message Container Area - ONLY this section scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 space-y-4">
          {/* Welcome Screen when Chat is empty */}
          {messages.length === 0 && (
            <div className="max-w-4xl lg:max-w-5xl mx-auto py-8 sm:py-14 space-y-8">
              <div className="text-center space-y-3">
                <div className="inline-flex p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  How can I help your business today?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                  Ask questions about sales trends, inventory stockouts, unpaid customer debts, and profit margins.
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="pt-2">
                <SuggestedPromptChips
                  onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                  onOpenDailyBriefModal={() => setIsDailyBriefOpen(true)}
                />
              </div>
            </div>
          )}

          {/* Active Message History */}
          <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-4">
            {messages.map((msg) => (
              <AIMessageCard
                key={msg.id}
                message={msg}
                currencySymbol={currency}
                onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                onDeleteMessage={handleDeleteMessage}
                onRetry={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                  if (lastUser) handleSendMessage(lastUser.content);
                }}
              />
            ))}

            {/* Chatbot Typing Indicator */}
            {loading && (
              <div className="flex items-start gap-3 my-3 sm:my-5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-400/30 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-xs bg-zinc-900 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-zinc-400 text-xs ml-1 font-medium">Ursella is thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================================= */}
        {/* 3. INPUT BAR - Fixed at bottom of chat workspace                          */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md shrink-0">
          <div className="max-w-4xl lg:max-w-5xl mx-auto">
            <div className="relative flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-1.5 sm:p-2 focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all shadow-md">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Ask anything about ${activeBusiness.name}...`}
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none py-2 px-3 max-h-36 min-h-[2.5rem] leading-relaxed disabled:opacity-50"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || loading}
                className="p-2.5 sm:p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-xs"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Brief Modal */}
      <DailyBriefModal
        isOpen={isDailyBriefOpen}
        onClose={() => setIsDailyBriefOpen(false)}
        businessId={activeBusiness.id}
        businessName={activeBusiness.name}
        currency={currency}
        onAskFollowUp={(prompt) => handleSendMessage(prompt)}
      />
    </div>
  );
};

