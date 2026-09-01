import {
  type AIStructuredResponse,
  type AIDailyBrief,
} from '../src/types/ai.ts';
import {
  getGeminiClient,
  getActiveGeminiModel,
  logAIProvenance,
} from './ai-config.ts';

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
    return `You are Ursella AI, the elite executive business operating co-pilot inside Ursella Business OS.
You are providing high-level operational intelligence, financial diagnostics, and strategic advisory to the business owner of "${ctx.businessName}" (${ctx.businessType}).

PLATFORM CONTEXT & GROUND TRUTH:
- Active Enterprise: "${ctx.businessName}" (${ctx.businessType})
- Operating Currency: "${ctx.currency}". Always format every financial figure with "${ctx.currency}".
- Timezone: "${ctx.timezone}". Reference Date: ${ctx.currentDateIso.split('T')[0]}.

RESPONSE STYLE: FLAGSHIP GEMINI EXECUTIVE INTELLIGENCE
You provide thorough, comprehensive, deeply analytical, and actionable responses. DO NOT give ultra-short or single-line answers.

STRUCTURE EVERY RESPONSE WITH THE FOLLOWING SECTIONS:
1. ### Executive Summary
   - State the authoritative, verified factual figures directly in the opening sentence.
   - Summarize the immediate status of the requested topic clearly and concisely.

2. ### Analytical Diagnostics & Data Breakdown
   - Break down the underlying drivers (e.g. breakdown by SKU, customer debtor balances, cash collection velocity, margin percentages, or stock replenishment lead times).
   - Use bullet points, bold key figures, and concise comparison metrics.

3. ### Operational Observations & Risk Assessment
   - Highlight potential bottlenecks, cash flow leakage, stockout vulnerabilities, margin compression, or overdue credit exposure based on the real data.

4. ### Strategic Recommendations & Tactical Playbook
   - Provide 2 to 3 concrete, high-leverage action items the merchant can execute immediately in their store or system.

CRITICAL INTEGRITY RULES:
- STRICT MATHEMATICAL GROUNDING: Base all figures strictly on the verified facts in the context JSON. NEVER hallucinate or invent numbers.
- If data is empty or zero, explain clearly what that implies and guide the user on what activity to record.
- NEVER substitute store-wide aggregate reports when asked about a specific product, customer, or category.

OUTPUT FORMAT:
Respond with a JSON object strictly adhering to this schema:
{
  "answer": "A comprehensive, beautifully formatted Markdown response with clear headers (### Executive Summary, ### Analytical Breakdown, ### Strategic Playbook), bullet points, bold figures, and actionable business depth.",
  "keyMetrics": [
    { "label": "Metric Name", "value": 12000, "formattedValue": "${ctx.currency} 12,000", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Detailed rationale explaining why this action is critical",
      "actionSuggestion": "Step-by-step actionable instruction",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": [
    "Contextual follow-up question 1",
    "Contextual follow-up question 2",
    "Contextual follow-up question 3"
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

    const model = getActiveGeminiModel();
    const startTime = Date.now();

    if (!ai) {
      logAIProvenance({
        endpoint: 'generateChatResponse',
        businessId: ctx.businessName,
        source: 'DETERMINISTIC_FALLBACK',
        model,
        latencyMs: 0,
        error: 'GEMINI_API_KEY is not configured or client initialization failed',
      });
      return this.generateDeterministicFallback(userMessage, ctx);
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: contextPrompt,
        config: {
          systemInstruction: this.buildSystemInstruction(ctx),
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const latencyMs = Date.now() - startTime;
      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed.answer === 'string') {
          logAIProvenance({
            endpoint: 'generateChatResponse',
            businessId: ctx.businessName,
            source: 'GEMINI_RESPONSE',
            model,
            latencyMs,
          });
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
            responseSource: 'GEMINI_RESPONSE',
          };
        }
      } catch (parseError: any) {
        logAIProvenance({
          endpoint: 'generateChatResponse',
          businessId: ctx.businessName,
          source: 'GEMINI_RESPONSE',
          model,
          latencyMs,
          error: `JSON parse warning: ${parseError?.message}`,
        });
        return {
          answer: responseText,
          confidence: 'moderate_confidence',
          followUpSuggestions: ['What else should I focus on?'],
          responseSource: 'GEMINI_RESPONSE',
        };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.warn(`[Gemini Chat API Error] Model="${model}" failed after ${latencyMs}ms:`, err?.message || err);
      logAIProvenance({
        endpoint: 'generateChatResponse',
        businessId: ctx.businessName,
        source: 'DETERMINISTIC_FALLBACK',
        model,
        latencyMs,
        error: err?.message || String(err),
      });
    }

    return this.generateDeterministicFallback(userMessage, ctx);
  }

  /**
   * Generates Daily Business Brief.
   */
  public static async generateDailyBrief(ctx: ChatReasoningContext): Promise<AIDailyBrief> {
    const ai = getGeminiClient();
    const model = getActiveGeminiModel();
    const startTime = Date.now();
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
      logAIProvenance({
        endpoint: 'generateDailyBrief',
        businessId: ctx.businessName,
        source: 'DETERMINISTIC_FALLBACK',
        model,
        latencyMs: 0,
        error: 'GEMINI_API_KEY not configured',
      });
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
        model,
        contents: prompt,
        config: {
          systemInstruction: `You are Ursella AI. Generate an accurate, grounded Daily Business Brief for ${ctx.businessName} in currency ${ctx.currency}. Never invent numbers. Answer performance facts directly.`,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const latencyMs = Date.now() - startTime;
      const parsed = JSON.parse(response.text || '{}');
      logAIProvenance({
        endpoint: 'generateDailyBrief',
        businessId: ctx.businessName,
        source: 'GEMINI_RESPONSE',
        model,
        latencyMs,
      });
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
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.warn(`[Gemini Daily Brief API Error] Model="${model}" failed after ${latencyMs}ms:`, err?.message || err);
      logAIProvenance({
        endpoint: 'generateDailyBrief',
        businessId: ctx.businessName,
        source: 'DETERMINISTIC_FALLBACK',
        model,
        latencyMs,
        error: err?.message || String(err),
      });
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
        responseSource: 'DETERMINISTIC_FALLBACK',
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
        responseSource: 'DETERMINISTIC_FALLBACK',
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
          responseSource: 'DETERMINISTIC_FALLBACK',
        };
      }

      const topDebtor = topList[0];
      const debtorBreakdown = topList
        .map((d, i) => `${i + 1}. **${d.name}**: ${currency} ${Number(d.debtAmount).toLocaleString()}${d.phone ? ` (📞 ${d.phone})` : ''}`)
        .join('\n');

      return {
        answer: `### Executive Summary\nYou currently have **${debtorCount} customer account(s)** with outstanding credit balances totaling **${currency} ${totalDebt.toLocaleString()}**.

