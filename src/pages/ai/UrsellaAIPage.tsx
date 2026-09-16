import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { AIService } from '../../services/ai.service.ts';
import { AnalyticsService } from '../../services/analytics.service.ts';
import { generateUUID, isValidUUID } from '../../lib/uuid.ts';
import {
  type AIChatMessage,
  type AIConversationSummary,
} from '../../types/ai.ts';
import { AIMessageCard } from '../../components/ai/AIMessageCard.tsx';
import { SuggestedPromptChips } from '../../components/ai/SuggestedPromptChips.tsx';
import { UrsellaSymbolMark, UrsellaAIGlyph } from '../../components/common/UrsellaLogo.tsx';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
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
  onPromptConsumed?: () => void;
  onOpenMobileMenu?: () => void;
}

// Module-level cache to guarantee prompt strings are never re-run multiple times across component unmounts/remounts
const executedPromptTokens = new Set<string>();

export const UrsellaAIPage: React.FC<UrsellaAIPageProps> = ({
  initialPrompt,
  onPromptConsumed,
  onOpenMobileMenu,
}) => {
  const { user } = useAuth();
  const { activeBusiness, currency } = useBusiness();
  const { isDark } = useTheme();

  // Conversations & Messages State
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(false);
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
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const [hasNewUnseenMessage, setHasNewUnseenMessage] = useState<boolean>(false);
  const isInitialLoadRef = useRef<boolean>(true);
  const prevActiveConvIdRef = useRef<string | null>(null);

  // Screen & Virtual Keyboard tracking for mobile bottom nav / keyboard avoidance
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 768 : true
  );

  useEffect(() => {
    const handleScreenResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleScreenResize);
    return () => window.removeEventListener('resize', handleScreenResize);
  }, []);

  useEffect(() => {
    const handleFocus = () => setIsKeyboardOpen(true);
    const handleBlur = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          setIsKeyboardOpen(false);
        }
      }, 100);
    };

    window.addEventListener('focusin', handleFocus);
    window.addEventListener('focusout', handleBlur);

    const vv = window.visualViewport;
    const handleResize = () => {
      if (vv) {
        const isShrunk = vv.height < (window.screen?.height || window.innerHeight) * 0.75;
        const activeTag = document.activeElement?.tagName;
        setIsKeyboardOpen((activeTag === 'INPUT' || activeTag === 'TEXTAREA') && isShrunk);
      }
    };
    if (vv) {
      vv.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('focusout', handleBlur);
      if (vv) vv.removeEventListener('resize', handleResize);
    };
  }, []);

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

  const isAtBottomRef = useRef(true);

  // Handle container scroll to check if user is near bottom
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 120;
    if (isAtBottomRef.current !== nearBottom) {
      isAtBottomRef.current = nearBottom;
      setIsAtBottom(nearBottom);
    }
    if (nearBottom) {
      setHasNewUnseenMessage(false);
    }
  }, []);

  // Manual scroll to bottom (used by floating button)
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewUnseenMessage(false);
  }, []);

  // Smooth scroll to top of a specific message
  const scrollToMessageTop = useCallback((messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasNewUnseenMessage(false);
    } else if (scrollContainerRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

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

  // When switching conversations
  useEffect(() => {
    if (activeConversationId !== prevActiveConvIdRef.current) {
      prevActiveConvIdRef.current = activeConversationId;
      isInitialLoadRef.current = true;
    }
  }, [activeConversationId]);

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

      // Old chats only should start reading from the bottom (latest messages)
      if (isInitialLoadRef.current) {
        requestAnimationFrame(() => {
          if (deduplicated.length > 0) {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
          } else if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }
        });
        isInitialLoadRef.current = false;
      }
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

  // Handle Initial Prompt (Single-use consumption across entire session)
  const processedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0 && activeBusiness?.id) {
      const promptToRun = initialPrompt.trim();
      // Ensure parent state is immediately cleared so it never sits in parent memory
      onPromptConsumed?.();

      if (processedPromptRef.current === promptToRun || executedPromptTokens.has(promptToRun)) {
        return;
      }
      processedPromptRef.current = promptToRun;
      executedPromptTokens.add(promptToRun);
      handleSendMessage(promptToRun);
    }
  }, [initialPrompt, activeBusiness?.id, onPromptConsumed]);

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

    // Scroll to show user message and the loading typing indicator
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);

    try {
      // Build conversation history window (last 6 turns)
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

      // Gather rich real-time operating system intelligence context from analytics service
      let osContext: Record<string, unknown> | undefined = undefined;
      try {
        const fullContext = await AnalyticsService.getAIBusinessContext(activeBusiness.id, 30);
        osContext = fullContext as unknown as Record<string, unknown>;
      } catch (osErr) {
        console.warn('[UrsellaAIPage] Failed to fetch enriched OS context, continuing with standard context:', osErr);
      }

      const res = await AIService.sendChatMessage({
        businessId: activeBusiness.id,
        conversationId: convId,
        message: textToSend.trim(),
        history: historyPayload,
        osContext,
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

      const assistantMsgId = (res.messageId && isValidUUID(res.messageId)) ? res.messageId : generateUUID();
      const assistantMsg: AIChatMessage = {
        id: assistantMsgId,
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

      // Dynamically assign unique intent-based title to conversation
      const currentConv = conversations.find((c) => c.id === convId);
      const isPlaceholder = !currentConv ||
        currentConv.title === 'New Conversation' ||
        currentConv.title === 'New Chat' ||
        currentConv.title === 'Business Advisory' ||
        currentConv.title === 'Business Consultation' ||
        !currentConv.title.trim();

      if (isPlaceholder || messages.length <= 1) {
        const uniqueIntentTitle = AIService.generateTitleFromMessage(textToSend, res.intent);
        AIService.renameConversation(activeBusiness.id, convId, uniqueIntentTitle);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: uniqueIntentTitle } : c))
        );
      }

      // AI advisor messages should start reading from the top after AI responds
      setTimeout(() => {
        scrollToMessageTop(assistantMsgId);
      }, 75);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to obtain AI response.';
      setError(errMsg);

      const errorMsgId = generateUUID();
      const errorAssistantMsg: AIChatMessage = {
        id: errorMsgId,
        conversation_id: convId,
        business_id: activeBusiness.id,
        role: 'assistant',
        content: 'I encountered an issue retrieving your store records. Please try again.',
        metadata: {
          error: errMsg,
        },
        created_at: new Date().toISOString(),
      };
      appendUniqueMessage(errorAssistantMsg);

      setTimeout(() => {
        scrollToMessageTop(errorMsgId);
      }, 75);
    } finally {
      setLoading(false);
    }
  };

  // Create new conversation - resets active conversation so first prompt names it with user's intent
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setIsSidebarOpen(false);
    setShowOptionsMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Listen for global AI actions dispatched from mobile top nav bar
  useEffect(() => {
    const handleNewChatEvent = () => {
      handleNewConversation();
    };
    const handleToggleHistoryEvent = () => {
      setIsSidebarOpen((prev) => !prev);
    };
    const handleToggleOptionsEvent = () => {
      setShowOptionsMenu((prev) => !prev);
    };

    window.addEventListener('ursella_ai_new_chat', handleNewChatEvent);
    window.addEventListener('ursella_ai_toggle_history', handleToggleHistoryEvent);
    window.addEventListener('ursella_ai_toggle_options', handleToggleOptionsEvent);

    return () => {
      window.removeEventListener('ursella_ai_new_chat', handleNewChatEvent);
      window.removeEventListener('ursella_ai_toggle_history', handleToggleHistoryEvent);
      window.removeEventListener('ursella_ai_toggle_options', handleToggleOptionsEvent);
    };
  }, []);

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
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(transcript).catch(() => {});
    }
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
    <div className={`flex flex-1 min-h-0 w-full overflow-hidden relative ${
      isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* ========================================================================= */}
      {/* 1. CONVERSATION HISTORY SIDEBAR                                           */}
      {/* ========================================================================= */}
      <div
        className={`fixed md:relative inset-y-0 left-0 z-40 border-r flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
        } ${
          isSidebarOpen ? 'translate-x-0 w-72 sm:w-80' : '-translate-x-full md:translate-x-0'
        } ${
          isDesktopSidebarCollapsed ? 'md:hidden' : 'md:w-64 lg:w-72'
        }`}
      >
        {/* Sidebar Header */}
        <div 
          className={`p-3 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800' : 'border-slate-200'
          }`}
          style={{
            paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
          }}
        >
          <div className="flex items-center gap-2">
            <History className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <span className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              Chat History
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className={`md:hidden p-1.5 rounded-lg ${
                isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        {conversations.length > 2 && (
          <div className="px-2.5 pt-2 shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
              isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <Search className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-transparent border-0 focus:outline-hidden text-xs ${
                  isDark ? 'text-zinc-200 placeholder-zinc-500' : 'text-slate-800 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'}
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
            <div className={`py-8 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
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
                      ? isDark
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80'
                      : isDark
                      ? 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                        className={`flex-1 border rounded px-1.5 py-0.5 text-xs focus:outline-hidden ${
                          isDark 
                            ? 'bg-zinc-950 border-amber-500/60 text-zinc-100' 
                            : 'bg-white border-amber-500 text-slate-900'
                        }`}
                      />
                      <button
                        onClick={(e) => handleSaveRename(conv.id, e)}
                        className={`p-1 rounded ${
                          isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title="Save title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingConvId(null)}
                        className={`p-1 rounded ${
                          isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-400 hover:bg-slate-200'
                        }`}
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
                          className={`p-1 rounded transition-colors ${
                            isDark ? 'hover:text-zinc-200' : 'hover:text-slate-900'
                          }`}
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmConv(conv);
                          }}
                          className="p-1 rounded hover:text-rose-500 transition-colors"
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
          <div className={`p-2 border-t shrink-0 ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                isDark 
                  ? 'text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/60' 
                  : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
              }`}
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
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative ${
        isDark ? 'bg-zinc-950' : 'bg-slate-50'
      }`}>
        {/* Top Header - Desktop Workspace Navigation (On mobile, AppShell provides the fixed top nav bar) */}
        <header 
          className={`hidden md:flex shrink-0 w-full select-none px-6 py-3 border-b items-center justify-between z-20 transition-colors ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile App Menu Trigger */}
            {onOpenMobileMenu && (
              <button
                onClick={onOpenMobileMenu}
                className={`md:hidden p-2 rounded-lg transition-colors shrink-0 ${
                  isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Open Navigation"
                aria-label="Open Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`md:hidden p-2 rounded-lg transition-colors shrink-0 ${
                isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Chat History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
              className={`hidden md:flex p-2 rounded-lg transition-colors shrink-0 ${
                isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={isDesktopSidebarCollapsed ? 'Show History' : 'Hide History'}
            >
              {isDesktopSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            {/* Active Chat Title: Ursella AI */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-xs ${
                isDark ? 'bg-zinc-900 border-sky-500/30 shadow-sky-950/30' : 'bg-sky-50 border-sky-200'
              }`}>
                <UrsellaAIGlyph sizeClass="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className={`text-xs sm:text-sm font-bold truncate leading-tight tracking-tight ${
                    isDark ? 'text-zinc-100' : 'text-slate-900'
                  }`}>
                    Ursella AI
                  </h1>
                </div>
                <p className={`text-[10px] sm:text-[11px] truncate mt-0.5 ${
                  isDark ? 'text-zinc-500' : 'text-slate-500'
                }`}>
                  {activeBusiness.name}
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-xs shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* Chat Options Dropdown */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Chat Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showOptionsMenu && (
                <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl backdrop-blur-md border py-1.5 shadow-2xl z-50 animate-in fade-in-50 zoom-in-95 ${
                  isDark ? 'bg-zinc-900/98 border-zinc-700/80 ring-1 ring-black/50' : 'bg-white border-slate-200 shadow-xl'
                }`}>
                  {messages.length > 0 && (
                    <button
                      onClick={handleCopyTranscript}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors ${
                        isDark ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {copiedTranscript ? (
                        <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                      )}
                      <span>{copiedTranscript ? 'Copied' : 'Copy Transcript'}</span>
                    </button>
                  )}

                  {messages.length > 0 && (
                    <button
                      onClick={handleClearActiveConversation}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors ${
                        isDark ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Trash2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                      <span>Clear Messages</span>
                    </button>
                  )}

                  {activeConv && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setDeleteConfirmConv(activeConv);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Delete Chat</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Options Dropdown Anchored Below Top Bar */}
        {showOptionsMenu && isMobileScreen && (
          <div 
            ref={optionsMenuRef}
            className={`md:hidden fixed right-3 z-50 w-52 rounded-xl border py-1.5 shadow-2xl animate-in fade-in-50 zoom-in-95 ${
              isDark ? 'bg-zinc-900 border-zinc-700/80 ring-1 ring-black/50' : 'bg-white border-slate-200 shadow-xl'
            }`}
            style={{
              top: 'calc(max(0.625rem, calc(0.375rem + env(safe-area-inset-top, 0px))) + 3.25rem)',
            }}
          >
            {messages.length > 0 && (
              <button
                onClick={handleCopyTranscript}
                className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center gap-2.5 transition-colors ${
                  isDark ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {copiedTranscript ? (
                  <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Copy className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                )}
                <span>{copiedTranscript ? 'Copied to Clipboard' : 'Copy Transcript'}</span>
              </button>
            )}

            {messages.length > 0 && (
              <button
                onClick={handleClearActiveConversation}
                className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center gap-2.5 transition-colors ${
                  isDark ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Trash2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                <span>Clear Messages</span>
              </button>
            )}

            {activeConv && (
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  setDeleteConfirmConv(activeConv);
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Delete Chat</span>
              </button>
            )}
          </div>
        )}

        {/* Message Container Area - Smooth vertical scrolling */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
          }}
        >
          {/* Welcome Screen when Chat is empty */}
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto py-6 sm:py-14 space-y-6">
              <div className="text-center space-y-2">
                <div className={`inline-flex p-3 sm:p-3.5 rounded-2xl border shadow-lg mb-2 ${
                  isDark 
                    ? 'bg-zinc-900 border-sky-500/30 shadow-sky-950/40' 
                    : 'bg-white border-sky-200 shadow-sky-100/50'
                }`}>
                  <UrsellaAIGlyph sizeClass="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  How can I assist your business today?
                </h2>
                <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}>
                  Ask questions across sales trends, inventory stockouts, unpaid customer debts, and financial performance.
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="pt-2">
                <SuggestedPromptChips
                  onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                  onInsertPrompt={(prompt) => {
                    setInputText(prompt);
                    textareaRef.current?.focus();
                  }}
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
                onInsertPrompt={(prompt) => {
                  setInputText(prompt);
                  textareaRef.current?.focus();
                }}
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
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-xs mt-0.5 ${
                  isDark ? 'bg-zinc-900 border-sky-500/30 shadow-sky-950/30' : 'bg-white border-sky-200'
                }`}>
                  <UrsellaAIGlyph sizeClass="w-4 h-4 sm:w-4.5 sm:h-4.5" isAnimated={true} />
                </div>
                <div className={`rounded-2xl rounded-tl-xs px-4 py-3 text-xs flex items-center gap-2 shadow-xs border ${
                  isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className={`text-xs ml-1 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    Ursella is thinking...
                  </span>
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
              onClick={() => scrollToBottom()}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-xs transition-all active:scale-95 group border ${
                isDark 
                  ? 'bg-zinc-900/95 hover:bg-zinc-800 text-zinc-200 border-emerald-500/40 shadow-black/40' 
                  : 'bg-white/95 hover:bg-slate-50 text-slate-800 border-emerald-500/50 shadow-slate-300/60'
              }`}
            >
              <span>{hasNewUnseenMessage ? 'New response received' : 'Scroll to bottom'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. INPUT BAR - Fixed at bottom of chat workspace                          */}
        {/* ========================================================================= */}
        <div 
          className={`p-3 sm:p-4 border-t shrink-0 z-20 transition-all ${
            isDark ? 'border-zinc-800/80 bg-zinc-950' : 'border-slate-200 bg-white shadow-xs'
          }`}
          style={{
            paddingBottom: isMobileScreen && !isKeyboardOpen
              ? 'calc(4rem + max(0.5rem, env(safe-area-inset-bottom, 0px)))'
              : 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
            <div className={`relative flex items-center gap-2 border rounded-xl p-1.5 transition-all shadow-xs ${
              isDark 
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30' 
                : 'bg-slate-100 border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-500/30'
            }`}>
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
                className={`flex-1 bg-transparent border-0 text-base sm:text-sm focus:outline-hidden resize-none py-2 px-3 max-h-36 min-h-[2.5rem] leading-relaxed disabled:opacity-50 ${
                  isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-slate-900 placeholder-slate-400'
                }`}
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || loading}
                className="p-2.5 sm:p-2.5 min-w-[40px] min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-xs shadow-emerald-500/20 flex items-center justify-center active:scale-95"
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
          <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>Delete Conversation?</h3>
                <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  &quot;{deleteConfirmConv.title}&quot;
                </p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              This will permanently delete this conversation and its messages from your history.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmConv(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
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
          <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 shadow-2xl ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>Clear All Chat History?</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              All stored conversation transcripts and advisory sessions for <strong className={isDark ? 'text-zinc-100' : 'text-slate-900'}>{activeBusiness.name}</strong> will be permanently wiped.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
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
    </div>
  );
};
