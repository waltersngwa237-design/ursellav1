import {
  type AIStructuredResponse,
  type AIDailyBrief,
} from '../src/types/ai.ts';
import {
  getGeminiClient,
  getActiveGeminiModel,
  GROQ_PRODUCTION_MODEL,
  logAIProvenance,
} from './ai-config.ts';
import { GroqService } from './groq.service.ts';

export interface ChatReasoningContext {
  businessName: string;
  businessType: string;
  currency: string;
  timezone: string;
  ownerName?: string;
  address?: string;
  taxRate?: number;
  currentDateIso: string;
  toolResults: Record<string, unknown>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  parsedIntent?: {
    intent: string;
    domain: string;
    timePeriod: string;
    primaryGoal: string;
    isEntitySpecific?: boolean;
    entityHint?: string;
    isReportMode?: boolean;
    resolvedContextTopic?: string;
  };
  testSimulation?: 'gemini-503' | 'gemini-429' | 'gemini-timeout' | 'all-fail';
}

/**
 * Server-side Ursella AI Reasoning Engine.
 * Operates as a knowledgeable, conversational business advisor that talks directly to the merchant.
 * Prioritizes direct, natural answers over rigid report templates.
 */
export class GeminiService {
  /**
   * Builds the conversational Ursella AI system instruction.
   */
  private static buildSystemInstruction(ctx: ChatReasoningContext): string {
    const isReportMode = Boolean(ctx.parsedIntent?.isReportMode);

    return `You are Ursella AI, a trusted, highly knowledgeable business advisor speaking directly with the merchant who owns "${ctx.businessName}" (${ctx.businessType}).
You communicate like an experienced human business advisor: natural, conversational, warm, sharp, and direct.
You are NOT a rigid report generator.

PLATFORM CONTEXT & GROUND TRUTH:
- Active Enterprise: "${ctx.businessName}" (${ctx.businessType})
- Operating Currency: "${ctx.currency}". Always format every financial figure with "${ctx.currency}".
- Timezone: "${ctx.timezone}". Reference Date: ${ctx.currentDateIso.split('T')[0]}.

CONVERSATIONAL BEHAVIOR & ANSWER PRIORITY:
1. ALWAYS ANSWER THE USER'S ACTUAL QUESTION IMMEDIATELY IN THE FIRST SENTENCE.
   - Additional context should support the answer, not bury it.
   - Keep responses proportional to what was asked. For standard questions, respond in 1-3 conversational, insightful paragraphs using clear natural language, bolding key figures.
   - Do NOT dump every available metric into the response.

2. STRUCTURE RULES (CONVERSATIONAL vs REPORT MODE):
${
  isReportMode
    ? `- REPORT MODE IS EXPLICITLY REQUESTED BY THE USER:
  Structure your analysis into clear, professional sections:
  ### Executive Summary
  - Summarize key findings directly.
  ### Analytical Diagnostics & Data Breakdown
  - Drill into relevant metrics, percentages, margins, and comparisons.
  ### Strategic Recommendations
  - Provide 2-3 concrete, high-leverage operational action steps.`
    : `- NORMAL CONVERSATIONAL MODE (Default):
  Respond naturally and directly to the user's message.
  DO NOT use or prepend boilerplate report headers like "### Executive Summary", "### Analytical Diagnostics & Data Breakdown", or "### Strategic Recommendations & Tactical Playbook". Write conversationally as an advisor talking to the merchant.`
}

3. CONVERSATIONAL MEMORY & MULTI-TURN CONTINUITY:
- Maintain the current conversation's context.
- The AI must understand references such as:
  'it', 'that', 'them', 'those products', 'the first one', 'what about the hoodies?', 'compare it with last month', 'check it', 'do that', 'yes', 'no', 'go ahead'
  based on the immediately preceding conversation.
- Never treat every message as an isolated question or force the merchant to repeat the subject.
- Continue previous trains of thought seamlessly (e.g., if the user previously said 'Sales have been slow lately' and then says 'Check it', diagnose the sales slowdown directly; if discussing which product makes the most money and the user asks 'What about the hoodies?', analyze the hoodies' margins and revenue directly).

4. BUSINESS REASONING & INTEGRITY (FACT vs INFERENCE vs RECOMMENDATION):
- Strictly distinguish between:
  * FACT: 'Your recorded sales today are ${ctx.currency} 0.' (Must be grounded strictly in verified data).
  * INFERENCE: 'This may indicate a slower sales day, or orders have not been entered into the system yet.'
  * RECOMMENDATION: 'If you want to generate sales today, I would first contact existing customers before discounting products.'
- NEVER present an inference or recommendation as an established business fact.
- NEVER fabricate: supplier agreements, delivery times, customer behavior, market trends, competitor activity, future events, discounts, budgets, percentages, financial conditions, or business policies.
- If data is insufficient or zero, say so simply and clearly.
- Do not assume that one day of zero sales means the business has a cash-flow problem.
- Do not recommend arbitrary discounts or spending amounts without supporting evidence.

5. ADVISOR IDENTITY — STRICTLY AN ADVISOR, NOT AN AUTONOMOUS AGENT:
- You are a business advisor, financial analyst, and strategic mentor. You are NOT an autonomous execution agent.
- DO NOT claim to perform autonomous actions, execute system tasks, or manipulate records on the user's behalf.
- Never say "I will add this for you", "I have staged this for execution", or "Click below to confirm and execute".
- When the merchant asks about adding a product, restocking, or adjusting prices (e.g. "Add 20 units of Milo" or "Add 50 bags of Cement"):
  * Provide helpful advisory guidance on the unit economics, pricing strategy, and margin calculation.
  * Clearly guide the merchant on how to record the product or adjustment in their **Inventory & Products** dashboard.
  * Keep the tone supportive, professional, and consultative.

6. OUTPUT FORMAT:
Respond with a JSON object strictly adhering to this schema:
{
  "answer": "Your natural, conversational response in Markdown (or structured report if Report Mode was explicitly requested).",
  "keyMetrics": [
    { "label": "Metric Name", "value": 12000, "formattedValue": "${ctx.currency} 12,000", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Clear rationale",
      "actionSuggestion": "Actionable step for merchant to take in their store",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": [
    "User question or request 1",
    "User question or request 2"
  ]
}
(Note: Include keyMetrics only if directly relevant to the question. Leave empty [] for greetings, navigation, or general concept explanations).

7. FOLLOW-UP SUGGESTIONS PERSPECTIVE (CRITICAL):
The "followUpSuggestions" are buttons that the MERCHANT will click to ask Ursella what THEY need next.
- They MUST be phrased from the USER'S perspective requesting what they need (e.g. "Check my sales from last week", "Show me products low on stock", "Who owes me money?", "Help me reorder this item", "What was my profit on cement?").
- They MUST NEVER be phrased as the AI asking the user ("Would you like me to...", "Do you want to...", "Should I...", "Would you like...").
- Keep them concise (3-7 words) and directly relevant.`;
  }