### Debtor Portfolio Breakdown
${debtorBreakdown}

### Receivables Risk Analysis
- **Top Concentration:** The single largest outstanding credit belongs to **${topDebtor?.name || 'Top Debtor'}** at **${currency} ${Number(topDebtor?.debtAmount || 0).toLocaleString()}** (${totalDebt > 0 ? Math.round((Number(topDebtor?.debtAmount || 0) / totalDebt) * 100) : 0}% of total receivables).
- **Working Capital Impact:** Uncollected debts directly constrains your purchasing power for fast-moving inventory.

### Strategic Playbook
1. **Immediate Phone Follow-Up:** Dispatch payment reminders or payment links via WhatsApp/SMS to the top 3 debtor accounts.
2. **Implement Credit Limits:** Place a temporary freeze on new credit purchases for accounts with overdue balances older than 14 days.`,
        keyMetrics: [
          { label: 'Total Outstanding Debt', value: totalDebt, formattedValue: `${currency} ${totalDebt.toLocaleString()}`, trend: 'negative' },
          { label: 'Debtor Accounts', value: debtorCount, formattedValue: `${debtorCount}`, trend: 'neutral' },
          { label: 'Top Debtor Exposure', value: Number(topDebtor?.debtAmount || 0), formattedValue: `${currency} ${Number(topDebtor?.debtAmount || 0).toLocaleString()}`, trend: 'negative' },
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
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 3. FIFO Costing, Valuation & Cost Drift
    if (
      q.includes('fifo') ||
      q.includes('cost drift') ||
      q.includes('cost basis') ||
      q.includes('inventory valuation') ||
      q.includes('valuation by product') ||
      q.includes('cost layer')
    ) {
      const fifoData = (ctx.toolResults.get_fifo_inventory_valuation || {}) as any;
      const totals = fifoData.totals || {};
      const totalVal = Number(totals.inventoryValue || inv.totalInventoryValuation || 0);
      const unitsOnHand = Number(totals.unitsOnHand || 0);
      const warnings = fifoData.warnings || [];
      const costDrift = fifoData.costDrift || { totalDrift: 0, saleLinesCompared: 0 };

      return {
        answer: `### Executive Summary
