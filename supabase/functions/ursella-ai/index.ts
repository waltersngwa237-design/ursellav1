// Setup type definitions for built-in Supabase Edge Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequestBody {
  action?: "chat" | "daily-brief" | "proactive-insights";
  businessId: string;
  message?: string;
  conversationId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  preferredTimeHorizonDays?: number;
  businessContext?: {
    businessName?: string;
    businessType?: string;
    currency?: string;
    timezone?: string;
    ownerName?: string;
    address?: string;
    taxRate?: number;
  };
}

/**
 * Calculates start and end ISO date strings for a given timezone and horizon days.
 * For Cameroon (Africa/Douala, UTC+1), "today" starts at midnight Douala time.
 */
function calculateTimezoneRange(timezone: string = "Africa/Douala", days: number = 1): {
  startDateIso: string;
  endDateIso: string;
  todayDateStr: string;
} {
  try {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "01";
    const year = Number(getPart("year"));
    const month = Number(getPart("month"));
    const day = Number(getPart("day"));
    const todayDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMs = tzDate.getTime() - utcDate.getTime();

    const localMidnightUtcEquivalent = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const startOfTodayUtc = new Date(localMidnightUtcEquivalent - offsetMs);
    const startOfRangeUtc = new Date(startOfTodayUtc.getTime() - (days - 1) * 86400000);
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 86400000 - 1);

    return {
      startDateIso: startOfRangeUtc.toISOString(),
      endDateIso: endOfTodayUtc.toISOString(),
      todayDateStr,
    };
  } catch {
    const now = new Date();
    const todayDateStr = now.toISOString().split("T")[0];
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return {
      startDateIso: start.toISOString(),
      endDateIso: end.toISOString(),
      todayDateStr,
    };
  }
}

/**
 * 9-Step Internal Reasoning Intent & Domain Classifier.
 */