  /**
   * Primary entry point for generating conversational AI chat responses.
   * Employs the resilient multi-provider routing strategy:
   * 1. Gemini (primary) -> with 1 bounded retry for transient faults
   * 2. Groq (secondary) -> production llama/gpt model
   * 3. Deterministic Reasoning Engine Fallback (guaranteed response)
   */
  public static async generateChatResponse(
    userMessage: string,
    ctx: ChatReasoningContext
  ): Promise<AIStructuredResponse> {
    const ai = getGeminiClient();

    const contextPrompt = `
=== BUSINESS CONTEXT & RELEVANT FACTUAL METRICS ===
Active Store: ${ctx.businessName} (${ctx.businessType})
Currency: ${ctx.currency}
Timezone: ${ctx.timezone}
Reference Date: ${ctx.currentDateIso}

${
  ctx.parsedIntent
    ? `=== INTERPRETED REASONING GOAL ===
Intent: ${ctx.parsedIntent.intent}
Domain: ${ctx.parsedIntent.domain}
Time Period: ${ctx.parsedIntent.timePeriod}
Goal: ${ctx.parsedIntent.primaryGoal}
Report Mode: ${ctx.parsedIntent.isReportMode ? 'YES' : 'NO'}
${ctx.parsedIntent.entityHint ? `Entity Target: ${ctx.parsedIntent.entityHint}` : ''}
${ctx.parsedIntent.resolvedContextTopic ? `Resolved Topic: ${ctx.parsedIntent.resolvedContextTopic}` : ''}
`
    : ''
}

=== VERIFIED BUSINESS DATA (GROUND TRUTH) ===
${JSON.stringify(ctx.toolResults, null, 2)}

=== USER CONVERSATION HISTORY ===
${
  ctx.conversationHistory?.length
    ? ctx.conversationHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    : 'No previous history.'
}

=== CURRENT USER QUESTION ===
"${userMessage}"
`;

    const model = getActiveGeminiModel();
    const startTime = Date.now();
    const systemInstruction = this.buildSystemInstruction(ctx);

    // 1. PRIMARY PROVIDER: Gemini
    let geminiError: any = null;

    if (
      ai &&
      ctx.testSimulation !== 'gemini-503' &&
      ctx.testSimulation !== 'gemini-429' &&
      ctx.testSimulation !== 'gemini-timeout' &&
      ctx.testSimulation !== 'all-fail'
    ) {
      try {
        console.log(`[AI Routing] Calling primary provider: gemini (${model})...`);
        const geminiPromise = ai.models.generateContent({
          model,
          contents: contextPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const response = await this.withTimeout(
          geminiPromise,
          12000,
          'Gemini request timed out after 12000ms'
        );

        const latencyMs = Date.now() - startTime;
        const responseText = response.text || '';

        if (responseText) {
          console.log('[AI Routing] provider: gemini');
          logAIProvenance({
            endpoint: 'generateChatResponse',
            businessId: ctx.businessName,
            source: 'GEMINI_RESPONSE',
            provider: 'gemini',
            model,
            latencyMs,
          });

          return this.parseChatStructuredResponse(responseText, ctx, 'GEMINI_RESPONSE', 'gemini');
        }
      } catch (err: any) {
        console.warn(`[AI Routing] Gemini primary provider failed:`, err?.message || err);
        geminiError = err;
      }
    } else {
      if (ctx.testSimulation === 'gemini-503') {
        const err = new Error('503 Service Unavailable: High upstream model load (simulated)');
        (err as any).status = 503;
        geminiError = err;
      } else if (ctx.testSimulation === 'gemini-429') {
        const err = new Error('429 Too Many Requests: Rate limit exceeded (simulated)');
        (err as any).status = 429;
        geminiError = err;
      } else if (ctx.testSimulation === 'gemini-timeout') {
        const err = new Error('Gemini request timed out after 12000ms (simulated)');
        (err as any).name = 'TimeoutError';
        (err as any).status = 504;
        geminiError = err;
      } else if (ctx.testSimulation === 'all-fail') {
        geminiError = new Error('Simulated upstream failure (all-fail)');
      } else {
        geminiError = new Error('GEMINI_API_KEY is not configured or client initialization failed');
      }
    }

    // 2. BOUNDED RETRY for Gemini if temporary failure (503, 429, timeout, network error)
    if (this.isTemporaryGeminiError(geminiError) && ctx.testSimulation !== 'all-fail') {
      console.warn(
        `[AI Routing] Gemini temporary failure (${geminiError?.message || geminiError}). Initiating 1 bounded retry...`
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (ai && !ctx.testSimulation?.startsWith('gemini-')) {
        try {
          const retryPromise = ai.models.generateContent({
            model,
            contents: contextPrompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          const response = await this.withTimeout(
            retryPromise,
            8000,
            'Gemini retry timed out after 8000ms'
          );

          const latencyMs = Date.now() - startTime;
          const responseText = response.text || '';

          if (responseText) {
            console.log('[AI Routing] provider: gemini (succeeded on retry)');
            logAIProvenance({
              endpoint: 'generateChatResponse',
              businessId: ctx.businessName,
              source: 'GEMINI_RESPONSE',
              provider: 'gemini',
              model,
              latencyMs,
            });

            return this.parseChatStructuredResponse(responseText, ctx, 'GEMINI_RESPONSE', 'gemini');
          }
        } catch (retryErr: any) {
          console.warn(
            `[AI Routing] Gemini retry attempt failed (${retryErr?.message || retryErr}). Proceeding to Groq fallback.`
          );
          geminiError = retryErr;
        }
      } else {
        console.warn(`[AI Routing] Simulated Gemini temporary failure verified. Proceeding to Groq fallback.`);
      }
    }

    // 3. SECONDARY PROVIDER: Groq (production model: openai/gpt-oss-120b)
    console.log(`[AI Routing] Calling secondary provider: groq (${GROQ_PRODUCTION_MODEL})...`);
    try {
      const groqResponse = await GroqService.generateChatResponse(
        systemInstruction,
        contextPrompt,
        ctx,
        12000
      );

      if (groqResponse) {
        console.log('[AI Routing] provider: groq');
        return groqResponse;
      }
    } catch (groqErr: any) {
      console.warn(`[AI Routing] Groq provider failed:`, groqErr?.message || groqErr);
    }

    // 4. DETERMINISTIC REASONING ENGINE FALLBACK
    console.log('[AI Routing] provider: deterministic_fallback');
    return this.generateDeterministicFallback(userMessage, ctx);
  }

  /**
   * Detects whether an error from Gemini is temporary and suitable for a bounded retry.
   */
  private static isTemporaryGeminiError(err: any): boolean {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const status = err.status || err.statusCode;

    if (status === 503 || status === 429 || status === 504 || status === 502) return true;
    if (msg.includes('503') || msg.includes('429') || msg.includes('rate limit') || msg.includes('resource exhausted')) return true;
    if (msg.includes('timeout') || msg.includes('timed out') || err.name === 'TimeoutError') return true;
    if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('network error') || msg.includes('socket hang up')) return true;

    return false;
  }

  /**
   * Helper timeout promise wrapper.
   */
  private static withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(errorMsg);
        (err as any).name = 'TimeoutError';
        reject(err);
      }, ms);

      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Sanitizes follow-up suggestions so that every prompt represents
   * the merchant needing a service (User perspective) rather than
   * the AI asking if the merchant wants something (AI perspective).
   */
  public static sanitizeFollowUpSuggestions(suggestions: unknown): string[] {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return ['How are my sales today?', 'Which products are low on stock?'];
    }

    const cleaned = suggestions
      .map((s) => {
        if (!s || typeof s !== 'string') return '';
        let clean = s.trim();

        // Convert AI offers/questions into user requests
        clean = clean
          .replace(/^would you like me to\s+/i, '')
          .replace(/^would you like to\s+/i, '')
          .replace(/^would you like\s+/i, 'Show me ')
          .replace(/^do you want me to\s+/i, '')
          .replace(/^do you want to\s+/i, '')
          .replace(/^do you want\s+/i, 'Show me ')
          .replace(/^should i\s+/i, '')
          .replace(/^shall i\s+/i, '')
          .replace(/^can i help you\s+/i, 'Help me ')
          .replace(/^can i\s+/i, '')
          .replace(/^do you need me to\s+/i, '')
          .replace(/^do you need help\s+(?:with|to)?\s*/i, 'Help me ')
          .replace(/^do you need to\s+/i, '')
          .replace(/^do you have any questions about\s+/i, 'Tell me more about ')
          .replace(/^let me know if you want to\s+/i, '')
          .replace(/^if you want, I can\s+/i, '');

        clean = clean.trim();
        if (!clean) return '';

        // Capitalize first letter
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);

        // Remove trailing question mark if it was converted from an AI offer to an imperative user action
        if (clean.endsWith('?') && !/^(how|what|who|which|where|why|can you|is|are)\b/i.test(clean)) {
          clean = clean.slice(0, -1).trim();
        }

        return clean;
      })
      .filter((s) => s.length > 3)
      .slice(0, 4);

    return cleaned.length > 0
      ? cleaned
      : ['How are my sales today?', 'Which products are low on stock?'];
  }

