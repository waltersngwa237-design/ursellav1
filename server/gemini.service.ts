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
}

/**
 * Server-side Ursella AI Reasoning Engine.
 * Formulates structured, mathematically grounded business guidance using Google Gemini.
 */
export class GeminiService {
  /**
   * Builds the strict Ursella AI system instruction.
   */
  private static buildSystemInstruction(ctx: ChatReasoningContext): string {
    return `You are Ursella AI, the intelligent, grounded business operating co-pilot inside Ursella Business OS.
You are assisting the owner/operator of "${ctx.businessName}" (${ctx.businessType}).

IDENTITY & PLATFORM PRINCIPLES:
- Application Name: Ursella
- Assistant Name: Ursella AI
- The active business is "${ctx.businessName}". DO NOT say "Welcome to ${ctx.businessName}" as if it's the AI name; "${ctx.businessName}" is the merchant's business.
- NEVER assume that a new conversation implies a brand-new business. All authoritative data for "${ctx.businessName}" is provided in the context.
- Always use the merchant's operating currency: "${ctx.currency}".
- Timezone: "${ctx.timezone}". Reference date: ${ctx.currentDateIso.split('T')[0]}.

GROUNDING & INTEGRITY:
- Base all financial figures strictly on the provided tool metrics. Never hallucinate or invent numbers.
- If sales or transactions exist in the context, accurately report them.
- If 0 sales have been recorded for a specific period (e.g. today), clearly distinguish between "0 sales recorded today" and overall business history.
- Distinguish between "no transactions recorded in the system yet" and "the business has no sales".

COMMERCIAL REASONING & RESPONSE STRUCTURE:
Preferred structure for financial and operational queries:
1. Direct answer with exact numbers formatted in "${ctx.currency}".
2. Contextual interpretation (margins, pace, comparisons).
3. Critical watch item / anomaly (e.g. low stock SKUs, pending receivables) if present in data.
4. Concrete, practical recommended action.

TONE & STYLE:
- Professional, commercially aware, concise, analytical, and practical.
- Avoid generic motivational chatbot clichés, excessive emojis, and fluffy filler.
- Format cleanly with Markdown (bold key metrics, concise lists).

OUTPUT FORMAT:
Respond with a JSON object strictly adhering to this schema:
{
  "answer": "A crisp, structured, markdown-formatted answer grounded in the metrics.",
  "keyMetrics": [
    { "label": "Metric Name", "value": 12000, "formattedValue": "${ctx.currency} 12,000", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Brief explanation",
      "actionSuggestion": "Specific next step",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": [
    "Follow-up question 1",
    "Follow-up question 2"
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
=== BUSINESS METRICS CONTEXT (AUTHORITATIVE SOURCE OF TRUTH) ===
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
            intent: (parsed.intent as any) || 'business_overview',
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
  "executiveSummary": "2-3 sentence overview of revenue, gross margin, cash collection, and immediate risks.",
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
          systemInstruction: `You are Ursella AI. Generate an accurate Daily Business Brief for ${ctx.businessName} in currency ${ctx.currency}. Never invent numbers.`,
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
   */
  private static generateDeterministicFallback(
    query: string,
    ctx: ChatReasoningContext
  ): AIStructuredResponse {
    const q = query.toLowerCase().trim();
    const overview = (ctx.toolResults.get_business_overview || {}) as any;
    const todaySales = (ctx.toolResults.get_today_sales_summary || {}) as any;
    const dailyBrief = (ctx.toolResults.get_daily_brief_facts || {}) as any;
    const inv = (ctx.toolResults.get_inventory_alerts || todaySales.inventoryAlerts || {}) as any;
    const debtors = (ctx.toolResults.get_customer_balances || dailyBrief.debtorAlerts || {}) as any;
    const products = (ctx.toolResults.get_product_performance || []) as any[];
    const comp = (ctx.toolResults.get_period_comparison || {}) as any;
    const expenses = (ctx.toolResults.get_expense_summary || {}) as any;

    const currency = ctx.currency || 'USD';

    // 0. Store Identity & Preferences Queries
    if (
      q.includes('business name') ||
      q.includes('store name') ||
      q.includes('shop name') ||
      q.includes('name of my business') ||
      q.includes('name of this business') ||
      q.includes('what is my store') ||
      q.includes('what is my business') ||
      q.includes('about my store') ||
      q.includes('about my business') ||
      q.includes('who am i') ||
      q.includes('who is the owner')
    ) {
      return {
        answer: `Your active business in Ursella is **${ctx.businessName}**.\n\n- 🏢 **Store Name:** ${ctx.businessName}\n- 🏷️ **Business Type:** ${ctx.businessType}\n- 💱 **Currency:** ${currency}\n- 🌐 **Timezone:** ${ctx.timezone}${ctx.ownerName ? `\n- 👤 **Operator:** ${ctx.ownerName}` : ''}${ctx.address ? `\n- 📍 **Address:** ${ctx.address}` : ''}`,
        keyMetrics: [
          {
            label: 'Business Name',
            value: ctx.businessName,
            formattedValue: ctx.businessName,
            trend: 'neutral',
          },
          {
            label: 'Currency',
            value: currency,
            formattedValue: currency,
            trend: 'neutral',
          },
        ],
        followUpSuggestions: [
          'How are my sales today?',
          'Which products are low on stock?',
          'Who owes me money?',
        ],
        confidence: 'high_confidence',
      };
    }

    if (
      q.includes('currency') ||
      q.includes('what currency') ||
      q.includes('which currency') ||
      q.includes('currency am i using') ||
      q.includes('currency do we use')
    ) {
      return {
        answer: `Your store's active operating currency is **${currency}**.\n\nAll selling prices, POS sales receipts, product costs, debtor balances, and analytics reports for **${ctx.businessName}** are tracked in **${currency}**.`,
        keyMetrics: [
          {
            label: 'Operating Currency',
            value: currency,
            formattedValue: currency,
            trend: 'neutral',
          },
        ],
        followUpSuggestions: [
          'How are my sales today?',
          'What is my total receivables?',
          'What are my top selling products?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 1. Specific "Today" queries ("How are my sales today?", "What did I sell today?", "Revenue today")
    if (
      q.includes('today') ||
      q.includes('sell today') ||
      q.includes('sold today') ||
      q.includes('sales today') ||
      q.includes('revenue today') ||
      q.includes('profit today') ||
      q.includes('orders today') ||
      q.includes('what did i sell today') ||
      q.includes('how much did i sell today') ||
      q.includes('how are my sales today')
    ) {
      const todayRev = Number(todaySales.revenue ?? dailyBrief.todayMetrics?.revenueToday ?? 0);
      const todayTx = Number(todaySales.salesCount ?? dailyBrief.todayMetrics?.transactionCountToday ?? 0);
      const todayCash = Number(todaySales.cashCollected ?? dailyBrief.todayMetrics?.cashCollectedToday ?? 0);
      const todayGp = Number(todaySales.grossProfit ?? (todayRev > 0 ? todayRev * 0.4 : 0));
      const todayMargin = Number(todaySales.grossMarginPct ?? (todayRev > 0 ? 40 : 0));
      const outCount = inv.outOfStockCount || 0;
      const lowCount = inv.lowStockCount || 0;
      const criticalItem = inv.criticalItemsToRestock?.[0];

      let stockAlertText = '';
      if (outCount > 0 || lowCount > 0) {
        stockAlertText = `\n\n⚠️ **Inventory Watch:** ${outCount > 0 ? `${outCount} item(s) out of stock` : ''}${outCount > 0 && lowCount > 0 ? ', ' : ''}${lowCount > 0 ? `${lowCount} item(s) low on stock` : ''}.${criticalItem ? ` (e.g. **${criticalItem.name}** has ${criticalItem.currentStock} left).` : ''}`;
      }

      if (todayTx === 0) {
        const totalHistoricalSales = Number(overview.transaction_count || 0);
        const totalHistoricalRev = Number(overview.revenue || 0);

        return {
          answer: `You haven't recorded any sales today.${totalHistoricalSales > 0 ? ` (Historically, your store has recorded **${currency} ${totalHistoricalRev.toLocaleString()}** across **${totalHistoricalSales}** sales).` : ' Once you process transactions in the **Sell (POS)** module, your real-time revenue and margins will appear here.'}${stockAlertText}`,
          keyMetrics: [
            {
              label: "Today's Revenue",
              value: 0,
              formattedValue: `${currency} 0`,
              trend: 'neutral',
            },
            {
              label: "Today's Orders",
              value: 0,
              formattedValue: '0',
              trend: 'neutral',
            },
          ],
          recommendations: outCount > 0 || lowCount > 0 ? [
            {
              id: 'rec-stock-today',
              title: 'Replenish Depleted SKUs',
              reasoning: `${outCount + lowCount} item(s) need restocking.`,
              actionSuggestion: 'Check inventory and prepare restock order.',
              priority: 'high',
            },
          ] : [],
          followUpSuggestions: [
            'Which products are low on stock?',
            'Who owes me money?',
            'What is my gross profit margin?',
          ],
          confidence: 'high_confidence',
        };
      }

      return {
        answer: `Today, **${ctx.businessName}** has recorded **${currency} ${todayRev.toLocaleString()}** in revenue across **${todayTx}** completed transaction${todayTx > 1 ? 's' : ''}.\n\n- **Gross Profit:** ${currency} ${todayGp.toLocaleString()} (Gross Margin: **${todayMargin}%**)\n- **Cash Collected:** ${currency} ${todayCash.toLocaleString()}${stockAlertText}`,
        keyMetrics: [
          {
            label: "Today's Revenue",
            value: todayRev,
            formattedValue: `${currency} ${todayRev.toLocaleString()}`,
            trend: 'positive',
          },
          {
            label: "Today's Orders",
            value: todayTx,
            formattedValue: `${todayTx}`,
            trend: 'positive',
          },
          {
            label: "Today's Gross Margin",
            value: `${todayMargin}%`,
            trend: todayMargin >= 30 ? 'positive' : 'neutral',
          },
        ],
        followUpSuggestions: [
          'Which products are low on stock?',
          'Who owes me money?',
          'What are my top selling products?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 2. Receivables & Debtors Query
    if (q.includes('owe') || q.includes('debt') || q.includes('unpaid') || q.includes('receivable') || q.includes('credit balance')) {
      const debtAmount = Number(debtors.totalOutstandingDebt || overview.outstanding_receivables || 0);
      const count = debtors.debtorsCount || 0;
      const topList = (debtors.topDebtors || []).slice(0, 3);

      if (debtAmount === 0 || count === 0) {
        return {
          answer: `You currently have **no outstanding customer debts** recorded for **${ctx.businessName}**. All customer accounts are fully settled.`,
          followUpSuggestions: [
            'How are my sales today?',
            'Do I have any low stock items?',
          ],
          confidence: 'high_confidence',
        };
      }

      const debtorListText = topList.length
        ? topList.map((d: any) => `• **${d.name}**: ${currency} ${Number(d.debtAmount).toLocaleString()}`).join('\n')
        : '';

      return {
        answer: `You currently have **${currency} ${debtAmount.toLocaleString()}** in outstanding receivables across **${count}** customer account${count > 1 ? 's' : ''}.\n\n${debtorListText ? `**Top Unpaid Balances:**\n${debtorListText}\n\n` : ''}💡 *Recommendation:* Following up with friendly payment notices in **Customers & CRM** will help convert these balances into cash flow.`,
        keyMetrics: [
          {
            label: 'Total Receivables',
            value: debtAmount,
            formattedValue: `${currency} ${debtAmount.toLocaleString()}`,
            trend: 'negative',
          },
          {
            label: 'Debtor Accounts',
            value: count,
            formattedValue: `${count}`,
            trend: 'negative',
          },
        ],
        recommendations: [
          {
            id: 'rec-debt',
            title: 'Send Payment Reminders',
            reasoning: `${currency} ${debtAmount.toLocaleString()} is currently tied up in outstanding customer credit.`,
            actionSuggestion: 'Open Customers & CRM and send payment reminders.',
            priority: 'high',
          },
        ],
        confidence: 'high_confidence',
        followUpSuggestions: [
          'Which products are low on stock?',
          'What are my sales today?',
          'What is my gross profit margin?',
        ],
      };
    }

    // 3. Inventory / Stock Query
    if (q.includes('stock') || q.includes('inventory') || q.includes('restock') || q.includes('low') || q.includes('run out')) {
      const outCount = inv.outOfStockCount || 0;
      const lowCount = inv.lowStockCount || 0;
      const items = (inv.criticalItemsToRestock || []).slice(0, 5);

      if (outCount === 0 && lowCount === 0) {
        return {
          answer: `All inventory SKUs are currently adequately stocked for **${ctx.businessName}**. No items are out of stock or below their minimum reorder thresholds.`,
          followUpSuggestions: [
            'What are my top selling products?',
            'How are my sales today?',
          ],
          confidence: 'high_confidence',
        };
      }

      const itemsText = items.length
        ? items.map((i: any) => `• **${i.name}**: ${i.currentStock} units left (Min threshold: ${i.minimumStockLevel}) — ${i.status === 'OUT_OF_STOCK' ? '🔴 OUT OF STOCK' : '🟡 LOW STOCK'}`).join('\n')
        : '';

      return {
        answer: `Here is your current stock status for **${ctx.businessName}**:\n\n- **${outCount}** item${outCount === 1 ? ' is' : 's are'} completely out of stock.\n- **${lowCount}** item${lowCount === 1 ? ' is' : 's are'} below minimum threshold.\n\n${itemsText ? `**Critical SKUs to restock:**\n${itemsText}\n\n` : ''}💡 *Recommendation:* Reorder depleted items in **Business & Stock** to prevent lost revenue.`,
        keyMetrics: [
          {
            label: 'Out of Stock SKUs',
            value: outCount,
            formattedValue: `${outCount}`,
            trend: outCount > 0 ? 'negative' : 'positive',
          },
          {
            label: 'Low Stock SKUs',
            value: lowCount,
            formattedValue: `${lowCount}`,
            trend: lowCount > 0 ? 'negative' : 'neutral',
          },
        ],
        recommendations: [
          {
            id: 'rec-stock',
            title: 'Place Restock Order',
            reasoning: `${outCount + lowCount} products require replenishment.`,
            actionSuggestion: 'Create a restock purchase order in Stock Audit Ledger.',
            priority: outCount > 0 ? 'high' : 'medium',
          },
        ],
        confidence: 'high_confidence',
        followUpSuggestions: [
          'What are my top selling products?',
          'Who owes me money?',
          'How are my sales today?',
        ],
      };
    }

    // 4. Products / Best Sellers Query
    if (q.includes('top product') || q.includes('best seller') || q.includes('selling') || q.includes('popular')) {
      const topProducts = (products || []).slice(0, 5);
      if (!topProducts.length) {
        return {
          answer: `No sales data is currently recorded to rank your top-selling products. As you process transactions in the **Sell (POS)** module, your highest-volume items will be ranked here.`,
          followUpSuggestions: ['How are my sales today?', 'Check inventory stock'],
          confidence: 'moderate_confidence',
        };
      }

      const list = topProducts.map((p: any, i: number) => `${i + 1}. **${p.name}** — Selling Price: ${currency} ${Number(p.sellingPrice || 0).toLocaleString()} (Margin: ${p.marginPct || 0}%, Stock: ${p.stockQuantity ?? 'N/A'})`).join('\n');

      return {
        answer: `Here are your catalog products and profit margins for **${ctx.businessName}**:\n\n${list}`,
        followUpSuggestions: [
          'Which products are low on stock?',
          'How are my sales today?',
          'What is my gross profit margin?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 5. Profitability & Margins Query
    if (q.includes('gross margin') || q.includes('profit margin') || q.includes('profit') || q.includes('margin') || q.includes('cogs')) {
      const rev = Number(overview.revenue || 0);
      const cogs = Number(overview.cost_of_goods_sold || 0);
      const gp = Number(overview.gross_profit || 0);
      const margin = Number(overview.gross_margin || 0);
      const opex = Number(overview.operating_expenses || 0);
      const net = Number(overview.estimated_net_profit || 0);

      if (rev === 0) {
        return {
          answer: `No revenue has been recorded in the system yet to calculate gross margin for **${ctx.businessName}**.\n\nGross margin is calculated as: \`((Revenue - Cost of Goods Sold) / Revenue) * 100\`.\nOnce sales are recorded, your margin breakdown will appear here.`,
          followUpSuggestions: ['How are my sales today?', 'Check inventory stock'],
          confidence: 'high_confidence',
        };
      }

      return {
        answer: `Here is your profitability breakdown for **${ctx.businessName}**:\n\n- **Revenue:** ${currency} ${rev.toLocaleString()}\n- **Cost of Goods Sold (COGS):** ${currency} ${cogs.toLocaleString()}\n- **Gross Profit:** ${currency} ${gp.toLocaleString()} (Gross Margin: **${margin}%**)\n- **Operating Expenses:** ${currency} ${opex.toLocaleString()}\n- **Estimated Net Profit:** ${currency} ${net.toLocaleString()}\n\nYour store is operating with a **${margin >= 35 ? 'healthy' : margin >= 20 ? 'moderate' : 'compressed'}** gross margin.`,
        keyMetrics: [
          {
            label: 'Gross Margin',
            value: `${margin}%`,
            formattedValue: `${margin}%`,
            trend: margin >= 30 ? 'positive' : 'neutral',
          },
          {
            label: 'Gross Profit',
            value: gp,
            formattedValue: `${currency} ${gp.toLocaleString()}`,
            trend: gp > 0 ? 'positive' : 'negative',
          },
          {
            label: 'Net Profit',
            value: net,
            formattedValue: `${currency} ${net.toLocaleString()}`,
            trend: net > 0 ? 'positive' : 'negative',
          },
        ],
        followUpSuggestions: [
          'How are my sales today?',
          'What are my total expenses?',
          'Who owes me money?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 6. Expenses Query
    if (q.includes('expense') || q.includes('spend') || q.includes('cost') || q.includes('bill')) {
      const expTotal = Number(expenses.totalExpenses || overview.operating_expenses || 0);
      const topCats = (expenses.topExpenseCategories || []).slice(0, 3);

      const catText = topCats.length
        ? `\n\n**Top Expense Categories:**\n` + topCats.map((c: any) => `• **${c.category}**: ${currency} ${Number(c.amount).toLocaleString()} (${c.percentageOfTotal}%)`).join('\n')
        : '';

      return {
        answer: `Recorded operating expenses for **${ctx.businessName}** total **${currency} ${expTotal.toLocaleString()}** across the selected period.${catText}`,
        keyMetrics: [
          {
            label: 'Operating Expenses',
            value: expTotal,
            formattedValue: `${currency} ${expTotal.toLocaleString()}`,
            trend: 'neutral',
          },
        ],
        followUpSuggestions: [
          'What is my net profit?',
          'How are my sales today?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 7. Recommendations, Strategic Priorities & "What should I do?"
    if (
      q.includes('recommendation') ||
      q.includes('what should i do') ||
      q.includes('focus') ||
      q.includes('next step') ||
      q.includes('advice') ||
      q.includes('priority') ||
      q.includes('hurting') ||
      q.includes('improve')
    ) {
      const rev = Number(overview.revenue || todaySales.revenue || 0);
      const margin = Number(overview.gross_margin || todaySales.grossMarginPct || 0);
      const gp = Number(overview.gross_profit || todaySales.grossProfit || 0);
      const outCount = inv.outOfStockCount || 0;
      const lowCount = inv.lowStockCount || 0;
      const debtAmount = Number(debtors.totalOutstandingDebt || 0);
      const opex = Number(overview.operating_expenses || expenses.totalExpenses || 0);
      const tx = Number(overview.transaction_count || todaySales.salesCount || 0);

      const recs: Array<{ id: string; title: string; reasoning: string; actionSuggestion: string; priority: 'high' | 'medium' | 'low' }> = [];
      const points: string[] = [];

      if (rev > 0 && margin < 30) {
        points.push(`**Improve product profit margins:** You are currently generating a **${margin}%** gross margin. Out of **${currency} ${rev.toLocaleString()}** in revenue, only **${currency} ${gp.toLocaleString()}** remains after direct inventory costs.`);
        recs.push({
          id: 'rec-margin',
          title: 'Review Catalog Pricing & Product Costs',
          reasoning: `A ${margin}% gross margin leaves narrow margin to cover store operating expenses.`,
          actionSuggestion: 'Identify high-margin products to promote and adjust pricing on weak-margin items.',
          priority: 'high',
        });
      }

      if (outCount > 0 || lowCount > 0) {
        points.push(`**Replenish critical inventory:** You have **${outCount}** product(s) completely out of stock and **${lowCount}** below minimum reorder thresholds. Stockouts directly prevent sales.`);
        recs.push({
          id: 'rec-restock',
          title: 'Restock Depleted SKUs',
          reasoning: `${outCount + lowCount} items need replenishment.`,
          actionSuggestion: 'Create purchase orders in Business & Stock.',
          priority: 'high',
        });
      }

      if (debtAmount > 0) {
        points.push(`**Collect pending customer credit:** **${currency} ${debtAmount.toLocaleString()}** is currently tied up across **${debtors.debtorsCount || 1}** customer debtor account(s).`);
        recs.push({
          id: 'rec-debt',
          title: 'Collect Outstanding Customer Credit',
          reasoning: `Converting ${currency} ${debtAmount.toLocaleString()} in receivables into cash boosts operating liquidity.`,
          actionSuggestion: 'Send WhatsApp or SMS payment reminders from Customers & CRM.',
          priority: 'medium',
        });
      }

      if (opex === 0 && rev > 0) {
        points.push(`**Track store operating expenses:** You have recorded **${currency} 0** in operating expenses, so your net take-home profit cannot yet be calculated.`);
        recs.push({
          id: 'rec-expense',
          title: 'Log Operating Expenses',
          reasoning: 'Tracking daily overhead like rent, utilities, and transport shows your true net profit.',
          actionSuggestion: 'Record store expenses in Reports & Accounting.',
          priority: 'medium',
        });
      }

      if (tx === 0) {
        return {
          answer: `Based on your current setup for **${ctx.businessName}**, here are my top recommendations to get started:\n\n1. **Record your initial sales in the POS terminal:** Process transactions in **Sell (POS)** to start generating real-time revenue, gross margin, and inventory tracking.\n2. **Verify product cost and selling prices:** Ensure every catalog item has accurate cost and selling prices so your gross margins are calculated correctly.\n3. **Set minimum stock reorder points:** Set alert thresholds on your fastest-moving items to prevent surprise stockouts.`,
          keyMetrics: [
            {
              label: 'Catalog Items',
              value: products.length,
              formattedValue: `${products.length} products`,
              trend: 'neutral',
            },
          ],
          recommendations: [
            {
              id: 'rec-pos',
              title: 'Process First Sale in POS',
              reasoning: 'Real-time metrics activate as soon as sales are recorded.',
              actionSuggestion: 'Open Sell (POS) and record a transaction.',
              priority: 'high',
            },
          ],
          confidence: 'high_confidence',
          followUpSuggestions: [
            'Which products are low on stock?',
            'What are my catalog margins?',
          ],
        };
      }

      const volumeNote = tx < 5
        ? `\n\n*Note: You have ${tx} completed sale(s) on record, so long-term trends are still preliminary.*`
        : '';

      return {
        answer: `Based on your current numbers for **${ctx.businessName}**, here are my key recommendations:\n\n${points.map((p, i) => `${i + 1}. ${p}`).join('\n\n')}${volumeNote}`,
        keyMetrics: [
          {
            label: 'Gross Margin',
            value: `${margin}%`,
            formattedValue: `${margin}%`,
            trend: margin >= 30 ? 'positive' : 'neutral',
          },
          {
            label: 'Receivables',
            value: debtAmount,
            formattedValue: `${currency} ${debtAmount.toLocaleString()}`,
            trend: debtAmount > 0 ? 'negative' : 'positive',
          },
        ],
        recommendations: recs,
        confidence: tx < 5 ? 'insufficient_data' : 'high_confidence',
        followUpSuggestions: [
          'Which products have the best margins?',
          'Who owes me money?',
          'How are my sales today?',
        ],
      };
    }

    // 8. General Business Overview
    const rev = Number(overview.revenue || 0);
    const gp = Number(overview.gross_profit || 0);
    const margin = Number(overview.gross_margin || 0);
    const net = Number(overview.estimated_net_profit || 0);
    const tx = Number(overview.transaction_count || 0);
    const revChange = comp.revenue?.percentageChange;

    const trendText =
      revChange !== null && revChange !== undefined
        ? ` (${revChange >= 0 ? '+' : ''}${revChange}% vs prior period)`
        : '';

    if (tx === 0) {
      return {
        answer: `No sales transactions have been recorded in the database yet for **${ctx.businessName}**.\n\nOnce you begin ringing up sales in the **Sell (POS)** module, real-time revenue, gross profit margins, and daily analytics will be calculated here automatically.`,
        followUpSuggestions: [
          'Check my stock levels',
          'Who owes me money?',
        ],
        confidence: 'high_confidence',
      };
    }

    return {
      answer: `Here is the current business summary for **${ctx.businessName}**:\n\n- **Revenue:** ${currency} ${rev.toLocaleString()}${trendText} across **${tx}** completed sale${tx > 1 ? 's' : ''}.\n- **Gross Profit:** ${currency} ${gp.toLocaleString()} (Gross Margin: **${margin}%**).\n- **Operating Expenses:** ${currency} ${Number(overview.operating_expenses || 0).toLocaleString()}.\n- **Estimated Net Profit:** ${currency} ${net.toLocaleString()}.\n\nYour store is currently running with a **${margin >= 30 ? 'healthy' : 'moderate'}** gross margin.`,
      keyMetrics: [
        {
          label: 'Total Revenue',
          value: rev,
          formattedValue: `${currency} ${rev.toLocaleString()}`,
          trend: revChange ? (revChange >= 0 ? 'positive' : 'negative') : 'neutral',
        },
        {
          label: 'Gross Margin',
          value: `${margin}%`,
          trend: margin >= 30 ? 'positive' : 'neutral',
        },
        {
          label: 'Net Profit',
          value: net,
          formattedValue: `${currency} ${net.toLocaleString()}`,
          trend: net > 0 ? 'positive' : 'negative',
        },
      ],
      followUpSuggestions: [
        'How are my sales today?',
        'Which products are low on stock?',
        'Who owes me money?',
      ],
      confidence: 'high_confidence',
    };
  }
}
