import { GoogleGenAI } from '@google/genai';
import {
  type AIStructuredResponse,
  type AIDailyBrief,
} from '../src/types/ai.ts';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 0 && apiKey !== 'placeholder-key') {
      geminiClient = new GoogleGenAI({ apiKey });
    }
  }
  return geminiClient;
}

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
  };
}

/**
 * Server-side Ursella AI Reasoning Engine.
 * Follows an internal 9-step reasoning process:
 * USER QUESTION -> INTERPRET USER INTENT -> IDENTIFY BUSINESS DOMAIN ->
 * IDENTIFY REQUIRED INFORMATION -> IDENTIFY RELEVANT TIME PERIOD ->
 * RETRIEVE RELEVANT VERIFIED BUSINESS DATA -> ANALYZE DATA ->
 * FORMULATE BUSINESS CONCLUSION -> PROVIDE APPROPRIATE RESPONSE ->
 * VALIDATE RESPONSE RELEVANCE.
 */
export class GeminiService {
  /**
   * Builds the strict Ursella AI system instruction enforcing the 9-step reasoning workflow.
   */
  private static buildSystemInstruction(ctx: ChatReasoningContext): string {
    return `You are Ursella AI, the intelligent, mathematically grounded business operating co-pilot inside Ursella Business OS.
You are assisting the owner/operator of "${ctx.businessName}" (${ctx.businessType}).

PLATFORM FACTS:
- Active Business: "${ctx.businessName}" (DO NOT say "Welcome to ${ctx.businessName}" as if it is your AI name; you are Ursella AI assisting ${ctx.businessName}).
- Operating Currency: "${ctx.currency}". Always format money with "${ctx.currency}".
- Timezone: "${ctx.timezone}". Reference date: ${ctx.currentDateIso.split('T')[0]}.

CRITICAL REASONING DIRECTIVES:
1. USER QUESTION IS YOUR SUPREME DIRECTIVE:
   The user's question must strictly determine what you analyze and return.

2. RELEVANCE TAKES ABSOLUTE PRIORITY OVER COMPLETENESS:
   - Provide ONLY information directly relevant to answering the question.
   - DO NOT automatically output an unrequested complete business report.
   - DO NOT mention revenue, profit, expenses, inventory, customers, or debtors unless they are directly relevant to the question.
   - For a debtor question: focus exclusively on customer debts and balances.
   - For an inventory question: focus exclusively on stock levels and replenishment.
   - For today's sales: focus strictly on today's performance.

3. ANSWER DIRECTLY FIRST:
   - The very first sentence of your response MUST answer the user's question directly with the exact verified numbers (or clearly state that 0 records exist).
   - DO NOT start with generic greetings, robotic pleasantries, or preamble.

4. SEPARATE INTERNALLY BETWEEN:
   - FACT: Authoritative data verified directly in the context.
   - INTERPRETATION: Business context, comparison, or operational meaning.
   - RECOMMENDATION: Concrete next step or business advice (only when helpful or asked).

5. PROPORTIONATE RESPONSE DEPTH:
   - Simple question (e.g. "Who owes me the most?", "What is my currency?", "How many items are low on stock?") -> Crisp, direct answer (1-3 sentences with key metrics).
   - Complex analysis or diagnosis question -> Structured markdown breakdown with context, diagnosis, and action.

6. GROUNDING & MATHEMATICAL INTEGRITY:
   - Base all figures strictly on the provided verified business context. NEVER invent numbers.
   - If no records exist for the requested scope/timeframe, state it clearly and neutrally.

OUTPUT FORMAT:
Respond with a JSON object strictly adhering to this schema:
{
  "answer": "A markdown-formatted answer answering the question directly in the first sentence.",
  "keyMetrics": [
    { "label": "Metric Name", "value": 12000, "formattedValue": "${ctx.currency} 12,000", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Why this matters",
      "actionSuggestion": "Actionable next step",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": [
    "Relevant follow-up 1",
    "Relevant follow-up 2"
  ]
}`;
  }