  /**
   * Parses and validates raw AI JSON output.
   */
  private static parseChatStructuredResponse(
    rawText: string,
    ctx: ChatReasoningContext,
    source: 'GEMINI_RESPONSE' | 'GROQ_RESPONSE',
    provider: 'gemini' | 'groq'
  ): AIStructuredResponse {
    try {
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

      return {
        answer: parsed.answer || 'Analysis complete.',
        keyMetrics: Array.isArray(parsed.keyMetrics) ? parsed.keyMetrics : [],
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        confidence: parsed.confidence || 'high_confidence',
        followUpSuggestions: GeminiService.sanitizeFollowUpSuggestions(parsed.followUpSuggestions),
        responseSource: source,
        provider,
      };
    } catch (parseError) {
      console.warn(`[AI Engine] Failed to parse structured JSON from ${provider}, using text fallback:`, parseError);
      return {
        answer: rawText,
        confidence: 'moderate_confidence',
        responseSource: source,
        provider,
        followUpSuggestions: ['How are my sales today?', 'Which products are low on stock?'],
      };
    }
  }

  /**
   * Authoritative Deterministic Fallback Engine.
   * Produces natural, conversational responses matching the updated communication standards.
   */
  public static generateDeterministicFallback(
    query: string,
    ctx: ChatReasoningContext
  ): AIStructuredResponse {
    const q = query.toLowerCase().trim();
    const overview = (ctx.toolResults.get_business_overview || {}) as any;
    const todaySales = (ctx.toolResults.get_today_sales_summary || {}) as any;
    const salesSummary = (ctx.toolResults.get_sales_summary || {}) as any;
    const dailyBrief = (ctx.toolResults.get_daily_brief_facts || {}) as any;
    const inv = (ctx.toolResults.get_inventory_alerts || todaySales.inventoryAlerts || {}) as any;
    const debtors = (ctx.toolResults.get_customer_balances || dailyBrief.debtorAlerts || {}) as any;
    const products = (ctx.toolResults.get_product_performance || []) as any[];
    const comp = (ctx.toolResults.get_period_comparison || {}) as any;
    const expenses = (ctx.toolResults.get_expense_summary || {}) as any;
    const cashFlow = (ctx.toolResults.get_cash_flow || {}) as any;

    const currency = ctx.currency || 'XAF';
    const isExplicitReport = Boolean(ctx.parsedIntent?.isReportMode);

    // =========================================================================
    // 1. GREETINGS & CHIT-CHAT (Conversational, no report headers, no database queries)
    // =========================================================================
    if (
      ctx.parsedIntent?.intent === 'greeting' ||
      /^(hello|hi|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|salut|bonjour|yo|hola)[\s!.,?]*$/i.test(q) ||
      /^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+are\s+you|what\s+is\s+ursella|help)[\s!.,?]*$/i.test(q)
    ) {
      return {
        answer: `Hello! I'm your Ursella AI advisor for **${ctx.businessName}**.\n\nI can help you check your live sales, identify low-stock items needing replenishment, review customer credit balances, analyze your product margins, or register products in your catalog. What would you like to look at today?`,
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        keyMetrics: [],
        recommendations: [],
        followUpSuggestions: [
          'How are my sales today?',
          'What is my best-selling product?',
          'Which products are low on stock?',
          'Who owes me money?',
        ],
      };
    }

