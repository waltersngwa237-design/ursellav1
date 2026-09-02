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
import { UrsellaSymbolMark } from '../../components/common/UrsellaLogo.tsx';
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
  Menu,
  MoreVertical,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface UrsellaAIPageProps {
  initialPrompt?: string;
  onOpenMobileMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenFeedback?: () => void;
}

export const UrsellaAIPage: React.FC<UrsellaAIPageProps> = ({
  initialPrompt,
  onOpenMobileMenu,
}) => {
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
  const [deleteConfirmConv, setDeleteConfirmConv] = useState<AIConversationSummary | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const [hasNewUnseenMessage, setHasNewUnseenMessage] = useState<boolean>(false);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle container scroll to check if user is near bottom
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 120;
    setIsAtBottom(nearBottom);
    if (nearBottom) {
      setHasNewUnseenMessage(false);
    }
  }, []);

  // Auto-scroll to bottom of chat only if user is near bottom
  const scrollToBottom = useCallback((force = false) => {
    if (force || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasNewUnseenMessage(false);
    } else {
      setHasNewUnseenMessage(true);
    }
  }, [isAtBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Load conversations when active business changes
  const loadConversations = useCallback(async () => {
    if (!activeBusiness?.id) return;
    try {
      const list = await AIService.listConversations(activeBusiness.id);
      setConversations(list);

      if (list.length > 0) {
        setActiveConversationId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
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
      const seen = new Set<string>();
      const deduplicated = msgs.filter((m) => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(deduplicated);
    });
  }, [activeConversationId]);

  // Safe message appender that prevents duplicate IDs
  const appendUniqueMessage = (newMsg: AIChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) {
        return prev;
      }
      return [...prev, newMsg];
    });
  };

  // Handle Initial Prompt
  const processedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0 && activeBusiness?.id) {
      if (processedPromptRef.current === initialPrompt) return;
      processedPromptRef.current = initialPrompt;
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
    appendUniqueMessage(userMsg);
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

      appendUniqueMessage(assistantMsg);
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
      appendUniqueMessage(errorAssistantMsg);
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
      setShowOptionsMenu(false);
    } catch (e) {
      console.warn('Failed to create new conversation:', e);
    }
  };

  // Delete single conversation with clean state update
  const executeDeleteConversation = async (convId: string) => {
    if (!activeBusiness?.id) return;

    // Remove from database and storage
    await AIService.deleteConversation(activeBusiness.id, convId);

    const remaining = conversations.filter((c) => c.id !== convId);
    setConversations(remaining);
    setDeleteConfirmConv(null);
    setShowOptionsMenu(false);

    if (activeConversationId === convId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        // Create a fresh new chat session
        const newConv = await AIService.createConversation(
          activeBusiness.id,
          user?.id || 'demo-user',
          'Business Advisory'
        );
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
        setMessages([]);
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
    setShowOptionsMenu(false);
  };

  // Clear all conversations
  const handleClearAllConversations = async () => {
    if (!activeBusiness?.id) return;
    await AIService.clearAllConversations(activeBusiness.id);
    setShowClearAllConfirm(false);
    setShowOptionsMenu(false);
    
    // Start fresh
    const newConv = await AIService.createConversation(
      activeBusiness.id,
      user?.id || 'demo-user',
      'Business Advisory'
    );
    setConversations([newConv]);
    setActiveConversationId(newConv.id);
    setMessages([]);
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
    setShowOptionsMenu(false);
  };

  // Handle textarea enter key with IME composition protection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
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
          isDesktopSidebarCollapsed ? 'md:hidden' : 'md:w-64 lg:w-72'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Chat History
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
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        {conversations.length > 2 && (
          <div className="px-2.5 pt-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400">
              <Search className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 focus:outline-hidden text-xs text-zinc-200 placeholder-zinc-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No chats found.
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
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 font-medium'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
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
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{conv.title}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => handleStartRename(conv, e)}
                          className="p-1 rounded hover:text-zinc-200 transition-colors"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmConv(conv);
                          }}
                          className="p-1 rounded hover:text-rose-400 transition-colors"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: Clear All Chats */}
        {conversations.length > 0 && (
          <div className="p-2 border-t border-zinc-800 shrink-0">
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/60 text-[11px] font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All Chats</span>
            </button>
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
      {/* 2. MAIN CHAT WORKSPACE (Edge-to-Edge Full Height)                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 h-full overflow-hidden relative">
        {/* Full-Length Top Header (Reaches absolute top of viewport with consistent height) */}
        <header className="h-14 min-h-[3.5rem] max-h-14 px-3 sm:px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/95 backdrop-blur-md shrink-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile App Menu Trigger */}
            {onOpenMobileMenu && (
              <button
                onClick={onOpenMobileMenu}
                className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
                title="Open Navigation"
                aria-label="Open Navigation"
              >
                <Menu className="w-5 h-5 text-zinc-300" />
              </button>
            )}

            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
              title="Chat History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
              className="hidden md:flex p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
              title={isDesktopSidebarCollapsed ? 'Show History' : 'Hide History'}
            >
              {isDesktopSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            {/* Active Chat Title & Store */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-indigo-500/25 flex items-center justify-center shrink-0 shadow-xs">
                <UrsellaSymbolMark sizeClass="w-4 h-4" theme="ai" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate leading-tight">
                  {activeConv?.title || 'Business Advisory'}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate mt-0.5">
                  {activeBusiness.name}
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsDailyBriefOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-emerald-300 text-xs font-medium transition-colors"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Daily Brief</span>
            </button>

            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors shadow-xs shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* Chat Options Dropdown */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Chat Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showOptionsMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-zinc-900/98 backdrop-blur-md border border-zinc-700/80 py-1.5 shadow-2xl z-50 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/50">
                  {messages.length > 0 && (
                    <button
                      onClick={handleCopyTranscript}
                      className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      {copiedTranscript ? (
                        <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                      <span>{copiedTranscript ? 'Copied' : 'Copy Transcript'}</span>
                    </button>
                  )}

                  {messages.length > 0 && (
                    <button
                      onClick={handleClearActiveConversation}
                      className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Clear Messages</span>
                    </button>
                  )}

                  {activeConv && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setDeleteConfirmConv(activeConv);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Delete Chat</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Message Container Area - Smooth vertical scrolling */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 touch-pan-y scroll-smooth"
        >
          {/* Welcome Screen when Chat is empty */}
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto py-6 sm:py-14 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 sm:p-3.5 rounded-2xl bg-zinc-900 border border-indigo-500/25 shadow-lg shadow-indigo-950/40 mb-2">
                  <UrsellaSymbolMark sizeClass="w-8 h-8 sm:w-10 sm:h-10" theme="ai" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  How can I assist your business today?
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Ask questions across sales trends, inventory stockouts, unpaid customer debts, and financial performance.
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
          <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-4">
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
              <div className="flex items-start gap-2.5 sm:gap-3.5 my-3 sm:my-5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-zinc-900 border border-indigo-500/25 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <UrsellaSymbolMark sizeClass="w-4 h-4 sm:w-4.5 sm:h-4.5" theme="ai" isAnimated={true} />
                </div>
                <div className="rounded-2xl rounded-tl-xs bg-zinc-900 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 flex items-center gap-2 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-zinc-400 text-xs ml-1 font-medium">Ursella is analyzing business data...</span>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Jump to Latest Button (when user scrolls up) */}
        {(!isAtBottom || hasNewUnseenMessage) && messages.length > 2 && (
          <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => scrollToBottom(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/95 hover:bg-zinc-800 text-zinc-200 border border-emerald-500/40 text-xs font-semibold shadow-lg shadow-black/40 backdrop-blur-xs transition-all active:scale-95 group"
            >
              <span>{hasNewUnseenMessage ? 'New response received' : 'Scroll to bottom'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. INPUT BAR - Fixed at bottom of chat workspace                          */}
        {/* ========================================================================= */}
        <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950 shrink-0">
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
            <div className="relative flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-1.5 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all shadow-xs">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Ask anything about ${activeBusiness.name}...`}
                rows={1}
                disabled={loading}
                inputMode="text"
                enterKeyHint="send"
                className="flex-1 bg-transparent border-0 text-base sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden resize-none py-2 px-3 max-h-36 min-h-[2.5rem] leading-relaxed disabled:opacity-50"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || loading}
                className="p-2.5 sm:p-2.5 min-w-[40px] min-h-[40px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-xs shadow-emerald-500/20 flex items-center justify-center active:scale-95"
                title="Send query"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Conversation Confirmation Modal */}
      {deleteConfirmConv && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-zinc-100">Delete Conversation?</h3>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  &quot;{deleteConfirmConv.title}&quot;
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will permanently delete this conversation and its messages from your history.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmConv(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteConversation(deleteConfirmConv.id)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Chats Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Clear All Chat History?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              All stored conversation transcripts and advisory sessions for <strong className="text-zinc-100">{activeBusiness.name}</strong> will be permanently wiped.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllConversations}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

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