  /**
   * Executes AI Chat reasoning.
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

    if (!ai) {
      return this.generateDeterministicFallback(userMessage, ctx);
    }

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contextPrompt,
        config: {
          systemInstruction: this.buildSystemInstruction(ctx),
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed.answer === 'string') {
          return {
            answer: parsed.answer,
            intent: (parsed.intent as any) || ctx.parsedIntent?.intent || 'business_overview',
            keyMetrics: parsed.keyMetrics || [],
            observations: parsed.observations || [],
            recommendations: parsed.recommendations || [],
            anomaliesDetected: parsed.anomaliesDetected || [],
            confidence: parsed.confidence || 'high_confidence',
            dataSufficiencyNote: parsed.dataSufficiencyNote,
            followUpSuggestions: parsed.followUpSuggestions || [
              'How are my sales today?',
              'Which products are low on stock?',
              'Who owes me money?',
            ],
            proposedAction: parsed.proposedAction,
          };
        }
      } catch {
        return {
          answer: responseText,
          confidence: 'moderate_confidence',
          followUpSuggestions: ['What else should I focus on?'],
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, using deterministic business synthesizer:', err);
    }

    return this.generateDeterministicFallback(userMessage, ctx);
  }

  /**
   * Generates Daily Business Brief.
   */
  public static async generateDailyBrief(ctx: ChatReasoningContext): Promise<AIDailyBrief> {
    const ai = getGeminiClient();
    const briefFacts = (ctx.toolResults.get_daily_brief_facts || ctx.toolResults.get_today_sales_summary) as any;
    const today = briefFacts?.todayMetrics || {
      revenueToday: briefFacts?.revenue || 0,
      transactionCountToday: briefFacts?.salesCount || 0,
      cashCollectedToday: briefFacts?.cashCollected || 0,
      expensesToday: 0,
      grossProfitToday: briefFacts?.grossProfit || 0,
      grossMarginPctToday: briefFacts?.grossMarginPct || 0,
    };
    const debtors = briefFacts?.debtorAlerts || { debtorsCount: 0, totalOutstandingDebt: 0 };

    if (!ai) {
      return this.generateDeterministicDailyBrief(ctx, briefFacts);
    }

    try {
      const prompt = `Generate a concise, professional executive Daily Business Brief for "${ctx.businessName}" based on today's factual metrics in timezone ${ctx.timezone}:
${JSON.stringify(briefFacts, null, 2)}

Return a valid JSON object matching the schema:
{
  "headline": "Punchy 1-sentence headline of today's status",
  "executiveSummary": "2-3 sentence overview answering today's revenue, gross margin, cash collection, and immediate risks.",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "inventoryAlerts": ["Alert 1"],
  "debtFollowUps": ["Follow up 1"],
  "recommendedFocusToday": "Clear top strategic priority for today",
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data"
}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: `You are Ursella AI. Generate an accurate, grounded Daily Business Brief for ${ctx.businessName} in currency ${ctx.currency}. Never invent numbers. Answer performance facts directly.`,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        generatedAt: new Date().toISOString(),
        businessName: ctx.businessName,
        currency: ctx.currency,
        headline: parsed.headline || `Daily Briefing for ${ctx.businessName}`,
        executiveSummary: parsed.executiveSummary || `Today's performance overview for ${ctx.businessName}.`,
        performanceSnapshot: {
          revenue: today.revenueToday,
          transactions: today.transactionCountToday,
          amountCollected: today.cashCollectedToday,
          expenses: today.expensesToday,
          outstandingReceivables: debtors.totalOutstandingDebt,
        },
        keyTakeaways: parsed.keyTakeaways || [],
        inventoryAlerts: parsed.inventoryAlerts || [],
        debtFollowUps: parsed.debtFollowUps || [],
        recommendedFocusToday: parsed.recommendedFocusToday || 'Review daily sales and inventory levels.',
        confidence: parsed.confidence || (today.transactionCountToday >= 5 ? 'high_confidence' : 'insufficient_data'),
      };
    } catch (err) {
      console.warn('Gemini Daily Brief API failed, using deterministic briefing:', err);
      return this.generateDeterministicDailyBrief(ctx, briefFacts);
    }
  }

  /**
   * Deterministic Daily Brief generator when AI API is unavailable.
   */
  private static generateDeterministicDailyBrief(
    ctx: ChatReasoningContext,
    briefFacts: any
  ): AIDailyBrief {
    const today = briefFacts?.todayMetrics || {
      revenueToday: briefFacts?.revenue || 0,
      transactionCountToday: briefFacts?.salesCount || 0,
      cashCollectedToday: briefFacts?.cashCollected || 0,
      expensesToday: 0,
    };
    const inv = briefFacts?.inventoryAlerts || { lowStockCount: 0, outOfStockCount: 0 };
    const debtors = briefFacts?.debtorAlerts || { debtorsCount: 0, totalOutstandingDebt: 0 };

    return {
      generatedAt: new Date().toISOString(),
      businessName: ctx.businessName,
      currency: ctx.currency,
      headline:
        today.revenueToday > 0
          ? `Daily Briefing: ${ctx.currency} ${today.revenueToday.toLocaleString()} recorded in sales today across ${today.transactionCountToday} orders.`
          : `Daily Briefing: Ready for trading. No sales recorded yet today.`,
      executiveSummary: `Today ${ctx.businessName} has recorded ${ctx.currency} ${today.revenueToday.toLocaleString()} in revenue with ${ctx.currency} ${today.cashCollectedToday.toLocaleString()} in cash collected. You currently have ${inv.outOfStockCount} out of stock item(s) and ${debtors.debtorsCount} customer(s) with outstanding credit balances.`,
      performanceSnapshot: {
        revenue: today.revenueToday,
        transactions: today.transactionCountToday,
        amountCollected: today.cashCollectedToday,
        expenses: today.expensesToday,
        outstandingReceivables: debtors.totalOutstandingDebt,
      },
      keyTakeaways: [
        `Revenue: ${ctx.currency} ${today.revenueToday.toLocaleString()} across ${today.transactionCountToday} transaction(s).`,
        `Cash Collections: ${ctx.currency} ${today.cashCollectedToday.toLocaleString()} received.`,
        `Receivables Balance: ${ctx.currency} ${debtors.totalOutstandingDebt.toLocaleString()} owed across ${debtors.debtorsCount} customer account(s).`,
      ],
      inventoryAlerts:
        inv.outOfStockCount > 0 || inv.lowStockCount > 0
          ? [`${inv.outOfStockCount} product(s) out of stock, ${inv.lowStockCount} below minimum threshold.`]
          : ['All inventory SKUs are currently adequately stocked.'],
      debtFollowUps:
        debtors.debtorsCount > 0
          ? [`${debtors.debtorsCount} debtor account(s) totaling ${ctx.currency} ${debtors.totalOutstandingDebt.toLocaleString()}.`]
          : ['No overdue customer receivables recorded.'],
      recommendedFocusToday:
        inv.outOfStockCount > 0
          ? 'Prepare restock orders for depleted inventory items to avoid stockouts.'
          : debtors.totalOutstandingDebt > 0
          ? 'Send payment reminder notices to customer debtor accounts.'
          : 'Focus on ringing up sales and customer engagement today.',
      confidence: today.transactionCountToday >= 5 ? 'high_confidence' : 'insufficient_data',
    };
  }

  /**
   * Deterministic fallback reasoning engine when Gemini API is offline or key unconfigured.
   * Guarantees strict relevance: only answers what was asked, answering directly in the first sentence.
   */
  private static generateDeterministicFallback(
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

    // 1. Store Identity & Meta queries
    if (
      q.includes('business name') ||
      q.includes('store name') ||
      q.includes('shop name') ||
      q.includes('name of my business') ||
      q.includes('what is my store') ||
      q.includes('what is my business') ||
      q.includes('who am i') ||
      q.includes('about my store')
    ) {
      return {
        answer: `Your active business is **${ctx.businessName}** (${ctx.businessType}), operating in **${currency}** under the **${ctx.timezone}** timezone.${ctx.ownerName ? ` Owned by ${ctx.ownerName}.` : ''}`,
        keyMetrics: [
          { label: 'Business Name', value: ctx.businessName, formattedValue: ctx.businessName, trend: 'neutral' },
          { label: 'Currency', value: currency, formattedValue: currency, trend: 'neutral' },
        ],
        followUpSuggestions: ['How are my sales today?', 'Who owes me money?', 'Which products are low on stock?'],
        confidence: 'high_confidence',
      };
    }

    if (
      q.includes('currency') ||
      q.includes('what currency') ||
      q.includes('which currency') ||
      q.includes('currency am i using')
    ) {
      return {
        answer: `Your store's active operating currency is **${currency}**. All transactions, catalog prices, inventory valuations, and debtor balances are recorded in ${currency}.`,
        keyMetrics: [{ label: 'Operating Currency', value: currency, formattedValue: currency, trend: 'neutral' }],
        followUpSuggestions: ['How are my sales today?', 'What is my total receivables?'],
        confidence: 'high_confidence',
      };
    }

    // 2. Debtors, Receivables & Unpaid Customer Accounts
    if (
      q.includes('who owes') ||
      q.includes('debt') ||
      q.includes('debtor') ||
      q.includes('unpaid') ||
      q.includes('receivable') ||
      q.includes('owing') ||
      q.includes('credit balance') ||
      q.includes('collect money')
    ) {
      const totalDebt = Number(debtors.totalOutstandingDebt || 0);
      const debtorCount = Number(debtors.debtorsCount || 0);
      const topList = (debtors.topDebtors || []) as Array<{ name: string; debtAmount: number; phone?: string }>;

      if (debtorCount === 0 || totalDebt === 0) {
        return {
          answer: `You currently have **no outstanding customer debts** (0 unpaid customer balances recorded).`,
          keyMetrics: [
            { label: 'Outstanding Receivables', value: 0, formattedValue: `${currency} 0`, trend: 'positive' },
            { label: 'Debtor Accounts', value: 0, formattedValue: '0', trend: 'positive' },
          ],
          recommendations: [],
          followUpSuggestions: ['How are my sales today?', 'Do I have any low-stock products?'],
          confidence: 'high_confidence',
        };
      }

      const topDebtor = topList[0];
      const debtorBreakdown = topList
        .map((d, i) => `${i + 1}. **${d.name}**: ${currency} ${Number(d.debtAmount).toLocaleString()}${d.phone ? ` (📞 ${d.phone})` : ''}`)
        .join('\n');

      return {
        answer: `You have **${debtorCount} customer(s)** with outstanding debts totaling **${currency} ${totalDebt.toLocaleString()}**.\n\n${topDebtor ? `The largest outstanding balance is from **${topDebtor.name}** at **${currency} ${Number(topDebtor.debtAmount).toLocaleString()}**.\n\n**Debtor Breakdown:**\n${debtorBreakdown}` : ''}`,
        keyMetrics: [
          { label: 'Total Outstanding Debt', value: totalDebt, formattedValue: `${currency} ${totalDebt.toLocaleString()}`, trend: 'negative' },
          { label: 'Debtor Accounts', value: debtorCount, formattedValue: `${debtorCount}`, trend: 'neutral' },
        ],
        recommendations: [
          {
            id: 'rec-debt-collection',
            title: `Contact ${topDebtor?.name || 'Top Debtors'}`,
            reasoning: `Collecting ${currency} ${totalDebt.toLocaleString()} will immediately improve operating liquidity.`,
            actionSuggestion: topDebtor?.phone ? `Send SMS or call ${topDebtor.name} at ${topDebtor.phone}.` : 'Review credit sales in the Customers module.',
            priority: 'high',
          },
        ],
        followUpSuggestions: ['How are my sales today?', 'What is my current cash flow?'],
        confidence: 'high_confidence',
      };
    }

    // 3. Inventory, Out of Stock, Low Stock
    if (
      q.includes('low stock') ||
      q.includes('running low') ||
      q.includes('out of stock') ||
      q.includes('restock') ||
      q.includes('inventory') ||
      q.includes('stock level') ||
      q.includes('stockout') ||
      q.includes('reorder')
    ) {
      const outCount = Number(inv.outOfStockCount || 0);
      const lowCount = Number(inv.lowStockCount || 0);
      const criticalItems = (inv.criticalItemsToRestock || []) as Array<{ name: string; currentStock: number; minimumStockLevel: number; status: string }>;
      const totalSKUs = Number(inv.totalActiveSKUs || 0);
      const valuation = Number(inv.totalInventoryValuation || 0);

      if (outCount === 0 && lowCount === 0) {
        return {
          answer: `All **${totalSKUs} active product SKUs** are adequately stocked with zero low-stock or out-of-stock items.${valuation > 0 ? ` (Total inventory valuation at cost: **${currency} ${valuation.toLocaleString()}**).` : ''}`,
          keyMetrics: [
            { label: 'Out of Stock SKUs', value: 0, formattedValue: '0', trend: 'positive' },
            { label: 'Low Stock SKUs', value: 0, formattedValue: '0', trend: 'positive' },
            { label: 'Inventory Value', value: valuation, formattedValue: `${currency} ${valuation.toLocaleString()}`, trend: 'neutral' },
          ],
          recommendations: [],
          followUpSuggestions: ['What are my top selling products?', 'How are my sales today?'],
          confidence: 'high_confidence',
        };
      }

      const itemsList = criticalItems
        .map((item) => `- **${item.name}**: ${item.currentStock} in stock (${item.status === 'OUT_OF_STOCK' ? '🔴 Depleted' : `⚠️ Min: ${item.minimumStockLevel}`})`)
        .join('\n');

      return {
        answer: `You have **${outCount} item(s) completely out of stock** and **${lowCount} item(s) running low** below minimum reorder thresholds.\n\n**Items Requiring Restock:**\n${itemsList}`,
        keyMetrics: [
          { label: 'Out of Stock', value: outCount, formattedValue: `${outCount}`, trend: outCount > 0 ? 'negative' : 'neutral' },
          { label: 'Low Stock', value: lowCount, formattedValue: `${lowCount}`, trend: lowCount > 0 ? 'negative' : 'neutral' },
        ],
        recommendations: [
          {
            id: 'rec-restock-urgency',
            title: 'Place Supplier Purchase Order',
            reasoning: `${outCount + lowCount} SKUs are depleted or near stockout, risking lost customer sales.`,
            actionSuggestion: 'Navigate to Stock module to issue purchase orders for depleted SKUs.',
            priority: 'high',
          },
        ],
        followUpSuggestions: ['Which products make me the most money?', 'How are my sales today?'],
        confidence: 'high_confidence',
      };
    }

    // 4. Specific "Today" queries
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
      const gpToday = Number(todaySales.grossProfit ?? (revToday > 0 ? revToday * 0.35 : 0));
      const marginPct = Number(todaySales.grossMarginPct ?? (revToday > 0 ? 35 : 0));

      if (txToday === 0) {
        return {
          answer: `You have recorded **${currency} 0** in sales today (0 transactions completed so far today).`,
          keyMetrics: [
            { label: "Today's Revenue", value: 0, formattedValue: `${currency} 0`, trend: 'neutral' },
            { label: "Today's Orders", value: 0, formattedValue: '0', trend: 'neutral' },
          ],
          recommendations: [],
          followUpSuggestions: ['Which products are low on stock?', 'Who owes me money?', 'What were my sales this month?'],
          confidence: 'high_confidence',
        };
      }

      return {
        answer: `Today, **${ctx.businessName}** has generated **${currency} ${revToday.toLocaleString()}** in revenue across **${txToday}** transaction${txToday > 1 ? 's' : ''}.\n\n- **Gross Profit:** ${currency} ${gpToday.toLocaleString()} (Gross Margin: **${marginPct}%**)\n- **Cash Collected:** ${currency} ${cashToday.toLocaleString()}`,
        keyMetrics: [
          { label: "Today's Revenue", value: revToday, formattedValue: `${currency} ${revToday.toLocaleString()}`, trend: 'positive' },
          { label: "Today's Orders", value: txToday, formattedValue: `${txToday}`, trend: 'positive' },
          { label: 'Gross Margin', value: marginPct, formattedValue: `${marginPct}%`, trend: 'positive' },
        ],
        followUpSuggestions: ['Who owes me money?', 'Which products are low on stock?'],
        confidence: 'high_confidence',
      };
    }

    // 5. Product Margins & Top Products
    if (
      q.includes('best selling') ||
      q.includes('top product') ||
      q.includes('margin on product') ||
      q.includes('highest margin') ||
      q.includes('most profitable product') ||
      q.includes('product')
    ) {
      if (!products || products.length === 0) {
        return {
          answer: `No product performance sales data is available yet for the current catalog.`,
          keyMetrics: [],
          followUpSuggestions: ['How are my sales today?', 'Do I have low stock?'],
          confidence: 'insufficient_data',
        };
      }

      const productList = products
        .map((p, i) => `${i + 1}. **${p.name}**: Selling Price ${currency} ${Number(p.sellingPrice).toLocaleString()} (Margin: **${p.marginPct}%**, Stock: ${p.stockQuantity})`)
        .join('\n');

      const topProduct = products[0];

      return {
        answer: `Your top performing product by catalog margin is **${topProduct.name}** with a **${topProduct.marginPct}%** gross unit margin.\n\n**Product Margin Highlights:**\n${productList}`,
        keyMetrics: products.slice(0, 3).map((p) => ({
          label: p.name,
          value: p.marginPct,
          formattedValue: `${p.marginPct}% margin`,
          trend: (p.marginPct >= 30 ? 'positive' : 'neutral') as 'positive' | 'neutral',
        })),
        followUpSuggestions: ['Which products are running low on stock?', 'How are my sales today?'],
        confidence: 'high_confidence',
      };
    }

    // 6. Expenses
    if (q.includes('expense') || q.includes('spending') || q.includes('costs') || q.includes('bills')) {
      const totalExp = Number(expenses.totalExpenses || 0);
      const topCats = (expenses.topExpenseCategories || []) as Array<{ category: string; amount: number; percentageOfTotal: number }>;

      if (totalExp === 0) {
        return {
          answer: `You have recorded **${currency} 0** in operating expenses for this period.`,
          keyMetrics: [{ label: 'Total Expenses', value: 0, formattedValue: `${currency} 0`, trend: 'positive' }],
          followUpSuggestions: ['How are my sales today?', 'What is my current cash flow?'],
          confidence: 'high_confidence',
        };
      }

      const catBreakdown = topCats
        .map((c) => `- **${c.category}**: ${currency} ${Number(c.amount).toLocaleString()} (${c.percentageOfTotal}% of total)`)
        .join('\n');

      return {
        answer: `Your total operating expenses for the period are **${currency} ${totalExp.toLocaleString()}**.\n\n**Expense Category Breakdown:**\n${catBreakdown}`,
        keyMetrics: [
          { label: 'Total Expenses', value: totalExp, formattedValue: `${currency} ${totalExp.toLocaleString()}`, trend: 'neutral' },
          { label: 'Top Expense Category', value: topCats[0]?.category || 'N/A', formattedValue: `${topCats[0]?.category || 'N/A'} (${currency} ${Number(topCats[0]?.amount || 0).toLocaleString()})`, trend: 'neutral' },
        ],
        followUpSuggestions: ['What is my net profitability?', 'How is my cash flow?'],
        confidence: 'high_confidence',
      };
    }

    // 7. Cash Flow
    if (q.includes('cash flow') || q.includes('cash collected') || q.includes('liquidity') || q.includes('inflow')) {
      const cashIn = Number(cashFlow.cashInflow || 0);
      const cashOut = Number(cashFlow.cashOutflow || 0);
      const netCash = Number(cashFlow.netCashFlow || 0);

      return {
        answer: `Your net cash flow for the trailing 30 days is **${netCash >= 0 ? '+' : ''}${currency} ${netCash.toLocaleString()}** (Cash Inflows: **${currency} ${cashIn.toLocaleString()}**, Outflows: **${currency} ${cashOut.toLocaleString()}**).`,
        keyMetrics: [
          { label: 'Net Cash Flow', value: netCash, formattedValue: `${currency} ${netCash.toLocaleString()}`, trend: netCash >= 0 ? 'positive' : 'negative' },
          { label: 'Cash Inflow', value: cashIn, formattedValue: `${currency} ${cashIn.toLocaleString()}`, trend: 'positive' },
          { label: 'Cash Outflow', value: cashOut, formattedValue: `${currency} ${cashOut.toLocaleString()}`, trend: 'neutral' },
        ],
        followUpSuggestions: ['Who owes me money?', 'What are my total expenses?'],
        confidence: 'high_confidence',
      };
    }

    // 8. General Overview / Sales History
    const totalRev = Number(overview.revenue || salesSummary.totalRevenue || 0);
    const txCount = Number(overview.transaction_count || salesSummary.transactionCount || 0);
    const grossProfit = Number(overview.gross_profit || 0);
    const grossMargin = Number(overview.gross_margin || 0);

    return {
      answer: `**${ctx.businessName}** has recorded **${currency} ${totalRev.toLocaleString()}** in revenue across **${txCount}** transaction(s) over the last 30 days, achieving a **${grossMargin}%** gross margin (${currency} ${grossProfit.toLocaleString()} gross profit).`,
      keyMetrics: [
        { label: 'Revenue (30d)', value: totalRev, formattedValue: `${currency} ${totalRev.toLocaleString()}`, trend: 'positive' },
        { label: 'Transactions', value: txCount, formattedValue: `${txCount}`, trend: 'positive' },
        { label: 'Gross Margin', value: grossMargin, formattedValue: `${grossMargin}%`, trend: grossMargin >= 30 ? 'positive' : 'neutral' },
      ],
      followUpSuggestions: ['How are my sales today?', 'Who owes me money?', 'Which products are low on stock?'],
      confidence: txCount > 0 ? 'high_confidence' : 'insufficient_data',
    };
  }
}
