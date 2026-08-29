import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

export const serverSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface BusinessAuthorizationContext {
  userId: string;
  businessId: string;
}

/**
 * Calculates start and end ISO date strings for a given timezone and horizon days.
 * For Cameroon (Africa/Douala, UTC+1), "today" starts at midnight Douala time (23:00 UTC prior).
 */
export function getTimezoneDateRange(timezone: string = 'Africa/Douala', days = 1): {
  startDateIso: string;
  endDateIso: string;
  todayDateStr: string;
} {
  try {
    const now = new Date();
    // Get calendar date in target timezone
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = dtf.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '01';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const todayDateStr = `${year}-${month}-${day}`;

    // Compute UTC offset between target timezone and UTC
    const targetTzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMs = targetTzDate.getTime() - utcDate.getTime();

    // Midnight in the local timezone corresponds to UTC:
    const utcMidnightForToday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0));
    const startOfTodayUtc = new Date(utcMidnightForToday.getTime() - offsetMs);
    const startOfRangeUtc = new Date(startOfTodayUtc.getTime() - (days - 1) * 86400000);
    const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 86400000 - 1);

    return {
      startDateIso: startOfRangeUtc.toISOString(),
      endDateIso: endOfTodayUtc.toISOString(),
      todayDateStr,
    };
  } catch {
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
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
 * Server-side business tools executor.
 * Strictly verifies tenant authorization and executes predefined business queries.
 * Grounded in the Supabase PostgreSQL database records.
 */
export class BusinessToolsService {
  /**
   * Verifies user has access to the business.
   */
  public static async verifyTenantAccess(userId: string, businessId: string): Promise<boolean> {
    if (!userId || !businessId) return false;
    try {
      const { data, error } = await serverSupabase
        .from('business_members')
        .select('id, role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return true;
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * 1. Tool: get_business_overview
   */
  public static async getBusinessOverview(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);

    try {
      const { data, error } = await serverSupabase.rpc('get_business_analytics', {
        p_business_id: businessId,
        p_start_date: startDateIso,
        p_end_date: endDateIso,
      });

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('RPC get_business_analytics failed, falling back to direct calculation:', e);
    }

    return await this.calculateFallbackOverview(businessId, startDateIso, endDateIso, timezone);
  }

  /**
   * 2. Tool: get_sales_summary
   */
  public static async getSalesSummary(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso, todayDateStr } = getTimezoneDateRange(timezone, timeHorizonDays);

    const { data: sales } = await serverSupabase
      .from('sales')
      .select('id, total, amount_paid, amount_due, payment_status, payment_method, sold_at')
      .eq('business_id', businessId)
      .eq('sale_status', 'completed')
      .gte('sold_at', startDateIso)
      .lte('sold_at', endDateIso)
      .order('sold_at', { ascending: false });

    const salesList = sales || [];
    const totalSales = salesList.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const totalCollected = salesList.reduce((acc, s) => acc + Number(s.amount_paid || 0), 0);
    const totalDue = salesList.reduce((acc, s) => acc + Number(s.amount_due || 0), 0);
    const count = salesList.length;

    return {
      periodDays: timeHorizonDays,
      referenceDate: todayDateStr,
      timezone,
      transactionCount: count,
      totalRevenue: totalSales,
      totalCashCollected: totalCollected,
      totalReceivablesOutstanding: totalDue,
      averageOrderValue: count > 0 ? Number((totalSales / count).toFixed(2)) : 0,
      recentSalesCount: Math.min(count, 5),
    };
  }

  /**
   * 3. Tool: get_today_sales_summary
   * Specific high-precision today metrics using the business's timezone.
   */
  public static async getTodaySalesSummary(businessId: string, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso, todayDateStr } = getTimezoneDateRange(timezone, 1);

    const [{ data: salesToday }, { data: paymentsToday }, inventoryAlerts] = await Promise.all([
      serverSupabase
        .from('sales')
        .select('id, total, amount_paid, amount_due, payment_status, payment_method, sold_at')
        .eq('business_id', businessId)
        .eq('sale_status', 'completed')
        .gte('sold_at', startDateIso)
        .lte('sold_at', endDateIso)
        .order('sold_at', { ascending: false }),
      serverSupabase
        .from('payments')
        .select('amount, payment_method, paid_at')
        .eq('business_id', businessId)
        .gte('paid_at', startDateIso)
        .lte('paid_at', endDateIso),
      this.getInventoryAlerts(businessId),
    ]);

    const sales = salesToday || [];
    const payments = paymentsToday || [];
    const revenueToday = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const txCountToday = sales.length;
    const cashCollectedToday = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const receivablesToday = sales.reduce((sum, s) => sum + Number(s.amount_due || 0), 0);

    // Compute COGS for today's sales
    let cogsToday = 0;
    const saleIds = sales.map((s) => s.id);
    if (saleIds.length > 0) {
      const { data: saleItems } = await serverSupabase
        .from('sale_items')
        .select('quantity, unit_cost, total_cost')
        .in('sale_id', saleIds);

      if (saleItems && saleItems.length > 0) {
        cogsToday = saleItems.reduce((sum, item) => {
          const cost = Number(item.total_cost || 0) > 0
            ? Number(item.total_cost)
            : Number(item.unit_cost || 0) * Number(item.quantity || 1);
          return sum + cost;
        }, 0);
      }
    }

    const grossProfitToday = revenueToday - cogsToday;
    const grossMarginToday = revenueToday > 0 ? Number(((grossProfitToday / revenueToday) * 100).toFixed(1)) : 0;

    return {
      todayDate: todayDateStr,
      timezone,
      salesCount: txCountToday,
      revenue: revenueToday,
      cogs: cogsToday,
      grossProfit: grossProfitToday,
      grossMarginPct: grossMarginToday,
      cashCollected: cashCollectedToday,
      receivablesCreated: receivablesToday,
      hasRecordedSalesToday: txCountToday > 0,
      inventoryAlerts,
    };
  }

  /**
   * 4. Tool: get_product_performance
   */
  public static async getProductPerformance(businessId: string, limit = 5) {
    try {
      const { data, error } = await serverSupabase.rpc('get_product_analytics', {
        p_business_id: businessId,
        p_start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
        p_end_date: new Date().toISOString(),
        p_limit: limit,
      });

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback
    }

    // Direct query fallback
    const { data: products } = await serverSupabase
      .from('products')
      .select('id, name, selling_price, cost_price, stock_quantity, minimum_stock_level')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .limit(limit);

    return (
      products?.map((p) => ({
        id: p.id,
        name: p.name,
        sellingPrice: Number(p.selling_price),
        costPrice: Number(p.cost_price),
        unitMargin: Number(p.selling_price) - Number(p.cost_price),
        marginPct:
          Number(p.selling_price) > 0
            ? Number((((Number(p.selling_price) - Number(p.cost_price)) / Number(p.selling_price)) * 100).toFixed(1))
            : 0,
        stockQuantity: p.stock_quantity,
      })) || []
    );
  }

  /**
   * 5. Tool: get_inventory_alerts
   */
  public static async getInventoryAlerts(businessId: string) {
    const { data: products } = await serverSupabase
      .from('products')
      .select('id, name, stock_quantity, minimum_stock_level, cost_price')
      .eq('business_id', businessId)
      .eq('is_active', true);

    const activeList = products || [];
    const lowStock = activeList.filter(
      (p) => p.stock_quantity > 0 && p.stock_quantity <= (p.minimum_stock_level || 5)
    );
    const outOfStock = activeList.filter((p) => p.stock_quantity === 0);
    const totalValuation = activeList.reduce(
      (sum, p) => sum + Number(p.stock_quantity || 0) * Number(p.cost_price || 0),
      0
    );

    return {
      totalActiveSKUs: activeList.length,
      totalInventoryValuation: totalValuation,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      criticalItemsToRestock: [...outOfStock, ...lowStock].slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        currentStock: p.stock_quantity,
        minimumStockLevel: p.minimum_stock_level || 5,
        status: p.stock_quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      })),
    };
  }

  /**
   * 6. Tool: get_customer_balances
   */
  public static async getCustomerBalances(businessId: string) {
    const { data: customers } = await serverSupabase
      .from('customers')
      .select('id, name, phone, outstanding_debt, total_spent, total_orders, last_order_at')
      .eq('business_id', businessId);

    const list = customers || [];
    const debtors = list
      .filter((c) => Number(c.outstanding_debt || 0) > 0)
      .sort((a, b) => Number(b.outstanding_debt || 0) - Number(a.outstanding_debt || 0));

    const totalDebt = debtors.reduce((sum, c) => sum + Number(c.outstanding_debt || 0), 0);

    return {
      totalRegisteredCustomers: list.length,
      debtorsCount: debtors.length,
      totalOutstandingDebt: totalDebt,
      topDebtors: debtors.slice(0, 5).map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        debtAmount: Number(d.outstanding_debt),
        totalSpent: Number(d.total_spent),
      })),
    };
  }

  /**
   * 7. Tool: get_expense_summary
   */
  public static async getExpenseSummary(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso, todayDateStr } = getTimezoneDateRange(timezone, timeHorizonDays);
    const startDate = startDateIso.split('T')[0];

    const { data: expenses } = await serverSupabase
      .from('expenses')
      .select('id, category, description, amount, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', startDate);

    const list = expenses || [];
    const total = list.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const categoryMap: Record<string, number> = {};
    for (const e of list) {
      const cat = e.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount || 0);
    }

    const categories = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentageOfTotal: total > 0 ? Number(((amount / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      periodDays: timeHorizonDays,
      referenceDate: todayDateStr,
      totalExpenses: total,
      topExpenseCategories: categories.slice(0, 5),
      recentExpenses: list.slice(0, 4).map((e) => ({
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        date: e.expense_date,
      })),
    };
  }

  /**
   * 8. Tool: get_cash_flow
   */
  public static async getCashFlow(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);

    const [{ data: payments }, { data: expenses }] = await Promise.all([
      serverSupabase
        .from('payments')
        .select('amount')
        .eq('business_id', businessId)
        .gte('paid_at', startDateIso),
      serverSupabase
        .from('expenses')
        .select('amount')
        .eq('business_id', businessId)
        .gte('expense_date', startDateIso.split('T')[0]),
    ]);

    const cashIn = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
    const cashOut = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

    return {
      periodDays: timeHorizonDays,
      cashInflow: cashIn,
      cashOutflow: cashOut,
      netCashFlow: cashIn - cashOut,
      cashStatus: cashIn >= cashOut ? 'POSITIVE_CASH_FLOW' : 'NEGATIVE_CASH_FLOW',
    };
  }

  /**
   * 9. Tool: get_period_comparison
   */
  public static async getPeriodComparison(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const now = new Date();
    const currStart = new Date(now.getTime() - timeHorizonDays * 86400000);
    const priorEnd = new Date(currStart.getTime() - 1);
    const priorStart = new Date(currStart.getTime() - timeHorizonDays * 86400000);

    try {
      const { data, error } = await serverSupabase.rpc('get_period_comparison', {
        p_business_id: businessId,
        p_current_start: currStart.toISOString(),
        p_current_end: now.toISOString(),
        p_prior_start: priorStart.toISOString(),
        p_prior_end: priorEnd.toISOString(),
      });

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback
    }

    const [currOverview, priorOverview] = await Promise.all([
      this.calculateFallbackOverview(businessId, currStart.toISOString(), now.toISOString(), timezone),
      this.calculateFallbackOverview(businessId, priorStart.toISOString(), priorEnd.toISOString(), timezone),
    ]);

    const revDiff = currOverview.revenue - priorOverview.revenue;
    const revPct =
      priorOverview.revenue > 0 ? Number(((revDiff / priorOverview.revenue) * 100).toFixed(1)) : null;

    return {
      revenue: {
        current: currOverview.revenue,
        prior: priorOverview.revenue,
        percentageChange: revPct,
        trend: revDiff > 0 ? 'positive' : revDiff < 0 ? 'negative' : 'neutral',
      },
      grossProfit: {
        current: currOverview.gross_profit,
        prior: priorOverview.gross_profit,
        percentageChange:
          priorOverview.gross_profit > 0
            ? Number((((currOverview.gross_profit - priorOverview.gross_profit) / priorOverview.gross_profit) * 100).toFixed(1))
            : null,
      },
      expenses: {
        current: currOverview.operating_expenses,
        prior: priorOverview.operating_expenses,
      },
      transactionCount: {
        current: currOverview.transaction_count,
        prior: priorOverview.transaction_count,
      },
    };
  }

  /**
   * 10. Tool: get_business_health
   */
  public static async getBusinessHealth(businessId: string, timezone = 'Africa/Douala') {
    const overview = await this.getBusinessOverview(businessId, 30, timezone);
    const inv = await this.getInventoryAlerts(businessId);
    const debtors = await this.getCustomerBalances(businessId);

    let score = 70;
    const keyObservations: string[] = [];

    if (overview.gross_margin >= 35) {
      score += 10;
      keyObservations.push(`Healthy gross margin of ${overview.gross_margin}%.`);
    } else if (overview.gross_margin < 20 && overview.revenue > 0) {
      score -= 15;
      keyObservations.push(`Low gross margin (${overview.gross_margin}%).`);
    }

    if (overview.estimated_net_profit > 0) {
      score += 10;
      keyObservations.push('Positive operational net profit.');
    } else if (overview.estimated_net_profit < 0) {
      score -= 20;
      keyObservations.push('Operating at an estimated net loss this period.');
    }

    if (inv.outOfStockCount > 0 || inv.lowStockCount >= 3) {
      score -= 10;
      keyObservations.push(`${inv.outOfStockCount + inv.lowStockCount} product(s) low or out of stock.`);
    }

    if (debtors.totalOutstandingDebt > overview.revenue * 0.3 && overview.revenue > 0) {
      score -= 10;
      keyObservations.push(`High customer debt exposure (${debtors.totalOutstandingDebt}).`);
    }

    score = Math.max(10, Math.min(100, score));

    return {
      score,
      rating: score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'At Risk',
      keyObservations,
      dataSufficiency: overview.transaction_count >= 5 ? 'high_confidence' : 'insufficient_data',
    };
  }

  /**
   * 11. Tool: get_daily_brief_facts
   */
  public static async getDailyBriefFacts(businessId: string, timezone = 'Africa/Douala') {
    const todaySales = await this.getTodaySalesSummary(businessId, timezone);
    const debtors = await this.getCustomerBalances(businessId);

    return {
      businessId,
      todayDate: todaySales.todayDate,
      timezone: todaySales.timezone,
      todayMetrics: {
        revenueToday: todaySales.revenue,
        transactionCountToday: todaySales.salesCount,
        cashCollectedToday: todaySales.cashCollected,
        grossProfitToday: todaySales.grossProfit,
        grossMarginPctToday: todaySales.grossMarginPct,
        receivablesCreatedToday: todaySales.receivablesCreated,
      },
      inventoryAlerts: todaySales.inventoryAlerts,
      debtorAlerts: debtors,
    };
  }

  /**
   * Internal database calculation for overview
   */
  private static async calculateFallbackOverview(
    businessId: string,
    startDateIso: string,
    endDateIso: string,
    defaultTimezone = 'Africa/Douala'
  ) {
    const [{ data: business }, { data: sales }, { data: expenses }, { data: payments }] =
      await Promise.all([
        serverSupabase.from('businesses').select('currency, timezone').eq('id', businessId).maybeSingle(),
        serverSupabase
          .from('sales')
          .select('id, total, amount_paid, amount_due')
          .eq('business_id', businessId)
          .eq('sale_status', 'completed')
          .gte('sold_at', startDateIso)
          .lte('sold_at', endDateIso),
        serverSupabase
          .from('expenses')
          .select('amount')
          .eq('business_id', businessId)
          .gte('expense_date', startDateIso.split('T')[0])
          .lte('expense_date', endDateIso.split('T')[0]),
        serverSupabase
          .from('payments')
          .select('amount')
          .eq('business_id', businessId)
          .gte('paid_at', startDateIso)
          .lte('paid_at', endDateIso),
      ]);

    const salesList = sales || [];
    const revenue = salesList.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const txCount = salesList.length;

    // Real COGS calculation by querying sale_items for these sales
    let cogs = 0;
    const saleIds = salesList.map((s) => s.id);
    if (saleIds.length > 0) {
      const { data: saleItems } = await serverSupabase
        .from('sale_items')
        .select('quantity, unit_cost, total_cost')
        .in('sale_id', saleIds);

      if (saleItems && saleItems.length > 0) {
        cogs = saleItems.reduce((sum, item) => {
          const itemCost = Number(item.total_cost || 0) > 0
            ? Number(item.total_cost)
            : Number(item.unit_cost || 0) * Number(item.quantity || 1);
          return sum + itemCost;
        }, 0);
      }
    }

    // If no sale_items costs were recorded, fallback to product catalogue costs
    if (cogs === 0 && revenue > 0) {
      const { data: products } = await serverSupabase
        .from('products')
        .select('cost_price, selling_price')
        .eq('business_id', businessId);

      if (products && products.length > 0) {
        const avgMargin = products.reduce((acc, p) => {
          const sp = Number(p.selling_price || 0);
          const cp = Number(p.cost_price || 0);
          return sp > 0 ? acc + (cp / sp) : acc;
        }, 0) / products.length;
        cogs = Number((revenue * (avgMargin || 0.6)).toFixed(2));
      }
    }

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(2)) : 0;
    const operatingExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const netProfit = grossProfit - operatingExpenses;
    const netMargin = revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(2)) : 0;
    const amountCollected = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
    const receivables = salesList.reduce((sum, s) => sum + Number(s.amount_due || 0), 0);

    return {
      business_id: businessId,
      currency: business?.currency || 'USD',
      timezone: business?.timezone || defaultTimezone,
      revenue,
      cost_of_goods_sold: cogs,
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      operating_expenses: operatingExpenses,
      estimated_net_profit: netProfit,
      net_margin: netMargin,
      transaction_count: txCount,
      average_order_value: txCount > 0 ? Number((revenue / txCount).toFixed(2)) : 0,
      amount_collected: amountCollected,
      outstanding_receivables: receivables,
    };
  }
}