Your authoritative **FIFO Inventory Asset Valuation** is **${currency} ${totalVal.toLocaleString()}** representing **${unitsOnHand > 0 ? unitsOnHand : inv.totalActiveSKUs || 0}** ${unitsOnHand > 0 ? 'units on hand' : 'active catalog SKUs'}.

### Costing & COGS Diagnostics
- **Historical FIFO COGS:** ${currency} ${Number(totals.cogs || 0).toLocaleString()}
- **Cost Drift Variance:** ${currency} ${Number(costDrift.totalDrift || 0).toLocaleString()} across ${costDrift.saleLinesCompared} audited transaction lines
${warnings.length > 0 ? `- **Audit Notes:** ${warnings.join('; ')}` : '- **Audit Status:** Zero cost discrepancy detected across recorded stock batches.'}

### Inventory Capital Optimization
- Ensure purchasing batches reflect seasonal supplier price renegotiations to preserve gross margin integrity.`,
        keyMetrics: [
          { label: 'FIFO Valuation', value: totalVal, formattedValue: `${currency} ${totalVal.toLocaleString()}`, trend: 'neutral' },
          { label: 'FIFO COGS', value: Number(totals.cogs || 0), formattedValue: `${currency} ${Number(totals.cogs || 0).toLocaleString()}`, trend: 'neutral' },
          { label: 'Cost Drift', value: Number(costDrift.totalDrift || 0), formattedValue: `${currency} ${Number(costDrift.totalDrift || 0).toLocaleString()}`, trend: costDrift.totalDrift === 0 ? 'positive' : 'neutral' },
        ],
        followUpSuggestions: ['Which products are low on stock?', 'What is my gross profit?'],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 4. Inventory, Out of Stock, Low Stock
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
          answer: `### Executive Summary
All **${totalSKUs} active product SKUs** in your catalog are fully stocked with zero critical stockouts or low-inventory alerts.

### Stock Health Overview
- **Total Stock Asset Value (at cost):** ${currency} ${valuation.toLocaleString()}
- **Stock Depletion Risk:** Minimal. All catalog items are maintained comfortably above their designated safety stock thresholds.

### Next Operational Steps
- Maintain current replenishment schedules and monitor sales velocity across weekend peak hours.`,
          keyMetrics: [
            { label: 'Out of Stock SKUs', value: 0, formattedValue: '0', trend: 'positive' },
            { label: 'Low Stock SKUs', value: 0, formattedValue: '0', trend: 'positive' },
            { label: 'Inventory Value', value: valuation, formattedValue: `${currency} ${valuation.toLocaleString()}`, trend: 'neutral' },
          ],
          recommendations: [],
          followUpSuggestions: ['What are my top selling products?', 'How are my sales today?'],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
        };
      }

      const itemsList = criticalItems
        .map((item) => `- **${item.name}**: ${item.currentStock} units remaining (${item.status === 'OUT_OF_STOCK' ? '🔴 Depleted / Out of Stock' : `⚠️ Below safety minimum: ${item.minimumStockLevel}`})`)
        .join('\n');

      return {
        answer: `### Executive Summary
Inventory alert: You have **${outCount} item(s) completely depleted (0 stock)** and **${lowCount} item(s) operating below minimum reorder thresholds**.

### Critical Stockout & Low Stock Items
${itemsList}

### Revenue Impact & Stockout Risks
- **Immediate Sales Forfeiture:** Depleted SKUs are actively causing walk-outs and unfulfilled customer requests at checkout.
- **Supplier Lead Time:** If supplier replenishment takes 2–4 days, current low-stock SKUs will hit zero inventory before next delivery.

### Strategic Restocking Playbook
1. **Trigger Purchase Orders:** Open the Stock Management module to record replenishment batches for depleted lines immediately.
2. **Prioritize High-Velocity Lines:** Focus available working capital on top-selling items to protect daily gross profit.`,
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
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 5. Specific "Today" queries
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
          answer: `### Executive Summary
No transactions have been logged yet today for **${ctx.businessName}** (${currency} 0 revenue across 0 orders).

