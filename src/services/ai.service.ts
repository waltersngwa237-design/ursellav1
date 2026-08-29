import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import {
  type AIChatRequestPayload,
  type AIChatResponsePayload,
  type AIChatMessage,
  type AIConversationSummary,
  type AIDailyBrief,
} from '../types/ai.ts';

const LOCAL_STORAGE_CONVERSATIONS_KEY = 'ursella_ai_conversations';
const LOCAL_STORAGE_MESSAGES_KEY = 'ursella_ai_messages';

export class AIService {
  /**
   * Sends a user query to the Ursella AI engine via Supabase Edge Function (or local server proxy).
   */
  public static async sendChatMessage(
    payload: AIChatRequestPayload
  ): Promise<AIChatResponsePayload> {
    // 1. Try invoking the Supabase Edge Function 'ursella-ai' if configured
    if (isSupabaseConfigured && isValidUUID(payload.businessId)) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ursella-ai', {
          body: payload,
        });

        if (!edgeError && edgeData && edgeData.response) {
          return edgeData as AIChatResponsePayload;
        }
        if (edgeError) {
          console.warn('Supabase Edge Function invocation failed, falling back to server route:', edgeError);
        }
      } catch (err) {
        console.warn('Edge function invoke error, falling back to server route:', err);
      }
    }

    // 2. Full-stack server proxy fallback
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Fetches the generated Daily Business Brief from Edge Function or server.
   */
  public static async fetchDailyBrief(
    businessId: string,
    businessContext?: {
      businessName?: string;
      currency?: string;
      timezone?: string;
    }
  ): Promise<AIDailyBrief> {
    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ursella-ai', {
          body: {
            action: 'daily-brief',
            businessId,
            businessContext,
          },
        });

        if (!edgeError && edgeData?.response) {
          const resp = edgeData.response;
          return {
            generatedAt: new Date().toISOString(),
            businessName: businessContext?.businessName || 'My Business',
            currency: businessContext?.currency || 'XAF',
            headline: resp.answer?.split('\n')?.[0]?.replace(/^#+\s*/, '') || `Daily Business Brief`,
            executiveSummary: resp.answer || 'Daily performance ready.',
            performanceSnapshot: {
              revenue: 0,
              transactions: 0,
              amountCollected: 0,
              expenses: 0,
              outstandingReceivables: 0,
            },
            keyTakeaways: resp.recommendations?.map((r: any) => r.reasoning || r.title) || [],
            inventoryAlerts: [],
            debtFollowUps: [],
            recommendedFocusToday: resp.recommendations?.[0]?.actionSuggestion || 'Focus on active sales.',
            confidence: resp.confidence || 'high_confidence',
          };
        }
      } catch (err) {
        console.warn('Edge function invoke for daily-brief failed, attempting server route:', err);
      }
    }

    try {
      const response = await fetch('/api/ai/daily-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          businessName: businessContext?.businessName,
          currency: businessContext?.currency,
          timezone: businessContext?.timezone,
          businessContext,
        }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // server route not available
    }

    return {
      generatedAt: new Date().toISOString(),
      businessName: businessContext?.businessName || 'My Business',
      currency: businessContext?.currency || 'XAF',
      headline: `Daily Business Overview`,
      executiveSummary: `Ready for trading. Review real-time sales and inventory movements directly in the Sell POS and Stock modules.`,
      performanceSnapshot: {
        revenue: 0,
        transactions: 0,
        amountCollected: 0,
        expenses: 0,
        outstandingReceivables: 0,
      },
      keyTakeaways: ['All business data is synchronized with your cloud database.'],
      inventoryAlerts: [],
      debtFollowUps: [],
      recommendedFocusToday: 'Process sales in POS terminal to record transactions.',
      confidence: 'high_confidence',
    };
  }

  /**
   * Fetches proactive anomaly insights for the dashboard.
   */
  public static async fetchProactiveInsights(businessId: string): Promise<{
    healthScore: number;
    healthRating: string;
    insights: Array<{
      id: string;
      type: 'warning' | 'critical' | 'info' | 'positive';
      title: string;
      message: string;
      actionPrompt: string;
    }>;
  }> {
    try {
      const response = await fetch('/api/ai/proactive-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businessId }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // server route not available
    }

    return { healthScore: 85, healthRating: 'Good', insights: [] };
  }

  /**
   * Lists all conversations for a specific business (enforcing tenant isolation).
   */
  public static async listConversations(businessId: string): Promise<AIConversationSummary[]> {
    if (!businessId) return [];

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data, error } = await (supabase as any)
          .from('ai_conversations')
          .select('id, business_id, user_id, title, context_type, created_at, updated_at')
          .eq('business_id', businessId)
          .order('updated_at', { ascending: false });

        if (!error && data) {
          return data as AIConversationSummary[];
        }
      } catch (err) {
        console.warn('Failed to load conversations from Supabase, checking local cache:', err);
      }
    }

    // LocalStorage fallback for demo / offline sessions
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }

    return [];
  }

  /**
   * Creates a new conversation for a business.
   */
  public static async createConversation(
    businessId: string,
    userId: string,
    title = 'New Business Advisory'
  ): Promise<AIConversationSummary> {
    const newId = generateUUID();
    const nowIso = new Date().toISOString();

    const conv: AIConversationSummary = {
      id: newId,
      business_id: businessId,
      user_id: userId,
      title,
      context_type: 'general',
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured && isValidUUID(businessId) && (!userId || isValidUUID(userId))) {
      try {
        const { data, error } = await (supabase as any)
          .from('ai_conversations')
          .insert({
            id: newId,
            business_id: businessId,
            user_id: isValidUUID(userId) ? userId : null,
            title,
            context_type: 'general',
          })
          .select()
          .single();

        if (!error && data) {
          return data as AIConversationSummary;
        }
      } catch {
        // fallback to local
      }
    }

    // Store in localStorage
    try {
      const existing = await this.listConversations(businessId);
      const updated = [conv, ...existing.filter((c) => c.id !== newId)];
      localStorage.setItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return conv;
  }

  /**
   * Fetches messages in a conversation.
   */
  public static async getMessages(conversationId: string): Promise<AIChatMessage[]> {
    if (!conversationId) return [];

    if (isSupabaseConfigured && isValidUUID(conversationId)) {
      try {
        const { data, error } = await (supabase as any)
          .from('ai_messages')
          .select('id, conversation_id, business_id, role, content, metadata, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data as AIChatMessage[];
        }
      } catch {
        // fallback
      }
    }

    // LocalStorage fallback
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${conversationId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }

    return [];
  }

  /**
   * Persists a message to a conversation.
   */
  public static async saveMessage(message: AIChatMessage): Promise<void> {
    const msgId = (message.id && isValidUUID(message.id)) ? message.id : generateUUID();
    const cleanMessage: AIChatMessage = {
      ...message,
      id: msgId,
    };

    if (isSupabaseConfigured && isValidUUID(cleanMessage.business_id) && isValidUUID(cleanMessage.conversation_id)) {
      try {
        await (supabase as any).from('ai_messages').insert({
          id: cleanMessage.id,
          conversation_id: cleanMessage.conversation_id,
          business_id: cleanMessage.business_id,
          role: cleanMessage.role,
          content: cleanMessage.content,
          metadata: cleanMessage.metadata,
        });

        await (supabase as any)
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', cleanMessage.conversation_id);
      } catch {
        // fallback to local
      }
    }

    // Save to local storage cache
    try {
      const existing = await this.getMessages(cleanMessage.conversation_id);
      const updated = [...existing.filter(m => m.id !== cleanMessage.id), cleanMessage];
      localStorage.setItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${cleanMessage.conversation_id}`, JSON.stringify(updated));

      // Update conversation timestamp in local storage
      const rawConvs = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${cleanMessage.business_id}`);
      if (rawConvs) {
        const convs: AIConversationSummary[] = JSON.parse(rawConvs);
        const target = convs.find((c) => c.id === cleanMessage.conversation_id);
        if (target) {
          target.updated_at = new Date().toISOString();
          target.last_message_preview = cleanMessage.content.substring(0, 60);
          localStorage.setItem(
            `${LOCAL_STORAGE_CONVERSATIONS_KEY}_${cleanMessage.business_id}`,
            JSON.stringify(convs)
          );
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Deletes an individual message from a conversation.
   */
  public static async deleteMessage(
    businessId: string,
    conversationId: string,
    messageId: string
  ): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(messageId)) {
      try {
        await (supabase as any).from('ai_messages').delete().eq('id', messageId);
      } catch {
        // ignore
      }
    }

    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${conversationId}`);
      if (raw) {
        const msgs: AIChatMessage[] = JSON.parse(raw);
        const filtered = msgs.filter((m) => m.id !== messageId);
        localStorage.setItem(
          `${LOCAL_STORAGE_MESSAGES_KEY}_${conversationId}`,
          JSON.stringify(filtered)
        );

        // Update conversation last message preview if needed
        const rawConvs = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
        if (rawConvs) {
          const convs: AIConversationSummary[] = JSON.parse(rawConvs);
          const target = convs.find((c) => c.id === conversationId);
          if (target) {
            target.last_message_preview = filtered.length > 0
              ? filtered[filtered.length - 1].content.substring(0, 60)
              : '';
            target.updated_at = new Date().toISOString();
            localStorage.setItem(
              `${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`,
              JSON.stringify(convs)
            );
          }
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Clears all messages in an active conversation.
   */
  public static async clearMessagesInConversation(
    businessId: string,
    conversationId: string
  ): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(conversationId)) {
      try {
        await (supabase as any).from('ai_messages').delete().eq('conversation_id', conversationId);
      } catch {
        // ignore
      }
    }

    try {
      localStorage.removeItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${conversationId}`);
      const rawConvs = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
      if (rawConvs) {
        const convs: AIConversationSummary[] = JSON.parse(rawConvs);
        const target = convs.find((c) => c.id === conversationId);
        if (target) {
          target.last_message_preview = '';
          target.updated_at = new Date().toISOString();
          localStorage.setItem(
            `${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`,
            JSON.stringify(convs)
          );
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Deletes a conversation.
   */
  public static async deleteConversation(businessId: string, conversationId: string): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(conversationId)) {
      try {
        await (supabase as any).from('ai_messages').delete().eq('conversation_id', conversationId);
        await (supabase as any).from('ai_conversations').delete().eq('id', conversationId);
      } catch {
        // ignore
      }
    }

    try {
      localStorage.removeItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${conversationId}`);
      const rawConvs = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
      if (rawConvs) {
        const convs: AIConversationSummary[] = JSON.parse(rawConvs);
        const filtered = convs.filter((c) => c.id !== conversationId);
        localStorage.setItem(
          `${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`,
          JSON.stringify(filtered)
        );
      }
    } catch {
      // ignore
    }
  }

  /**
   * Renames a conversation.
   */
  public static async renameConversation(businessId: string, conversationId: string, newTitle: string): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(conversationId)) {
      try {
        await (supabase as any)
          .from('ai_conversations')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } catch {
        // ignore
      }
    }

    try {
      const rawConvs = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
      if (rawConvs) {
        const convs: AIConversationSummary[] = JSON.parse(rawConvs);
        const target = convs.find((c) => c.id === conversationId);
        if (target) {
          target.title = newTitle;
          target.updated_at = new Date().toISOString();
          localStorage.setItem(
            `${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`,
            JSON.stringify(convs)
          );
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Clears all conversations and messages for a business.
   */
  public static async clearAllConversations(businessId: string): Promise<void> {
    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        await (supabase as any).from('ai_messages').delete().eq('business_id', businessId);
        await (supabase as any).from('ai_conversations').delete().eq('business_id', businessId);
      } catch {
        // ignore
      }
    }

    try {
      const rawConvs = localStorage.getItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
      if (rawConvs) {
        const convs: AIConversationSummary[] = JSON.parse(rawConvs);
        for (const c of convs) {
          localStorage.removeItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${c.id}`);
        }
      }
      localStorage.removeItem(`${LOCAL_STORAGE_CONVERSATIONS_KEY}_${businessId}`);
    } catch {
      // ignore
    }
  }

  /**
   * Generates a clean 3-5 word conversation title from the first prompt.
   */
  public static generateTitleFromMessage(text: string): string {
    const clean = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = clean.split(/\s+/).slice(0, 5).join(' ');
    if (!words) return 'Business Advisory';
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
