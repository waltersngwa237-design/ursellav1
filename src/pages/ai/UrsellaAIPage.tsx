import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { AIService } from '../../services/ai.service.ts';
import { generateUUID } from '../../lib/uuid.ts';
import {
  type AIChatMessage,
  type AIConversationSummary,
} from '../../types/ai.ts';
import { AIMessageCard } from '../../components/ai/AIMessageCard.tsx';
import { SuggestedPromptChips } from '../../components/ai/SuggestedPromptChips.tsx';
import { UrsaMemoryModal } from '../../components/ai/UrsaMemoryModal.tsx';
import { UrsaMemoryService } from '../../services/ursa-memory.service.ts';
import { UrsellaAIGlyph } from '../../components/common/UrsellaLogo.tsx';
import { type AppNavRoute } from '../../types/index.ts';
import {
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
  ArrowLeft,
  Mic,
  MicOff,
  Loader2,
  Volume2,
  Brain,
} from 'lucide-react';

interface UrsellaAIPageProps {
  initialPrompt?: string;
  onPromptConsumed?: () => void;
  onOpenMobileMenu?: () => void;
  onNavigate?: (route: AppNavRoute) => void;
}

// Module-level cache to guarantee prompt strings are never re-run multiple times across component unmounts/remounts
const executedPromptTokens = new Set<string>();