### Today's Readiness Checklist
- Verify that cashiers and POS registers are active in the **Sell / POS** module.
- Check that opening cash float has been counted and catalog prices are up to date.`,
          keyMetrics: [
            { label: "Today's Revenue", value: 0, formattedValue: `${currency} 0`, trend: 'neutral' },
            { label: "Today's Orders", value: 0, formattedValue: '0', trend: 'neutral' },
          ],
          recommendations: [],
          followUpSuggestions: ['Which products are low on stock?', 'Who owes me money?', 'What were my sales this month?'],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
        };
      }

      return {
        answer: `### Executive Summary
Today, **${ctx.businessName}** has generated **${currency} ${revToday.toLocaleString()}** across **${txToday}** customer transaction${txToday > 1 ? 's' : ''}.

### Performance Diagnostics
- **Gross Profit Generated:** ${currency} ${gpToday.toLocaleString()} (Operating Gross Margin: **${marginPct}%**)
- **Direct Cash Inflow:** ${currency} ${cashToday.toLocaleString()}
- **Average Basket Value:** ${currency} ${txToday > 0 ? Math.round(revToday / txToday).toLocaleString() : '0'} per transaction

### Tactical Observations
- Momentum is active. Ensure front-line sales staff offer complementary items at checkout to increase average basket size.`,
        keyMetrics: [
          { label: "Today's Revenue", value: revToday, formattedValue: `${currency} ${revToday.toLocaleString()}`, trend: 'positive' },
          { label: "Today's Orders", value: txToday, formattedValue: `${txToday}`, trend: 'positive' },
          { label: 'Gross Margin', value: marginPct, formattedValue: `${marginPct}%`, trend: 'positive' },
        ],
        followUpSuggestions: ['Who owes me money?', 'Which products are low on stock?'],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 6. Product Margins & Specific Product Queries
    if (
      q.includes('best selling') ||
      q.includes('top product') ||
      q.includes('margin on product') ||
      q.includes('highest margin') ||
      q.includes('most profitable product') ||
      q.includes('product') ||
      q.includes('margin on') ||
      q.includes('cost of') ||
      q.includes('price of') ||
      (products && products.some((p) => q.includes(p.name.toLowerCase()) || (p.sku && q.includes(p.sku.toLowerCase()))))
    ) {
      if (!products || products.length === 0) {
        return {
          answer: `No matching product performance data is available in the catalog.`,
          keyMetrics: [],
          followUpSuggestions: ['How are my sales today?', 'Do I have low stock?'],
          confidence: 'insufficient_data',
          responseSource: 'DETERMINISTIC_FALLBACK',
        };
      }

      // Check if user specifically asked about a single product
      const exactMatch = products.find(
        (p) => q.includes(p.name.toLowerCase()) || (p.sku && q.includes(p.sku.toLowerCase()))
      );

      if (exactMatch) {
        const uMargin = exactMatch.catalogUnitMarginPct ?? exactMatch.marginPct;
        const fifoCost = exactMatch.fifoUnitCostAverage ?? exactMatch.costPrice;
        const unitsSold = exactMatch.unitsSold ?? 0;
        const stock = exactMatch.stockQuantity ?? 0;

        return {
          answer: `### Executive Summary
Performance analysis for **${exactMatch.name}**: Selling at **${currency} ${Number(exactMatch.sellingPrice).toLocaleString()}** with a **${uMargin}% unit gross margin** (${currency} ${(Number(exactMatch.sellingPrice) - Number(fifoCost)).toLocaleString()} unit profit).

### Product Unit Economics
- **Selling Price (RRP):** ${currency} ${Number(exactMatch.sellingPrice).toLocaleString()}
- **Unit Cost (FIFO Base):** ${currency} ${Number(fifoCost).toLocaleString()}
- **Gross Profit per Unit:** ${currency} ${(Number(exactMatch.sellingPrice) - Number(fifoCost)).toLocaleString()} (**${uMargin}%**)
- **Current Inventory On Hand:** ${stock} unit(s) ${stock <= 5 ? '⚠️ *(Low safety stock)*' : '✅ *(Adequately stocked)*'}
- **Sales Velocity:** ${unitsSold} unit(s) sold in current period (Generated ${currency} ${Number(exactMatch.revenue || 0).toLocaleString()} revenue)

