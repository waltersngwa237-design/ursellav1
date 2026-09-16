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
  language?: 'en' | 'fr';
  toolResults: Record<string, unknown>;
  osContext?: any;
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

FULL APP BUSINESS OPERATING SYSTEM SCOPE:
- You have comprehensive visibility into the entire store OS and all functional domains:
  * Sales velocity across all time horizons: Today, This Week, This Month, Last 30 Days, Year-to-Date, and All-Time.
  * Inventory valuation & stock health: Total SKUs, valuation at cost (FIFO), valuation at retail, low-stock alerts, and out-of-stock items.
  * Customer accounts & receivables: Total outstanding customer debt, active debtor accounts, and individual balances.
  * Operating expenditures: Total expenses, expense counts, and category breakdowns.
  * Exact financial calculations:
    - Gross Profit = Revenue - FIFO Cost of Goods Sold (COGS)
    - Gross Margin % = (Gross Profit / Revenue) * 100
    - Net Profit = Gross Profit - Operating Expenses
    - Net Margin % = (Net Profit / Revenue) * 100
    - Cash Flow = Cash Collected - Cash Outflows
- CRITICAL TEMPORAL SCOPE:
  * NEVER restrict your analysis to "today's sales" unless the merchant explicitly asked about today!
  * If the merchant asks general questions like "How are my sales?", "What is my profit?", "How is my store doing?", or "Give me a summary", answer with the comprehensive financial ledger, multi-period performance, and operational health.

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

6. BILINGUAL REASONING & LOCALIZATION (ENGLISH & FRENCH):
- Preferred Session Language: ${ctx.language === 'fr' ? 'FRENCH (Français)' : 'ENGLISH (Auto-detect from query)'}.
- If the merchant speaks in French OR the preferred language is 'fr', you MUST reason, compute, explain, and respond entirely in natural, polished, native French business terminology.
- Use precise French accounting & retail terms:
  * Revenue -> "Chiffre d'affaires"
  * Gross Profit & Margin -> "Marge brute" & "Taux de marge brute"
  * FIFO Purchase Cost -> "Coût d'achat PEPS (Premier Entré, Premier Sorti)"
  * Cost of Goods Sold -> "Coût des marchandises vendues (CMV)"
  * Net Profit -> "Bénéfice net"
  * Operating Expenses -> "Dépenses d'exploitation" / "Charges"
  * Customer Receivables / Debtors -> "Créances clients" / "Débiteurs" / "Dettes impayées"
  * Low Stock / Out of Stock -> "Stock faible" / "Rupture de stock"
  * Cash Register / Checkout -> "Caisse" / "Ticket de caisse"
- Format numbers and currency naturally according to French locale conventions (e.g., "15 000 FCFA" or "${ctx.currency} 15 000").
- If followUpSuggestions are generated in French, phrase them from the user's perspective (e.g., "Vérifier les ventes de la semaine", "Qui me doit de l'argent ?", "Voir les articles en rupture", "Calculer ma marge brute").
- If the merchant speaks in English, answer in English.

7. OUTPUT FORMAT:
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

