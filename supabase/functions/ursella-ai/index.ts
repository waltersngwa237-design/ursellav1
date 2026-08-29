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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    // Authenticated user client with forwarded JWT
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Identify Authenticated User
    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ChatRequestBody = await req.json();
    const { businessId, conversationId, history = [], action = "chat" } = body;
    const message = body.message || (action === "daily-brief" ? "Provide my daily business brief" : "Analyze proactive business insights");

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: "businessId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Identify Authorized Business & Verify Membership (Tenant Isolation)
    const { data: membership, error: memberError } = await supabaseUserClient
      .from("business_members")
      .select("id, role, business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You are not an authorized member of this business" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Retrieve Business Metadata
    const { data: businessData } = await supabaseUserClient
      .from("businesses")
      .select("id, name, currency, timezone, business_type")
      .eq("id", businessId)
      .maybeSingle();

    const businessName = businessData?.name || body.businessContext?.businessName || "My Business";
    const businessType = businessData?.business_type || body.businessContext?.businessType || "Retail & Trade";
    const currency = businessData?.currency || body.businessContext?.currency || "XAF";
    const timezone = businessData?.timezone || body.businessContext?.timezone || "Africa/Douala";

    // 4. Retrieve Fresh Business Data from Database (Correct Schema)
    const { startDateIso: todayStartIso, endDateIso: todayEndIso, todayDateStr } = calculateTimezoneRange(timezone, 1);
    const { startDateIso: monthStartIso, endDateIso: monthEndIso } = calculateTimezoneRange(timezone, 30);

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
      // Products (correct schema columns: stock_quantity, minimum_stock_level, selling_price, cost_price)
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

    // Query sale_items for COGS and product margin analytics
    const allRecentSaleIds = [...new Set([...salesToday.map((s: any) => s.id), ...salesMonth.map((s: any) => s.id)])];
    let saleItemsRecent: any[] = [];
    if (allRecentSaleIds.length > 0) {
      const { data: items } = await supabaseUserClient
        .from("sale_items")
        .select("sale_id, product_id, product_name_snapshot, quantity, unit_price, unit_cost, subtotal, total")
        .in("sale_id", allRecentSaleIds);
      saleItemsRecent = items || [];
    }

    // 5. Deterministic Financial Metric Calculations (Authoritative Backend)
    const todayRevenue = salesToday.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const todaySalesCount = salesToday.length;
    const todayCashCollected = paymentsToday.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const todayReceivablesCreated = salesToday.reduce((sum: number, s: any) => sum + Number(s.amount_due || 0), 0);

    const todaySaleIdsSet = new Set(salesToday.map((s: any) => s.id));
    const saleItemsToday = saleItemsRecent.filter((item: any) => todaySaleIdsSet.has(item.sale_id));

    let todayCogs = 0;
    const productSalesTodayMap = new Map<string, { name: string; units: number; revenue: number; grossProfit: number }>();

    for (const item of saleItemsToday) {
      const qty = Number(item.quantity || 1);
      const unitCost = Number(item.unit_cost || 0);
      const itemCost = unitCost * qty;
      todayCogs += itemCost;

      const pName = item.product_name_snapshot || "Item";
      const existing = productSalesTodayMap.get(pName) || { name: pName, units: 0, revenue: 0, grossProfit: 0 };
      const itemRev = Number(item.total || Number(item.unit_price || 0) * qty);
      existing.units += qty;
      existing.revenue += itemRev;
      existing.grossProfit += itemRev - itemCost;
      productSalesTodayMap.set(pName, existing);
    }

    const topSellingToday = Array.from(productSalesTodayMap.values()).sort((a, b) => b.units - a.units);
    const todayGrossProfit = todayRevenue - todayCogs;
    const todayGrossMargin = todayRevenue > 0 ? (todayGrossProfit / todayRevenue) * 100 : 0;
    const todayAvgOrderValue = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

    // Monthly Product Performance & Margins
    let monthCogs = 0;
    const productSalesMonthMap = new Map<string, { name: string; units: number; revenue: number; grossProfit: number; grossMarginPct: number }>();

    for (const item of saleItemsRecent) {
      const qty = Number(item.quantity || 1);
      const unitCost = Number(item.unit_cost || 0);
      const itemCost = unitCost * qty;
      monthCogs += itemCost;

      const pName = item.product_name_snapshot || "Item";
      const existing = productSalesMonthMap.get(pName) || { name: pName, units: 0, revenue: 0, grossProfit: 0, grossMarginPct: 0 };
      const itemRev = Number(item.total || Number(item.unit_price || 0) * qty);
      existing.units += qty;
      existing.revenue += itemRev;
      existing.grossProfit += itemRev - itemCost;
      existing.grossMarginPct = existing.revenue > 0 ? Number(((existing.grossProfit / existing.revenue) * 100).toFixed(1)) : 0;
      productSalesMonthMap.set(pName, existing);
    }

    const topSellingMonth = Array.from(productSalesMonthMap.values()).sort((a, b) => b.units - a.units);
    const highestMarginSoldProducts = Array.from(productSalesMonthMap.values()).sort((a, b) => b.grossMarginPct - a.grossMarginPct);
    const lowestMarginSoldProducts = Array.from(productSalesMonthMap.values()).sort((a, b) => a.grossMarginPct - b.grossMarginPct);

    // Catalog Product Margins
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
    const lowestMarginCatalog = [...catalogWithMargins].sort((a, b) => a.marginPct - b.marginPct);

    // Monthly Metrics
    const monthRevenue = salesMonth.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const monthSalesCount = salesMonth.length;
    const monthExpenses = expensesMonth.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const monthGrossProfit = monthRevenue - monthCogs;
    const monthGrossMargin = monthRevenue > 0 ? (monthGrossProfit / monthRevenue) * 100 : 0;
    const monthNetProfit = monthGrossProfit - monthExpenses;
    const monthReceivables = salesMonth.reduce((sum: number, s: any) => sum + Number(s.amount_due || 0), 0);

    // Inventory status (stock_quantity and minimum_stock_level)
    const outOfStockProducts = products.filter((p: any) => Number(p.stock_quantity || 0) <= 0);
    const lowStockProducts = products.filter(
      (p: any) => Number(p.stock_quantity || 0) > 0 && Number(p.stock_quantity || 0) <= Number(p.minimum_stock_level || 5)
    );

    // Accurate Debtors & Receivables aggregation from unpaid sales
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

    // 6. Assemble Verified Deterministic Metrics Context for Gemini
    const verifiedBusinessFacts = {
      businessName,
      businessType,
      currency,
      timezone,
      referenceDate: todayDateStr,
      today: {
        hasRecordedSalesToday: todaySalesCount > 0,
        revenue: todayRevenue,
        salesCount: todaySalesCount,
        cashCollected: todayCashCollected,
        receivablesCreated: todayReceivablesCreated,
        cogs: todayCogs,
        grossProfit: todayGrossProfit,
        grossMarginPct: Number(todayGrossMargin.toFixed(1)),
        averageTransactionValue: Number(todayAvgOrderValue.toFixed(2)),
        topSellingProductsToday: topSellingToday.slice(0, 5),
      },
      last30Days: {
        totalRevenue: monthRevenue,
        totalSalesCount: monthSalesCount,
        totalCogs: monthCogs,
        grossProfit: monthGrossProfit,
        grossMarginPct: Number(monthGrossMargin.toFixed(1)),
        totalExpenses: monthExpenses,
        estimatedNetProfit: monthNetProfit,
        totalReceivablesCreated: monthReceivables,
        topSellingProducts: topSellingMonth.slice(0, 5),
        highestMarginSoldProducts: highestMarginSoldProducts.slice(0, 3),
        lowestMarginSoldProducts: lowestMarginSoldProducts.slice(0, 3),
      },
      catalog: {
        totalActiveProductsCount: products.length,
        highestMarginProducts: highestMarginCatalog.slice(0, 5),
        lowestMarginProducts: lowestMarginCatalog.slice(0, 5),
      },
      inventory: {
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
      overallBusiness: {
        totalHistoricalCompletedSalesCount: totalLifetimeSalesCount,
        hasEverRecordedSales: totalLifetimeSalesCount > 0,
        isDataSufficiencyLimited: totalLifetimeSalesCount < 5,
        dataSufficiencyNote: totalLifetimeSalesCount === 0
          ? "No sales have been processed in the system yet."
          : totalLifetimeSalesCount < 5
          ? `Only ${totalLifetimeSalesCount} transaction(s) recorded in total. Statistical trends are preliminary.`
          : undefined,
      },
    };

    // 7. Invoke Google Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    let structuredResponse: any = null;

    if (geminiApiKey && geminiApiKey.trim().length > 0 && geminiApiKey !== "placeholder-key") {
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

      const systemInstruction = `You are Ursella AI, the official, grounded, and practical business advisor inside Ursella Business OS.
You are advising the business owner of "${businessName}" (${businessType}).

CRITICAL IDENTITY & COMMERCIAL REASONING DIRECTIVES:
1. Product Name: Ursella. AI Advisor Name: Ursella AI.
   - "${businessName}" is the merchant's business name. NEVER confuse the business name with the app name.
   - NEVER say "Welcome to ${businessName}", "Welcome to ServSkee", or use canned chatbot greetings.
2. Direct Answer First:
   - Always answer the user's specific question directly in the very first sentence.
   - If the user asks "Any recommendations?", do NOT dump a raw revenue/expense summary. Instead, directly analyze the current numbers, identify 2-3 specific priorities (e.g. margin improvement, low-stock reorders, debt collection, expense logging), and explain WHY each recommendation matters.
   - If the user asks "How profitable am I?", answer directly with their exact gross margin %, gross profit in ${currency}, operating expenses, and net profit.
   - If the user asks "Who owes me money?", list the exact debtors and unpaid totals immediately.
   - If the user asks "What is hurting my profitability?", evaluate COGS, low-margin products, and expense drains directly.
3. Strict Grounding:
   - All factual numbers MUST come from the VERIFIED BUSINESS CONTEXT below.
   - Operating Currency: "${currency}".
   - NEVER invent numbers. If data is limited (e.g. only 1-2 sales recorded), explicitly state that early volume is limited so conclusions are preliminary.
4. Voice & Tone:
   - Practical, concise, commercially aware, analytical, proactive, and honest.
   - No robotic dashboard recitation. Transform raw figures into actionable business insight.

OUTPUT JSON SCHEMA:
{
  "answer": "A clear, well-structured markdown answer that directly addresses the user's prompt.",
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
    : "No previous messages in this conversation."
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
                followUpSuggestions: ["How are my sales today?", "Which products have the best margins?", "Who owes me money?"],
              };
            }
          }
        } else {
          const errText = await geminiReq.text();
          console.warn("Gemini API returned error status:", geminiReq.status, errText);
        }
      } catch (geminiFetchErr) {
        console.warn("Gemini fetch failed:", geminiFetchErr);
      }
    }

    // 8. Deterministic Advisory Reasoning Fallback
    if (!structuredResponse || !structuredResponse.answer) {
      structuredResponse = generateAdvancedDeterministicAdvisor(message, verifiedBusinessFacts);
    }

    // 9. Persist to Supabase if conversationId is provided
    let activeConvId = conversationId;
    try {
      if (!activeConvId) {
        const { data: newConv } = await supabaseUserClient
          .from("ai_conversations")
          .insert({
            business_id: businessId,
            user_id: user.id,
            title: message.length > 40 ? `${message.substring(0, 37)}...` : message,
            context_type: "general",
          })
          .select("id")
          .single();

        if (newConv) {
          activeConvId = newConv.id;
        }
      }

      if (activeConvId) {
        await Promise.all([
          supabaseUserClient.from("ai_messages").insert({
            conversation_id: activeConvId,
            business_id: businessId,
            role: "user",
            content: message,
            metadata: {},
          }),
          supabaseUserClient.from("ai_messages").insert({
            conversation_id: activeConvId,
            business_id: businessId,
            role: "assistant",
            content: structuredResponse.answer,
            metadata: {
              keyMetrics: structuredResponse.keyMetrics,
              recommendations: structuredResponse.recommendations,
              confidence: structuredResponse.confidence,
            },
          }),
        ]);
      }
    } catch (dbSaveErr) {
      console.warn("Could not save AI conversation message:", dbSaveErr);
    }

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        conversationId: activeConvId || `conv-${businessId}-${Date.now()}`,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        response: structuredResponse,
        intent: "business_advisory",
        toolsUsed: ["get_sales_summary", "get_product_performance", "get_inventory_alerts", "get_customer_balances"],
        latencyMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Ursella AI Edge Function critical error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred while generating business insights.",
        details: error?.message || "Internal Edge Function Error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Advanced Deterministic Business Advisor.
 * Direct answers, margin interpretations, prioritized recommendations, and zero fluff.
 */
function generateAdvancedDeterministicAdvisor(query: string, facts: any): any {
  const q = query.toLowerCase().trim();
  const curr = facts.currency;
  const t = facts.today;
  const m = facts.last30Days;
  const inv = facts.inventory;
  const d = facts.debtors;
  const cat = facts.catalog;
  const ov = facts.overallBusiness;

  // 1. "Any recommendations?" / "What should I do next?" / "What should I focus on?"
  if (
    q.includes("recommendation") ||
    q.includes("what should i do") ||
    q.includes("focus") ||
    q.includes("next step") ||
    q.includes("advice") ||
    q.includes("priority")
  ) {
    const rev = m.totalRevenue > 0 ? m.totalRevenue : t.revenue;
    const margin = m.totalRevenue > 0 ? m.grossMarginPct : t.grossMarginPct;
    const gp = m.totalRevenue > 0 ? m.grossProfit : t.grossProfit;
    const recs: Array<{ id: string; title: string; reasoning: string; actionSuggestion: string; priority: "high" | "medium" | "low" }> = [];
    const points: string[] = [];

    // Check Margins
    if (rev > 0 && margin < 30) {
      points.push(`**Improve your product margins:** You are generating a **${margin}%** gross margin, so only **${curr} ${gp.toLocaleString()}** remains from **${curr} ${rev.toLocaleString()}** in revenue after product costs.`);
      recs.push({
        id: "rec-margin",
        title: "Review Product Pricing & Margins",
        reasoning: `Gross margin of ${margin}% leaves limited headroom for operating expenses.`,
        actionSuggestion: "Identify high-margin products to promote and adjust pricing on weak-margin items.",
        priority: "high",
      });
    }

    // Check Inventory Stockouts
    if (inv.outOfStockCount > 0 || inv.lowStockCount > 0) {
      const stockTotal = inv.outOfStockCount + inv.lowStockCount;
      points.push(`**Replenish critical inventory:** You have **${inv.outOfStockCount}** product(s) out of stock and **${inv.lowStockCount}** below reorder thresholds. Stockouts directly cause lost revenue.`);
      recs.push({
        id: "rec-restock",
        title: "Restock Low & Depleted SKUs",
        reasoning: `${stockTotal} products risk running dry during trading hours.`,
        actionSuggestion: "Create purchase orders in Business & Stock.",
        priority: "high",
      });
    }

    // Check Debtors
    if (d.totalOutstandingReceivables > 0) {
      points.push(`**Collect pending customer debt:** **${curr} ${d.totalOutstandingReceivables.toLocaleString()}** is currently tied up in unpaid credit across **${d.debtorsCount}** customer(s).`);
      recs.push({
        id: "rec-debt",
        title: "Collect Outstanding Customer Credit",
        reasoning: `Converting ${curr} ${d.totalOutstandingReceivables.toLocaleString()} in credit into cash strengthens working capital.`,
        actionSuggestion: "Send payment reminders via WhatsApp/SMS in Customers & CRM.",
        priority: "medium",
      });
    }

    // Check Operating Expenses
    if (m.totalExpenses === 0 && rev > 0) {
      points.push(`**Start logging operating expenses:** You have recorded **${curr} 0** in operating expenses, meaning your net profitability cannot be accurately calculated yet.`);
      recs.push({
        id: "rec-expense",
        title: "Track Store Operating Expenses",
        reasoning: "Tracking rent, utilities, and daily costs reveals your true take-home profit.",
        actionSuggestion: "Record store expenses in Reports & Accounting.",
        priority: "medium",
      });
    }

    // If no sales or low transaction count
    if (ov.totalHistoricalCompletedSalesCount === 0) {
      return {
        answer: `Based on your current setup for **${facts.businessName}**, here are my top recommendations to get started:\n\n1. **Record your initial sales in the POS terminal:** Process transactions in **Sell (POS)** to start generating real-time revenue, gross margin, and inventory tracking.\n2. **Verify product cost and selling prices:** Ensure every catalog item has accurate cost and selling prices so your gross margins are calculated correctly.\n3. **Set minimum stock reorder points:** Set alert thresholds on your fastest-moving items to prevent surprise stockouts.`,
        keyMetrics: [
          { label: "Active Products", value: cat.totalActiveProductsCount, formattedValue: `${cat.totalActiveProductsCount} items`, trend: "neutral" },
        ],
        recommendations: [
          {
            id: "rec-pos",
            title: "Process First Sale in POS",
            reasoning: "Real-time metrics activate as soon as sales are recorded.",
            actionSuggestion: "Open Sell (POS) and record a transaction.",
            priority: "high",
          },
        ],
        confidence: "high_confidence",
        followUpSuggestions: ["Which products are low on stock?", "What are my catalog margins?"],
      };
    }

    const volumeNote = ov.isDataSufficiencyLimited
      ? `\n\n*Note: You have ${ov.totalHistoricalCompletedSalesCount} completed sale(s) on record, so long-term trends are still preliminary.*`
      : "";

    return {
      answer: `Based on your current numbers for **${facts.businessName}**, here are my key recommendations:\n\n${points.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}${volumeNote}`,
      keyMetrics: [
        { label: "Gross Margin", value: margin, formattedValue: `${margin}%`, trend: margin >= 30 ? "positive" : "neutral" },
        { label: "Receivables", value: d.totalOutstandingReceivables, formattedValue: `${curr} ${d.totalOutstandingReceivables.toLocaleString()}`, trend: d.totalOutstandingReceivables > 0 ? "negative" : "positive" },
      ],
      recommendations: recs,
      confidence: ov.isDataSufficiencyLimited ? "insufficient_data" : "high_confidence",
      followUpSuggestions: [
        "Which products have the best margins?",
        "Who owes me money?",
        "How are my sales today?",
      ],
    };
  }

  // 2. Sales Today / Revenue Today
  if (q.includes("today") || q.includes("sales today") || q.includes("make today") || q.includes("made today")) {
    if (!t.hasRecordedSalesToday) {
      const histText = ov.hasEverRecordedSales
        ? ` Historically, your business has completed **${ov.totalHistoricalCompletedSalesCount}** sales.`
        : "";
      return {
        answer: `You haven't recorded any sales today.${histText}\n\nOnce you record transactions in the **Sell (POS)** module, your real-time revenue, gross profit, and cash collections will update immediately.`,
        keyMetrics: [
          { label: "Today's Revenue", value: 0, formattedValue: `${curr} 0`, trend: "neutral" },
          { label: "Today's Orders", value: 0, formattedValue: "0", trend: "neutral" },
        ],
        recommendations: inv.lowStockCount > 0 ? [
          {
            id: "rec-stock",
            title: "Check Inventory Stock",
            reasoning: `${inv.lowStockCount} product(s) are below threshold.`,
            actionSuggestion: "Review stock before peak trading hours.",
            priority: "medium",
          },
        ] : [],
        confidence: "high_confidence",
        followUpSuggestions: ["What is low in stock?", "Who owes me money?", "Any recommendations?"],
      };
    }

    const topItem = t.topSellingProductsToday?.[0];
    const topStr = topItem ? `\n\n- **Top Seller Today:** ${topItem.name} (${topItem.units} units, ${curr} ${topItem.revenue.toLocaleString()})` : "";

    return {
      answer: `You've recorded **${t.salesCount}** sales today totaling **${curr} ${t.revenue.toLocaleString()}**.\n\n- **Gross Profit:** ${curr} ${t.grossProfit.toLocaleString()} (${t.grossMarginPct}% gross margin)\n- **Cash Collected:** ${curr} ${t.cashCollected.toLocaleString()}${t.receivablesCreated > 0 ? `\n- **New Receivables Created:** ${curr} ${t.receivablesCreated.toLocaleString()}` : ""}${topStr}`,
      keyMetrics: [
        { label: "Today's Revenue", value: t.revenue, formattedValue: `${curr} ${t.revenue.toLocaleString()}`, trend: "positive" },
        { label: "Today's Gross Margin", value: t.grossMarginPct, formattedValue: `${t.grossMarginPct}%`, trend: "positive" },
        { label: "Orders", value: t.salesCount, formattedValue: `${t.salesCount}`, trend: "positive" },
      ],
      recommendations: [],
      confidence: "high_confidence",
      followUpSuggestions: ["Which products have the best margins?", "Who owes me money?", "Any recommendations?"],
    };
  }

  // 3. Profitability / "How profitable am I?" / "What is hurting my profitability?"
  if (q.includes("profit") || q.includes("margin") || q.includes("cogs") || q.includes("hurting")) {
    const rev = m.totalRevenue > 0 ? m.totalRevenue : t.revenue;
    const cogs = m.totalRevenue > 0 ? m.totalCogs : t.cogs;
    const gp = m.totalRevenue > 0 ? m.grossProfit : t.grossProfit;
    const margin = m.totalRevenue > 0 ? m.grossMarginPct : t.grossMarginPct;
    const opex = m.totalExpenses;
    const net = m.estimatedNetProfit;

    if (rev === 0) {
      return {
        answer: `No sales transactions have been recorded yet to calculate your profitability for **${facts.businessName}**.\n\nGross profit is calculated as \`Revenue - Cost of Goods Sold\`. As soon as sales are recorded, your margin breakdown and net profit will calculate automatically.`,
        keyMetrics: [],
        confidence: "insufficient_data",
        followUpSuggestions: ["Any recommendations?", "Which products are low on stock?"],
      };
    }

    let marginComment = "";
    if (margin < 20) {
      marginComment = `\n\n⚠️ **Margin Warning:** A ${margin}% gross margin is compressed. Your cost of goods (${curr} ${cogs.toLocaleString()}) consumes ${100 - margin}% of your top-line revenue.`;
    } else if (margin >= 35) {
      marginComment = `\n\n✅ **Healthy Margin:** Your ${margin}% gross margin provides strong retained earnings after covering inventory replenishment costs.`;
    }

    return {
      answer: `Here is your profitability breakdown for **${facts.businessName}** (30-day window):\n\n- **Revenue:** ${curr} ${rev.toLocaleString()}\n- **Cost of Goods Sold (COGS):** ${curr} ${cogs.toLocaleString()}\n- **Gross Profit:** ${curr} ${gp.toLocaleString()} (**${margin}%** gross margin)\n- **Operating Expenses:** ${curr} ${opex.toLocaleString()}\n- **Estimated Net Profit:** ${curr} ${net.toLocaleString()}${marginComment}`,
      keyMetrics: [
        { label: "Gross Margin", value: margin, formattedValue: `${margin}%`, trend: margin >= 30 ? "positive" : "neutral" },
        { label: "Gross Profit", value: gp, formattedValue: `${curr} ${gp.toLocaleString()}`, trend: "positive" },
        { label: "Net Profit", value: net, formattedValue: `${curr} ${net.toLocaleString()}`, trend: net > 0 ? "positive" : "negative" },
      ],
      recommendations: margin < 25 ? [
        {
          id: "rec-pricing",
          title: "Adjust Low Margin Products",
          reasoning: `Cost of goods represents ${100 - margin}% of total sales.`,
          actionSuggestion: "Review product costs with suppliers or adjust selling prices.",
          priority: "high",
        },
      ] : [],
      confidence: "high_confidence",
      followUpSuggestions: ["Which products have the best margins?", "Any recommendations?", "Who owes me money?"],
    };
  }

  // 4. Product Margins & Best Sellers
  if (q.includes("best-selling") || q.includes("best selling") || q.includes("top selling") || q.includes("margin") || q.includes("product")) {
    const high = cat.highestMarginProducts || [];
    const top = m.topSellingProducts || [];

    let highStr = "";
    if (high.length > 0) {
      highStr = `**Highest-Margin Catalog Products:**\n` + high.slice(0, 3).map((p: any) => `• **${p.name}**: ${p.marginPct}% margin (Price: ${curr} ${p.sellingPrice.toLocaleString()}, Cost: ${curr} ${p.costPrice.toLocaleString()})`).join("\n");
    }

    let topStr = "";
    if (top.length > 0) {
      topStr = `\n\n**Top Volume Sellers:**\n` + top.slice(0, 3).map((p: any) => `• **${p.name}**: ${p.units} units sold (${curr} ${p.revenue.toLocaleString()} revenue)`).join("\n");
    }

    return {
      answer: `Here is your product performance analysis for **${facts.businessName}**:\n\n${highStr || "No product catalog margins configured."}${topStr || "\n\nNo sales volume recorded yet to rank best-sellers."}`,
      keyMetrics: high[0] ? [
        { label: "Top Margin SKU", value: high[0].marginPct, formattedValue: `${high[0].name} (${high[0].marginPct}%)`, trend: "positive" },
      ] : [],
      confidence: "high_confidence",
      followUpSuggestions: ["Any recommendations?", "Do I have any low-stock products?", "How are my sales today?"],
    };
  }

  // 5. Low stock / Inventory
  if (q.includes("low-stock") || q.includes("low stock") || q.includes("stock") || q.includes("inventory") || q.includes("out of stock")) {
    if (inv.outOfStockCount === 0 && inv.lowStockCount === 0) {
      return {
        answer: `All **${cat.totalActiveProductsCount}** active products in your inventory are adequately stocked above their minimum reorder thresholds.`,
        keyMetrics: [
          { label: "Out of Stock", value: 0, formattedValue: "0 items", trend: "positive" },
          { label: "Low Stock", value: 0, formattedValue: "0 items", trend: "positive" },
        ],
        confidence: "high_confidence",
        followUpSuggestions: ["How are my sales today?", "Who owes me money?", "Any recommendations?"],
      };
    }

    const outList = inv.outOfStockItems.map((i: any) => `• **${i.name}**: 0 in stock (🔴 Out of Stock)`).join("\n");
    const lowList = inv.lowStockItems.map((i: any) => `• **${i.name}**: ${i.currentStock} left (Min: ${i.minimumStockLevel})`).join("\n");

    return {
      answer: `You have **${inv.outOfStockCount}** product(s) out of stock and **${inv.lowStockCount}** below minimum stock levels:\n\n${outList ? `${outList}\n` : ""}${lowList ? `${lowList}\n` : ""}\n**Action:** Reorder depleted inventory in **Business & Stock** to prevent stockouts during trading.`,
      keyMetrics: [
        { label: "Out of Stock", value: inv.outOfStockCount, formattedValue: `${inv.outOfStockCount} items`, trend: inv.outOfStockCount > 0 ? "negative" : "positive" },
        { label: "Low Stock", value: inv.lowStockCount, formattedValue: `${inv.lowStockCount} items`, trend: inv.lowStockCount > 0 ? "negative" : "neutral" },
      ],
      recommendations: [
        {
          id: "rec-stock",
          title: "Restock Depleted Products",
          reasoning: `${inv.outOfStockCount + inv.lowStockCount} items are at or below minimum threshold.`,
          actionSuggestion: "Create replenishment orders with your suppliers.",
          priority: "high",
        },
      ],
      confidence: "high_confidence",
      followUpSuggestions: ["How are my sales today?", "Who owes me money?", "Any recommendations?"],
    };
  }

  // 6. Debtors / "Who owes me money?"
  if (q.includes("owe") || q.includes("debt") || q.includes("receivable") || q.includes("credit")) {
    if (d.debtorsCount === 0 || d.totalOutstandingReceivables === 0) {
      return {
        answer: `You currently have **${curr} 0** in outstanding customer receivables. All customer purchases are fully settled.`,
        keyMetrics: [
          { label: "Total Receivables", value: 0, formattedValue: `${curr} 0`, trend: "positive" },
        ],
        confidence: "high_confidence",
        followUpSuggestions: ["How are my sales today?", "Any recommendations?"],
      };
    }

    const debtorRows = d.topDebtors.map((deb: any) => `• **${deb.name}**: ${curr} ${deb.debtAmount.toLocaleString()}${deb.phone ? ` (${deb.phone})` : ""}`).join("\n");

    return {
      answer: `You have **${d.debtorsCount}** customer account(s) with unpaid balances totaling **${curr} ${d.totalOutstandingReceivables.toLocaleString()}**:\n\n${debtorRows}\n\n**Action:** Send collection reminders to top debtor accounts in **Customers & CRM** to improve cash flow.`,
      keyMetrics: [
        { label: "Total Receivables", value: d.totalOutstandingReceivables, formattedValue: `${curr} ${d.totalOutstandingReceivables.toLocaleString()}`, trend: "negative" },
        { label: "Debtor Accounts", value: d.debtorsCount, formattedValue: `${d.debtorsCount}`, trend: "negative" },
      ],
      recommendations: [
        {
          id: "rec-collect",
          title: "Follow Up on Customer Credit",
          reasoning: `${curr} ${d.totalOutstandingReceivables.toLocaleString()} is tied up in receivables.`,
          actionSuggestion: "Send WhatsApp / SMS reminders from Customers ledger.",
          priority: "high",
        },
      ],
      confidence: "high_confidence",
      followUpSuggestions: ["How are my sales today?", "What is low in stock?", "Any recommendations?"],
    };
  }

  // 7. General performance / month performance
  return {
    answer: `Here is the 30-day business performance for **${facts.businessName}**:\n\n- **Revenue:** ${curr} ${m.totalRevenue.toLocaleString()} across **${m.totalSalesCount}** transactions\n- **Gross Profit:** ${curr} ${m.grossProfit.toLocaleString()} (**${m.grossMarginPct}%** gross margin)\n- **Operating Expenses:** ${curr} ${m.totalExpenses.toLocaleString()}\n- **Net Profit:** ${curr} ${m.estimatedNetProfit.toLocaleString()}\n- **Inventory Watch:** ${inv.outOfStockCount} out of stock, ${inv.lowStockCount} low on stock\n- **Customer Receivables:** ${curr} ${d.totalOutstandingReceivables.toLocaleString()}`,
    keyMetrics: [
      { label: "30-Day Revenue", value: m.totalRevenue, formattedValue: `${curr} ${m.totalRevenue.toLocaleString()}`, trend: "positive" },
      { label: "Gross Margin", value: m.grossMarginPct, formattedValue: `${m.grossMarginPct}%`, trend: "positive" },
      { label: "Net Profit", value: m.estimatedNetProfit, formattedValue: `${curr} ${m.estimatedNetProfit.toLocaleString()}`, trend: m.estimatedNetProfit >= 0 ? "positive" : "negative" },
    ],
    confidence: "high_confidence",
    followUpSuggestions: ["Any recommendations?", "How are my sales today?", "Who owes me money?"],
  };
}