function classifyQuery(query: string) {
  const q = query.toLowerCase().trim();

  if (
    q.includes("business name") ||
    q.includes("store name") ||
    q.includes("shop name") ||
    q.includes("name of my business") ||
    q.includes("what is my store") ||
    q.includes("what is my business") ||
    q.includes("operating currency") ||
    q.includes("what currency") ||
    q.includes("which currency") ||
    q.includes("currency am i using") ||
    q.includes("who am i")
  ) {
    return {
      intent: "identity_lookup",
      domain: "store_info",
      timePeriod: "all_time",
      goal: "Answer store identity, active operating currency, or store settings directly.",
    };
  }

  if (
    q.includes("who owes") ||
    q.includes("debt") ||
    q.includes("debtor") ||
    q.includes("unpaid") ||
    q.includes("receivable") ||
    q.includes("owing") ||
    q.includes("credit balance") ||
    q.includes("collect money")
  ) {
    return {
      intent: q.includes("who should i call") || q.includes("priority") ? "recommendation" : "fact_retrieval",
      domain: "debtors",
      timePeriod: "all_time",
      goal: "Answer customer debt balances, top debtor accounts, and unpaid balances directly.",
    };
  }

  if (
    q.includes("low stock") ||
    q.includes("running low") ||
    q.includes("out of stock") ||
    q.includes("restock") ||
    q.includes("inventory") ||
    q.includes("stock level") ||
    q.includes("stockout") ||
    q.includes("reorder")
  ) {
    return {
      intent: q.includes("what should i restock") ? "recommendation" : "fact_retrieval",
      domain: "inventory",
      timePeriod: "all_time",
      goal: "Answer stock quantities, depleted SKUs, and reorder priorities directly.",
    };
  }

  if (
    q.includes("best selling") ||
    q.includes("top product") ||
    q.includes("fastest selling") ||
    q.includes("best seller") ||
    q.includes("highest margin product") ||
    q.includes("most profitable product") ||
    q.includes("margin on product") ||
    q.includes("slow moving")
  ) {
    return {
      intent: "analysis",
      domain: "products",
      timePeriod: "last_30_days",
      goal: "Analyze product sales volume, margins, and catalog unit profit.",
    };
  }

  if (
    q.includes("expense") ||
    q.includes("spending") ||
    q.includes("spent") ||
    q.includes("costs") ||
    q.includes("operating expense") ||
    q.includes("bills")
  ) {
    return {
      intent: "analysis",
      domain: "expenses",
      timePeriod: "last_30_days",
      goal: "Analyze operational expenses and breakdown by category.",
    };
  }

  if (
    q.includes("cash flow") ||
    q.includes("cash collected") ||
    q.includes("inflow") ||
    q.includes("outflow") ||
    q.includes("net cash")
  ) {
    return {
      intent: "analysis",
      domain: "cash_flow",
      timePeriod: "last_30_days",
      goal: "Analyze cash inflows vs outflows and liquidity.",
    };
  }

  if (
    q.includes("gross margin") ||
    q.includes("net profit") ||
    q.includes("profit margin") ||
    q.includes("profitable") ||
    q.includes("margins") ||
    q.includes("profitability") ||
    q.includes("cogs") ||
    q.includes("cost of goods")
  ) {
    return {
      intent: "analysis",
      domain: "profitability",
      timePeriod: "last_30_days",
      goal: "Analyze gross margin %, COGS, and net profitability.",
    };
  }

  if (
    q.includes("why are sales") ||
    q.includes("sales down") ||
    q.includes("sales up") ||
    q.includes("compared") ||
    q.includes("compare") ||
    q.includes("trend")
  ) {
    return {
      intent: "comparison",
      domain: "sales",
      timePeriod: "comparison_period",
      goal: "Compare current period with prior period to diagnose trends.",
    };
  }

  if (
    q.includes("today") ||
    q.includes("sell today") ||
    q.includes("sold today") ||
    q.includes("sales today") ||
    q.includes("revenue today") ||
    q.includes("how are my sales today")
  ) {
    return {
      intent: "fact_retrieval",
      domain: "sales",
      timePeriod: "today",
      goal: "Answer today's exact revenue, orders, gross margin, and cash collection.",
    };
  }

  if (
    q.includes("recommendation") ||
    q.includes("what should i do") ||
    q.includes("focus") ||
    q.includes("advice") ||
    q.includes("priority")
  ) {
    return {
      intent: "recommendation",
      domain: "strategy",
      timePeriod: "last_30_days",
      goal: "Synthesize prioritized strategic business actions grounded in current data.",
    };
  }

  return {
    intent: "general_overview",
    domain: "multi_domain",
    timePeriod: "last_30_days",
    goal: "Provide balanced commercial overview answering user question.",
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? supabaseAnonKey;

    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : supabaseAnonKey;

    // Supabase client with forwarded JWT or Service Role
    const supabaseUserClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    const body: ChatRequestBody = await req.json();
    const { businessId, conversationId, history = [], action = "chat" } = body;
    const message = body.message || (action === "daily-brief" ? "Provide my daily business brief" : "Analyze proactive business insights");

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: "businessId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Resolve Business Metadata
    const { data: businessData } = await supabaseUserClient
      .from("businesses")
      .select("id, name, currency, timezone, business_type, address")
      .eq("id", businessId)
      .maybeSingle();

    const businessName = businessData?.name || body.businessContext?.businessName || "My Business";
    const businessType = businessData?.business_type || body.businessContext?.businessType || "Retail & Trade";
    const currency = businessData?.currency || body.businessContext?.currency || "XAF";
    const timezone = businessData?.timezone || body.businessContext?.timezone || "Africa/Douala";

    // 2. Perform 9-Step Internal Intent & Domain Classification
    const parsedClassification = classifyQuery(message);

    // 3. Timezone calculation
    const { startDateIso: todayStartIso, endDateIso: todayEndIso, todayDateStr } = calculateTimezoneRange(timezone, 1);
    const { startDateIso: monthStartIso, endDateIso: monthEndIso } = calculateTimezoneRange(timezone, 30);

    // 4. Retrieve Fresh Deterministic Business Data from Database
    const [
      salesTodayRes,
      salesMonthRes,
      allSalesCountRes,
      productsRes,
      customersRes,
      expensesMonthRes,
      paymentsTodayRes,
      allUnpaidSalesRes,
    ] = await Promise.all([
      // Sales today
      supabaseUserClient
        .from("sales")
        .select("id, total, amount_paid, amount_due, payment_status, payment_method, sold_at")
        .eq("business_id", businessId)
        .eq("sale_status", "completed")
        .gte("sold_at", todayStartIso)
        .lte("sold_at", todayEndIso),
      // Sales last 30 days
      supabaseUserClient
        .from("sales")
        .select("id, total, amount_paid, amount_due, payment_status, payment_method, sold_at")
        .eq("business_id", businessId)
        .eq("sale_status", "completed")
        .gte("sold_at", monthStartIso)
        .lte("sold_at", monthEndIso),
      // Lifetime sales count
      supabaseUserClient
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("sale_status", "completed"),
      // Products
      supabaseUserClient
        .from("products")
        .select("id, name, sku, cost_price, selling_price, stock_quantity, minimum_stock_level, is_active")
        .eq("business_id", businessId)
        .eq("is_active", true),
      // Customers
      supabaseUserClient
        .from("customers")
        .select("id, name, phone, email, is_active")
        .eq("business_id", businessId),
      // Expenses in last 30 days
      supabaseUserClient
        .from("expenses")
        .select("id, amount, category, description, expense_date")
        .eq("business_id", businessId)
        .gte("expense_date", monthStartIso.split("T")[0])
        .lte("expense_date", monthEndIso.split("T")[0]),
      // Payments received today
      supabaseUserClient
        .from("payments")
        .select("id, amount, payment_method, paid_at")
        .eq("business_id", businessId)
        .gte("paid_at", todayStartIso)
        .lte("paid_at", todayEndIso),
      // Unpaid customer sales to compute exact debtor balances
      supabaseUserClient
        .from("sales")
        .select("id, customer_id, total, amount_paid, amount_due, sold_at")
        .eq("business_id", businessId)
        .eq("sale_status", "completed")
        .gt("amount_due", 0),
    ]);

    const salesToday = salesTodayRes.data || [];
    const salesMonth = salesMonthRes.data || [];
    const totalLifetimeSalesCount = allSalesCountRes.count ?? salesMonth.length;
    const products = productsRes.data || [];
    const customers = customersRes.data || [];
    const expensesMonth = expensesMonthRes.data || [];
    const paymentsToday = paymentsTodayRes.data || [];
    const unpaidSales = allUnpaidSalesRes.data || [];

    // Query sale_items for COGS calculation
    const allRecentSaleIds = [...new Set([...salesToday.map((s: any) => s.id), ...salesMonth.map((s: any) => s.id)])];
    let saleItemsRecent: any[] = [];
    if (allRecentSaleIds.length > 0) {
      const { data: items } = await supabaseUserClient
        .from("sale_items")
        .select("sale_id, product_id, product_name_snapshot, quantity, unit_price, unit_cost, total")
        .in("sale_id", allRecentSaleIds);
      saleItemsRecent = items || [];
    }

    // 5. Deterministic Financial Calculations
    const todayRevenue = salesToday.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const todaySalesCount = salesToday.length;
    const todayCashCollected = paymentsToday.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const todayReceivablesCreated = salesToday.reduce((sum: number, s: any) => sum + Number(s.amount_due || 0), 0);

    const todaySaleIdsSet = new Set(salesToday.map((s: any) => s.id));
    const saleItemsToday = saleItemsRecent.filter((item: any) => todaySaleIdsSet.has(item.sale_id));

    let todayCogs = 0;
    for (const item of saleItemsToday) {
      const qty = Number(item.quantity || 1);
      const unitCost = Number(item.unit_cost || 0);
      todayCogs += unitCost * qty;
    }

    const todayGrossProfit = todayRevenue - todayCogs;
    const todayGrossMargin = todayRevenue > 0 ? (todayGrossProfit / todayRevenue) * 100 : 0;

    // Monthly Calculations
    let monthCogs = 0;
    for (const item of saleItemsRecent) {
      const qty = Number(item.quantity || 1);
      const unitCost = Number(item.unit_cost || 0);
      monthCogs += unitCost * qty;
    }

    const monthRevenue = salesMonth.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const monthSalesCount = salesMonth.length;
    const monthExpenses = expensesMonth.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const monthGrossProfit = monthRevenue - monthCogs;
    const monthGrossMargin = monthRevenue > 0 ? (monthGrossProfit / monthRevenue) * 100 : 0;
    const monthNetProfit = monthGrossProfit - monthExpenses;

    // Inventory status
    const outOfStockProducts = products.filter((p: any) => Number(p.stock_quantity || 0) <= 0);
    const lowStockProducts = products.filter(
      (p: any) => Number(p.stock_quantity || 0) > 0 && Number(p.stock_quantity || 0) <= Number(p.minimum_stock_level || 5)
    );

    // Debtors aggregation
    const customerMap = new Map<string, any>(customers.map((c: any) => [c.id, c]));
    const debtorBalanceMap = new Map<string, { name: string; phone?: string; debtAmount: number; unpaidSalesCount: number }>();

    for (const sale of unpaidSales) {
      const custId = sale.customer_id;
      const custName = custId && customerMap.has(custId) ? customerMap.get(custId).name : "Walk-in / Unlinked Customer";
      const custPhone = custId && customerMap.has(custId) ? customerMap.get(custId).phone : undefined;
      const key = custId || `unknown-${sale.id}`;

      const current = debtorBalanceMap.get(key) || { name: custName, phone: custPhone, debtAmount: 0, unpaidSalesCount: 0 };
      current.debtAmount += Number(sale.amount_due || 0);
      current.unpaidSalesCount += 1;
      debtorBalanceMap.set(key, current);
    }

    const debtorList = Array.from(debtorBalanceMap.values())
      .filter((d) => d.debtAmount > 0)
      .sort((a, b) => b.debtAmount - a.debtAmount);

    const totalOutstandingReceivables = debtorList.reduce((sum, d) => sum + d.debtAmount, 0);

    // Catalog Margins
    const catalogWithMargins = products.map((p: any) => {
      const selling = Number(p.selling_price || 0);
      const cost = Number(p.cost_price || 0);
      const unitProfit = selling - cost;
      const marginPct = selling > 0 ? Number(((unitProfit / selling) * 100).toFixed(1)) : 0;
      return {
        id: p.id,
        name: p.name,
        sellingPrice: selling,
        costPrice: cost,
        unitProfit,
        marginPct,
        stockQuantity: Number(p.stock_quantity || 0),
        minimumStockLevel: Number(p.minimum_stock_level || 5),
      };
    });

    const highestMarginCatalog = [...catalogWithMargins].sort((a, b) => b.marginPct - a.marginPct);

    // 6. Assemble Focused, Selective Context for Gemini
    const verifiedBusinessFacts = {
      businessName,
      businessType,
      currency,
      timezone,
      referenceDate: todayDateStr,
      queryInterpretation: parsedClassification,
      today: {
        hasRecordedSalesToday: todaySalesCount > 0,
        revenue: todayRevenue,
        salesCount: todaySalesCount,
        cashCollected: todayCashCollected,
        receivablesCreated: todayReceivablesCreated,
        cogs: todayCogs,
        grossProfit: todayGrossProfit,
        grossMarginPct: Number(todayGrossMargin.toFixed(1)),
      },
      last30Days: {
        totalRevenue: monthRevenue,
        totalSalesCount: monthSalesCount,
        totalCogs: monthCogs,
        grossProfit: monthGrossProfit,
        grossMarginPct: Number(monthGrossMargin.toFixed(1)),
        totalExpenses: monthExpenses,
        estimatedNetProfit: monthNetProfit,
      },
      inventory: {
        totalActiveProducts: products.length,
        outOfStockCount: outOfStockProducts.length,
        outOfStockItems: outOfStockProducts.slice(0, 5).map((p: any) => ({ name: p.name, stock: Number(p.stock_quantity || 0) })),
        lowStockCount: lowStockProducts.length,
        lowStockItems: lowStockProducts.slice(0, 5).map((p: any) => ({
          name: p.name,
          currentStock: Number(p.stock_quantity || 0),
          minimumStockLevel: Number(p.minimum_stock_level || 5),
        })),
      },
      debtors: {
        debtorsCount: debtorList.length,
        totalOutstandingReceivables,
        topDebtors: debtorList.slice(0, 5),
      },
      catalog: {
        topMarginProducts: highestMarginCatalog.slice(0, 5),
      },
      overallBusiness: {
        totalLifetimeSalesCount,
      },
    };

    // 7. Invoke Google Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    let structuredResponse: any = null;

    if (geminiApiKey && geminiApiKey.trim().length > 0 && geminiApiKey !== "placeholder-key") {
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

      const systemInstruction = `You are Ursella AI, the intelligent, grounded business co-pilot inside Ursella Business OS.
You are assisting the owner of "${businessName}" (${businessType}).

REASONING RULES:
1. THE USER QUESTION IS YOUR PRIMARY DIRECTIVE:
   - Base your answer strictly on the user's question.
   - Relevance takes priority over completeness: provide ONLY information relevant to the question.
   - DO NOT automatically generate a full business summary.
   - DO NOT mention revenue, profit, expenses, inventory, or customers unless relevant to the question.
2. ANSWER DIRECTLY FIRST:
   - The very first sentence of your answer MUST directly answer the question with verified numbers (or state that 0 records exist).
   - No generic pleasantries, no "Welcome to...", no fluff.
3. SEPARATE:
   - FACT (exact figures from context in ${currency})
   - INTERPRETATION (business meaning)
   - RECOMMENDATION (concrete action)
4. PROPORTIONATE DEPTH:
   - Simple question -> simple, direct answer.
   - Complex question -> deeper analysis.

OUTPUT JSON SCHEMA:
{
  "answer": "A clear, well-structured markdown answer that directly addresses the user's prompt in the first sentence.",
  "keyMetrics": [
    { "label": "Metric Name", "value": 15000, "formattedValue": "${currency} 15,000", "trend": "positive" | "negative" | "neutral" }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Action Title",
      "reasoning": "Why this matters based on verified numbers",
      "actionSuggestion": "Concrete next step in the app",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high_confidence" | "moderate_confidence" | "insufficient_data",
  "followUpSuggestions": ["Follow-up question 1", "Follow-up question 2"]
}`;

      const userPrompt = `=== VERIFIED AUTHORITATIVE BUSINESS DATA ===
${JSON.stringify(verifiedBusinessFacts, null, 2)}

=== CONVERSATION HISTORY ===
${
  history.length
    ? history.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
    : "No previous messages."
}

=== CURRENT USER QUESTION ===
"${message}"
`;

      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const geminiReq = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        });

        if (geminiReq.ok) {
          const geminiRes = await geminiReq.json();
          const rawText = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            try {
              structuredResponse = JSON.parse(rawText);
            } catch {
              structuredResponse = {
                answer: rawText,
                confidence: "moderate_confidence",
                keyMetrics: [],
                recommendations: [],
                followUpSuggestions: ["How are my sales today?", "Who owes me money?", "Which products are low on stock?"],
              };
            }
          }
        } else {
          console.warn("Gemini API returned error status:", geminiReq.status);
        }
      } catch (geminiFetchErr) {
        console.warn("Gemini fetch failed:", geminiFetchErr);
      }
    }

    // 8. Deterministic Advisory Fallback
    if (!structuredResponse || !structuredResponse.answer) {
      structuredResponse = generateAdvancedDeterministicAdvisor(message, verifiedBusinessFacts);
    }

    // 9. Persist conversation if possible
    let activeConvId = conversationId;
    try {
      if (!activeConvId) {
        const { data: newConv } = await supabaseUserClient
          .from("ai_conversations")
          .insert({
            business_id: businessId,
            title: message.length > 40 ? `${message.substring(0, 37)}...` : message,
            context_type: "general",
          })
          .select("id")
          .maybeSingle();

        if (newConv) {
          activeConvId = newConv.id;
        }
      }
    } catch {
      // Ignored for non-critical logging
    }

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        conversationId: activeConvId || `conv-${businessId}-${Date.now()}`,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        response: structuredResponse,
        intent: parsedClassification.intent,
        domain: parsedClassification.domain,
        latencyMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Ursella AI Edge Function error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred while generating business insights.",
        details: error?.message || "Internal Error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Advanced Deterministic Business Advisor Fallback.
 */