export const UrsellaAIPage: React.FC<UrsellaAIPageProps> = ({
  initialPrompt,
  onPromptConsumed,
  onOpenMobileMenu,
  onNavigate,
}) => {
  const { user } = useAuth();
  const { activeBusiness, activeSettings, currency } = useBusiness();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
  const isFr = language === 'fr';

  // Conversations & Messages State (Initialized synchronously from cache to eliminate any flash)
  const [conversations, setConversations] = useState<AIConversationSummary[]>(() => {
    if (activeBusiness?.id) {
      return AIService.getCachedConversations(activeBusiness.id);
    }
    return [];
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (!activeBusiness?.id) return null;
    const lastActive = AIService.getCachedLastActiveConversationId(activeBusiness.id);
    if (lastActive) return lastActive;
    const cachedConvs = AIService.getCachedConversations(activeBusiness.id);
    return cachedConvs.length > 0 ? cachedConvs[0].id : null;
  });

  const [messages, setMessages] = useState<AIChatMessage[]>(() => {
    if (!activeBusiness?.id) return [];
    const targetId = AIService.getCachedLastActiveConversationId(activeBusiness.id) ||
      (AIService.getCachedConversations(activeBusiness.id)[0]?.id);
    if (targetId) {
      return AIService.getCachedMessages(targetId);
    }
    return [];
  });

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
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [memoryCount, setMemoryCount] = useState<number>(() => {
    return activeBusiness?.id ? UrsaMemoryService.getMemories(activeBusiness.id).length : 0;
  });

  // Voice Input States & Recording Handlers
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

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

  // Touch gesture support: swipe right from screen edge to return to previous page
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isSidebarOpen) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartRef.current.x;
    const diffY = Math.abs(endY - touchStartRef.current.y);

    // If gesture starts near the left edge (< 40px) and swipes right (> 75px) horizontally
    if (touchStartRef.current.x < 40 && diffX > 75 && diffY < 80) {
      if (onNavigate) {
        onNavigate('home');
      }
    }
    touchStartRef.current = null;
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // Close options menu when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If mobile screen, the mobile modal backdrop handles closing
      if (window.innerWidth < 768) return;
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
        const lastActiveCached = AIService.getCachedLastActiveConversationId(activeBusiness.id);
        setActiveConversationId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          if (lastActiveCached && list.some((c) => c.id === lastActiveCached)) return lastActiveCached;
          return list[0].id;
        });
      } else {
        // Create initial default conversation
        const newConv = await AIService.createConversation(
          activeBusiness.id,
          user?.id || 'demo-user',
          isFr ? 'Conseils & Stratégie' : 'Business Advisory'
        );
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
  }, [activeBusiness?.id, user?.id, isFr]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // When switching conversations, persist active conversation ID and load messages
  useEffect(() => {
    if (activeBusiness?.id) {
      AIService.setCachedLastActiveConversationId(activeBusiness.id, activeConversationId);
    }
    if (activeConversationId !== prevActiveConvIdRef.current) {
      prevActiveConvIdRef.current = activeConversationId;
      isInitialLoadRef.current = true;
    }
  }, [activeConversationId, activeBusiness?.id]);

  // Load messages whenever activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    // Populate from synchronous cache immediately if not already present
    const cached = AIService.getCachedMessages(activeConversationId);
    if (cached.length > 0) {
      setMessages((prev) => (prev.length === 0 ? cached : prev));
      if (isInitialLoadRef.current) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        });
      }
    }

    // Reconcile with async/remote store in the background without UI flicker
    AIService.getMessages(activeConversationId).then((msgs) => {
      const seen = new Set<string>();
      const deduplicated = msgs.filter((m) => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(deduplicated);

      // Scroll to bottom on initial load
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

  // Execute sending a message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || !activeBusiness?.id || loading) return;

    // Clear input immediately for responsive feel
    if (!customPrompt) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    let convId = activeConversationId;

    // Create a new conversation if none is active or if current is empty
    if (!convId) {
      try {
        const titleSnippet = textToSend.length > 32 ? `${textToSend.substring(0, 32)}...` : textToSend;
        const newConv = await AIService.createConversation(
          activeBusiness.id,
          user?.id || 'demo-user',
          titleSnippet
        );
        convId = newConv.id;
        setActiveConversationId(newConv.id);
        setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
      } catch (err) {
        console.error('Failed to create new conversation:', err);
        return;
      }
    }

    // Append User Message to UI and persist to history
    const userMsgId = generateUUID();
    const userMessage: AIChatMessage = {
      id: userMsgId,
      conversation_id: convId,
      business_id: activeBusiness.id,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    appendUniqueMessage(userMessage);
    AIService.saveMessage(userMessage).catch((e) => console.warn('Failed to persist user message:', e));

    // Update conversation title if current title is default/generic
    const activeConvItem = conversations.find((c) => c.id === convId);
    if (
      activeConvItem &&
      (activeConvItem.title === 'Business Advisory' ||
        activeConvItem.title === 'Conseils & Stratégie' ||
        activeConvItem.title === 'New Business Advisory')
    ) {
      const newTitle = textToSend.length > 32 ? `${textToSend.substring(0, 32)}...` : textToSend;
      AIService.renameConversation(activeBusiness.id, convId, newTitle).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
      );
    }

    // Scroll to user message instantly
    setTimeout(() => {
      scrollToMessageTop(userMsgId);
    }, 50);

    setLoading(true);
    setError(null);

    try {
      // Stream or generate AI response with active business metadata & currency
      const activeCurrency = activeBusiness.currency || currency || 'XAF';
      const priorHistory: Array<{ role: 'user' | 'assistant'; content: string }> = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const aiResponse = await AIService.generateResponse(
        activeBusiness.id,
        convId,
        textToSend,
        language,
        {
          businessName: activeBusiness.name,
          businessType: activeBusiness.business_type || undefined,
          currency: activeCurrency,
          currencySymbol: activeCurrency,
          timezone: activeBusiness.timezone || activeSettings?.timezone || 'Africa/Douala',
          ownerName: user?.user_metadata?.full_name || user?.email || undefined,
          address: undefined,
          taxRate: activeSettings?.tax_rate,
          country: activeBusiness.country || undefined,
        },
        priorHistory
      );

      const assistantMsgId = generateUUID();
      const assistantMessage: AIChatMessage = {
        id: assistantMsgId,
        conversation_id: convId,
        business_id: activeBusiness.id,
        role: 'assistant',
        content: aiResponse.content,
        metadata: aiResponse.metadata,
        created_at: new Date().toISOString(),
      };
      appendUniqueMessage(assistantMessage);
      AIService.saveMessage(assistantMessage).catch((e) => console.warn('Failed to persist assistant message:', e));

      // Keep conversation list timestamps up to date
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                updated_at: new Date().toISOString(),
                last_message_preview: aiResponse.content.substring(0, 60),
              }
            : c
        )
      );

      // Scroll so assistant response is in view
      setTimeout(() => {
        scrollToMessageTop(assistantMsgId);
      }, 75);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : isFr ? 'Erreur lors de la génération de réponse' : 'Failed to generate response.';
      setError(errMsg);

      const errorMsgId = generateUUID();
      const errorAssistantMsg: AIChatMessage = {
        id: errorMsgId,
        conversation_id: convId,
        business_id: activeBusiness.id,
        role: 'assistant',
        content: isFr ? 'Un problème est survenu lors de l’analyse de vos données. Veuillez réessayer.' : 'I encountered an issue retrieving your store records. Please try again.',
        metadata: {
          error: errMsg,
        },
        created_at: new Date().toISOString(),
      };
      appendUniqueMessage(errorAssistantMsg);
      AIService.saveMessage(errorAssistantMsg).catch(() => {});

      setTimeout(() => {
        scrollToMessageTop(errorMsgId);
      }, 75);
    } finally {
      setLoading(false);
    }
  };

  // Consume incoming external prompts
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && activeBusiness?.id) {
      const token = `${activeBusiness.id}::${initialPrompt.trim()}`;
      if (!executedPromptTokens.has(token)) {
        executedPromptTokens.add(token);
        handleSendMessage(initialPrompt.trim());
        if (onPromptConsumed) onPromptConsumed();
      }
    }
  }, [initialPrompt, activeBusiness?.id]);

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    if (activeBusiness?.id) {
      AIService.setCachedLastActiveConversationId(activeBusiness.id, null);
    }
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setIsSidebarOpen(false);
    setShowOptionsMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeBusiness?.id]);

  // Listen to AppShell top navbar events (mobile header buttons)
  useEffect(() => {
    const handleToggleOptions = () => {
      setShowOptionsMenu((prev) => !prev);
    };
    const handleToggleHistory = () => {
      setIsSidebarOpen((prev) => !prev);
    };
    const handleNewChatEvent = () => {
      handleNewConversation();
    };

    window.addEventListener('ursella_ai_toggle_options', handleToggleOptions);
    window.addEventListener('ursella_ai_toggle_history', handleToggleHistory);
    window.addEventListener('ursella_ai_new_chat', handleNewChatEvent);

    return () => {
      window.removeEventListener('ursella_ai_toggle_options', handleToggleOptions);
      window.removeEventListener('ursella_ai_toggle_history', handleToggleHistory);
      window.removeEventListener('ursella_ai_new_chat', handleNewChatEvent);
    };
  }, [handleNewConversation]);

  // Delete single conversation with clean state update
  const executeDeleteConversation = async (convId: string) => {
    if (!activeBusiness?.id) return;

    // Immediately flush local messages to provide instant feedback
    setMessages([]);

    const actualIdToDelete = (convId && convId !== 'current') ? convId : (activeConversationId || '');

    if (actualIdToDelete) {
      await AIService.deleteConversation(activeBusiness.id, actualIdToDelete);
    }

    const remaining = conversations.filter((c) => c.id !== actualIdToDelete && c.id !== convId);
    setConversations(remaining);
    setDeleteConfirmConv(null);
    setShowOptionsMenu(false);

    if (activeConversationId === actualIdToDelete || !activeConversationId || convId === 'current') {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        const newConv = await AIService.createConversation(
          activeBusiness.id,
          user?.id || 'demo-user',
          isFr ? 'Conseils & Stratégie' : 'Business Advisory'
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
    
    const newConv = await AIService.createConversation(
      activeBusiness.id,
      user?.id || 'demo-user',
      isFr ? 'Conseils & Stratégie' : 'Business Advisory'
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
          `[${m.role === 'user' ? (isFr ? 'Commerçant' : 'Merchant') : 'Ursa'}] (${new Date(
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

  // =========================================================================
  // VOICE RECORDING & MULTILINGUAL / PIDGIN TRANSCRIPTION ENGINE
  // =========================================================================
  const startVoiceRecording = async () => {
    setVoiceError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceError(isFr ? 'Enregistrement vocal non supporté par ce navigateur.' : 'Voice recording not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      // Determine supported mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration ticker
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting voice recording:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setVoiceError(
        isDenied
          ? (isFr ? 'Accès au micro refusé. Veuillez autoriser le microphone.' : 'Microphone permission denied. Please allow microphone access.')
          : (isFr ? 'Impossible de démarrer l’enregistrement vocal.' : 'Failed to access microphone.')
      );
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = async (sendImmediately: boolean = true) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const mr = mediaRecorderRef.current;

    // Return promise on stop
    const blobPromise = new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        const mime = mr.mimeType || 'audio/webm';
        const fullBlob = new Blob(audioChunksRef.current, { type: mime });
        resolve(fullBlob);
      };
    });

    mr.stop();

    // Stop all audio stream tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    setIsRecording(false);

    try {
      const audioBlob = await blobPromise;
      if (!audioBlob || audioBlob.size === 0) return;

      setIsTranscribing(true);
      setVoiceError(null);

      const result = await AIService.transcribeAudio(
        audioBlob,
        activeBusiness?.id || 'demo-store',
        language as 'en' | 'fr'
      );

      const transcribed = result.transcript?.trim() || '';
      if (transcribed) {
        if (sendImmediately) {
          handleSendMessage(transcribed);
        } else {
          setInputText(transcribed);
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
          }
        }
      } else {
        setVoiceError(isFr ? 'Aucune voix détectée. Veuillez réessayer.' : 'No speech detected. Please speak clearly into your mic.');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setVoiceError(isFr ? 'Erreur lors de la transcription vocale. Veuillez réessayer.' : 'Failed to transcribe speech. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
    setVoiceError(null);
  };

  // Cleanup timers & streams on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!activeBusiness) {
    return (
      <div className="p-8 text-center text-zinc-400">
        {isFr ? 'Veuillez sélectionner un commerce pour démarrer le chat.' : 'Please select a business to start chat.'}
      </div>
    );
  }

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`flex flex-1 min-h-0 w-full overflow-hidden relative ${
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
              {isFr ? 'Historique' : 'Chat History'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={isFr ? 'Nouvelle discussion' : 'New Chat'}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className={`md:hidden p-1.5 rounded-lg cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-800'
              }`}
              title={isFr ? 'Fermer l’historique' : 'Close sidebar'}
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
                placeholder={isFr ? 'Rechercher un échange...' : 'Search history...'}
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
              {isFr ? 'Aucun échange trouvé.' : 'No chats found.'}
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
                        className={`p-1 rounded cursor-pointer ${
                          isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={isFr ? 'Enregistrer le titre' : 'Save title'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingConvId(null)}
                        className={`p-1 rounded cursor-pointer ${
                          isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-400 hover:bg-slate-200'
                        }`}
                        title={t.common.cancel}
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
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isDark ? 'hover:text-zinc-200' : 'hover:text-slate-900'
                          }`}
                          title={isFr ? 'Renommer' : 'Rename'}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmConv(conv);
                          }}
                          className="p-1 rounded hover:text-rose-500 transition-colors cursor-pointer"
                          title={isFr ? 'Supprimer' : 'Delete chat'}
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
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                isDark 
                  ? 'text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/60' 
                  : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>{isFr ? 'Effacer tout l’historique' : 'Clear All'}</span>
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
        {/* Top Header - Desktop Workspace Navigation */}
        <header 
          className={`hidden md:flex shrink-0 w-full select-none px-6 py-3 border-b items-center justify-between z-20 transition-colors ${
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
              className={`hidden md:flex p-2 rounded-lg transition-colors shrink-0 cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={isDesktopSidebarCollapsed ? (isFr ? 'Afficher l’historique' : 'Show History') : (isFr ? 'Masquer l’historique' : 'Hide History')}
            >
              {isDesktopSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            {/* Active Chat Title: Ursa */}
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
                    Ursa AI
                  </h1>
                </div>
                <p className={`text-[10px] sm:text-[11px] truncate mt-0.5 ${
                  isDark ? 'text-zinc-500' : 'text-slate-500'
                }`}>
                  {isFr ? 'Conseillère d’Entreprise Personnelle' : 'Personal Business Advisor'}
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsMemoryModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
              title={isFr ? "Mémoire d'Ursa" : "Ursa's Memory Bank"}
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{isFr ? 'Mémoire' : 'Memory'}</span>
              {memoryCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300">
                  {memoryCount}
                </span>
              )}
            </button>

            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-xs shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFr ? 'Nouveau' : 'New Chat'}</span>
            </button>

            {/* Chat Options Dropdown */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={isFr ? 'Options de discussion' : 'Chat Options'}
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
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {copiedTranscript ? (
                        <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                      )}
                      <span>{copiedTranscript ? (isFr ? 'Copié !' : 'Copied') : (isFr ? 'Copier la transcription' : 'Copy Transcript')}</span>
                    </button>
                  )}

                  {messages.length > 0 && (
                    <button
                      onClick={handleClearActiveConversation}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Trash2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                      <span>{isFr ? 'Effacer les messages' : 'Clear Messages'}</span>
                    </button>
                  )}

                  {(activeConv || activeConversationId || messages.length > 0) && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        const targetConv = activeConv || {
                          id: activeConversationId || 'current',
                          business_id: activeBusiness.id,
                          user_id: user?.id || 'user',
                          title: isFr ? 'Discussion active' : 'Current Chat',
                          context_type: 'general',
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        };
                        setDeleteConfirmConv(targetConv);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{isFr ? 'Supprimer la discussion' : 'Delete Chat'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Message Container Area */}
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
            <div className="max-w-2xl mx-auto py-4 sm:py-10 space-y-5">
              <div className="text-center space-y-1.5 px-2">
                <div className={`inline-flex p-2.5 sm:p-3 rounded-2xl border shadow-md mb-1 ${
                  isDark 
                    ? 'bg-zinc-900 border-sky-500/30 shadow-sky-950/40' 
                    : 'bg-white border-sky-200 shadow-sky-100/50'
                }`}>
                  <UrsellaAIGlyph sizeClass="w-7 h-7 sm:w-9 sm:h-9" />
                </div>
                <h2 className={`text-lg sm:text-2xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {isFr ? 'Bonjour ! Que souhaitez-vous analyser ?' : 'Good day! How can I assist your business?'}
                </h2>
                <p className={`text-xs sm:text-sm max-w-sm mx-auto leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}>
                  {isFr ? 'Interrogez vos ventes, niveaux de stock, bénéfices et prévisions en temps réel.' : 'Ask real-time questions about your sales, stock valuation, margins, or business decisions.'}
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="pt-1">
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
                onActionExecuted={(_res, updatedAction) => {
                  if (updatedAction) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === msg.id
                          ? ({
                              ...m,
                              metadata: {
                                ...m.metadata,
                                proposedAction: updatedAction,
                                ...(m.metadata?.structured
                                  ? {
                                      structured: {
                                        ...m.metadata.structured,
                                        proposedAction: updatedAction,
                                      },
                                    }
                                  : {}),
                              } as any,
                            } as AIChatMessage)
                          : m
                      )
                    );
                  }
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
                    {isFr ? 'Analyse en cours...' : 'Thinking & analyzing...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Jump to Latest Button */}
        {(!isAtBottom || hasNewUnseenMessage) && messages.length > 2 && (
          <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => scrollToBottom()}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-xs transition-all active:scale-95 group border cursor-pointer ${
                isDark 
                  ? 'bg-zinc-900/95 hover:bg-zinc-800 text-zinc-200 border-emerald-500/40 shadow-black/40' 
                  : 'bg-white/95 hover:bg-slate-50 text-slate-800 border-emerald-500/50 shadow-slate-300/60'
              }`}
            >
              <span>{hasNewUnseenMessage ? (isFr ? 'Nouvelle réponse reçue' : 'New response received') : (isFr ? 'Défiler vers le bas' : 'Scroll to bottom')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* Mobile Options Popover / Action Menu (triggered by top navbar 3 dots) */}
        {showOptionsMenu && (
          <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-start items-end p-3 pt-14">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowOptionsMenu(false)}
            />
            
            <div 
              className={`relative w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-2xl p-1.5 z-10 animate-in fade-in zoom-in-95 duration-150 ${
                isDark 
                  ? 'bg-zinc-900 border-zinc-700/80 text-zinc-100 ring-1 ring-black/60' 
                  : 'bg-white border-slate-200 text-slate-900 shadow-xl'
              }`}
            >
              <div className={`px-3 py-2 border-b text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                isDark ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-slate-500'
              }`}>
                <span>{isFr ? 'Options Ursella AI' : 'Ursella AI Options'}</span>
                <button 
                  onClick={() => setShowOptionsMenu(false)}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  onClick={handleNewConversation}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-200 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{isFr ? 'Nouvelle discussion' : 'New Chat'}</span>
                </button>

                {messages.length > 0 && (
                  <button
                    onClick={handleCopyTranscript}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {copiedTranscript ? (
                      <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Copy className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                    )}
                    <span>{copiedTranscript ? (isFr ? 'Copié !' : 'Copied!') : (isFr ? 'Copier la transcription' : 'Copy Transcript')}</span>
                  </button>
                )}

                {messages.length > 0 && (
                  <button
                    onClick={handleClearActiveConversation}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Trash2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                    <span>{isFr ? 'Effacer les messages' : 'Clear Messages'}</span>
                  </button>
                )}

                {(activeConv || activeConversationId || messages.length > 0) && (
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      const targetConv = activeConv || {
                        id: activeConversationId || 'current',
                        business_id: activeBusiness.id,
                        user_id: user?.id || 'user',
                        title: isFr ? 'Discussion active' : 'Current Chat',
                        context_type: 'general',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                      setDeleteConfirmConv(targetConv);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{isFr ? 'Supprimer la discussion' : 'Delete Chat'}</span>
                  </button>
                )}

                {conversations.length > 0 && (
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowClearAllConfirm(true);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isDark ? 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800' : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>{isFr ? 'Effacer tout l’historique' : 'Clear All History'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. INPUT BAR - Fixed at bottom of chat workspace                          */}
        {/* ========================================================================= */}
        <div 
          className={`p-2.5 sm:p-4 border-t shrink-0 z-20 transition-all ${
            isDark ? 'border-zinc-800/80 bg-zinc-950' : 'border-slate-200 bg-white shadow-xs'
          }`}
          style={{
            paddingBottom: 'max(0.75rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))',
          }}
        >
          <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-2">
            {/* Voice Recording Error Alert */}
            {voiceError && (
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs bg-rose-500/10 border border-rose-500/25 text-rose-400 animate-in fade-in duration-150">
                <span className="truncate">{voiceError}</span>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="p-1 hover:bg-rose-500/20 rounded-md text-rose-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Live Voice Recording Bar (shown when microphone is active) */}
            {isRecording ? (
              <div className={`flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all animate-in fade-in zoom-in-95 ${
                isDark ? 'bg-zinc-900 border-rose-500/40 shadow-lg shadow-rose-950/20' : 'bg-rose-50 border-rose-200 shadow-md shadow-rose-100'
              }`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-rose-400 opacity-75" />
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-600 relative" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold tracking-tight ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                        {isFr ? 'Enregistrement vocal...' : 'Listening to voice (Pidgin / English / French)...'}
                      </span>
                      <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md font-semibold ${
                        isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-slate-700 border border-rose-200'
                      }`}>
                        {formatSeconds(recordingDuration)}
                      </span>
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      {isFr ? 'Parlez naturellement (ventes, stocks, dettes...)' : 'Speak naturally (e.g., "How market be today?", "Who never pay debt?")'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={cancelVoiceRecording}
                    className={`p-2 rounded-xl transition-colors cursor-pointer text-xs font-medium ${
                      isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                    }`}
                    title={isFr ? 'Annuler' : 'Cancel'}
                    aria-label={isFr ? 'Annuler l’enregistrement' : 'Cancel recording'}
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(false)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isDark 
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title={isFr ? 'Insérer le texte sans envoyer' : 'Insert text into field'}
                  >
                    {isFr ? 'Insérer' : 'To Text'}
                  </button>

                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs shadow-rose-500/30 active:scale-95 transition-all cursor-pointer"
                    title={isFr ? 'Envoyer directement' : 'Send voice message'}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isFr ? 'Envoyer' : 'Send'}</span>
                  </button>
                </div>
              </div>
            ) : isTranscribing ? (
              <div className={`flex items-center justify-center gap-2.5 p-3 rounded-2xl border transition-all ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                <span className="text-xs font-medium">
                  {isFr ? 'Transcription et reconnaissance vocale en cours...' : 'Transcribing voice input with Ursa Speech AI...'}
                </span>
              </div>
            ) : (
              <div className={`relative flex items-center gap-2 border rounded-xl p-1.5 transition-all shadow-xs ${
                isDark 
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30' 
                  : 'bg-slate-100 border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-500/30'
              }`}>
                {/* Voice Input Microphone Trigger */}
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={loading || isTranscribing}
                  className={`p-2 sm:p-2.5 min-w-[36px] min-h-[36px] rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-95 ${
                    isDark
                      ? 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800'
                      : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-200'
                  }`}
                  title={isFr ? 'Parler au micro (Français / Anglais / Pidgin)' : 'Voice input (Speak in Pidgin, English, or French)'}
                  aria-label={isFr ? 'Parler au micro' : 'Voice input'}
                >
                  <Mic className="w-4 h-4" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={isFr ? `Posez n’importe quelle question...` : `Ask anything or type your message...`}
                  rows={1}
                  disabled={loading}
                  inputMode="text"
                  enterKeyHint="send"
                  className={`flex-1 bg-transparent border-0 text-base sm:text-sm focus:outline-hidden resize-none py-2 px-2 max-h-36 min-h-[2.5rem] leading-relaxed disabled:opacity-50 ${
                    isDark ? 'text-zinc-100 placeholder-zinc-500' : 'text-slate-900 placeholder-slate-400'
                  }`}
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || loading}
                  className="p-2.5 sm:p-2.5 min-w-[40px] min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-xs shadow-emerald-500/20 flex items-center justify-center active:scale-95 cursor-pointer"
                  title={isFr ? 'Envoyer le message' : 'Send message'}
                  aria-label={isFr ? 'Envoyer le message' : 'Send message'}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
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
                <h3 className={`text-sm font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  {isFr ? 'Supprimer la discussion ?' : 'Delete Conversation?'}
                </h3>
                <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  &quot;{deleteConfirmConv.title}&quot;
                </p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              {isFr
                ? 'Cette action supprimera définitivement cette discussion et tous ses messages.'
                : 'This will permanently delete this conversation and its messages from your history.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmConv(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => executeDeleteConversation(deleteConfirmConv.id)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {isFr ? 'Supprimer' : 'Delete Chat'}
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
                <h3 className={`text-sm font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  {isFr ? 'Effacer tout l’historique ?' : 'Clear All Chat History?'}
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {isFr ? 'Cette action est irréversible.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              {isFr
                ? `Toutes les conversations et analyses stockées pour ${activeBusiness.name} seront supprimées.`
                : `All stored conversation transcripts and advisory sessions for ${activeBusiness.name} will be permanently wiped.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleClearAllConversations}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {isFr ? 'Tout Effacer' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ursa Memory Bank Modal */}
      {activeBusiness?.id && (
        <UrsaMemoryModal
          isOpen={isMemoryModalOpen}
          onClose={() => setIsMemoryModalOpen(false)}
          businessId={activeBusiness.id}
          language={language as 'en' | 'fr'}
          isDark={isDark}
          onMemoriesUpdated={() => {
            if (activeBusiness?.id) {
              setMemoryCount(UrsaMemoryService.getMemories(activeBusiness.id).length);
            }
          }}
        />
      )}
    </div>
  );
};
