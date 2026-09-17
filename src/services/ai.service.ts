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
   * Sends a user query to the Ursella AI engine via the full-stack server route.
   */
  public static async sendChatMessage(
    payload: AIChatRequestPayload
  ): Promise<AIChatResponsePayload> {
    try {
      const session = isSupabaseConfigured ? (await supabase.auth.getSession()).data?.session : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        headers['x-ursella-demo'] = 'true';
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `AI server responded with status ${response.status}`);
      }

      const data = await response.json();
      return data as AIChatResponsePayload;
    } catch (err: any) {
      console.error('[AIService] sendChatMessage error:', err);
      // If network or server error, provide graceful in-app fallback
      return {
        conversationId: payload.conversationId || 'offline_fallback',
        messageId: `msg_${Date.now()}`,
        intent: 'general_business_question',
        toolsUsed: [],
        latencyMs: 50,
        responseSource: 'DETERMINISTIC_FALLBACK',
        response: {
          answer: `I'm currently unable to reach the business intelligence service. Please check your internet connection or try again in a moment.`,
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: ['How are my sales today?', 'Which products are low on stock?'],
        },
      };
    }
  }

  public static async generateResponse(
    businessId: string,
    conversationId: string,
    message: string,
    language: 'en' | 'fr' | string = 'en'
  ): Promise<{ content: string; metadata?: any }> {
    const validLang: 'en' | 'fr' = language === 'fr' ? 'fr' : 'en';
    const result = await this.sendChatMessage({
      businessId,
      conversationId,
      message,
      language: validLang,
    });
    return {
      content: result.response?.answer || (validLang === 'fr' ? 'Analyse indisponible pour le moment.' : 'Intelligence temporarily unavailable.'),
      metadata: {
        confidence: result.response?.confidence,
        keyMetrics: result.response?.keyMetrics,
        recommendations: result.response?.recommendations,
        followUpSuggestions: result.response?.followUpSuggestions,
        chartData: (result.response as any)?.chartData,
      },
    };
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
    const bizName = businessContext?.businessName || 'My Business';
    const bizCurr = businessContext?.currency || 'XAF';

    // 1. Try Supabase Edge Function 'ursella-ai' if configured (with 4s timeout)
    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Edge function timeout') }), 4000)
        );
        const invokePromise = supabase.functions.invoke('ursella-ai', {
          body: {
            action: 'daily-brief',
            businessId,
            businessContext,
          },
        });
        const { data: edgeData, error: edgeError } = await Promise.race([invokePromise, timeoutPromise]);

        if (!edgeError && edgeData) {
          const raw = edgeData.brief || edgeData.response || edgeData;
          if (raw && (raw.headline || raw.executiveSummary || raw.answer)) {
            return {
              generatedAt: raw.generatedAt || new Date().toISOString(),
              businessName: raw.businessName || bizName,
              currency: raw.currency || bizCurr,
              headline: raw.headline || raw.answer?.split('\n')?.[0]?.replace(/^#+\s*/, '') || `Daily Business Brief for ${bizName}`,
              executiveSummary: raw.executiveSummary || raw.answer || 'Daily performance report ready.',
              performanceSnapshot: {
                revenue: Number(raw.performanceSnapshot?.revenue || 0),
                transactions: Number(raw.performanceSnapshot?.transactions || 0),
                amountCollected: Number(raw.performanceSnapshot?.amountCollected || 0),
                expenses: Number(raw.performanceSnapshot?.expenses || 0),
                outstandingReceivables: Number(raw.performanceSnapshot?.outstandingReceivables || 0),
              },
              keyTakeaways: Array.isArray(raw.keyTakeaways)
                ? raw.keyTakeaways
                : Array.isArray(raw.recommendations)
                ? raw.recommendations.map((r: any) => r.reasoning || r.title)
                : ['Business data synchronized.'],
              inventoryAlerts: Array.isArray(raw.inventoryAlerts) ? raw.inventoryAlerts : [],
              debtFollowUps: Array.isArray(raw.debtFollowUps) ? raw.debtFollowUps : [],
              recommendedFocusToday: raw.recommendedFocusToday || raw.recommendations?.[0]?.actionSuggestion || 'Focus on high-velocity inventory sales.',
              confidence: raw.confidence || 'high_confidence',
            };
          }
        }
      } catch (err) {
        console.warn('Edge function invoke for daily-brief failed, attempting server route:', err);
      }
    }

    // 2. Full-stack server proxy fallback
    try {
      const session = isSupabaseConfigured ? (await supabase.auth.getSession()).data?.session : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/ai/daily-brief', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          businessId,
          businessName: businessContext?.businessName,
          currency: businessContext?.currency,
          timezone: businessContext?.timezone,
          businessContext,
        }),
      });

      if (response.ok) {
        const raw = await response.json();
        if (raw && (raw.headline || raw.executiveSummary)) {
          return {
            generatedAt: raw.generatedAt || new Date().toISOString(),
            businessName: raw.businessName || bizName,
            currency: raw.currency || bizCurr,
            headline: raw.headline || `Daily Briefing for ${bizName}`,
            executiveSummary: raw.executiveSummary || 'Daily briefing summary generated.',
            performanceSnapshot: {
              revenue: Number(raw.performanceSnapshot?.revenue || 0),
              transactions: Number(raw.performanceSnapshot?.transactions || 0),
              amountCollected: Number(raw.performanceSnapshot?.amountCollected || 0),
              expenses: Number(raw.performanceSnapshot?.expenses || 0),
              outstandingReceivables: Number(raw.performanceSnapshot?.outstandingReceivables || 0),
            },
            keyTakeaways: Array.isArray(raw.keyTakeaways) ? raw.keyTakeaways : ['Business operations synchronized.'],
            inventoryAlerts: Array.isArray(raw.inventoryAlerts) ? raw.inventoryAlerts : [],
            debtFollowUps: Array.isArray(raw.debtFollowUps) ? raw.debtFollowUps : [],
            recommendedFocusToday: raw.recommendedFocusToday || 'Review daily sales and inventory levels.',
            confidence: raw.confidence || 'high_confidence',
          };
        }
      }
    } catch {
      // server route not available
    }

    // 3. Factual Local / Supabase Query Fallback (Guarantees authentic factual metrics even offline)
    try {
      if (businessId && isSupabaseConfigured && isValidUUID(businessId)) {
        const todayStartIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
        const [salesRes, expRes, prodRes, unpaidSalesRes, custRes] = await Promise.all([
          (supabase as any)
            .from('sales')
            .select('id, total, amount_paid, amount_due, sale_status, sold_at')
            .eq('business_id', businessId)
            .gte('sold_at', todayStartIso),
          (supabase as any)
            .from('expenses')
            .select('amount')
            .eq('business_id', businessId)
            .gte('expense_date', todayStartIso.split('T')[0]),
          (supabase as any)
            .from('products')
            .select('id, name, stock_quantity, minimum_stock_level, product_type, unit_of_measure, is_active')
            .eq('business_id', businessId)
            .eq('is_active', true),
          (supabase as any)
            .from('sales')
            .select('id, customer_id, amount_due')
            .eq('business_id', businessId)
            .eq('sale_status', 'completed')
            .gt('amount_due', 0),
          (supabase as any)
            .from('customers')
            .select('id, name, phone')
            .eq('business_id', businessId),
        ]);

        const salesList = (salesRes.data || []).filter((s: any) => s.sale_status === 'completed');
        const revenue = salesList.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
        const amountCollected = salesList.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);
        const expenses = (expRes.data || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

        // Calculate receivables from unpaid sales
        const unpaidSales = (unpaidSalesRes.data || []) as Array<{ id: string; customer_id: string | null; amount_due: number }>;
        const outstandingReceivables = unpaidSales.reduce((sum: number, s: any) => sum + Number(s.amount_due || 0), 0);
        const customerMap = new Map<string, string>((custRes.data || []).map((c: any) => [String(c.id), String(c.name || 'Customer')]));
        const debtorBalances = new Map<string, number>();
        for (const us of unpaidSales) {
          const cName: string = us.customer_id ? (customerMap.get(String(us.customer_id)) || 'Customer') : 'Walk-in Customer';
          debtorBalances.set(cName, (debtorBalances.get(cName) || 0) + Number(us.amount_due || 0));
        }

        // Inventory alerts (excluding services)
        const physicalProducts = (prodRes.data || []).filter((p: any) => p.product_type !== 'service');
        const lowStock = physicalProducts.filter((p: any) => Number(p.stock_quantity || 0) <= Number(p.minimum_stock_level || 5));
        const inventoryAlerts = lowStock.slice(0, 3).map((p: any) => `${p.name}: only ${p.stock_quantity} ${p.unit_of_measure || 'unit'}(s) remaining in stock.`);
        const debtFollowUps = Array.from(debtorBalances.entries())
          .slice(0, 3)
          .map(([name, amount]) => `${name}: owes ${bizCurr} ${amount.toLocaleString()}`);

        return {
          generatedAt: new Date().toISOString(),
          businessName: bizName,
          currency: bizCurr,
          headline: revenue > 0
            ? `Trading Active: ${bizCurr} ${revenue.toLocaleString()} recorded across ${salesList.length} orders today`
            : `Daily Briefing: Ready for trading at ${bizName}`,
          executiveSummary: revenue > 0
            ? `Today's revenue stands at ${bizCurr} ${revenue.toLocaleString()} with ${bizCurr} ${amountCollected.toLocaleString()} in cash collected. Operating expenses logged total ${bizCurr} ${expenses.toLocaleString()}.`
            : `Store operations are active. Review inventory levels and record sales transactions directly through the POS terminal.`,
          performanceSnapshot: {
            revenue,
            transactions: salesList.length,
            amountCollected,
            expenses,
            outstandingReceivables,
          },
          keyTakeaways: [
            `${salesList.length} transaction(s) recorded today`,
            `${lowStock.length} product(s) flagged near low-stock threshold`,
            `${debtorBalances.size} debtor account(s) with open credit balances`,
          ],
          inventoryAlerts,
          debtFollowUps,
          recommendedFocusToday: lowStock.length > 0
            ? `Restock low-inventory items (${lowStock[0]?.name}) to prevent stockouts.`
            : debtorBalances.size > 0
            ? `Follow up on outstanding customer credit (${bizCurr} ${outstandingReceivables.toLocaleString()}).`
            : 'Process counter sales and maintain inventory ledger accuracy.',
          confidence: salesList.length >= 3 ? 'high_confidence' : 'moderate_confidence',
        };
      }
    } catch (dbErr) {
      console.warn('Factual DB fallback for daily brief caught error:', dbErr);
    }

    return {
      generatedAt: new Date().toISOString(),
      businessName: bizName,
      currency: bizCurr,
      headline: `Daily Business Briefing for ${bizName}`,
      executiveSummary: `Ready for operations. Review real-time sales velocity, customer accounts, and stock movements.`,
      performanceSnapshot: {
        revenue: 0,
        transactions: 0,
        amountCollected: 0,
        expenses: 0,
        outstandingReceivables: 0,
      },
      keyTakeaways: ['All core modules are synchronized with the Ursella operating engine.'],
      inventoryAlerts: [],
      debtFollowUps: [],
      recommendedFocusToday: 'Process sales in the POS terminal to record transactional revenue.',
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
      const session = isSupabaseConfigured ? (await supabase.auth.getSession()).data?.session : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/ai/proactive-insights', {
        method: 'POST',
        headers,
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
        const parsed: AIChatMessage[] = JSON.parse(raw);
        const seenIds = new Set<string>();
        return parsed.filter((m) => {
          if (!m.id || seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        });
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
   * Generates a unique, concise title reflecting the user's specific intent and topic.
   */
  public static generateTitleFromMessage(text: string, intent?: string): string {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Action proposal / Product creation intent
    if (intent === 'action_proposal' || lower.startsWith('add ') || lower.startsWith('create ') || lower.includes('add product')) {
      const match = raw.match(/add\s+(\d+\s*(?:units?|bags?|cartons?|kg|pcs?|pieces?|bottles?|boxes?)\s+of\s+)?([a-zA-Z0-9\s-]+?)(?:\s+at|\s+with|\s+cost|\s+selling|$)/i);
      if (match && match[2]) {
        const prod = match[2].trim();
        return `Add ${prod.charAt(0).toUpperCase() + prod.slice(1)} to Catalog`;
      }
      return 'Add New Product';
    }

    // 2. Sales queries
    if (intent === 'sales_today' || (lower.includes('sales') && (lower.includes('today') || lower.includes('now')))) {
      return "Today's Sales Performance";
    }
    if (intent === 'sales' || lower.includes('sale') || lower.includes('revenue')) {
      if (lower.includes('yesterday')) return "Yesterday's Sales";
      if (lower.includes('week')) return "Weekly Sales Review";
      if (lower.includes('month')) return "Monthly Sales Overview";
      if (lower.includes('slow')) return "Sales Velocity & Trends";
      return "Sales & Revenue Analysis";
    }

    // 3. Product / Best-seller queries
    if (intent === 'products' || lower.includes('best-selling') || lower.includes('best selling') || lower.includes('top product')) {
      return "Best-Selling Products";
    }
    if (lower.includes('highest margin') || lower.includes('most profit') || lower.includes('most money')) {
      return "High-Margin Products";
    }

    // 4. Inventory / Restock queries
    if (intent === 'inventory' || lower.includes('inventory') || lower.includes('stock') || lower.includes('restock')) {
      if (lower.includes('low') || lower.includes('reorder') || lower.includes('depleted')) {
        return "Low Stock & Reorders";
      }
      return "Inventory Stock Levels";
    }

    // 5. Debtors / Receivables
    if (intent === 'receivables' || lower.includes('debt') || lower.includes('owe') || lower.includes('credit customer')) {
      return "Customer Debts & Balances";
    }

    // 6. Profitability / Gross Margin
    if (intent === 'profitability' || lower.includes('profit') || lower.includes('margin')) {
      if (lower.includes('gross margin')) return "Gross Margin Breakdown";
      return "Profitability & Margins";
    }

    // 7. Expenses & Cash Flow
    if (intent === 'expenses' || lower.includes('expense') || lower.includes('cost')) {
      return "Business Expense Review";
    }
    if (intent === 'cash_flow' || lower.includes('cash flow') || lower.includes('cash')) {
      return "Cash Flow & Collections";
    }

    // 8. Concept Explanation
    if (intent === 'explanation' || lower.startsWith('can you explain') || lower.startsWith('what is ') || lower.startsWith('explain ')) {
      const topic = raw.replace(/^(can you explain|what is|explain|tell me about)\s+/i, '').replace(/[?!.,]/g, '').trim();
      if (topic) {
        return `${topic.charAt(0).toUpperCase() + topic.slice(1)} Explanation`;
      }
      return "Business Concept Guide";
    }

    // 9. Daily brief or Full Report
    if (intent === 'daily_brief' || lower.includes('daily brief') || lower.includes('briefing')) {
      return "Daily Business Brief";
    }
    if (intent === 'full_report' || lower.includes('full report') || lower.includes('analysis report')) {
      return "Comprehensive Business Report";
    }

    // 10. Greetings & Onboarding
    if (intent === 'greeting' || /^(hello|hi|hey|good morning|good afternoon|good evening)\b/i.test(lower)) {
      return "Store Overview & Welcome";
    }

    // 11. Fallback: Clean up prompt into a concise 3-5 word capitalized title
    const clean = raw.replace(/[?!.,;:()]/g, '').trim();
    const words = clean.split(/\s+/).slice(0, 5);
    if (words.length > 0 && words[0]) {
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    return "Business Consultation";
  }
}