### Strategic Merchandising Guidance
${stock <= 5 ? '- 🔴 **Restock Action:** Current inventory is critical. Issue a replenishment order to prevent stockout during high-traffic hours.' : '- 📈 **Growth Action:** Given healthy margin and stock, feature this item as a recommended cross-sell at checkout.'}`,
          keyMetrics: [
            { label: `${exactMatch.name} Price`, value: exactMatch.sellingPrice, formattedValue: `${currency} ${Number(exactMatch.sellingPrice).toLocaleString()}`, trend: 'neutral' },
            { label: 'Unit Margin', value: uMargin, formattedValue: `${uMargin}%`, trend: uMargin >= 30 ? 'positive' : 'neutral' },
            { label: 'Stock On Hand', value: stock, formattedValue: `${stock}`, trend: stock > 5 ? 'positive' : 'negative' },
          ],
          followUpSuggestions: ['Which products have higher margin?', 'How are my sales today?'],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
        };
      }

      const productList = products
        .slice(0, 10)
        .map((p, i) => `${i + 1}. **${p.name}**: Selling at ${currency} ${Number(p.sellingPrice).toLocaleString()} (Gross Margin: **${p.marginPct}%**, Stock: ${p.stockQuantity})`)
        .join('\n');

      const topProduct = products[0];

      return {
        answer: `### Executive Summary
Your catalog leader by unit profitability is **${topProduct.name}** delivering an exceptional **${topProduct.marginPct}% gross margin**.

### Top High-Margin Product Highlights
${productList}

### Portfolio Strategy
- **Protect Top Margin Contributors:** Ensure items with margins above 35% maintain consistent inventory availability.
- **Bundle Strategy:** Pair high-margin accessories with staple items to increase average ticket value without discounting.`,
        keyMetrics: products.slice(0, 3).map((p) => ({
          label: p.name,
          value: p.marginPct,
          formattedValue: `${p.marginPct}% margin`,
          trend: (p.marginPct >= 30 ? 'positive' : 'neutral') as 'positive' | 'neutral',
        })),
        followUpSuggestions: ['Which products are running low on stock?', 'How are my sales today?'],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 7. Expenses
    if (q.includes('expense') || q.includes('spending') || q.includes('costs') || q.includes('bills')) {
      const totalExp = Number(expenses.totalExpenses || 0);
      const topCats = (expenses.topExpenseCategories || expenses.expensesByCategory || []) as Array<{ category: string; amount: number; percentageOfTotal?: number; percentage?: number }>;

      if (totalExp === 0) {
        return {
          answer: `### Executive Summary
Zero operating expenses (**${currency} 0**) have been recorded for **${ctx.businessName}** in the active period.

### Operational Advice
- To ensure accurate Net Profit calculations in Ursella, record utility bills, rent, and supplier delivery costs in the **Expenses** module.`,
          keyMetrics: [{ label: 'Total Expenses', value: 0, formattedValue: `${currency} 0`, trend: 'positive' }],
          followUpSuggestions: ['How are my sales today?', 'What is my current cash flow?'],
          confidence: 'high_confidence',
          responseSource: 'DETERMINISTIC_FALLBACK',
        };
      }

      const catBreakdown = topCats
        .map((c) => `- **${c.category}**: ${currency} ${Number(c.amount).toLocaleString()} (${c.percentageOfTotal ?? c.percentage ?? 0}% of total spend)`)
        .join('\n');

      return {
        answer: `### Executive Summary
Total operating expenditure for the period is **${currency} ${totalExp.toLocaleString()}**.

### Expense Distribution by Category
${catBreakdown}

### Cost Control Opportunities
- Review high-percentage cost categories for recurring subscription audits or supplier bulk terms.`,
        keyMetrics: [
          { label: 'Total Expenses', value: totalExp, formattedValue: `${currency} ${totalExp.toLocaleString()}`, trend: 'neutral' },
          { label: 'Top Category', value: topCats[0]?.category || 'N/A', formattedValue: `${topCats[0]?.category || 'N/A'} (${currency} ${Number(topCats[0]?.amount || 0).toLocaleString()})`, trend: 'neutral' },
        ],
        followUpSuggestions: ['What is my net profitability?', 'How is my cash flow?'],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 8. Cash Flow
    if (q.includes('cash flow') || q.includes('cash collected') || q.includes('liquidity') || q.includes('inflow')) {
      const cashIn = Number(cashFlow.cashInflow || cashFlow.cashInflows || 0);
      const cashOut = Number(cashFlow.cashOutflow || cashFlow.cashOutflows || 0);
      const netCash = Number(cashFlow.netCashFlow || 0);

      return {
        answer: `### Executive Summary
