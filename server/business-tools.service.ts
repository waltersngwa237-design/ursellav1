import { createClient } from '@supabase/supabase-js';
import {
  runLedger,
  createUrsellaAdapter,
  buildInput,
  openingLotsFromProducts,
  productCostIndex,
  compareToRecordedCost,
  reconcileStock,
  type UrsellaProductRow,
  type UrsellaInventoryTransactionRow,
  type UrsellaSaleItemRow,
} from '../src/lib/fifo/index.ts';

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
export function getTimezoneDateRange(timezone = 'Africa/Douala', days = 1): {
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
 * Grounded in authoritative Supabase PostgreSQL database records and pure FIFO costing.
 */
export class BusinessToolsService {
  /**
   * Verifies user has authorized access to the business.
   * Multi-tenant security rule: NEVER fail open.
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
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Runs the authoritative FIFO engine across a business's inventory transactions and sales.
   */
  public static async runFIFOLedger(businessId: string) {
    const [
      { data: products },
      { data: transactions },
      { data: saleItems },
    ] = await Promise.all([
      serverSupabase.from('products').select('*').eq('business_id', businessId),
      serverSupabase.from('inventory_transactions').select('*').eq('business_id', businessId).order('created_at', { ascending: true }),
      serverSupabase.from('sale_items').select('*').eq('business_id', businessId).order('created_at', { ascending: true }),
    ]);

    const productRows = (products || []) as UrsellaProductRow[];
    const movementRows = (transactions || []) as UrsellaInventoryTransactionRow[];
    const itemRows = (saleItems || []) as UrsellaSaleItemRow[];

    const adapter = createUrsellaAdapter({
      productCostById: productCostIndex(productRows),
    });

    const built = buildInput(adapter, {
      products: productRows,
      stockMovements: movementRows,
      saleLineItems: itemRows,
    });

    // Opening lots from products if no explicit initial_stock rows exist
    const hasInitialTransactions = movementRows.some(
      (m) => m.transaction_type === 'initial_stock' || m.transaction_type === 'purchase'
    );
    const openingEvents = hasInitialTransactions ? [] : openingLotsFromProducts(productRows);

    const ledgerResult = runLedger([...openingEvents, ...built.events]);

    const costDrift = compareToRecordedCost(itemRows, ledgerResult.sales);
    const stockReconciliation = reconcileStock(productRows, ledgerResult.valuationByProduct);

    return {
      productRows,
      itemRows,
      movementRows,
      ledgerResult,
      costDrift,
      stockReconciliation,
    };
  }

  /**
   * 1. Tool: get_business_overview
   */
  public static async getBusinessOverview(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);

    return await this.calculateOverviewWithFIFO(businessId, startDateIso, endDateIso, timezone);
  }

  /**
   * 2. Tool: get_inventory_alerts
   */
  public static async getInventoryAlerts(businessId: string) {
    const { data: products } = await serverSupabase
      .from('products')
      .select('id, name, sku, cost_price, selling_price, stock_quantity, minimum_stock_level, is_active, product_type, unit_of_measure')
      .eq('business_id', businessId)
      .eq('is_active', true);

    const activeList = products || [];
    const physicalList = activeList.filter((p: any) => p.product_type !== 'service');
    const outOfStock = physicalList.filter((p) => (p.stock_quantity || 0) <= 0);
    const lowStock = physicalList.filter(
      (p) => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= (p.minimum_stock_level || 5)
    );

    // Calculate FIFO inventory valuation
    let fifoValuation = 0;
    try {
      const fifo = await this.runFIFOLedger(businessId);
      fifoValuation = fifo.ledgerResult.totals.inventoryValue;
    } catch {
      fifoValuation = physicalList.reduce((sum, p) => sum + (Number(p.stock_quantity || 0) * Number(p.cost_price || 0)), 0);
    }

    const criticalItemsToRestock = [...outOfStock, ...lowStock].map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: p.stock_quantity,
      minimumStockLevel: p.minimum_stock_level || 5,
      costPrice: p.cost_price,
      sellingPrice: p.selling_price,
      unitOfMeasure: p.unit_of_measure || 'piece',
      status: (p.stock_quantity || 0) <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      estimatedRestockCost: Math.max(0, ((p.minimum_stock_level || 5) * 2 - (p.stock_quantity || 0)) * (p.cost_price || 0)),
    }));

    return {
      totalActiveSKUs: physicalList.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      healthyStockCount: physicalList.length - outOfStock.length - lowStock.length,
      totalInventoryValuation: fifoValuation,
      criticalItemsToRestock,
      hasStockIssues: outOfStock.length > 0 || lowStock.length > 0,
    };
  }

  /**
   * 3. Tool: get_today_sales_summary
   */
  public static async getTodaySalesSummary(businessId: string, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso, todayDateStr } = getTimezoneDateRange(timezone, 1);

    const [{ data: salesToday }, { data: paymentsToday }, invAlerts] = await Promise.all([
      serverSupabase
        .from('sales')
        .select('id, total, amount_paid, amount_due, payment_status, payment_method, sold_at')
        .eq('business_id', businessId)
        .eq('sale_status', 'completed')
        .gte('sold_at', startDateIso)
        .lte('sold_at', endDateIso),
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

    // Authoritative FIFO COGS calculation for today's sales
    let cogsToday = 0;
    const saleIds = new Set(sales.map((s) => s.id));
    if (saleIds.size > 0) {
      try {
        const fifo = await this.runFIFOLedger(businessId);
        const fifoByItem = new Map(fifo.ledgerResult.sales.map((s) => [s.saleEventId, s.cogs]));
        const todayItems = fifo.itemRows.filter((i) => saleIds.has(i.sale_id));
        cogsToday = todayItems.reduce((acc, i) => acc + (fifoByItem.get(i.id) ?? (Number(i.unit_cost || 0) * Number(i.quantity || 1))), 0);
      } catch {
        const { data: saleItems } = await serverSupabase
          .from('sale_items')
          .select('quantity, unit_cost')
          .in('sale_id', Array.from(saleIds));
        if (saleItems) {
          cogsToday = saleItems.reduce((acc, i) => acc + Number(i.unit_cost || 0) * Number(i.quantity || 1), 0);
        }
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
      inventoryAlerts: invAlerts,
    };
  }

  /**
   * 4. Tool: get_product_performance
   * Returns comprehensive product performance, unit economics, catalog margins, and FIFO valuation.
   */
  public static async getProductPerformance(businessId: string, limit = 50, searchQuery?: string) {
    try {
      const fifo = await this.runFIFOLedger(businessId);
      const fifoByItem = new Map(fifo.ledgerResult.sales.map((s) => [s.saleEventId, s]));
      const valuationRecord = fifo.ledgerResult.valuationByProduct || {};

      const productStats = new Map<
        string,
        {
          id: string;
          name: string;
          sku?: string | null;
          productType: string;
          unitOfMeasure: string;
          sellingPrice: number;
          costPrice: number;
          unitsSold: number;
          revenue: number;
          cogs: number;
          stockQuantity: number;
          fifoInventoryValue: number;
          fifoUnitsOnHand: number;
          fifoUnitCostAverage: number;
        }
      >();

      for (const p of fifo.productRows) {
        const fifoVal = valuationRecord[p.id];
        const costP = Number(p.cost_price || 0);
        const sellP = Number(p.selling_price || 0);
        const stockQty = Number(p.stock_quantity || 0);
        const fifoUnits = fifoVal ? fifoVal.quantityOnHand : stockQty;
        const fifoValuation = fifoVal ? fifoVal.inventoryValue : stockQty * costP;
        const fifoUnitCostAvg = fifoUnits > 0 ? Number((fifoValuation / fifoUnits).toFixed(2)) : (fifoVal?.averageUnitCost || costP);

        productStats.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.sku,
          productType: (p as any).product_type || 'physical',
          unitOfMeasure: (p as any).unit_of_measure || 'piece',
          sellingPrice: sellP,
          costPrice: costP,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          stockQuantity: stockQty,
          fifoInventoryValue: fifoValuation,
          fifoUnitsOnHand: fifoUnits,
          fifoUnitCostAverage: fifoUnitCostAvg,
        });
      }

      for (const item of fifo.itemRows) {
        if (!item.product_id) continue;
        const entry = productStats.get(item.product_id);
        if (!entry) continue;
        const fifoSold = fifoByItem.get(item.id);
        const qty = Number(item.quantity || 0);
        const rev = Number(item.total || 0);
        const cogs = fifoSold ? fifoSold.cogs : Number(item.unit_cost || 0) * qty;

        entry.unitsSold += qty;
        entry.revenue += rev;
        entry.cogs += cogs;
      }

      const cleanQuery = (searchQuery || '').toLowerCase().trim();

      let results = Array.from(productStats.values()).map((p) => {
        const grossProfit = p.revenue - p.cogs;
        // Realized margin from historical sales
        const realizedMarginPct = p.revenue > 0 ? Number(((grossProfit / p.revenue) * 100).toFixed(1)) : null;
        // Catalog unit margin based on selling price and cost price: ((SP - CP) / SP) * 100
        const catalogUnitMarginPct =
          p.sellingPrice > 0
            ? Number((((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(1))
            : 0;
        // Unit margin based on FIFO average unit cost
        const fifoUnitMarginPct =
          p.sellingPrice > 0
            ? Number((((p.sellingPrice - p.fifoUnitCostAverage) / p.sellingPrice) * 100).toFixed(1))
            : 0;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          productType: p.productType,
          unitOfMeasure: p.unitOfMeasure,
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice,
          stockQuantity: p.stockQuantity,
          fifoUnitsOnHand: p.fifoUnitsOnHand,
          fifoUnitCostAverage: p.fifoUnitCostAverage,
          fifoInventoryValue: p.fifoInventoryValue,
          unitsSold: p.unitsSold,
          revenue: p.revenue,
          cogs: p.cogs,
          grossProfit,
          // Primary margin: uses realized margin if sold, else catalog unit margin
          marginPct: realizedMarginPct !== null ? realizedMarginPct : catalogUnitMarginPct,
          realizedMarginPct,
          catalogUnitMarginPct,
          fifoUnitMarginPct,
        };
      });

      // Filter by search query if specified
      if (cleanQuery.length > 0) {
        const matched = results.filter(
          (r) => r.name.toLowerCase().includes(cleanQuery) || (r.sku && r.sku.toLowerCase().includes(cleanQuery))
        );
        if (matched.length > 0) {
          results = matched;
        }
      }

      // Sort with highest revenue or margin first
      return results
        .sort((a, b) => {
          if (b.revenue !== a.revenue) return b.revenue - a.revenue;
          return b.marginPct - a.marginPct;
        })
        .slice(0, limit);
    } catch {
      const { data: products } = await serverSupabase
        .from('products')
        .select('id, name, sku, selling_price, cost_price, stock_quantity')
        .eq('business_id', businessId)
        .limit(limit);

      return (products || []).map((p) => {
        const sellP = Number(p.selling_price || 0);
        const costP = Number(p.cost_price || 0);
        const stockQty = Number(p.stock_quantity || 0);
        const catalogMargin = sellP > 0 ? Number((((sellP - costP) / sellP) * 100).toFixed(1)) : 0;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          sellingPrice: sellP,
          costPrice: costP,
          stockQuantity: stockQty,
          fifoUnitsOnHand: stockQty,
          fifoUnitCostAverage: costP,
          fifoInventoryValue: stockQty * costP,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          marginPct: catalogMargin,
          realizedMarginPct: null,
          catalogUnitMarginPct: catalogMargin,
          fifoUnitMarginPct: catalogMargin,
        };
      });
    }
  }

  /**
   * 5. Tool: get_customer_balances (Debtors / Receivables)
   */
  public static async getCustomerBalances(businessId: string) {
    const [{ data: customers }, { data: unpaidSales }] = await Promise.all([
      serverSupabase.from('customers').select('id, name, phone, email').eq('business_id', businessId),
      serverSupabase
        .from('sales')
        .select('id, customer_id, total, amount_paid, amount_due, payment_status, sold_at')
        .eq('business_id', businessId)
        .eq('sale_status', 'completed')
        .gt('amount_due', 0),
    ]);

    const custMap = new Map((customers || []).map((c) => [c.id, c]));
    const debtorTotals = new Map<string, { name: string; phone?: string; totalDue: number; ordersCount: number }>();

    let totalOutstanding = 0;

    for (const s of unpaidSales || []) {
      const due = Number(s.amount_due || 0);
      totalOutstanding += due;
      const cust = s.customer_id ? custMap.get(s.customer_id) : null;
      const custId = s.customer_id || 'unassigned';
      const name = cust?.name || 'Walk-in / Unassigned Customer';

      const existing = debtorTotals.get(custId) || {
        name,
        phone: cust?.phone || undefined,
        totalDue: 0,
        ordersCount: 0,
      };

      existing.totalDue += due;
      existing.ordersCount += 1;
      debtorTotals.set(custId, existing);
    }

    const topDebtors = Array.from(debtorTotals.values())
      .map((d) => ({
        name: d.name,
        phone: d.phone,
        debtAmount: d.totalDue,
        unpaidOrdersCount: d.ordersCount,
      }))
      .sort((a, b) => b.debtAmount - a.debtAmount);

    return {
      totalOutstandingDebt: totalOutstanding,
      debtorsCount: topDebtors.length,
      topDebtors,
      hasOutstandingDebtors: topDebtors.length > 0,
    };
  }

  /**
   * 6. Tool: get_expense_summary
   */
  public static async getExpenseSummary(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);

    const { data: expenses } = await serverSupabase
      .from('expenses')
      .select('amount, category, description, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', startDateIso.split('T')[0])
      .lte('expense_date', endDateIso.split('T')[0]);

    const expList = expenses || [];
    const totalExpenses = expList.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const categoryMap = new Map<string, number>();
    for (const e of expList) {
      const cat = e.category || 'General';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(e.amount || 0));
    }

    const expensesByCategory = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
    }));

    return {
      totalExpenses,
      expenseCount: expList.length,
      expensesByCategory,
      timeHorizonDays,
    };
  }

  /**
   * 7. Tool: get_cash_flow
   */
  public static async getCashFlow(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    const { startDateIso, endDateIso } = getTimezoneDateRange(timezone, timeHorizonDays);

    const [{ data: payments }, { data: expenses }] = await Promise.all([
      serverSupabase
        .from('payments')
        .select('amount, payment_method, paid_at')
        .eq('business_id', businessId)
        .gte('paid_at', startDateIso)
        .lte('paid_at', endDateIso),
      serverSupabase
        .from('expenses')
        .select('amount, expense_date')
        .eq('business_id', businessId)
        .gte('expense_date', startDateIso.split('T')[0])
        .lte('expense_date', endDateIso.split('T')[0]),
    ]);

    const cashIn = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cashOut = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netCashFlow = cashIn - cashOut;

    return {
      cashInflows: cashIn,
      cashOutflows: cashOut,
      netCashFlow,
      timeHorizonDays,
    };
  }

  /**
   * 8. Tool: get_sales_summary
   */
  public static async getSalesSummary(businessId: string, timeHorizonDays = 30, timezone = 'Africa/Douala') {
    return await this.getBusinessOverview(businessId, timeHorizonDays, timezone);
  }

  /**
   * 9. Tool: get_period_comparison
   */
  public static async getPeriodComparison(businessId: string, days = 7, timezone = 'Africa/Douala') {
    const current = await this.getBusinessOverview(businessId, days, timezone);
    const prior = await this.getBusinessOverview(businessId, days * 2, timezone);

    const priorRevenue = Math.max(0, prior.revenue - current.revenue);
    const revenueGrowthPct = priorRevenue > 0 ? Number((((current.revenue - priorRevenue) / priorRevenue) * 100).toFixed(1)) : 0;

    return {
      currentPeriod: {
        days,
        revenue: current.revenue,
        cogs: current.cost_of_goods_sold,
        grossProfit: current.gross_profit,
        transactions: current.transaction_count,
      },
      priorPeriod: {
        days,
        revenue: priorRevenue,
      },
      revenueGrowthPct,
      trend: revenueGrowthPct > 0 ? 'growth' : revenueGrowthPct < 0 ? 'contraction' : 'flat',
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
   * 12. Tool: get_fifo_inventory_valuation (Authoritative FIFO Ledger Audit)
   */
  public static async getFIFOInventoryValuation(businessId: string) {
    const fifo = await this.runFIFOLedger(businessId);
    return {
      totals: fifo.ledgerResult.totals,
      valuationByProduct: fifo.ledgerResult.valuationByProduct,
      warnings: fifo.ledgerResult.warnings,
      costDrift: fifo.costDrift,
      stockReconciliation: fifo.stockReconciliation,
    };
  }

  /**
   * Authoritative calculation of overview metrics using the FIFO ledger.
   */
  private static async calculateOverviewWithFIFO(
    businessId: string,
    startDateIso: string,
    endDateIso: string,
    defaultTimezone = 'Africa/Douala'
  ) {
    const [{ data: business }, { data: sales }, { data: expenses }, { data: payments }, fifo] =
      await Promise.all([
        serverSupabase.from('businesses').select('currency, timezone').eq('id', businessId).maybeSingle(),
        serverSupabase
          .from('sales')
          .select('id, total, amount_paid, amount_due, sold_at')
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
        this.runFIFOLedger(businessId),
      ]);

    const salesList = sales || [];
    const revenue = salesList.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const txCount = salesList.length;

    // FIFO COGS for sales in this timeframe
    const windowSaleIds = new Set(salesList.map((s) => s.id));
    const fifoByItem = new Map(fifo.ledgerResult.sales.map((s) => [s.saleEventId, s.cogs]));
    const windowItems = fifo.itemRows.filter((i) => windowSaleIds.has(i.sale_id));

    let cogs = windowItems.reduce(
      (sum, item) => sum + (fifoByItem.get(item.id) ?? (Number(item.unit_cost || 0) * Number(item.quantity || 1))),
      0
    );

    if (cogs === 0 && revenue > 0 && fifo.productRows.length > 0) {
      const avgCostRatio = fifo.productRows.reduce((acc, p) => {
        const sp = Number(p.selling_price || 0);
        const cp = Number(p.cost_price || 0);
        return sp > 0 ? acc + cp / sp : acc;
      }, 0) / fifo.productRows.length;
      cogs = Number((revenue * (avgCostRatio || 0.6)).toFixed(2));
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
      cogs,
      gross_profit: grossProfit,
      grossProfit,
      gross_margin: grossMargin,
      grossMarginPercent: grossMargin,
      operating_expenses: operatingExpenses,
      operatingExpenses,
      estimated_net_profit: netProfit,
      netProfit,
      net_margin: netMargin,
      netMarginPercent: netMargin,
      transaction_count: txCount,
      transactionCount: txCount,
      average_order_value: txCount > 0 ? Number((revenue / txCount).toFixed(2)) : 0,
      averageOrderValue: txCount > 0 ? Number((revenue / txCount).toFixed(2)) : 0,
      amount_collected: amountCollected,
      totalCashCollected: amountCollected,
      outstanding_receivables: receivables,
      totalReceivablesOutstanding: receivables,
    };
  }
}