    // =========================================================================
    // 2. NAVIGATION INTENTS (Conversational guide, no database queries)
    // =========================================================================
    if (ctx.parsedIntent?.intent === 'navigation') {
      let targetName = 'the main dashboard';
      if (q.includes('inventory') || q.includes('product') || q.includes('catalog')) targetName = '**Inventory & Products**';
      else if (q.includes('sale') || q.includes('order')) targetName = '**Sales & Orders**';
      else if (q.includes('pos')) targetName = '**POS / Point of Sale**';
      else if (q.includes('debt') || q.includes('customer')) targetName = '**Customers & Credit**';
      else if (q.includes('expense')) targetName = '**Expenses**';
      else if (q.includes('setting')) targetName = '**Settings**';

      return {
        answer: `You can access ${targetName} directly from the navigation menu on the left side of your screen.`,
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        keyMetrics: [],
        recommendations: [],
        followUpSuggestions: [
          'How are my sales today?',
          'Which products are low on stock?',
        ],
      };
    }

    // =========================================================================
    // 3. BUSINESS CONCEPTS & EDUCATIONAL EXPLANATIONS (Zero DB query needed)
    // =========================================================================
    if (ctx.parsedIntent?.intent === 'explanation') {
      if (q.includes('gross margin') || q.includes('margin')) {
        return {
          answer: `**Gross margin** is the percentage of revenue your business keeps after paying the direct cost of purchasing or producing the goods sold (COGS).\n\n**Formula:**\n$$\\text{Gross Margin (\\%)} = \\frac{\\text{Revenue} - \\text{COGS}}{\\text{Revenue}} \\times 100$$\n\nFor example, if you buy an item for ${currency} 3,000 and sell it for ${currency} 5,000, your gross profit is ${currency} 2,000 and your gross margin is **40%**. A higher gross margin gives you more cash buffer to cover operating expenses like rent, utilities, and staff.`,
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            'Which products make me the most money?',
            'What is my gross profit this month?',
          ],
        };
      }
      if (q.includes('cogs') || q.includes('cost of goods')) {
        return {
          answer: `**Cost of Goods Sold (COGS)** represents the direct costs incurred to acquire or produce the products you sold during a period.\n\nIt includes purchase costs and direct inbound freight, but excludes general operating expenses like rent, electricity, or administrative overhead. In Ursella, COGS is tracked automatically using authoritative FIFO (First-In, First-Out) costing.`,
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            'What is my FIFO inventory valuation?',
            'What is my best-selling product?',
          ],
        };
      }
      if (q.includes('working capital') || q.includes('capital')) {
        return {
          answer: `**Working capital** is the cash and short-term assets available for your day-to-day business operations.\n\nIt is calculated as **Current Assets** (cash on hand, bank balances, inventory, unpaid customer debts) minus **Current Liabilities** (supplier payables and short-term bills). Maintaining positive working capital ensures you can replenish high-demand inventory and pay operational costs without liquidity freezes.`,
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            'What is my current cash flow?',
            'Who owes me money?',
          ],
        };
      }
    }

    // =========================================================================
    // 4. CONVERSATIONAL MEMORY / ANAPHORA CONTINUATION ("Check it", "What about the hoodies?")
    // =========================================================================

    // 4A. Sales Slowdown Diagnosis ("Check it" after sales discussion)
    if (
      ctx.parsedIntent?.resolvedContextTopic === 'sales_slowdown_diagnosis' ||
      (q === 'check it' && !q.includes('stock'))
    ) {
      const totalRev = Number(salesSummary.totalRevenue || overview.revenue || 0);
      const txCount = Number(salesSummary.transactionCount || overview.transaction_count || 0);
      const revGrowth = comp?.revenueGrowthPct;
      const outOfStock = Number(inv.outOfStockCount || 0);
      const lowStock = Number(inv.lowStockCount || 0);

      const hasDrop = revGrowth !== undefined && revGrowth < 0;
      const dropText = hasDrop
        ? `Sales are down **${Math.abs(revGrowth)}%** compared to the prior period.`
        : revGrowth !== undefined && revGrowth > 0
        ? `Sales are actually up **+${revGrowth}%** compared to the prior period.`
        : `Recent volume stands at ${currency} ${totalRev.toLocaleString()} across ${txCount} orders.`;

      let stockFinding = '';
      if (outOfStock > 0 || lowStock > 0) {
        stockFinding = `You have **${outOfStock} depleted item(s)** and **${lowStock} low-stock item(s)**. Out-of-stock items may be directly suppressing daily sales volume.`;
      } else {
        stockFinding = `All catalog items are currently stocked, so the slower pace appears related to general customer foot-traffic or purchase frequency rather than inventory shortages.`;
      }

      return {
        answer: `Looking into your sales pace:\n\n${dropText} In the last 30 days, your store recorded **${currency} ${totalRev.toLocaleString()}** across **${txCount}** transaction(s).\n\n**Key observations:**\n- **Inventory status:** ${stockFinding}\n- **Next step:** If you want to boost sales today, reaching out directly to past regular buyers or featuring your top-margin items at the register is a practical place to start.`,
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        keyMetrics: [
          { label: 'Recent Revenue', value: totalRev, formattedValue: `${currency} ${totalRev.toLocaleString()}`, trend: hasDrop ? 'negative' : 'neutral' },
          { label: 'Out of Stock SKUs', value: outOfStock, formattedValue: `${outOfStock}`, trend: outOfStock > 0 ? 'negative' : 'positive' },
        ],
        followUpSuggestions: [
          'What is my best-selling product?',
          'Which products are low on stock?',
          'How are my sales today?',
        ],
      };
    }

    // 4B. Follow-up product inquiry: e.g. "What about the hoodies?"
    if (
      ctx.parsedIntent?.resolvedContextTopic === 'product_margin_continuation' ||
      ctx.parsedIntent?.entityHint ||
      q.startsWith('what about ')
    ) {
      const entityHint = (ctx.parsedIntent?.entityHint || q.replace(/^(what\s+about|how\s+about|and)\s+(the\s+)?/i, '')).replace(/\?$/, '').trim();
      const matchedProduct = products.find((p) => p.name?.toLowerCase().includes(entityHint.toLowerCase()));

      if (matchedProduct) {
        const uMargin = matchedProduct.catalogUnitMarginPct ?? matchedProduct.marginPct ?? 0;
        const fifoCost = matchedProduct.fifoUnitCostAverage ?? matchedProduct.costPrice ?? 0;
        const sellPrice = Number(matchedProduct.sellingPrice || 0);
        const stock = matchedProduct.stockQuantity ?? 0;
        const unitsSold = matchedProduct.unitsSold ?? 0;
        const unitProfit = sellPrice - Number(fifoCost);

        return {
          answer: `For **${matchedProduct.name}**, you're selling at **${currency} ${sellPrice.toLocaleString()}** with a **${uMargin}% unit margin** (${currency} ${unitProfit.toLocaleString()} profit per unit).\n\nYou currently have **${stock} unit(s)** on hand with **${unitsSold} sold** in the current period.`,
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [
            { label: `${matchedProduct.name} Price`, value: sellPrice, formattedValue: `${currency} ${sellPrice.toLocaleString()}`, trend: 'neutral' },
            { label: 'Unit Margin', value: uMargin, formattedValue: `${uMargin}%`, trend: uMargin >= 30 ? 'positive' : 'neutral' },
            { label: 'Stock On Hand', value: stock, formattedValue: `${stock}`, trend: stock > 5 ? 'positive' : 'negative' },
          ],
          followUpSuggestions: [
            'Which product makes me the most money?',
            'What is my best-selling product?',
            'Which products are low on stock?',
          ],
        };
      } else {
        return {
          answer: `I checked your catalog, but could not find a product matching **"${entityHint}"**. You can register it anytime by saying "Add [quantity] of ${entityHint} at [selling price]".`,
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: [
            'What is my best-selling product?',
            'Which product makes me the most money?',
          ],
        };
      }
    }

    // =========================================================================
    // 5. PRODUCT CREATION / RESTOCK ACTIONS (Conversational confirmation + Action card)
    // =========================================================================
    if (
      q.startsWith('add ') ||
      q.startsWith('create ') ||
      q.startsWith('register ') ||
      q.startsWith('new product') ||
      q.startsWith('ajouter ') ||
      q.startsWith('créer ') ||
      q.includes('add product') ||
      q.includes('create product') ||
      q.includes('add to inventory') ||
      q.includes('add to catalog') ||
      q.includes('add stock') ||
      q.includes('restock')
    ) {
      let detectedUnit = 'piece';
      let detectedQty = 1;

      const unitRegex = /(\d+(?:\.\d+)?)\s*(bags?|sacs?|cartons?|boxes|box|caisses?|boites?|boîtes?|kgs?|kilos?|kilograms?|g|grams?|grammes?|litres?|liters?|l|bottles?|bouteilles?|cans?|canettes?|packs?|paquets?|pieces?|pcs?|pc|unit[ée]s?|pairs?|paires?|rolls?|rouleaux?|yards?|meters?|m[èe]tres?)/i;
      const unitMatch = query.match(unitRegex);

      if (unitMatch) {
        detectedQty = parseFloat(unitMatch[1]) || 1;
        const rawUnit = unitMatch[2].toLowerCase();
        if (rawUnit.startsWith('sac') || rawUnit.startsWith('bag')) detectedUnit = 'bag';
        else if (rawUnit.startsWith('carton') || rawUnit.startsWith('box') || rawUnit.startsWith('caisse') || rawUnit.startsWith('boit')) detectedUnit = 'carton';
        else if (rawUnit.startsWith('kg') || rawUnit.startsWith('kilo')) detectedUnit = 'kg';
        else if (rawUnit === 'g' || rawUnit.startsWith('gram')) detectedUnit = 'g';
        else if (rawUnit.startsWith('lit') || rawUnit === 'l') detectedUnit = 'L';
        else if (rawUnit.startsWith('bottl') || rawUnit.startsWith('bouteil')) detectedUnit = 'bottle';
        else if (rawUnit.startsWith('can')) detectedUnit = 'can';
        else if (rawUnit.startsWith('pack') || rawUnit.startsWith('paquet')) detectedUnit = 'pack';
        else if (rawUnit.startsWith('pair')) detectedUnit = 'pair';
        else if (rawUnit.startsWith('roll') || rawUnit.startsWith('rouleau')) detectedUnit = 'roll';
        else if (rawUnit.startsWith('yard') || rawUnit.startsWith('meter') || rawUnit.startsWith('mètr')) detectedUnit = 'm';
        else detectedUnit = 'piece';
      } else {
        const qtyMatch = query.match(/(?:qty|quantity|quantité|stock|count|initial stock)[:\s]*(\d+)/i) || query.match(/\b(\d+)\s*(?:items|units|articles)\b/i);
        if (qtyMatch) {
          detectedQty = parseInt(qtyMatch[1], 10) || 1;
        }
      }

      let sellingPrice = 0;
      let costPrice = 0;

      const sellMatch =
        query.match(/(?:selling|sell|price|selling price|sell price|prix|prix de vente)[:\s]*(\d+(?:[.,]\d+)?)/i) ||
        query.match(/at\s+(\d+(?:[.,]\d+)?)\s*(?:selling|each|unit|fcfa|xaf|\$)?/i);
      if (sellMatch) {
        sellingPrice = parseFloat(sellMatch[1].replace(',', '')) || 0;
      }

      const costMatch =
        query.match(/(?:cost|cost price|buy price|achat|prix d'achat)[:\s]*(\d+(?:[.,]\d+)?)/i) ||
        query.match(/and\s+(\d+(?:[.,]\d+)?)\s*(?:cost|cost price|buying)/i);
      if (costMatch) {
        costPrice = parseFloat(costMatch[1].replace(',', '')) || 0;
      }

      let cleanProductName = query
        .replace(/^(add|create|register|new product|ajouter|créer)\s+/i, '')
        .replace(/\b(?:product|item|article)\b/gi, '')
        .replace(unitRegex, '')
        .replace(/(?:qty|quantity|quantité|stock|count)[:\s]*\d+/gi, '')
        .replace(/(?:selling|sell|price|cost|cost price|at|and)[:\s]*\d+(?:[.,]\d+)?/gi, '')
        .replace(/\b(?:fcfa|xaf|\$|usd)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanProductName || cleanProductName.length < 2) {
        cleanProductName = 'Commercial Item';
      }

      const existingProduct = products.find(
        (p: any) => p.name?.toLowerCase().trim() === cleanProductName.toLowerCase()
      );

      const isRestockOnly = (q.includes('restock') || q.includes('reapprovisionner')) && existingProduct;

      if (isRestockOnly && existingProduct) {
        return {
          answer: `To restock **${existingProduct.name}** with **+${detectedQty} ${detectedUnit}**, open your **Inventory & Products** section and select **Restock / Adjust Quantity**. This will increase your recorded stock from ${existingProduct.stock_quantity || 0} to **${(existingProduct.stock_quantity || 0) + detectedQty} ${detectedUnit}**.`,
          keyMetrics: [
            { label: 'Adjustment Qty', value: detectedQty, formattedValue: `+${detectedQty} ${detectedUnit}`, trend: 'positive' },
            { label: 'Current Stock', value: existingProduct.stock_quantity || 0, formattedValue: `${existingProduct.stock_quantity || 0} ${detectedUnit}`, trend: 'neutral' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: [
            'Which products are low on stock?',
            'What is my best-selling product?',
            'How are my sales today?',
          ],
        };
      }

      const marginAmount = sellingPrice > 0 && costPrice > 0 ? sellingPrice - costPrice : 0;
      const marginPercent = sellingPrice > 0 && marginAmount > 0 ? Math.round((marginAmount / sellingPrice) * 100) : 0;

      return {
        answer: `To add **${cleanProductName}** to your catalog, go to **Inventory & Products** and tap **Add Product**. An initial stock of **${detectedQty} ${detectedUnit}** at **${currency} ${sellingPrice.toLocaleString()}** selling price${costPrice > 0 ? ` (cost: ${currency} ${costPrice.toLocaleString()})` : ''} yields a **${marginPercent}%** unit margin (${currency} ${marginAmount.toLocaleString()} profit per ${detectedUnit}).`,
        keyMetrics: [
          { label: 'Initial Stock', value: detectedQty, formattedValue: `${detectedQty} ${detectedUnit}`, trend: 'positive' },
          { label: 'Selling Price', value: sellingPrice, formattedValue: `${currency} ${sellingPrice.toLocaleString()}`, trend: 'neutral' },
          ...(marginPercent > 0 ? [{ label: 'Gross Margin', value: marginPercent, formattedValue: `${marginPercent}%`, trend: 'positive' as const }] : []),
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'Which products are low on stock?',
          'What is my best-selling product?',
          'How are my sales today?',
        ],
      };
    }

    // =========================================================================
    // 6. PRODUCT INQUIRIES ("What is my best-selling product?", "Which product makes me the most money?")
    // =========================================================================
    if (
      q.includes('best selling') ||
      q.includes('best-selling') ||
      q.includes('top product') ||
      q.includes('top selling') ||
      q.includes('fastest selling') ||
      q.includes('most sold')
    ) {
      if (!products || products.length === 0) {
        return {
          answer: `You do not have any recorded product sales in your catalog yet. Once you record sales through POS or Orders, I'll identify your fastest-moving items here.`,
          keyMetrics: [],
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: ['How are my sales today?', 'Which products are low on stock?'],
        };
      }

      // Sort by units sold (volume)
      const sortedByVolume = [...products].sort((a, b) => (b.unitsSold || 0) - (a.unitsSold || 0));
      const topVolume = sortedByVolume[0];

      return {
        answer: `Your best-selling product by volume is **${topVolume.name}** with **${topVolume.unitsSold || 0} unit(s) sold**, generating **${currency} ${Number(topVolume.revenue || 0).toLocaleString()}** in revenue (unit gross margin: **${topVolume.marginPct || 0}%**).\n\nYou currently have **${topVolume.stockQuantity || 0} unit(s)** remaining in stock.`,
        keyMetrics: [
          { label: 'Units Sold', value: topVolume.unitsSold || 0, formattedValue: `${topVolume.unitsSold || 0}`, trend: 'positive' },
          { label: 'Revenue', value: Number(topVolume.revenue || 0), formattedValue: `${currency} ${Number(topVolume.revenue || 0).toLocaleString()}`, trend: 'positive' },
          { label: 'Units on Hand', value: topVolume.stockQuantity || 0, formattedValue: `${topVolume.stockQuantity || 0}`, trend: (topVolume.stockQuantity || 0) > 5 ? 'positive' : 'negative' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'Which product makes me the most money?',
          'Which products are low on stock?',
          'How are my sales today?',
        ],
      };
    }

    if (
      q.includes('makes me the most money') ||
      q.includes('make me the most money') ||
      q.includes('most profitable product') ||
      q.includes('highest profit product') ||
      q.includes('highest margin product')
    ) {
      if (!products || products.length === 0) {
        return {
          answer: `No product margin data is recorded in your catalog yet. Once purchase costs and sales prices are established, your highest profit contributors will be tracked here.`,
          keyMetrics: [],
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: ['How are my sales today?', 'Which products are low on stock?'],
        };
      }

      // Sort by gross profit or margin
      const sortedByProfit = [...products].sort((a, b) => {
        const profitA = (a.revenue || 0) - (a.cogs || 0);
        const profitB = (b.revenue || 0) - (b.cogs || 0);
        return profitB - profitA;
      });
      const topProfit = sortedByProfit[0];
      const gp = (topProfit.revenue || 0) - (topProfit.cogs || 0);

      return {
        answer: `Your strongest product by gross profit is **${topProfit.name}**, generating **${currency} ${Number(gp).toLocaleString()}** in profit (${topProfit.unitsSold || 0} units sold at a **${topProfit.marginPct || 0}%** margin).\n\nCurrent stock on hand is **${topProfit.stockQuantity || 0} unit(s)**.`,
        keyMetrics: [
          { label: 'Gross Profit', value: gp, formattedValue: `${currency} ${Number(gp).toLocaleString()}`, trend: 'positive' },
          { label: 'Gross Margin', value: topProfit.marginPct || 0, formattedValue: `${topProfit.marginPct || 0}%`, trend: 'positive' },
          { label: 'Stock On Hand', value: topProfit.stockQuantity || 0, formattedValue: `${topProfit.stockQuantity || 0}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'What is my best-selling product?',
          'Which products are low on stock?',
          'What about the hoodies?',
        ],
      };
    }

    // =========================================================================
    // 7. TIME-SPECIFIC SALES ("How are my sales today?", "How much did I make this month?")
    // =========================================================================
    if (
      q.includes('this month') ||
      q.includes('make this month') ||
      q.includes('made this month')
    ) {
      const monthRev = Number(salesSummary.totalRevenue || overview.revenue || 0);
      const monthOrders = Number(salesSummary.transactionCount || overview.transaction_count || 0);
      const monthMargin = Number(salesSummary.grossMarginPct || overview.gross_margin || 0);

      return {
        answer: `This month, **${ctx.businessName}** has generated **${currency} ${monthRev.toLocaleString()}** in recorded sales across **${monthOrders}** order(s), with a **${monthMargin}%** gross margin.`,
        keyMetrics: [
          { label: 'Monthly Revenue', value: monthRev, formattedValue: `${currency} ${monthRev.toLocaleString()}`, trend: 'positive' },
          { label: 'Monthly Orders', value: monthOrders, formattedValue: `${monthOrders}`, trend: 'neutral' },
          { label: 'Gross Margin', value: monthMargin, formattedValue: `${monthMargin}%`, trend: 'positive' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'How are my sales today?',
          'What is my best-selling product?',
          'Who owes me money?',
        ],
      };
    }

    if (
      q.includes('today') ||
      q.includes('sell today') ||
      q.includes('sold today') ||
      q.includes('sales today') ||
      q.includes('revenue today') ||
      q.includes('how are my sales today')
    ) {
      const revToday = Number(todaySales.revenue ?? dailyBrief.todayMetrics?.revenueToday ?? 0);
      const txToday = Number(todaySales.salesCount ?? dailyBrief.todayMetrics?.transactionCountToday ?? 0);
      const cashToday = Number(todaySales.cashCollected ?? dailyBrief.todayMetrics?.cashCollectedToday ?? 0);

      if (txToday === 0) {
        return {
          answer: `No sales have been recorded yet today for **${ctx.businessName}** (${currency} 0 across 0 orders).\n\nIf you have completed transactions today that have not yet been rung up, make sure they are entered in the **POS / Sales** module.`,
          keyMetrics: [
            { label: "Today's Revenue", value: 0, formattedValue: `${currency} 0`, trend: 'neutral' },
            { label: "Today's Orders", value: 0, formattedValue: '0', trend: 'neutral' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: [
            'What is my best-selling product?',
            'Which products are low on stock?',
            'Who owes me money?',
          ],
        };
      }

      return {
        answer: `Today, **${ctx.businessName}** has recorded **${currency} ${revToday.toLocaleString()}** in sales across **${txToday}** customer order(s), with **${currency} ${cashToday.toLocaleString()}** collected in cash.`,
        keyMetrics: [
          { label: "Today's Revenue", value: revToday, formattedValue: `${currency} ${revToday.toLocaleString()}`, trend: 'positive' },
          { label: "Today's Orders", value: txToday, formattedValue: `${txToday}`, trend: 'positive' },
          { label: 'Cash Collected', value: cashToday, formattedValue: `${currency} ${cashToday.toLocaleString()}`, trend: 'positive' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'What is my best-selling product?',
          'Who owes me money?',
          'Which products are low on stock?',
        ],
      };
    }

    // =========================================================================
    // 8. INVENTORY & STOCKOUTS ("Which products are low on stock?")
    // =========================================================================
    if (
      q.includes('low stock') ||
      q.includes('running low') ||
      q.includes('out of stock') ||
      q.includes('stock level') ||
      q.includes('stockout') ||
      q.includes('reorder')
    ) {
      const outCount = Number(inv.outOfStockCount || 0);
      const lowCount = Number(inv.lowStockCount || 0);
      const criticalItems = (inv.criticalItemsToRestock || []) as Array<{ name: string; currentStock: number; minimumStockLevel: number; status: string }>;
      const totalSKUs = Number(inv.totalActiveSKUs || 0);

      if (outCount === 0 && lowCount === 0) {
        return {
          answer: `All **${totalSKUs} active product SKUs** in your catalog are adequately stocked with zero low-stock or out-of-stock alerts.`,
          keyMetrics: [
            { label: 'Out of Stock', value: 0, formattedValue: '0', trend: 'positive' },
            { label: 'Low Stock', value: 0, formattedValue: '0', trend: 'positive' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: [
            'What is my best-selling product?',
            'How are my sales today?',
          ],
        };
      }

      const itemsList = criticalItems
        .map((item) => `- **${item.name}**: ${item.currentStock} unit(s) remaining (${item.status === 'OUT_OF_STOCK' ? '🔴 Depleted' : `⚠️ Below minimum of ${item.minimumStockLevel}`})`)
        .join('\n');

      return {
        answer: `You currently have **${outCount} item(s) completely depleted** and **${lowCount} item(s) running below their safety threshold**:\n\n${itemsList}\n\nI recommend prioritizing purchase orders for depleted items that drive regular customer foot traffic.`,
        keyMetrics: [
          { label: 'Out of Stock', value: outCount, formattedValue: `${outCount}`, trend: outCount > 0 ? 'negative' : 'positive' },
          { label: 'Low Stock', value: lowCount, formattedValue: `${lowCount}`, trend: lowCount > 0 ? 'negative' : 'positive' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'What is my best-selling product?',
          'How are my sales today?',
          'What is my FIFO inventory valuation?',
        ],
      };
    }

    // =========================================================================
    // 9. RECEIVABLES & DEBTORS ("Who owes me money?")
    // =========================================================================
    if (
      q.includes('who owes') ||
      q.includes('debt') ||
      q.includes('debtor') ||
      q.includes('unpaid') ||
      q.includes('receivable') ||
      q.includes('owe me')
    ) {
      const totalDebt = Number(debtors.totalOutstandingDebt || 0);
      const debtorCount = Number(debtors.debtorsCount || 0);
      const topList = (debtors.topDebtors || []) as Array<{ name: string; debtAmount: number; phone?: string }>;

      if (debtorCount === 0 || totalDebt === 0) {
        return {
          answer: `You currently have **no outstanding customer debts** (0 unpaid balances recorded).`,
          keyMetrics: [
            { label: 'Outstanding Debt', value: 0, formattedValue: `${currency} 0`, trend: 'positive' },
            { label: 'Debtor Accounts', value: 0, formattedValue: '0', trend: 'positive' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: ['How are my sales today?', 'Which products are low on stock?'],
        };
      }

      const debtorBreakdown = topList
        .map((d, i) => `${i + 1}. **${d.name}**: ${currency} ${Number(d.debtAmount).toLocaleString()}${d.phone ? ` (${d.phone})` : ''}`)
        .join('\n');

      return {
        answer: `You currently have **${debtorCount} customer account(s)** with outstanding credit balances totaling **${currency} ${totalDebt.toLocaleString()}**:\n\n${debtorBreakdown}\n\nReaching out to these customers will help recover working capital for inventory purchases.`,
        keyMetrics: [
          { label: 'Outstanding Receivables', value: totalDebt, formattedValue: `${currency} ${totalDebt.toLocaleString()}`, trend: 'negative' },
          { label: 'Debtor Accounts', value: debtorCount, formattedValue: `${debtorCount}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: ['How are my sales today?', 'What is my current cash flow?'],
      };
    }

    // =========================================================================
    // 10. FULL BUSINESS ANALYSIS (Explicit report mode only)
    // =========================================================================
    if (isExplicitReport) {
      const totalRev = Number(overview.revenue || salesSummary.totalRevenue || 0);
      const txCount = Number(overview.transaction_count || salesSummary.transactionCount || 0);
      const grossProfit = Number(overview.gross_profit || 0);
      const grossMargin = Number(overview.gross_margin || 0);
      const outCount = Number(inv.outOfStockCount || 0);
      const totalDebt = Number(debtors.totalOutstandingDebt || 0);

      return {
        answer: `### Executive Summary\n**${ctx.businessName}** generated **${currency} ${totalRev.toLocaleString()}** in revenue across **${txCount}** completed transaction(s) over the last 30 days, achieving a **${grossMargin}% gross margin** (${currency} ${grossProfit.toLocaleString()} gross profit).\n\n### Analytical Diagnostics & Data Breakdown\n- **Revenue Volume:** ${currency} ${totalRev.toLocaleString()} (${txCount} transactions)\n- **Gross Margin:** **${grossMargin}%**\n- **Inventory Health:** ${outCount} depleted SKU(s)\n- **Receivables Exposure:** ${currency} ${totalDebt.toLocaleString()} in open customer credit\n\n### Strategic Recommendations\n1. **Protect Top Sellers:** Restock any depleted SKUs to avoid lost sales.\n2. **Collect Open Debts:** Send payment reminders to debtor accounts to recover liquid cash.\n3. **Maintain Margin Discipline:** Ensure sales prices cover rising replacement costs.`,
        keyMetrics: [
          { label: 'Revenue (30d)', value: totalRev, formattedValue: `${currency} ${totalRev.toLocaleString()}`, trend: 'positive' },
          { label: 'Gross Margin', value: grossMargin, formattedValue: `${grossMargin}%`, trend: grossMargin >= 30 ? 'positive' : 'neutral' },
          { label: 'Transactions', value: txCount, formattedValue: `${txCount}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: [
          'What is my best-selling product?',
          'Which products are low on stock?',
          'How are my sales today?',
        ],
      };
    }

    // =========================================================================
    // 11. GENERAL BUSINESS OVERVIEW / STATUS (Conversational default)
    // =========================================================================
    const totalRev = Number(overview.revenue || salesSummary.totalRevenue || 0);
    const txCount = Number(overview.transaction_count || salesSummary.transactionCount || 0);
    const grossMargin = Number(overview.gross_margin || 0);

    return {
      answer: `Over the past 30 days, **${ctx.businessName}** has generated **${currency} ${totalRev.toLocaleString()}** across **${txCount}** transaction(s) with an operating gross margin of **${grossMargin}%**.\n\nWhat specific part of your business would you like to explore? I can check today's sales, product profitability, low inventory, or customer debts.`,
      keyMetrics: [
        { label: 'Revenue (30d)', value: totalRev, formattedValue: `${currency} ${totalRev.toLocaleString()}`, trend: 'positive' },
        { label: 'Gross Margin', value: grossMargin, formattedValue: `${grossMargin}%`, trend: 'neutral' },
      ],
      confidence: txCount > 0 ? 'high_confidence' : 'insufficient_data',
      responseSource: 'DETERMINISTIC_FALLBACK',
      provider: 'deterministic_fallback',
      followUpSuggestions: [
        'How are my sales today?',
        'What is my best-selling product?',
        'Which products are low on stock?',
        'Who owes me money?',
      ],
    };
  }

  /**
   * Generates the Daily Business Brief summary.
   */
  public static async generateDailyBrief(ctx: ChatReasoningContext): Promise<AIDailyBrief> {
    const briefFacts = (ctx.toolResults.get_daily_brief_facts || {}) as any;
    const currency = ctx.currency || 'XAF';

    const revenue = Number(briefFacts.todayMetrics?.revenueToday ?? 0);
    const transactions = Number(briefFacts.todayMetrics?.transactionCountToday ?? 0);
    const amountCollected = Number(briefFacts.todayMetrics?.cashCollectedToday ?? 0);
    const expenses = Number(briefFacts.todayMetrics?.expensesToday ?? 0);
    const outstandingReceivables = Number(briefFacts.debtorAlerts?.totalOutstandingDebt ?? 0);

    const inventoryAlerts: string[] = [];
    if (briefFacts.inventoryAlerts?.criticalItemsToRestock?.length) {
      for (const item of briefFacts.inventoryAlerts.criticalItemsToRestock.slice(0, 4)) {
        inventoryAlerts.push(`${item.name} (${item.currentStock} remaining - ${item.status})`);
      }
    }

    const debtFollowUps: string[] = [];
    if (briefFacts.debtorAlerts?.topDebtors?.length) {
      for (const debtor of briefFacts.debtorAlerts.topDebtors.slice(0, 3)) {
        debtFollowUps.push(`${debtor.name} owes ${currency} ${Number(debtor.debtAmount).toLocaleString()}`);
      }
    }

    const headline = transactions > 0
      ? `${transactions} transaction(s) logged today generating ${currency} ${revenue.toLocaleString()}`
      : `No transactions recorded yet today for ${ctx.businessName}`;

    const keyTakeaways: string[] = [
      `Today's Revenue: ${currency} ${revenue.toLocaleString()} across ${transactions} order(s)`,
      `Cash Collected: ${currency} ${amountCollected.toLocaleString()}`,
    ];

    if (outstandingReceivables > 0) {
      keyTakeaways.push(`Open Customer Debt: ${currency} ${outstandingReceivables.toLocaleString()} across ${briefFacts.debtorAlerts?.debtorsCount || 0} account(s)`);
    }

    const recommendedFocusToday = inventoryAlerts.length > 0
      ? `Review depleted inventory items to prevent missed sales.`
      : outstandingReceivables > 0
      ? `Follow up with top debtor accounts to recover working capital.`
      : `Focus on customer checkout service and recording daily transactions.`;

    return {
      generatedAt: new Date().toISOString(),
      businessName: ctx.businessName,
      currency,
      headline,
      executiveSummary: `${ctx.businessName} has recorded ${transactions} order(s) today generating ${currency} ${revenue.toLocaleString()}. ${inventoryAlerts.length > 0 ? `${inventoryAlerts.length} product(s) require inventory replenishment.` : 'Catalog inventory is adequately stocked.'}`,
      performanceSnapshot: {
        revenue,
        transactions,
        amountCollected,
        expenses,
        outstandingReceivables,
      },
      keyTakeaways,
      inventoryAlerts,
      debtFollowUps,
      recommendedFocusToday,
      confidence: 'high_confidence',
    };
  }
}