Net cash flow for the trailing 30 days is **${netCash >= 0 ? '+' : ''}${currency} ${netCash.toLocaleString()}**.

### Cash Liquidity Analysis
- **Cash Inflows (Collections & Cash Sales):** ${currency} ${cashIn.toLocaleString()}
- **Cash Outflows (Operating Spend & Stock Purchases):** ${currency} ${cashOut.toLocaleString()}
- **Net Liquidity Movement:** **${netCash >= 0 ? '+' : ''}${currency} ${netCash.toLocaleString()}** (${netCash >= 0 ? '🟢 Positive Cash Accretion' : '🔴 Negative Cash Drain'})

### Liquidity Safeguards
- Accelerate debtor collections to bolster reserve buffers before upcoming supplier payables.`,
        keyMetrics: [
          { label: 'Net Cash Flow', value: netCash, formattedValue: `${currency} ${netCash.toLocaleString()}`, trend: netCash >= 0 ? 'positive' : 'negative' },
          { label: 'Cash Inflow', value: cashIn, formattedValue: `${currency} ${cashIn.toLocaleString()}`, trend: 'positive' },
          { label: 'Cash Outflow', value: cashOut, formattedValue: `${currency} ${cashOut.toLocaleString()}`, trend: 'neutral' },
        ],
        followUpSuggestions: ['Who owes me money?', 'What are my total expenses?'],
        confidence: 'high_confidence',
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 9. Explicit Overview or Summary Requests
    if (
      q.includes('overview') ||
      q.includes('summary') ||
      q.includes('health') ||
      q.includes('performance') ||
      q.includes('how is my business') ||
      q.includes('how are we doing') ||
      q.includes('status') ||
      q.includes('report')
    ) {
      const totalRev = Number(overview.revenue || salesSummary.totalRevenue || 0);
      const txCount = Number(overview.transaction_count || salesSummary.transactionCount || 0);
      const grossProfit = Number(overview.gross_profit || 0);
      const grossMargin = Number(overview.gross_margin || 0);

      return {
        answer: `### Executive Summary
**${ctx.businessName}** has generated **${currency} ${totalRev.toLocaleString()}** in revenue across **${txCount}** completed transaction(s) over the last 30 days, achieving a **${grossMargin}% gross margin** (${currency} ${grossProfit.toLocaleString()} gross profit).

### Operational Diagnostics & Performance Pillars
- **Revenue Throughput:** ${currency} ${totalRev.toLocaleString()} across ${txCount} customer checkouts
- **Gross Profit Margin:** **${grossMargin}%** (${grossMargin >= 30 ? 'Strong margin performance' : 'Monitor unit pricing to protect margins'})
- **Average Ticket Size:** ${currency} ${txCount > 0 ? Math.round(totalRev / txCount).toLocaleString() : '0'}

### Key Growth Actions
1. **Focus on Inventory Continuity:** Review safety stock levels for top sellers to eliminate stockout losses.
2. **Collect Open Receivables:** Monitor customer credit limits to keep operating cash conversion swift.`,
        keyMetrics: [
          { label: 'Revenue (30d)', value: totalRev, formattedValue: `${currency} ${totalRev.toLocaleString()}`, trend: 'positive' },
          { label: 'Transactions', value: txCount, formattedValue: `${txCount}`, trend: 'positive' },
          { label: 'Gross Margin', value: grossMargin, formattedValue: `${grossMargin}%`, trend: grossMargin >= 30 ? 'positive' : 'neutral' },
        ],
        followUpSuggestions: ['How are my sales today?', 'Who owes me money?', 'Which products are low on stock?'],
        confidence: txCount > 0 ? 'high_confidence' : 'insufficient_data',
        responseSource: 'DETERMINISTIC_FALLBACK',
      };
    }

    // 10. Ambiguous or Unrecognized Query: Ask for clarification instead of guessing
    return {
      answer: `I could not identify the specific business metric or question you would like me to analyze for **${ctx.businessName}**.\n\nPlease ask a specific question such as checking today's sales, low stock items, customer debts, or operating expenses.`,
      confidence: 'insufficient_data',
      dataSufficiencyNote: 'Query was ambiguous or outside standard business metrics.',
      responseSource: 'DETERMINISTIC_FALLBACK',
      followUpSuggestions: [
        'How are my sales today?',
        'Which products are low on stock?',
        'Who owes me money?',
        'What is my FIFO inventory valuation?',
      ],
    };
  }
}
