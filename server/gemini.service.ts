import { GoogleGenAI } from '@google/genai';
import { type AIStructuredResponse, type AIDailyBrief } from '../src/types/ai.ts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

let genAIClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('MY_GEMINI_API_KEY') || GEMINI_API_KEY.length < 10) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

export interface ChatReasoningContext {
  businessName: string;
  businessType: string;
  currency: string;
  currencySymbol?: string;
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
   * Builds the strict Ursella system instruction.
   */
  private static buildSystemInstruction(ctx: ChatReasoningContext): string {
    return `You are Ursella, a smart, conversational, and highly capable AI business co-pilot and operating assistant for "${ctx.businessName}" (${ctx.businessType}).

STORE & MERCHANT IDENTITY (CRITICAL USER PREFERENCES):
- Business / Store Name: "${ctx.businessName}"
  * YOU MUST ALWAYS know and address the store as "${ctx.businessName}".
  * If the merchant asks "What is my business name?", "What's my store name?", or "Who am I?", explicitly tell them "${ctx.businessName}".
- Active Operating Currency: "${ctx.currency}"
  * YOU MUST ALWAYS format every monetary amount, price, cost, debt, revenue, or expense with "${ctx.currency}".
  * Never use generic "USD" or "$" unless the configured currency is USD.
  * If the merchant asks "What currency am I using?" or "What is my currency?", explicitly state "${ctx.currency}".
- Industry / Business Category: "${ctx.businessType}"
- Timezone: "${ctx.timezone}"
- Owner / Operator: "${ctx.ownerName || 'Store Owner'}"
${ctx.address ? `- Store Address / Location: "${ctx.address}"` : ''}
${ctx.taxRate !== undefined ? `- Configured Tax Rate: ${ctx.taxRate}%` : ''}

APPLICATION ARCHITECTURE & WORKFLOW KNOWLEDGE:
You have complete, in-depth understanding of the Ursella Business OS application and all its features:
1. Home / Dashboard: Key performance indicators (Revenue, Gross Margin, Cash Collected, Debtor Receivables), daily sales trends, daily briefing modal, recent transactional logs, and proactive intelligence alerts.
2. Sell / POS Terminal: Rapid barcode and SKU search checkout, cart management, instant printable/shareable digital receipts, customer assignment, and flexible split-payment tender (Cash, Mobile Money, Bank Transfer, Customer Debt Ledger).
3. Business & Stock:
   - Products Catalog: Product SKU, barcode, selling price, unit cost, inventory alerts threshold, product active/archived state.
   - Stock Audit Ledger: Real-time, immutable transaction log tracking all stock increments and decrements (Purchases, Restocks, Sales deductions, Damages, Returns, Initial Balance).
   - Categories: Product grouping and organization.
   - Operating Expenses: Categorized expense logging (Rent, Salaries, Utilities, Marketing, Logistics, Taxes) with recurring intervals.
4. Customers & CRM: Customer directory, contact details, total lifetime spend, unpaid debt tracking, debt settlements, and automated WhatsApp/SMS payment reminders.
5. Proactive AI & Insights: Background automated event detection (revenue anomalies, low stock warnings, debtor risk spikes), safe action preview and one-click execution with safety logs.
6. Analytics & Reports: Period-over-period comparisons, profit & loss breakdown, cash flow trends, tax estimates, CSV / Excel / PDF exportable reports.
7. Data Hub & Settings: Backup/Restore JSON exports, business metadata, default currency (${ctx.currency}), timezone (${ctx.timezone}), tax configurations, user roles (Owner, Manager, Cashier), and notification preferences.

PERSONA & CONVERSATIONAL STYLE:
- Talk like an experienced, supportive business partner chatting naturally in a modern messaging app.
- Answer the user's question directly, clearly, and conversationally in the very first sentence.
- Always be ready to guide the user on where to find things in the app and how to perform tasks.
- Format responses cleanly with Markdown:
  * Bold key numbers, totals, currency figures (${ctx.currency}), product names, and section names.
  * Use concise bullet points for multiple items or steps.
  * Keep paragraphs short (1-3 sentences) so the chat has room to breathe.

ACCURACY & GROUNDING:
- Rely strictly on the provided business metrics for financial numbers. Never hallucinate data.
- Currency: ${ctx.currency}. Reference Date: ${ctx.currentDateIso.split('T')[0]}.

OUTPUT FORMAT:
Respond with a JSON object strictly adhering to this schema:
{
  "answer": "A friendly, conversational markdown chat response answering the question with bolded numbers or step-by-step guidance.",
  "keyMetrics": [
    { "label": "Metric Name", "value": 12000, "formattedValue": "12,000 ${ctx.currency}", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Brief explanation",
      "actionSuggestion": "Actionable next step",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": [
    "Short conversational follow-up question 1",
    "Short conversational follow-up question 2"
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

    // Context payload
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
      // Fallback deterministic synthesis when Gemini API key is not configured or in local sandbox
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
              'How are my sales compared to last month?',
              'Which products are low on stock?',
              'Who owes me money?',
            ],
            proposedAction: parsed.proposedAction,
          };
        }
      } catch {
        // If JSON parsing fails, wrap plain text cleanly
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
    const briefFacts = ctx.toolResults.get_daily_brief_facts as any;
    const today = briefFacts?.todayMetrics || {
      revenueToday: 0,
      transactionCountToday: 0,
      cashCollectedToday: 0,
      expensesToday: 0,
    };
    const debtors = briefFacts?.debtorAlerts || { debtorsCount: 0, totalOutstandingDebt: 0 };

    if (!ai) {
      return this.generateDeterministicDailyBrief(ctx, briefFacts);
    }

    try {
      const prompt = `Generate a concise, professional executive Daily Business Brief for "${ctx.businessName}" based on today's factual metrics:
${JSON.stringify(briefFacts, null, 2)}

Return a valid JSON object matching the schema:
{
  "headline": "Punchy 1-sentence headline of today's status",
  "executiveSummary": "2-3 sentence overview of revenue, cash collection, and immediate risks.",
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
      revenueToday: 0,
      transactionCountToday: 0,
      cashCollectedToday: 0,
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
          : `Daily Briefing: Ready for trading. No sales completed yet today.`,
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
    const inv = (ctx.toolResults.get_inventory_alerts || {}) as any;
    const debtors = (ctx.toolResults.get_customer_balances || {}) as any;
    const products = (ctx.toolResults.get_product_performance || []) as any[];
    const comp = (ctx.toolResults.get_period_comparison || {}) as any;
    const expenses = (ctx.toolResults.get_expense_summary || {}) as any;

    const currency = ctx.currency || 'USD';

    // 0. Store Identity & Preferences Queries ("What is my business name?", "What currency do I use?")
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
        answer: `Your active business is **${ctx.businessName}**!\n\nHere are your current store details:\n- 🏢 **Store Name:** ${ctx.businessName}\n- 🏷️ **Business Type:** ${ctx.businessType}\n- 💱 **Currency:** ${currency}\n- 🌐 **Timezone:** ${ctx.timezone}${ctx.ownerName ? `\n- 👤 **Owner/User:** ${ctx.ownerName}` : ''}${ctx.address ? `\n- 📍 **Address:** ${ctx.address}` : ''}\n\nYou can customize these anytime in **Settings** (Settings → Business Profile).`,
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
          'What are my sales today?',
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
      q.includes('currency do we use') ||
      q.includes('money unit')
    ) {
      return {
        answer: `Your store's active operating currency is **${currency}**.\n\nAll selling prices, POS sales receipts, product costs, debtor balances, and analytics reports for **${ctx.businessName}** are tracked in **${currency}**.\n\nYou can change this anytime in **Settings** (Settings → Business Profile).`,
        keyMetrics: [
          {
            label: 'Operating Currency',
            value: currency,
            formattedValue: currency,
            trend: 'neutral',
          },
        ],
        followUpSuggestions: [
          'What are my sales today?',
          'What is my total receivables?',
          'What are my top selling products?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 0. App navigation, help, preferences, or features query
    if (
      q.includes('how to') ||
      q.includes('where is') ||
      q.includes('where do i') ||
      q.includes('how do i') ||
      q.includes('preference') ||
      q.includes('setting') ||
      q.includes('feature') ||
      q.includes('help')
    ) {
      if (q.includes('product') || q.includes('add item') || q.includes('catalog')) {
        return {
          answer: `To add or manage products:\n\n1. Go to **Business & Stock** in the navigation menu.\n2. Click the **Add Product** button in the Products Catalog tab.\n3. Enter the product title, barcode/SKU, selling price, unit cost, and minimum alert threshold.\n4. Click **Save Product**.\n\nYour products will immediately appear in the **Sell (POS)** checkout terminal!`,
          followUpSuggestions: ['How do I record a sale?', 'Check inventory stock'],
          confidence: 'high_confidence',
        };
      }
      if (q.includes('sale') || q.includes('pos') || q.includes('receipt') || q.includes('checkout')) {
        return {
          answer: `To make a sale in the POS terminal:\n\n1. Open the **Sell / POS** module.\n2. Tap products to add them to your cart or search by name/SKU.\n3. Choose your customer (optional).\n4. Select payment method (**Cash**, **Mobile Money**, **Transfer**, or **Customer Debt**).\n5. Click **Complete Sale** to record the transaction and generate a digital receipt!`,
          followUpSuggestions: ['How are my sales today?', 'Who owes me money?'],
          confidence: 'high_confidence',
        };
      }
      if (q.includes('debt') || q.includes('customer') || q.includes('reminder') || q.includes('owe')) {
        return {
          answer: `To manage customers and debts:\n\n1. Go to **Customers & CRM**.\n2. View customer directories, lifetime spend, and outstanding balances.\n3. Click **Record Payment** to settle a debt or click **Send Reminder** to send a WhatsApp payment notice.`,
          followUpSuggestions: ['Who owes me money?', 'How are my sales today?'],
          confidence: 'high_confidence',
        };
      }
      if (q.includes('preference') || q.includes('notification') || q.includes('setting') || q.includes('currency') || q.includes('quiet hour')) {
        return {
          answer: `You can configure all your business preferences in **Settings**:\n\n- **Business Profile:** Update store name, type, currency (**${currency}**), and timezone (**${ctx.timezone}**).\n- **Notification Preferences:** Adjust alert thresholds, choose monitored categories (Sales, Inventory, Debts), and set quiet hours.\n- **Proactive AI Rules:** Manage automated trigger thresholds and action execution settings.`,
          followUpSuggestions: ['What are my sales today?', 'What can you do?'],
          confidence: 'high_confidence',
        };
      }
      if (q.includes('expense')) {
        return {
          answer: `To record an operating expense:\n\n1. Navigate to **Business & Stock**.\n2. Switch to the **Expenses** tab.\n3. Click **Log Expense**, enter the amount, choose category (Rent, Utilities, Wages, etc.), and save.\n\nYour net profit margins in **Analytics** will update automatically!`,
          followUpSuggestions: ['What are my total expenses?', 'What is my net profit?'],
          confidence: 'high_confidence',
        };
      }
      return {
        answer: `Here is a quick overview of what you can do in **Ursella Business OS**:\n\n- 🛒 **Sell / POS:** Ring up orders, handle split tender, and print receipts.\n- 📦 **Business & Stock:** Manage products, stock audit ledger, and expenses.\n- 👥 **Customers & CRM:** Track customer balances and send debt reminders.\n- 📊 **Analytics & Reports:** View P&L statements, cash flow, and export reports.\n- ⚡ **Proactive AI:** Continuous anomaly detection and smart action suggestions.\n\nWhat would you like assistance with?`,
        followUpSuggestions: ['How do I add a product?', 'What are my sales today?', 'Who owes me money?'],
        confidence: 'high_confidence',
      };
    }

    // 0. Greetings / Casual conversation
    if (
      q === 'hi' ||
      q === 'hello' ||
      q === 'hey' ||
      q.startsWith('hi ') ||
      q.startsWith('hello ') ||
      q.includes('how are you') ||
      q.includes('what can you do')
    ) {
      return {
        answer: `Hello! 👋 I'm **Ursella**, your business assistant. I'm connected to your real-time records for **${ctx.businessName}**.\n\nAsk me anything about:\n- 📈 **Today's sales & revenue**\n- 📦 **Low stock & out-of-stock items**\n- 👥 **Customer debts & balances**\n- 💡 **Profit margins & expenses**\n\nWhat would you like to check?`,
        followUpSuggestions: [
          'What are my sales today?',
          'Which products are low on stock?',
          'Who owes me money?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 1. Receivables Query
    if (q.includes('owe') || q.includes('debt') || q.includes('unpaid') || q.includes('receivable') || q.includes('credit balance')) {
      const debtAmount = Number(debtors.totalOutstandingDebt || overview.outstanding_receivables || 0);
      const count = debtors.debtorsCount || 0;
      const topList = (debtors.topDebtors || []).slice(0, 3);

      if (debtAmount === 0 || count === 0) {
        return {
          answer: `Great news! 🎉 You currently have **no outstanding customer debts** recorded for **${ctx.businessName}**. All accounts are settled up.`,
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
        answer: `You currently have **${currency} ${debtAmount.toLocaleString()}** in outstanding debt across **${count}** customer${count > 1 ? 's' : ''}.\n\n${debtorListText ? `**Top Unpaid Balances:**\n${debtorListText}\n\n` : ''}💡 *Tip:* Following up with friendly payment reminders helps keep your working cash flow healthy.`,
        keyMetrics: [
          {
            label: 'Total Receivables',
            value: debtAmount,
            formattedValue: `${currency} ${debtAmount.toLocaleString()}`,
            trend: 'negative',
          },
        ],
        recommendations: [
          {
            id: 'rec-debt',
            title: 'Send Friendly Debt Reminders',
            reasoning: `${currency} ${debtAmount.toLocaleString()} is currently tied up in unpaid balances.`,
            actionSuggestion: 'Check customer details and send payment notifications.',
            priority: 'high',
          },
        ],
        confidence: 'high_confidence',
        followUpSuggestions: [
          'Which products are low on stock?',
          'What were my sales today?',
          'What is my profit margin?',
        ],
      };
    }

    // 2. Inventory / Low Stock Query
    if (q.includes('stock') || q.includes('inventory') || q.includes('restock') || q.includes('low') || q.includes('run out')) {
      const outCount = inv.outOfStockCount || 0;
      const lowCount = inv.lowStockCount || 0;
      const items = (inv.criticalItemsToRestock || []).slice(0, 4);

      if (outCount === 0 && lowCount === 0) {
        return {
          answer: `All your inventory items are currently well-stocked! 📦 There are no products out of stock or below minimum levels right now for **${ctx.businessName}**.`,
          followUpSuggestions: [
            'What are my top selling products?',
            'How are sales today?',
          ],
          confidence: 'high_confidence',
        };
      }

      const itemsText = items.length
        ? items.map((i: any) => `• **${i.name}**: ${i.currentStock} left (Min threshold: ${i.minimumStockLevel})`).join('\n')
        : '';

      return {
        answer: `Here is your current stock alert:\n\n- **${outCount}** item${outCount === 1 ? ' is' : 's are'} completely out of stock.\n- **${lowCount}** item${lowCount === 1 ? ' is' : 's are'} running low.\n\n${itemsText ? `**Items needing restock:**\n${itemsText}\n\n` : ''}💡 *Tip:* Reordering depleted SKUs early prevents lost sales during peak hours.`,
        keyMetrics: [
          {
            label: 'Out of Stock',
            value: outCount,
            trend: outCount > 0 ? 'negative' : 'positive',
          },
          {
            label: 'Low Stock',
            value: lowCount,
            trend: lowCount > 0 ? 'negative' : 'neutral',
          },
        ],
        recommendations: [
          {
            id: 'rec-stock',
            title: 'Prepare Restock Order',
            reasoning: `${outCount + lowCount} products need urgent supplier replenishment.`,
            actionSuggestion: 'Contact your supplier to replenish critical items.',
            priority: outCount > 0 ? 'high' : 'medium',
          },
        ],
        confidence: 'high_confidence',
        followUpSuggestions: [
          'What are my top selling products?',
          'Who owes me money?',
          'How is my revenue today?',
        ],
      };
    }

    // 3. Top Products Query
    if (q.includes('top product') || q.includes('best seller') || q.includes('selling') || q.includes('popular')) {
      const topProducts = (products || []).slice(0, 4);
      if (!topProducts.length) {
        return {
          answer: `You haven't logged enough sales yet to rank your best sellers. As you process transactions at the POS, I'll track your highest revenue items here!`,
          followUpSuggestions: ['What are my sales today?', 'Check inventory stock'],
          confidence: 'moderate_confidence',
        };
      }

      const list = topProducts.map((p: any, i: number) => `${i + 1}. **${p.name}** — ${currency} ${Number(p.revenue || 0).toLocaleString()} (${p.unitsSold || 0} units sold)`).join('\n');

      return {
        answer: `Here are your top-performing products:\n\n${list}\n\nThese items generate the bulk of your sales volume!`,
        followUpSuggestions: [
          'Which products are low on stock?',
          'What are my sales today?',
          'What is my gross profit margin?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 4. Expenses Query
    if (q.includes('expense') || q.includes('spend') || q.includes('cost') || q.includes('bill')) {
      const expTotal = Number(expenses.totalExpenses || overview.operating_expenses || 0);
      const count = expenses.expenseCount || 0;

      return {
        answer: `Your recorded operating expenses total **${currency} ${expTotal.toLocaleString()}** across **${count}** entry(ies).\n\nKeeping non-essential operating expenses lean directly protects your bottom-line profit!`,
        keyMetrics: [
          {
            label: 'Total Expenses',
            value: expTotal,
            formattedValue: `${currency} ${expTotal.toLocaleString()}`,
          },
        ],
        followUpSuggestions: [
          'What is my net profit?',
          'How are my sales today?',
        ],
        confidence: 'high_confidence',
      };
    }

    // 5. General Sales & Overview Query
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
        answer: `Welcome to **${ctx.businessName}**! ✨\n\nYou are on a clean slate with **0 transactions** recorded so far.\n\nOnce you record sales in the **Sell (POS)** tab, I'll give you live metrics on revenue, daily profits, and smart alerts!`,
        followUpSuggestions: [
          'Check my stock levels',
          'Who owes me money?',
        ],
        confidence: 'high_confidence',
      };
    }

    return {
      answer: `Here is your current performance for **${ctx.businessName}**:\n\n- **Revenue:** ${currency} ${rev.toLocaleString()}${trendText} from **${tx}** completed sale${tx > 1 ? 's' : ''}.\n- **Gross Profit:** ${currency} ${gp.toLocaleString()} (Margin: **${margin}%**).\n- **Estimated Net Profit:** ${currency} ${net.toLocaleString()}.\n\nYour store is currently running with a **${margin >= 30 ? 'healthy' : 'moderate'}** gross margin.`,
      keyMetrics: [
        {
          label: 'Revenue',
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
        'Which products are low on stock?',
        'Who owes me money?',
        'What are my top products?',
      ],
      confidence: 'high_confidence',
    };
  }
}