8. FOLLOW-UP SUGGESTIONS PERSPECTIVE (CRITICAL):
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
    const isFr =
      ctx.language === 'fr' ||
      /[\b\s](bonjour|salut|bonsoir|merci|ventes|chiffre|bénéfice|benefice|marge|dépenses|depenses|créances|creances|débiteurs|debiteurs|stock|combien|comment|pourquoi|produits|caisse|ce mois|cette semaine|aujourd'hui|aujourdhui)[\b\s]/i.test(
        q
      );

    const fmtNum = (n: number) =>
      isFr ? Number(n || 0).toLocaleString('fr-FR') : Number(n || 0).toLocaleString('en-US');
    const fmtCur = (n: number) =>
      isFr
        ? `${fmtNum(n)} ${currency === 'XAF' ? 'FCFA' : currency}`
        : `${currency} ${fmtNum(n)}`;

    // New OS-wide domain tools & full OS context
    const ledger = (ctx.toolResults.get_financial_ledger || {}) as any;
    const invHealth = (ctx.toolResults.get_inventory_health || {}) as any;
    const debtorSummary = (ctx.toolResults.get_debtor_and_receivables_summary || {}) as any;
    const expenseBreakdown = (ctx.toolResults.get_expense_breakdown || {}) as any;
    const osContext = (ctx.osContext || ctx.toolResults.comprehensive_os_context || {}) as any;
    const osFin = osContext?.financialSummary;
    const osToday = osContext?.todayFacts;
    const osAllTime = osContext?.allTimeFacts;
    const osInv = osContext?.inventoryFacts;
    const osCustomers = osContext?.customerFacts;
    const osExpenses = osContext?.expenseFacts;

    // =========================================================================
    // 1. GREETINGS & CHIT-CHAT (Conversational, no report headers, no database queries)
    // =========================================================================
    if (
      ctx.parsedIntent?.intent === 'greeting' ||
      /^(hello|hi|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|salut|bonjour|yo|hola)[\s!.,?]*$/i.test(q) ||
      /^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+are\s+you|what\s+is\s+ursella|help)[\s!.,?]*$/i.test(q)
    ) {
      if (isFr) {
        return {
          answer: `Bonjour ! Je suis votre conseiller Ursella IA pour **${ctx.businessName}**.\n\nJe peux vous aider à consulter vos ventes en direct, identifier les produits en rupture de stock à réapprovisionner, suivre les dettes de vos clients, analyser vos marges bénéficiaires ou valoriser votre inventaire avec la méthode PEPS (FIFO). Que souhaitez-vous analyser aujourd'hui ?`,
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [],
          recommendations: [],
          followUpSuggestions: [
            'Comment se portent mes ventes ?',
            'Quel est mon produit le plus vendu ?',
            'Quels sont les produits en rupture de stock ?',
            'Qui me doit de l’argent ?',
          ],
        };
      }

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
      let targetName = isFr ? 'le tableau de bord principal' : 'the main dashboard';
      if (q.includes('inventory') || q.includes('product') || q.includes('catalog') || q.includes('stock') || q.includes('produit')) {
        targetName = isFr ? '**Stock & Catalogue**' : '**Inventory & Products**';
      } else if (q.includes('sale') || q.includes('order') || q.includes('vente')) {
        targetName = isFr ? '**Ventes & Commandes**' : '**Sales & Orders**';
      } else if (q.includes('pos') || q.includes('caisse')) {
        targetName = isFr ? '**Caisse / Point de Vente**' : '**POS / Point of Sale**';
      } else if (q.includes('debt') || q.includes('customer') || q.includes('client') || q.includes('dette') || q.includes('creance')) {
        targetName = isFr ? '**Clients & Débiteurs**' : '**Customers & Credit**';
      } else if (q.includes('expense') || q.includes('charge') || q.includes('depense')) {
        targetName = isFr ? '**Dépenses**' : '**Expenses**';
      } else if (q.includes('setting') || q.includes('parametre')) {
        targetName = isFr ? '**Paramètres**' : '**Settings**';
      }

      return {
        answer: isFr
          ? `Vous pouvez accéder à ${targetName} directement depuis le menu de navigation de votre application.`
          : `You can access ${targetName} directly from the navigation menu on the left side of your screen.`,
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        keyMetrics: [],
        recommendations: [],
        followUpSuggestions: isFr
          ? ['Comment se portent mes ventes ?', 'Quels sont les produits en rupture de stock ?']
          : ['How are my sales today?', 'Which products are low on stock?'],
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
      q.includes('most sold') ||
      q.includes('plus vendu') ||
      q.includes('meilleur produit') ||
      q.includes('meilleure vente')
    ) {
      if (!products || products.length === 0) {
        return {
          answer: isFr
            ? `Vous n'avez pas encore de ventes de produits enregistrées dans votre catalogue. Dès que vous enregistrerez des ventes via la caisse ou les commandes, vos articles les plus populaires apparaîtront ici.`
            : `You do not have any recorded product sales in your catalog yet. Once you record sales through POS or Orders, I'll identify your fastest-moving items here.`,
          keyMetrics: [],
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: isFr
            ? ['Comment se portent mes ventes ?', 'Quels sont les produits en rupture de stock ?']
            : ['How are my sales today?', 'Which products are low on stock?'],
        };
      }

      // Sort by units sold (volume)
      const sortedByVolume = [...products].sort((a, b) => (b.unitsSold || 0) - (a.unitsSold || 0));
      const topVolume = sortedByVolume[0];

      return {
        answer: isFr
          ? `Votre produit le plus vendu en volume est **${topVolume.name}** avec **${fmtNum(topVolume.unitsSold || 0)} unité(s) vendue(s)**, générant **${fmtCur(Number(topVolume.revenue || 0))}** de chiffre d'affaires (marge unitaire brute : **${topVolume.marginPct || 0}%**).\n\nIl vous reste actuellement **${fmtNum(topVolume.stockQuantity || 0)} unité(s)** en stock.`
          : `Your best-selling product by volume is **${topVolume.name}** with **${topVolume.unitsSold || 0} unit(s) sold**, generating **${currency} ${Number(topVolume.revenue || 0).toLocaleString()}** in revenue (unit gross margin: **${topVolume.marginPct || 0}%**).\n\nYou currently have **${topVolume.stockQuantity || 0} unit(s)** remaining in stock.`,
        keyMetrics: [
          { label: isFr ? 'Unités Vendues' : 'Units Sold', value: topVolume.unitsSold || 0, formattedValue: `${fmtNum(topVolume.unitsSold || 0)}`, trend: 'positive' },
          { label: isFr ? "Chiffre d'Affaires" : 'Revenue', value: Number(topVolume.revenue || 0), formattedValue: fmtCur(Number(topVolume.revenue || 0)), trend: 'positive' },
          { label: isFr ? 'Stock Disponible' : 'Units on Hand', value: topVolume.stockQuantity || 0, formattedValue: `${fmtNum(topVolume.stockQuantity || 0)}`, trend: (topVolume.stockQuantity || 0) > 5 ? 'positive' : 'negative' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quel produit me rapporte le plus ?', 'Quels sont les produits en rupture de stock ?', 'Comment se portent mes ventes ?']
          : [
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
      q.includes('highest margin product') ||
      q.includes('rapporte le plus') ||
      q.includes('plus rentable') ||
      q.includes('meilleure marge')
    ) {
      if (!products || products.length === 0) {
        return {
          answer: isFr
            ? `Aucune donnée de marge de produit n'est encore enregistrée. Dès que les coûts d'achat et les prix de vente seront configurés, vos plus forts contributeurs de profit apparaîtront ici.`
            : `No product margin data is recorded in your catalog yet. Once purchase costs and sales prices are established, your highest profit contributors will be tracked here.`,
          keyMetrics: [],
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: isFr
            ? ['Comment se portent mes ventes ?', 'Quels sont les produits en rupture de stock ?']
            : ['How are my sales today?', 'Which products are low on stock?'],
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
        answer: isFr
          ? `Votre produit le plus performant en bénéfice brut est **${topProfit.name}**, générant **${fmtCur(Number(gp))}** de bénéfice (${fmtNum(topProfit.unitsSold || 0)} unités vendues avec une marge de **${topProfit.marginPct || 0}%**).\n\nLe stock actuel disponible est de **${fmtNum(topProfit.stockQuantity || 0)} unité(s)**.`
          : `Your strongest product by gross profit is **${topProfit.name}**, generating **${currency} ${Number(gp).toLocaleString()}** in profit (${topProfit.unitsSold || 0} units sold at a **${topProfit.marginPct || 0}%** margin).\n\nCurrent stock on hand is **${topProfit.stockQuantity || 0} unit(s)**.`,
        keyMetrics: [
          { label: isFr ? 'Bénéfice Brut' : 'Gross Profit', value: gp, formattedValue: fmtCur(Number(gp)), trend: 'positive' },
          { label: isFr ? 'Marge Brute' : 'Gross Margin', value: topProfit.marginPct || 0, formattedValue: `${topProfit.marginPct || 0}%`, trend: 'positive' },
          { label: isFr ? 'Stock Disponible' : 'Stock On Hand', value: topProfit.stockQuantity || 0, formattedValue: `${fmtNum(topProfit.stockQuantity || 0)}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quel est mon produit le plus vendu ?', 'Quels sont les produits en rupture de stock ?', 'Comment se portent mes ventes ?']
          : [
              'What is my best-selling product?',
              'Which products are low on stock?',
              'What about the hoodies?',
            ],
      };
    }

    // =========================================================================
    // 7A. PROFITABILITY, MARGINS & EARNINGS ("What is my profit?", "Am I making money?")
    // =========================================================================
    if (
      q.includes('profit') ||
      q.includes('margin') ||
      q.includes('earnings') ||
      q.includes('earn') ||
      q.includes('making money') ||
      q.includes('net income') ||
      q.includes('p&l') ||
      q.includes('bénéfice') ||
      q.includes('benefice') ||
      q.includes('marge') ||
      q.includes('rentabilité') ||
      q.includes('rentabilite') ||
      q.includes('gains') ||
      q.includes('résultat') ||
      q.includes('resultat')
    ) {
      const rev = Number(ledger.revenue ?? osFin?.totalRevenue ?? salesSummary.totalRevenue ?? overview.revenue ?? 0);
      const cogs = Number(ledger.cost_of_goods_sold ?? osFin?.costOfGoodsSold ?? overview.cost_of_goods_sold ?? 0);
      const grossProfit = Number(ledger.gross_profit ?? osFin?.grossProfit ?? (rev - cogs));
      const grossMarginPct = rev > 0 ? Number(((grossProfit / rev) * 100).toFixed(1)) : 0;
      const opExpenses = Number(ledger.operating_expenses ?? osFin?.totalExpenses ?? expenseBreakdown.totalExpenses ?? expenses.totalExpenses ?? 0);
      const netProfit = Number(ledger.estimated_net_profit ?? osFin?.netProfit ?? (grossProfit - opExpenses));
      const netMarginPct = rev > 0 ? Number(((netProfit / rev) * 100).toFixed(1)) : 0;
      const periodLabel = ledger.periodLabel || (q.includes('today') || q.includes("aujourd'hui") ? (isFr ? "Aujourd'hui" : 'Today') : q.includes('week') || q.includes('semaine') ? (isFr ? 'Cette semaine' : 'This Week') : q.includes('year') || q.includes('année') ? (isFr ? 'Cette année' : 'This Year') : (isFr ? '30 derniers jours' : 'Last 30 Days'));

      if (rev === 0 && opExpenses === 0) {
        return {
          answer: isFr
            ? `Aucune transaction de vente ni dépense opérationnelle n'a été enregistrée pour **${ctx.businessName}** sur la période sélectionnée (${periodLabel}).\n\nDès que des commandes seront enregistrées dans la **Caisse** et que des charges seront saisies dans **Dépenses**, vos calculs déterministes de bénéfice brut et net se mettront à jour automatiquement.`
            : `No sales transactions or operating expenses have been recorded for **${ctx.businessName}** in the selected period (${periodLabel}).\n\nOnce orders are recorded in the **POS** and overhead costs are logged in **Expenses**, your deterministic Gross and Net Profit calculations will update automatically.`,
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          keyMetrics: [
            { label: isFr ? "Chiffre d'Affaires" : 'Revenue', value: 0, formattedValue: fmtCur(0), trend: 'neutral' },
            { label: isFr ? 'Bénéfice Brut' : 'Gross Profit', value: 0, formattedValue: fmtCur(0), trend: 'neutral' },
            { label: isFr ? 'Bénéfice Net' : 'Net Profit', value: 0, formattedValue: fmtCur(0), trend: 'neutral' },
          ],
          followUpSuggestions: isFr
            ? ['Quelle est la valeur de mon stock ?', 'Quels produits sont en rupture de stock ?', 'Qui me doit de l’argent ?']
            : [
                'What is my inventory valuation?',
                'Which products are low on stock?',
                'Who owes me money?',
              ],
        };
      }

      const profitInsight = isFr
        ? (netProfit >= 0
            ? `Votre entreprise est bénéficiaire avec une **marge nette de ${netMarginPct}%** après déduction des charges opérationnelles.`
            : `Vos dépenses d'exploitation dépassent actuellement votre marge brute pour cette période, générant un déficit net de **${fmtCur(Math.abs(netProfit))}**.`)
        : (netProfit >= 0
            ? `Your store is operating profitably with a **${netMarginPct}% net margin** after accounting for overhead.`
            : `Your operating expenses currently exceed gross profit for this period, yielding a net deficit of **${currency} ${Math.abs(netProfit).toLocaleString()}**.`);

      return {
        answer: isFr
          ? `Pour la période **${periodLabel}**, **${ctx.businessName}** a réalisé un chiffre d'affaires de **${fmtCur(rev)}** pour un coût des marchandises vendues (PEPS/FIFO) de **${fmtCur(cogs)}**, générant un **bénéfice brut de ${fmtCur(grossProfit)} (${grossMarginPct}% de marge brute)**.\n\nAprès déduction de **${fmtCur(opExpenses)}** de charges d'exploitation, votre **bénéfice net estimé est de ${fmtCur(netProfit)} (${netMarginPct}% de marge nette)**.\n\n${profitInsight}`
          : `For **${periodLabel}**, **${ctx.businessName}** generated **${currency} ${rev.toLocaleString()}** in revenue with **${currency} ${cogs.toLocaleString()}** in FIFO Cost of Goods Sold, producing a **Gross Profit of ${currency} ${grossProfit.toLocaleString()} (${grossMarginPct}% gross margin)**.\n\nAfter accounting for **${currency} ${opExpenses.toLocaleString()}** in operating expenses, your **Estimated Net Profit is ${currency} ${netProfit.toLocaleString()} (${netMarginPct}% net margin)**.\n\n${profitInsight}`,
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        keyMetrics: [
          { label: isFr ? 'Bénéfice Brut' : 'Gross Profit', value: grossProfit, formattedValue: fmtCur(grossProfit), trend: grossProfit > 0 ? 'positive' : 'neutral' },
          { label: isFr ? 'Marge Brute' : 'Gross Margin', value: grossMarginPct, formattedValue: `${grossMarginPct}%`, trend: grossMarginPct >= 25 ? 'positive' : 'neutral' },
          { label: isFr ? "Dépenses d'Exploitation" : 'Operating Expenses', value: opExpenses, formattedValue: fmtCur(opExpenses), trend: 'neutral' },
          { label: isFr ? 'Bénéfice Net Estimé' : 'Estimated Net Profit', value: netProfit, formattedValue: fmtCur(netProfit), trend: netProfit >= 0 ? 'positive' : 'negative' },
        ],
        followUpSuggestions: isFr
          ? ['Quelles sont mes plus grandes dépenses ?', 'Quel produit me rapporte le plus ?', 'Quelle est la valeur de mon stock ?', 'Qui me doit de l’argent ?']
          : [
              'What are my biggest operating expenses?',
              'Which product makes me the most money?',
              'What is my inventory valuation?',
              'Who owes me money?',
            ],
      };
    }

    // =========================================================================
    // 7B. TODAY'S SALES & DAILY PULSE (Explicitly requested for today)
    // =========================================================================
    if (
      q.includes('today') ||
      q.includes('sell today') ||
      q.includes('sold today') ||
      q.includes('sales today') ||
      q.includes('revenue today') ||
      q.includes('how are my sales today') ||
      q.includes("aujourd'hui") ||
      q.includes('aujourdhui') ||
      q.includes('ventes du jour') ||
      q.includes('recette du jour')
    ) {
      const revToday = Number(todaySales.revenue ?? osToday?.todayRevenue ?? dailyBrief.todayMetrics?.revenueToday ?? 0);
      const txToday = Number(todaySales.salesCount ?? osToday?.todayTransactions ?? dailyBrief.todayMetrics?.transactionCountToday ?? 0);
      const cashToday = Number(todaySales.cashCollected ?? dailyBrief.todayMetrics?.cashCollectedToday ?? 0);

      if (txToday === 0) {
        return {
          answer: isFr
            ? `Aucune vente n'a encore été enregistrée aujourd'hui pour **${ctx.businessName}** (${fmtCur(0)} sur 0 commande).\n\nSi vous avez finalisé des transactions aujourd'hui qui n'ont pas encore été saisies, assurez-vous de les enregistrer dans le module **Caisse / Ventes**.`
            : `No sales have been recorded yet today for **${ctx.businessName}** (${currency} 0 across 0 orders).\n\nIf you have completed transactions today that have not yet been rung up, make sure they are entered in the **POS / Sales** module.`,
          keyMetrics: [
            { label: isFr ? "Ventes d'Aujourd'hui" : "Today's Revenue", value: 0, formattedValue: fmtCur(0), trend: 'neutral' },
            { label: isFr ? "Commandes d'Aujourd'hui" : "Today's Orders", value: 0, formattedValue: '0', trend: 'neutral' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: isFr
            ? ['Quelles sont mes ventes globales ce mois-ci ?', 'Quel est mon produit le plus vendu ?', 'Quels sont les produits en rupture de stock ?', 'Qui me doit de l’argent ?']
            : [
                'What are my overall sales this month?',
                'What is my best-selling product?',
                'Which products are low on stock?',
                'Who owes me money?',
              ],
        };
      }

      return {
        answer: isFr
          ? `Aujourd'hui, **${ctx.businessName}** a enregistré **${fmtCur(revToday)}** de chiffre d'affaires sur **${fmtNum(txToday)}** commande(s) client(s), avec **${fmtCur(cashToday)}** encaissés en espèces.`
          : `Today, **${ctx.businessName}** has recorded **${currency} ${revToday.toLocaleString()}** in sales across **${txToday}** customer order(s), with **${currency} ${cashToday.toLocaleString()}** collected in cash.`,
        keyMetrics: [
          { label: isFr ? "Ventes d'Aujourd'hui" : "Today's Revenue", value: revToday, formattedValue: fmtCur(revToday), trend: 'positive' },
          { label: isFr ? "Commandes d'Aujourd'hui" : "Today's Orders", value: txToday, formattedValue: `${fmtNum(txToday)}`, trend: 'positive' },
          { label: isFr ? 'Espèces Encaissées' : 'Cash Collected', value: cashToday, formattedValue: fmtCur(cashToday), trend: 'positive' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quelles sont mes ventes globales ce mois-ci ?', 'Quel est mon bénéfice ce mois-ci ?', 'Quels sont les produits en rupture de stock ?', 'Qui me doit de l’argent ?']
          : [
              'What are my overall sales this month?',
              'What is my profit this month?',
              'Which products are low on stock?',
              'Who owes me money?',
            ],
      };
    }

    // =========================================================================
    // 7C. MULTI-HORIZON & GENERAL SALES (This Week, This Month, Year, All-Time, or "How are my sales?")
    // =========================================================================
    if (
      q.includes('sales') ||
      q.includes('revenue') ||
      q.includes('this week') ||
      q.includes('this month') ||
      q.includes('this year') ||
      q.includes('all time') ||
      q.includes('total sales') ||
      q.includes('volume') ||
      q.includes('turnover') ||
      q.includes('ventes') ||
      q.includes('chiffre') ||
      q.includes('cette semaine') ||
      q.includes('ce mois') ||
      q.includes('cette annee') ||
      q.includes('cette année') ||
      q.includes('tout temps')
    ) {
      let period = isFr ? '30 Derniers Jours' : 'Last 30 Days';
      let rev = Number(ledger.revenue ?? salesSummary.totalRevenue ?? osFin?.totalRevenue ?? overview.revenue ?? 0);
      let txCount = Number(ledger.transaction_count ?? salesSummary.transactionCount ?? osFin?.transactionCount ?? overview.transaction_count ?? 0);
      let margin = Number(ledger.gross_margin ?? salesSummary.grossMarginPct ?? overview.gross_margin ?? 0);

      if (q.includes('all time') || q.includes('all-time') || q.includes('total sales') || q.includes('ever') || q.includes('tout temps')) {
        period = isFr ? 'Historique Total' : 'All-Time';
        if (osAllTime) {
          rev = Number(osAllTime.allTimeRevenue || rev);
          txCount = Number(osAllTime.allTimeTransactions || txCount);
          margin = Number(osAllTime.allTimeGrossMarginPct || margin);
        }
      } else if (q.includes('week') || q.includes('semaine')) {
        period = isFr ? 'Cette Semaine' : 'This Week';
      } else if (q.includes('year') || q.includes('année') || q.includes('annee')) {
        period = isFr ? 'Cette Année' : 'This Year';
      } else if (q.includes('month') || q.includes('mois')) {
        period = isFr ? 'Ce Mois' : 'This Month';
      }

      const aov = txCount > 0 ? Math.round(rev / txCount) : 0;
      const todayRev = Number(todaySales.revenue ?? osToday?.todayRevenue ?? 0);
      const todayTx = Number(todaySales.salesCount ?? osToday?.todayTransactions ?? 0);
      const todayNote = isFr
        ? (todayTx > 0
            ? `Le volume de ventes d'aujourd'hui s'élève actuellement à **${fmtCur(todayRev)}** sur ${fmtNum(todayTx)} transaction(s).`
            : `Aucune transaction n'a encore été enregistrée aujourd'hui.`)
        : (todayTx > 0
            ? `Today's sales volume currently stands at **${currency} ${todayRev.toLocaleString()}** across ${todayTx} transaction(s).`
            : `No transactions have been logged yet today.`);

      return {
        answer: isFr
          ? `Pour la période **${period}**, **${ctx.businessName}** a généré **${fmtCur(rev)}** de chiffre d'affaires sur **${fmtNum(txCount)}** commande(s) client(s), avec un panier moyen de **${fmtCur(aov)}** et une marge brute moyenne de **${margin}%**.\n\n${todayNote}`
          : `For the **${period}** period, **${ctx.businessName}** has generated **${currency} ${rev.toLocaleString()}** in sales across **${txCount}** customer order(s), with an average order value of **${currency} ${aov.toLocaleString()}** and an average gross margin of **${margin}%**.\n\n${todayNote}`,
        keyMetrics: [
          { label: isFr ? `CA (${period})` : `${period} Revenue`, value: rev, formattedValue: fmtCur(rev), trend: rev > 0 ? 'positive' : 'neutral' },
          { label: isFr ? 'Transactions' : 'Transactions', value: txCount, formattedValue: `${fmtNum(txCount)}`, trend: 'neutral' },
          { label: isFr ? 'Panier Moyen' : 'Average Order Value', value: aov, formattedValue: fmtCur(aov), trend: 'neutral' },
          { label: isFr ? 'Marge Brute' : 'Gross Margin', value: margin, formattedValue: `${margin}%`, trend: margin >= 25 ? 'positive' : 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quel est mon bénéfice net ?', 'Quelles sont mes plus grandes dépenses ?', 'Quel produit me rapporte le plus ?', 'Quelle est la valeur de mon stock ?']
          : [
              'What is my net profit?',
              'What are my biggest operating expenses?',
              'Which product makes me the most money?',
              'What is my inventory valuation?',
            ],
      };
    }

    // =========================================================================
    // 8A. OPERATING EXPENSES & OVERHEAD BREAKDOWN ("What are my expenses?")
    // =========================================================================
    if (
      q.includes('expense') ||
      q.includes('spending') ||
      q.includes('spent') ||
      q.includes('operating cost') ||
      q.includes('overhead') ||
      q.includes('bills') ||
      q.includes('dépenses') ||
      q.includes('depenses') ||
      q.includes('charges') ||
      q.includes('frais') ||
      q.includes('factures')
    ) {
      const totalExp = Number(expenseBreakdown.totalExpenses ?? expenses.totalExpenses ?? osExpenses?.totalExpensesThisMonth ?? 0);
      const expCount = Number(expenseBreakdown.expenseCount ?? expenses.expenseCount ?? osExpenses?.expenseCountThisMonth ?? 0);
      const byCat = (expenseBreakdown.expensesByCategory || []) as Array<{ category: string; amount: number; percentage: number }>;

      if (totalExp === 0) {
        return {
          answer: isFr
            ? `Aucune dépense d'exploitation n'est actuellement enregistrée pour **${ctx.businessName}** sur cette période.\n\nEnregistrer le loyer, l'électricité, le transport et les achats de consommables dans la page **Dépenses** permet de refléter la rentabilité réelle de votre activité.`
            : `No operating expenses are currently recorded for **${ctx.businessName}** in this period.\n\nRecording rent, utilities, transport, and supplier payments in the **Expenses** page helps ensure your net profit figures reflect true business reality.`,
          keyMetrics: [
            { label: isFr ? 'Total Dépenses' : 'Total Expenses', value: 0, formattedValue: fmtCur(0), trend: 'positive' },
            { label: isFr ? 'Lignes de Dépenses' : 'Expense Records', value: 0, formattedValue: '0', trend: 'neutral' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: isFr
            ? ['Quel est mon bénéfice brut ?', 'Quelle est la valeur de mon stock ?', 'Qui me doit de l’argent ?']
            : [
                'What is my gross profit?',
                'What is my inventory valuation?',
                'Who owes me money?',
              ],
        };
      }

      let catBreakdown = '';
      if (byCat.length > 0) {
        catBreakdown = isFr
          ? '\n\n**Répartition par Catégorie :**\n' +
            byCat.slice(0, 5).map((c) => `- **${c.category}**: ${fmtCur(Number(c.amount))} (${c.percentage}%)`).join('\n')
          : '\n\n**Breakdown by Category:**\n' +
            byCat.slice(0, 5).map((c) => `- **${c.category}**: ${currency} ${Number(c.amount).toLocaleString()} (${c.percentage}%)`).join('\n');
      }

      return {
        answer: isFr
          ? `Vos dépenses d'exploitation enregistrées totalisent **${fmtCur(totalExp)}** réparties sur **${fmtNum(expCount)}** entrée(s) de charge.${catBreakdown}\n\nMaîtriser vos charges fixes et variables est essentiel pour protéger votre marge nette.`
          : `Your recorded operating expenses total **${currency} ${totalExp.toLocaleString()}** across **${expCount}** logged expense item(s).${catBreakdown}\n\nKeeping non-inventory overhead in check is essential for protecting your net profit margins.`,
        keyMetrics: [
          { label: isFr ? 'Total Dépenses' : 'Total Expenses', value: totalExp, formattedValue: fmtCur(totalExp), trend: 'neutral' },
          { label: isFr ? 'Nombre de Dépenses' : 'Expense Entries', value: expCount, formattedValue: `${fmtNum(expCount)}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quel est mon bénéfice net ?', 'Quelle est ma marge brute ?', 'Comment se portent mes ventes aujourd’hui ?']
          : [
              'What is my net profit?',
              'What is my gross margin?',
              'How are my sales today?',
            ],
      };
    }

    // =========================================================================
    // 8B. INVENTORY VALUATION & CATALOG ASSETS ("How much is my stock worth?")
    // =========================================================================
    if (
      q.includes('inventory value') ||
      q.includes('stock value') ||
      q.includes('worth') ||
      q.includes('catalog value') ||
      q.includes('how much stock') ||
      q.includes('inventory valuation') ||
      q.includes('valeur du stock') ||
      q.includes('valeur inventaire') ||
      q.includes('vaut mon stock') ||
      q.includes('valorisation')
    ) {
      const costVal = Number(invHealth.totalCostValuation ?? osInv?.totalCatalogValueAtCost ?? 0);
      const retailVal = Number(invHealth.totalRetailValuation ?? osInv?.totalCatalogValueAtRetail ?? 0);
      const totalSKUs = Number(invHealth.totalActiveSKUs ?? osInv?.totalActiveProducts ?? products.length ?? 0);
      const lowCount = Number(invHealth.lowStockCount ?? inv.lowStockCount ?? osInv?.lowStockCount ?? 0);
      const outCount = Number(invHealth.outOfStockCount ?? inv.outOfStockCount ?? osInv?.outOfStockCount ?? 0);
      const potentialProfit = retailVal - costVal;

      return {
        answer: isFr
          ? `Votre catalogue comprend actuellement **${fmtNum(totalSKUs)} référence(s) active(s)** pour une valorisation au coût d'acquisition (PEPS / FIFO) de **${fmtCur(costVal)}**.\n\nAux prix de vente actuels, ce stock représente **${fmtCur(retailVal)}** de valeur marchande brute, soit **${fmtCur(potentialProfit)}** de bénéfice brut potentiel une fois entièrement écoulé.\n\nActuellement, vous avez **${fmtNum(lowCount)} produit(s) en stock faible** et **${fmtNum(outCount)} référence(s) en rupture totale**.`
          : `Your inventory catalog currently consists of **${totalSKUs} active SKU(s)** with a total acquisition cost valuation (FIFO) of **${currency} ${costVal.toLocaleString()}**.\n\nAt current retail pricing, this stock represents **${currency} ${retailVal.toLocaleString()}** in gross catalog value, representing **${currency} ${potentialProfit.toLocaleString()}** in potential gross profit when completely sold.\n\nCurrently, you have **${lowCount} low-stock item(s)** and **${outCount} depleted SKU(s)**.`,
        keyMetrics: [
          { label: isFr ? "Valeur au Coût (PEPS)" : 'Valuation at Cost (FIFO)', value: costVal, formattedValue: fmtCur(costVal), trend: 'neutral' },
          { label: isFr ? 'Valeur Marchande' : 'Valuation at Retail', value: retailVal, formattedValue: fmtCur(retailVal), trend: 'positive' },
          { label: isFr ? 'Marge Brute Potentielle' : 'Potential Gross Profit', value: potentialProfit, formattedValue: fmtCur(potentialProfit), trend: 'positive' },
          { label: isFr ? 'Articles Actifs' : 'Active SKUs', value: totalSKUs, formattedValue: `${fmtNum(totalSKUs)}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quels produits sont en rupture de stock ?', 'Quel est mon produit le plus vendu ?', 'Quel est mon bénéfice net ?']
          : [
              'Which products are low on stock?',
              'What is my best-selling product?',
              'What is my net profit?',
            ],
      };
    }

    // =========================================================================
    // 8C. INVENTORY & STOCKOUTS ("Which products are low on stock?")
    // =========================================================================
    if (
      q.includes('low stock') ||
      q.includes('running low') ||
      q.includes('out of stock') ||
      q.includes('stock level') ||
      q.includes('stockout') ||
      q.includes('reorder') ||
      q.includes('rupture') ||
      q.includes('faible') ||
      q.includes('reapprovisionner') ||
      q.includes('réapprovisionner') ||
      q.includes('niveau de stock')
    ) {
      const outCount = Number(invHealth.outOfStockCount ?? inv.outOfStockCount ?? osInv?.outOfStockCount ?? 0);
      const lowCount = Number(invHealth.lowStockCount ?? inv.lowStockCount ?? osInv?.lowStockCount ?? 0);
      const criticalItems = (invHealth.criticalRestockAlerts || inv.criticalItemsToRestock || []) as Array<{ name: string; currentStock: number; minimumStockLevel: number; status: string }>;
      const totalSKUs = Number(invHealth.totalActiveSKUs ?? inv.totalActiveSKUs ?? osInv?.totalActiveProducts ?? 0);

      if (outCount === 0 && lowCount === 0) {
        return {
          answer: isFr
            ? `Toutes les **${fmtNum(totalSKUs)} références actives** de votre catalogue sont convenablement approvisionnées, avec zéro alerte de stock faible ou de rupture.`
            : `All **${totalSKUs} active product SKUs** in your catalog are adequately stocked with zero low-stock or out-of-stock alerts.`,
          keyMetrics: [
            { label: isFr ? 'En Rupture' : 'Out of Stock', value: 0, formattedValue: '0', trend: 'positive' },
            { label: isFr ? 'Stock Faible' : 'Low Stock', value: 0, formattedValue: '0', trend: 'positive' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: isFr
            ? ['Quelle est la valeur de mon stock ?', 'Quel est mon produit le plus vendu ?', 'Quel est mon bénéfice net ?']
            : [
                'What is my inventory valuation?',
                'What is my best-selling product?',
                'What is my net profit?',
              ],
        };
      }

      const itemsList = isFr
        ? criticalItems
            .map((item) => `- **${item.name}**: ${fmtNum(item.currentStock)} unité(s) restante(s) (${item.status === 'OUT_OF_STOCK' ? '🔴 Rupture totale' : `⚠️ Sous le seuil de sécurité`})`)
            .join('\n')
        : criticalItems
            .map((item) => `- **${item.name}**: ${item.currentStock} unit(s) remaining (${item.status === 'OUT_OF_STOCK' ? '🔴 Depleted' : `⚠️ Below minimum threshold`})`)
            .join('\n');

      return {
        answer: isFr
          ? `Vous avez actuellement **${fmtNum(outCount)} article(s) en rupture totale** et **${fmtNum(lowCount)} article(s) sous le seuil d'alerte** :\n\n${itemsList}\n\nJe vous recommande de prioriser les commandes de réapprovisionnement pour vos produits moteurs.`
          : `You currently have **${outCount} item(s) completely depleted** and **${lowCount} item(s) running below safety thresholds**:\n\n${itemsList}\n\nI recommend prioritizing purchase orders for high-demand items that drive recurring foot traffic.`,
        keyMetrics: [
          { label: isFr ? 'En Rupture' : 'Out of Stock', value: outCount, formattedValue: `${fmtNum(outCount)}`, trend: outCount > 0 ? 'negative' : 'positive' },
          { label: isFr ? 'Stock Faible' : 'Low Stock', value: lowCount, formattedValue: `${fmtNum(lowCount)}`, trend: lowCount > 0 ? 'negative' : 'positive' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quelle est la valeur de mon stock ?', 'Quel est mon produit le plus vendu ?', 'Qui me doit de l’argent ?']
          : [
              'What is my inventory valuation?',
              'What is my best-selling product?',
              'Who owes me money?',
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
      q.includes('owe me') ||
      q.includes('qui me doit') ||
      q.includes('dettes') ||
      q.includes('créances') ||
      q.includes('creances') ||
      q.includes('impayés') ||
      q.includes('impayes') ||
      q.includes('débiteurs') ||
      q.includes('debiteurs')
    ) {
      const totalDebt = Number(debtorSummary.totalOutstandingDebt ?? debtors.totalOutstandingDebt ?? osCustomers?.totalOutstandingDebt ?? 0);
      const debtorCount = Number(debtorSummary.debtorsCount ?? debtors.debtorsCount ?? osCustomers?.debtorsCount ?? 0);
      const topList = (debtorSummary.topDebtors || debtors.topDebtors || []) as Array<{ name: string; debtAmount: number; phone?: string }>;

      if (debtorCount === 0 || totalDebt === 0) {
        return {
          answer: isFr
            ? `Vous n'avez actuellement **aucun impayé client** (0 solde débiteur sur l'ensemble de vos comptes clients).`
            : `You currently have **no outstanding customer debts** (0 unpaid balances recorded across all customer accounts).`,
          keyMetrics: [
            { label: isFr ? 'Total Créances' : 'Outstanding Debt', value: 0, formattedValue: fmtCur(0), trend: 'positive' },
            { label: isFr ? 'Comptes Débiteurs' : 'Debtor Accounts', value: 0, formattedValue: '0', trend: 'positive' },
          ],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
          provider: 'deterministic_fallback',
          followUpSuggestions: isFr
            ? ['Quel est mon bénéfice net ?', 'Quelle est la valeur de mon stock ?', 'Comment se portent mes ventes aujourd’hui ?']
            : [
                'What is my net profit?',
                'What is my inventory valuation?',
                'How are my sales today?',
              ],
        };
      }

      const debtorBreakdown = isFr
        ? topList
            .map((d, i) => `${i + 1}. **${d.name}**: ${fmtCur(Number(d.debtAmount))}${d.phone ? ` (${d.phone})` : ''}`)
            .join('\n')
        : topList
            .map((d, i) => `${i + 1}. **${d.name}**: ${currency} ${Number(d.debtAmount).toLocaleString()}${d.phone ? ` (${d.phone})` : ''}`)
            .join('\n');

      return {
        answer: isFr
          ? `Vous avez actuellement **${fmtNum(debtorCount)} compte(s) client(s)** avec des créances en attente totalisant **${fmtCur(totalDebt)}** :\n\n${debtorBreakdown}\n\nRelancer ces clients permettra de récupérer des liquidités indispensables au fonds de roulement.`
          : `You currently have **${debtorCount} customer account(s)** with outstanding credit balances totaling **${currency} ${totalDebt.toLocaleString()}**:\n\n${debtorBreakdown}\n\nReaching out to these customers will help recover liquid working capital for inventory purchases.`,
        keyMetrics: [
          { label: isFr ? 'Créances Clients' : 'Outstanding Receivables', value: totalDebt, formattedValue: fmtCur(totalDebt), trend: 'negative' },
          { label: isFr ? 'Clients Débiteurs' : 'Debtor Accounts', value: debtorCount, formattedValue: `${fmtNum(debtorCount)}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quel est mon bénéfice net ?', 'Quelles sont mes plus grandes dépenses ?', 'Comment se portent mes ventes aujourd’hui ?']
          : [
              'What is my net profit?',
              'What are my biggest operating expenses?',
              'How are my sales today?',
            ],
      };
    }

    // =========================================================================
    // 10. FULL BUSINESS ANALYSIS (Explicit report mode only)
    // =========================================================================
    if (isExplicitReport) {
      const totalRev = Number(ledger.revenue ?? overview.revenue ?? salesSummary.totalRevenue ?? 0);
      const txCount = Number(ledger.transaction_count ?? overview.transaction_count ?? salesSummary.transactionCount ?? 0);
      const grossProfit = Number(ledger.gross_profit ?? overview.gross_profit ?? 0);
      const grossMargin = Number(ledger.gross_margin ?? overview.gross_margin ?? 0);
      const opExpenses = Number(ledger.operating_expenses ?? overview.operating_expenses ?? 0);
      const netProfit = Number(ledger.estimated_net_profit ?? overview.estimated_net_profit ?? (grossProfit - opExpenses));
      const outCount = Number(invHealth.outOfStockCount ?? inv.outOfStockCount ?? 0);
      const totalDebt = Number(debtorSummary.totalOutstandingDebt ?? debtors.totalOutstandingDebt ?? 0);

      return {
        answer: isFr
          ? `### Synthèse Opérationnelle\n**${ctx.businessName}** a réalisé un chiffre d'affaires de **${fmtCur(totalRev)}** sur **${fmtNum(txCount)}** transaction(s) au cours des 30 derniers jours, atteignant une **marge brute de ${grossMargin}%** (${fmtCur(grossProfit)} de marge brute) et **${fmtCur(netProfit)} de bénéfice net estimé**.\n\n### Diagnostics Analytiques & Données Clés\n- **Chiffre d'Affaires :** ${fmtCur(totalRev)} (${fmtNum(txCount)} transactions)\n- **Coût des Marchandises (PEPS) :** ${fmtCur(Number(ledger.cost_of_goods_sold || (totalRev - grossProfit)))}\n- **Dépenses d'Exploitation :** ${fmtCur(opExpenses)}\n- **Bénéfice Net :** ${fmtCur(netProfit)}\n- **État du Stock :** ${fmtNum(outCount)} référence(s) épuisée(s)\n- **Créances Clients :** ${fmtCur(totalDebt)} d'encours de crédit à recouvrer\n\n### Recommandations Stratégiques\n1. **Protéger les Ventes Clés :** Réapprovisionner sans délai les produits épuisés.\n2. **Recouvrement :** Envoyer des rappels de paiement aux clients débiteurs pour reconstituer la trésorerie.\n3. **Discipline de Marge :** Veiller à ce que les prix de vente couvrent l'augmentation des coûts d'approvisionnement et les charges fixes.`
          : `### Executive Summary\n**${ctx.businessName}** generated **${currency} ${totalRev.toLocaleString()}** in revenue across **${txCount}** completed transaction(s) over the last 30 days, achieving a **${grossMargin}% gross margin** (${currency} ${grossProfit.toLocaleString()} gross profit) and **${currency} ${netProfit.toLocaleString()} in estimated net profit**.\n\n### Analytical Diagnostics & Data Breakdown\n- **Revenue Volume:** ${currency} ${totalRev.toLocaleString()} (${txCount} transactions)\n- **Cost of Goods (COGS):** ${currency} ${Number(ledger.cost_of_goods_sold || (totalRev - grossProfit)).toLocaleString()}\n- **Operating Expenses:** ${currency} ${opExpenses.toLocaleString()}\n- **Net Profit:** ${currency} ${netProfit.toLocaleString()}\n- **Inventory Status:** ${outCount} depleted SKU(s)\n- **Receivables Exposure:** ${currency} ${totalDebt.toLocaleString()} in open customer credit\n\n### Strategic Recommendations\n1. **Protect Top Sellers:** Restock any depleted SKUs to avoid lost sales.\n2. **Collect Open Debts:** Send payment reminders to debtor accounts to recover liquid cash.\n3. **Maintain Margin Discipline:** Ensure sales prices cover replacement costs and operating overhead.`,
        keyMetrics: [
          { label: isFr ? 'CA (30j)' : 'Revenue (30d)', value: totalRev, formattedValue: fmtCur(totalRev), trend: 'positive' },
          { label: isFr ? 'Marge Brute' : 'Gross Margin', value: grossMargin, formattedValue: `${grossMargin}%`, trend: grossMargin >= 30 ? 'positive' : 'neutral' },
          { label: isFr ? 'Bénéfice Net Estimé' : 'Estimated Net Profit', value: netProfit, formattedValue: fmtCur(netProfit), trend: netProfit >= 0 ? 'positive' : 'negative' },
          { label: isFr ? 'Transactions' : 'Transactions', value: txCount, formattedValue: `${fmtNum(txCount)}`, trend: 'neutral' },
        ],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
        provider: 'deterministic_fallback',
        followUpSuggestions: isFr
          ? ['Quel est mon produit le plus vendu ?', 'Quels sont les produits en rupture de stock ?', 'Quelles sont mes plus grandes dépenses ?']
          : [
              'What is my best-selling product?',
              'Which products are low on stock?',
              'What are my biggest operating expenses?',
            ],
      };
    }

    // =========================================================================
    // 11. GENERAL BUSINESS OVERVIEW / STATUS (Conversational default)
    // =========================================================================
    const totalRev = Number(ledger.revenue ?? overview.revenue ?? salesSummary.totalRevenue ?? osFin?.totalRevenue ?? 0);
    const txCount = Number(ledger.transaction_count ?? overview.transaction_count ?? salesSummary.transactionCount ?? osFin?.transactionCount ?? 0);
    const grossProfit = Number(ledger.gross_profit ?? overview.gross_profit ?? (totalRev * 0.3));
    const grossMargin = Number(ledger.gross_margin ?? overview.gross_margin ?? 0);
    const opExpenses = Number(ledger.operating_expenses ?? osFin?.totalExpenses ?? expenseBreakdown.totalExpenses ?? 0);
    const netProfit = Number(ledger.estimated_net_profit ?? osFin?.netProfit ?? (grossProfit - opExpenses));
    const totalCostValuation = Number(invHealth.totalCostValuation ?? osInv?.totalCatalogValueAtCost ?? 0);
    const totalDebt = Number(debtorSummary.totalOutstandingDebt ?? debtors.totalOutstandingDebt ?? osCustomers?.totalOutstandingDebt ?? 0);

    return {
      answer: isFr
        ? `Voici la situation opérationnelle de **${ctx.businessName}** dans votre système d'exploitation :\n\n- **Performance Récente (30 jours) :** **${fmtCur(totalRev)}** de ventes sur **${fmtNum(txCount)}** transactions, générant **${fmtCur(grossProfit)}** de bénéfice brut (${grossMargin}% de marge) et **${fmtCur(netProfit)}** de bénéfice net estimé.\n- **Actifs en Stock :** **${fmtCur(totalCostValuation)}** de valorisation d'inventaire au coût d'achat.\n- **Crédit Clients :** **${fmtCur(totalDebt)}** de créances ouvertes en attente de paiement.\n\nQuel domaine souhaitez-vous explorer davantage ? Vous pouvez poser des questions sur les marges de vos produits, les charges, le réapprovisionnement ou les ventes du jour.`
        : `Here is the current operational health of **${ctx.businessName}** across the operating system:\n\n- **Recent Performance (30 Days):** **${currency} ${totalRev.toLocaleString()}** in sales across **${txCount}** transactions, producing **${currency} ${grossProfit.toLocaleString()}** in gross profit (${grossMargin}% margin) and **${currency} ${netProfit.toLocaleString()}** in estimated net profit.\n- **Inventory Assets:** **${currency} ${totalCostValuation.toLocaleString()}** in catalog stock valuation at acquisition cost.\n- **Customer Credit:** **${currency} ${totalDebt.toLocaleString()}** in open receivables awaiting collection.\n\nWhat domain would you like to explore deeper? You can ask about product margins, operating expenses, stock replenishment, or today's register.`,
      keyMetrics: [
        { label: isFr ? 'CA (30j)' : 'Revenue (30d)', value: totalRev, formattedValue: fmtCur(totalRev), trend: totalRev > 0 ? 'positive' : 'neutral' },
        { label: isFr ? 'Marge Brute' : 'Gross Margin', value: grossMargin, formattedValue: `${grossMargin}%`, trend: 'neutral' },
        { label: isFr ? 'Bénéfice Net Estimé' : 'Estimated Net Profit', value: netProfit, formattedValue: fmtCur(netProfit), trend: netProfit >= 0 ? 'positive' : 'negative' },
        { label: isFr ? 'Valeur Stock (Coût)' : 'Stock Valuation (Cost)', value: totalCostValuation, formattedValue: fmtCur(totalCostValuation), trend: 'neutral' },
      ],
      confidence: txCount > 0 ? 'high_confidence' : 'insufficient_data',
      responseSource: 'DETERMINISTIC_FALLBACK',
      provider: 'deterministic_fallback',
      followUpSuggestions: isFr
        ? ['Quel est mon bénéfice ce mois-ci ?', 'Quelles sont mes plus grandes dépenses ?', 'Quels sont les produits en rupture de stock ?', 'Qui me doit de l’argent ?']
        : [
            'What is my profit this month?',
            'What are my biggest operating expenses?',
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
    const isFr = (ctx.language || '').toLowerCase().startsWith('fr');

    const fmtNum = (n: number) => isFr ? n.toLocaleString('fr-FR') : n.toLocaleString('en-US');
    const fmtCur = (n: number) => isFr ? `${fmtNum(n)} ${currency}` : `${currency} ${fmtNum(n)}`;

    const revenue = Number(briefFacts.todayMetrics?.revenueToday ?? 0);
    const transactions = Number(briefFacts.todayMetrics?.transactionCountToday ?? 0);
    const amountCollected = Number(briefFacts.todayMetrics?.cashCollectedToday ?? 0);
    const expenses = Number(briefFacts.todayMetrics?.expensesToday ?? 0);
    const outstandingReceivables = Number(briefFacts.debtorAlerts?.totalOutstandingDebt ?? 0);

    const inventoryAlerts: string[] = [];
    if (briefFacts.inventoryAlerts?.criticalItemsToRestock?.length) {
      for (const item of briefFacts.inventoryAlerts.criticalItemsToRestock.slice(0, 4)) {
        if (isFr) {
          inventoryAlerts.push(`${item.name} (${fmtNum(item.currentStock)} restants - ${item.status === 'OUT_OF_STOCK' ? 'Épuisé' : 'Stock faible'})`);
        } else {
          inventoryAlerts.push(`${item.name} (${item.currentStock} remaining - ${item.status})`);
        }
      }
    }

    const debtFollowUps: string[] = [];
    if (briefFacts.debtorAlerts?.topDebtors?.length) {
      for (const debtor of briefFacts.debtorAlerts.topDebtors.slice(0, 3)) {
        if (isFr) {
          debtFollowUps.push(`${debtor.name} doit ${fmtCur(Number(debtor.debtAmount))}`);
        } else {
          debtFollowUps.push(`${debtor.name} owes ${currency} ${Number(debtor.debtAmount).toLocaleString()}`);
        }
      }
    }

    const headline = isFr
      ? (transactions > 0
          ? `${fmtNum(transactions)} transaction(s) enregistrée(s) aujourd'hui pour ${fmtCur(revenue)} de ventes`
          : `Aucune transaction enregistrée pour l'instant aujourd'hui pour ${ctx.businessName}`)
      : (transactions > 0
          ? `${transactions} transaction(s) logged today generating ${currency} ${revenue.toLocaleString()}`
          : `No transactions recorded yet today for ${ctx.businessName}`);

    const keyTakeaways: string[] = isFr
      ? [
          `Recette du jour : ${fmtCur(revenue)} sur ${fmtNum(transactions)} commande(s)`,
          `Espèces encaissées : ${fmtCur(amountCollected)}`,
        ]
      : [
          `Today's Revenue: ${currency} ${revenue.toLocaleString()} across ${transactions} order(s)`,
          `Cash Collected: ${currency} ${amountCollected.toLocaleString()}`,
        ];

    if (outstandingReceivables > 0) {
      if (isFr) {
        keyTakeaways.push(`Créances clients ouvertes : ${fmtCur(outstandingReceivables)} sur ${fmtNum(briefFacts.debtorAlerts?.debtorsCount || 0)} compte(s)`);
      } else {
        keyTakeaways.push(`Open Customer Debt: ${currency} ${outstandingReceivables.toLocaleString()} across ${briefFacts.debtorAlerts?.debtorsCount || 0} account(s)`);
      }
    }

    const recommendedFocusToday = isFr
      ? (inventoryAlerts.length > 0
          ? `Vérifier les articles en rupture pour éviter des ventes manquées.`
          : outstandingReceivables > 0
          ? `Relancer les principaux débiteurs pour récupérer du fonds de roulement.`
          : `Se concentrer sur le service client en caisse et l'enregistrement rigoureux des ventes.`)
      : (inventoryAlerts.length > 0
          ? `Review depleted inventory items to prevent missed sales.`
          : outstandingReceivables > 0
          ? `Follow up with top debtor accounts to recover working capital.`
          : `Focus on customer checkout service and recording daily transactions.`);

    const executiveSummary = isFr
      ? `${ctx.businessName} a enregistré ${fmtNum(transactions)} commande(s) aujourd'hui générant ${fmtCur(revenue)}. ${inventoryAlerts.length > 0 ? `${fmtNum(inventoryAlerts.length)} produit(s) nécessitent un réapprovisionnement.` : 'Le stock du catalogue est convenablement approvisionné.'}`
      : `${ctx.businessName} has recorded ${transactions} order(s) today generating ${currency} ${revenue.toLocaleString()}. ${inventoryAlerts.length > 0 ? `${inventoryAlerts.length} product(s) require inventory replenishment.` : 'Catalog inventory is adequately stocked.'}`;

    return {
      generatedAt: new Date().toISOString(),
      businessName: ctx.businessName,
      currency,
      headline,
      executiveSummary,
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