function generateAdvancedDeterministicAdvisor(query: string, facts: any): any {
  const q = query.toLowerCase().trim();
  const curr = facts.currency;
  const t = facts.today;
  const m = facts.last30Days;
  const inv = facts.inventory;
  const d = facts.debtors;
  const cat = facts.catalog;

  // 1. Store info / Currency
  if (
    q.includes("currency") ||
    q.includes("what currency") ||
    q.includes("which currency") ||
    q.includes("currency am i using")
  ) {
    return {
      answer: `Your store's active operating currency is **${curr}**. All POS receipts, selling prices, product costs, debtor balances, and analytics are recorded in **${curr}**.`,
      keyMetrics: [{ label: "Operating Currency", value: curr, formattedValue: curr, trend: "neutral" }],
      followUpSuggestions: ["How are my sales today?", "Who owes me money?"],
      confidence: "high_confidence",
    };
  }

  // 2. Debtors / Receivables
  if (
    q.includes("who owes") ||
    q.includes("debt") ||
    q.includes("debtor") ||
    q.includes("unpaid") ||
    q.includes("receivable") ||
    q.includes("owing") ||
    q.includes("credit balance")
  ) {
    const totalDebt = Number(d.totalOutstandingReceivables || 0);
    const count = Number(d.debtorsCount || 0);
    const topDebtors = (d.topDebtors || []) as Array<{ name: string; debtAmount: number; phone?: string }>;

    if (count === 0 || totalDebt === 0) {
      return {
        answer: `You currently have **no outstanding customer debts** (0 unpaid customer balances).`,
        keyMetrics: [
          { label: "Outstanding Debt", value: 0, formattedValue: `${curr} 0`, trend: "positive" },
          { label: "Debtors", value: 0, formattedValue: "0", trend: "positive" },
        ],
        followUpSuggestions: ["How are my sales today?", "Do I have low stock?"],
        confidence: "high_confidence",
      };
    }

    const topDebtor = topDebtors[0];
    const breakdown = topDebtors
      .map((item, i) => `${i + 1}. **${item.name}**: ${curr} ${Number(item.debtAmount).toLocaleString()}${item.phone ? ` (📞 ${item.phone})` : ""}`)
      .join("\n");

    return {
      answer: `You have **${count} customer(s)** with outstanding debts totaling **${curr} ${totalDebt.toLocaleString()}**.\n\n${topDebtor ? `The largest debtor is **${topDebtor.name}** owing **${curr} ${Number(topDebtor.debtAmount).toLocaleString()}**.\n\n**Debtor Breakdown:**\n${breakdown}` : ""}`,
      keyMetrics: [
        { label: "Total Outstanding Debt", value: totalDebt, formattedValue: `${curr} ${totalDebt.toLocaleString()}`, trend: "negative" },
        { label: "Debtor Accounts", value: count, formattedValue: `${count}`, trend: "neutral" },
      ],
      recommendations: [
        {
          id: "rec-debt-action",
          title: `Follow Up With ${topDebtor?.name || "Top Debtors"}`,
          reasoning: `Recovering ${curr} ${totalDebt.toLocaleString()} immediately boosts working capital.`,
          actionSuggestion: topDebtor?.phone ? `Call ${topDebtor.name} at ${topDebtor.phone}.` : "Review debtor records in Customers & CRM.",
          priority: "high",
        },
      ],
      followUpSuggestions: ["How are my sales today?", "What is my cash flow?"],
      confidence: "high_confidence",
    };
  }

  // 3. Inventory / Stock
  if (
    q.includes("low stock") ||
    q.includes("running low") ||
    q.includes("out of stock") ||
    q.includes("restock") ||
    q.includes("inventory") ||
    q.includes("stock level")
  ) {
    const outCount = Number(inv.outOfStockCount || 0);
    const lowCount = Number(inv.lowStockCount || 0);
    const critical = [...(inv.outOfStockItems || []), ...(inv.lowStockItems || [])];

    if (outCount === 0 && lowCount === 0) {
      return {
        answer: `All **${inv.totalActiveProducts || 0} active product SKUs** are adequately stocked with zero items low or out of stock.`,
        keyMetrics: [
          { label: "Out of Stock", value: 0, formattedValue: "0", trend: "positive" },
          { label: "Low Stock", value: 0, formattedValue: "0", trend: "positive" },
        ],
        followUpSuggestions: ["What are my top selling products?", "How are my sales today?"],
        confidence: "high_confidence",
      };
    }

    const itemsText = critical.slice(0, 5).map((item: any) => `- **${item.name}**: ${item.currentStock ?? item.stock} in stock`).join("\n");

    return {
      answer: `You have **${outCount} item(s) out of stock** and **${lowCount} item(s) below reorder levels**.\n\n**Items Requiring Restock:**\n${itemsText}`,
      keyMetrics: [
        { label: "Out of Stock", value: outCount, formattedValue: `${outCount}`, trend: "negative" },
        { label: "Low Stock", value: lowCount, formattedValue: `${lowCount}`, trend: "negative" },
      ],
      recommendations: [
        {
          id: "rec-stock-action",
          title: "Restock Depleted SKUs",
          reasoning: `${outCount + lowCount} products risk lost sales.`,
          actionSuggestion: "Create purchase orders in Business & Stock.",
          priority: "high",
        },
      ],
      followUpSuggestions: ["Which products make me the most money?", "How are my sales today?"],
      confidence: "high_confidence",
    };
  }

  // 4. Sales Today
  if (
    q.includes("today") ||
    q.includes("sell today") ||
    q.includes("sold today") ||
    q.includes("sales today") ||
    q.includes("revenue today") ||
    q.includes("how are my sales today")
  ) {
    const rev = Number(t.revenue || 0);
    const count = Number(t.salesCount || 0);
    const gp = Number(t.grossProfit || 0);
    const margin = Number(t.grossMarginPct || 0);
    const cash = Number(t.cashCollected || 0);

    if (count === 0) {
      return {
        answer: `You have recorded **${curr} 0** in sales today (0 transactions completed so far today).`,
        keyMetrics: [
          { label: "Today's Revenue", value: 0, formattedValue: `${curr} 0`, trend: "neutral" },
          { label: "Today's Orders", value: 0, formattedValue: "0", trend: "neutral" },
        ],
        followUpSuggestions: ["Who owes me money?", "Which products are low on stock?"],
        confidence: "high_confidence",
      };
    }

    return {
      answer: `Today, **${facts.businessName}** has generated **${curr} ${rev.toLocaleString()}** across **${count}** transaction${count > 1 ? "s" : ""}.\n\n- **Gross Profit:** ${curr} ${gp.toLocaleString()} (Gross Margin: **${margin}%**)\n- **Cash Collected:** ${curr} ${cash.toLocaleString()}`,
      keyMetrics: [
        { label: "Today's Revenue", value: rev, formattedValue: `${curr} ${rev.toLocaleString()}`, trend: "positive" },
        { label: "Today's Orders", value: count, formattedValue: `${count}`, trend: "positive" },
        { label: "Gross Margin", value: margin, formattedValue: `${margin}%`, trend: "positive" },
      ],
      followUpSuggestions: ["Who owes me money?", "Which products are low on stock?"],
      confidence: "high_confidence",
    };
  }

  // 5. General Recommendations & Strategy
  const rev30 = Number(m.totalRevenue || 0);
  const gp30 = Number(m.grossProfit || 0);
  const margin30 = Number(m.grossMarginPct || 0);
  const exp30 = Number(m.totalExpenses || 0);
  const net30 = Number(m.estimatedNetProfit || 0);

  return {
    answer: `Over the last 30 days, **${facts.businessName}** generated **${curr} ${rev30.toLocaleString()}** in revenue across **${m.totalSalesCount || 0}** orders with a **${margin30}%** gross margin (${curr} ${gp30.toLocaleString()} gross profit)${exp30 > 0 ? ` and **${curr} ${net30.toLocaleString()}** in net profit after **${curr} ${exp30.toLocaleString()}** expenses.` : "."}`,
    keyMetrics: [
      { label: "Revenue (30d)", value: rev30, formattedValue: `${curr} ${rev30.toLocaleString()}`, trend: "positive" },
      { label: "Gross Margin", value: margin30, formattedValue: `${margin30}%`, trend: margin30 >= 30 ? "positive" : "neutral" },
    ],
    followUpSuggestions: ["How are my sales today?", "Who owes me money?", "Which products are low on stock?"],
    confidence: "high_confidence",
  };
}
