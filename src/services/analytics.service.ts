import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { isValidUUID } from '../lib/uuid.ts';
import type {
  CompleteBusinessAnalytics,
  DateRangePreset,
  DateRangeWindow,
  FinancialOverviewMetrics,
  PeriodComparisonSummary,
  TimeSeriesPoint,
  ProductPerformanceItem,
  CustomerSegmentMetrics,
  ExpenseCategoryBreakdown,
  CashFlowMetrics,
  BusinessAnomalyAlert,
  BusinessHealthIndicator,
  DataSufficiencyInfo,
  AIBusinessContextPayload,
  Sale,
  SaleItem,
  Product,
  Expense,
  Customer,
  Payment,
} from '../types/index.ts';

export const AnalyticsService = {
  /**
   * Resolves a DateRangePreset into precise ISO date strings for current and equivalent prior periods.
   */
  resolveDateRange(
    preset: DateRangePreset,
    customStart?: string,
    customEnd?: string
  ): DateRangeWindow {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let priorStart = new Date();
    let priorEnd = new Date();
    let label = 'Today';
    let priorLabel = 'Yesterday';

    switch (preset) {
      case 'today': {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - 1);
        priorEnd = new Date(end);
        priorEnd.setDate(priorEnd.getDate() - 1);
        label = 'Today';
        priorLabel = 'Yesterday';
        break;
      }
      case 'yesterday': {
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - 1);
        priorEnd = new Date(end);
        priorEnd.setDate(priorEnd.getDate() - 1);
        label = 'Yesterday';
        priorLabel = 'Day Before Yesterday';
        break;
      }
      case 'last_7_days': {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - 7);
        priorEnd = new Date(start);
        priorEnd.setMilliseconds(priorEnd.getMilliseconds() - 1);
        label = 'Last 7 Days';
        priorLabel = 'Prior 7 Days';
        break;
      }
      case 'last_30_days': {
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - 30);
        priorEnd = new Date(start);
        priorEnd.setMilliseconds(priorEnd.getMilliseconds() - 1);
        label = 'Last 30 Days';
        priorLabel = 'Prior 30 Days';
        break;
      }
      case 'this_week': {
        const dayOfWeek = now.getDay(); // 0 is Sunday
        const distanceToMonday = (dayOfWeek + 6) % 7;
        start.setDate(now.getDate() - distanceToMonday);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - 7);
        priorEnd = new Date(end);
        priorEnd.setDate(priorEnd.getDate() - 7);
        label = 'This Week';
        priorLabel = 'Last Week';
        break;
      }
      case 'last_week': {
        const dayOfWeek = now.getDay();
        const distanceToMonday = (dayOfWeek + 6) % 7;
        end.setDate(now.getDate() - distanceToMonday - 1);
        end.setHours(23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - 7);
        priorEnd = new Date(end);
        priorEnd.setDate(priorEnd.getDate() - 7);
        label = 'Last Week';
        priorLabel = 'Two Weeks Ago';
        break;
      }
      case 'this_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        priorEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        label = 'This Month';
        priorLabel = 'Last Month';
        break;
      }
      case 'last_month': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        priorStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        priorEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
        label = 'Last Month';
        priorLabel = 'Two Months Ago';
        break;
      }
      case 'this_year': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        priorStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        priorEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        label = 'This Year';
        priorLabel = 'Last Year';
        break;
      }
      case 'custom': {
        if (customStart) start = new Date(customStart);
        if (customEnd) end = new Date(customEnd);
        const duration = end.getTime() - start.getTime();
        priorEnd = new Date(start.getTime() - 1);
        priorStart = new Date(priorEnd.getTime() - duration);
        label = 'Custom Range';
        priorLabel = 'Preceding Period';
        break;
      }
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label,
      priorStartDate: priorStart.toISOString(),
      priorEndDate: priorEnd.toISOString(),
      priorLabel,
    };
  },

  /**
   * Fetches full authoritative analytics for the specified business and date window.
   */
  async getCompleteAnalytics(
    businessId: string,
    preset: DateRangePreset = 'last_30_days',
    customStart?: string,
    customEnd?: string
  ): Promise<CompleteBusinessAnalytics> {
    const window = this.resolveDateRange(preset, customStart, customEnd);

    if (isSupabaseConfigured) {
      try {
        // Run stored procedures in parallel
        const [
          overviewRes,
          comparisonRes,
          timeSeriesRes,
          productRes,
          customerRes,
          expenseRes,
        ] = await Promise.all([
          (supabase as any).rpc('get_business_analytics', {
            p_business_id: businessId,
            p_start_date: window.startDate,
            p_end_date: window.endDate,
          }),
          (supabase as any).rpc('get_period_comparison', {
            p_business_id: businessId,
            p_current_start: window.startDate,
            p_current_end: window.endDate,
            p_prior_start: window.priorStartDate,
            p_prior_end: window.priorEndDate,
          }),
          (supabase as any).rpc('get_sales_timeseries', {
            p_business_id: businessId,
            p_start_date: window.startDate,
            p_end_date: window.endDate,
            p_interval: preset === 'this_year' ? 'month' : 'day',
          }),
          (supabase as any).rpc('get_product_analytics', {
            p_business_id: businessId,
            p_start_date: window.startDate,
            p_end_date: window.endDate,
            p_limit: 50,
          }),
          (supabase as any).rpc('get_customer_analytics', {
            p_business_id: businessId,
            p_start_date: window.startDate,
            p_end_date: window.endDate,
          }),
          (supabase as any).rpc('get_expense_analytics', {
            p_business_id: businessId,
            p_start_date: window.startDate,
            p_end_date: window.endDate,
          }),
        ]);

        if (!overviewRes.error && overviewRes.data) {
          const overviewData = overviewRes.data;
          const compData = comparisonRes.data || {};
          const tsData: TimeSeriesPoint[] = timeSeriesRes.data || [];
          const prodData: ProductPerformanceItem[] = productRes.data || [];
          const custData: CustomerSegmentMetrics = customerRes.data || {
            totalCustomers: 0,
            activeInPeriod: 0,
            newCustomersInPeriod: 0,
            repeatCustomers: 0,
            highValueCustomers: 0,
            inactiveCustomers: 0,
            debtorCustomers: 0,
            totalOutstandingDebt: 0,
            topCustomersByRevenue: [],
          };
          const expData = expenseRes.data || {
            total_expenses: 0,
            expense_to_revenue_ratio: 0,
            categories: [],
            recent_expenses: [],
          };

          const financialOverview: FinancialOverviewMetrics = {
            revenue: Number(overviewData.revenue) || 0,
            costOfGoodsSold: Number(overviewData.cost_of_goods_sold) || 0,
            grossProfit: Number(overviewData.gross_profit) || 0,
            grossMargin: Number(overviewData.gross_margin) || 0,
            operatingExpenses: Number(overviewData.operating_expenses) || 0,
            estimatedNetProfit: Number(overviewData.estimated_net_profit) || 0,
            netMargin: Number(overviewData.net_margin) || 0,
            transactionCount: Number(overviewData.transaction_count) || 0,
            averageOrderValue: Number(overviewData.average_order_value) || 0,
            unitsSold: Number(overviewData.units_sold) || 0,
            amountCollected: Number(overviewData.amount_collected) || 0,
            outstandingReceivables: Number(overviewData.outstanding_receivables) || 0,
            inventoryValuation: Number(overviewData.inventory_valuation) || 0,
            lowStockCount: Number(overviewData.low_stock_count) || 0,
            outOfStockCount: Number(overviewData.out_of_stock_count) || 0,
          };

          const comparison = this.formatComparison(compData, financialOverview);

          const cashFlow: CashFlowMetrics = {
            cashInflows: financialOverview.amountCollected,
            cashOutflows: financialOverview.operatingExpenses,
            netCashFlow: financialOverview.amountCollected - financialOverview.operatingExpenses,
            accrualRevenue: financialOverview.revenue,
            outstandingCreditAdded: Math.max(0, financialOverview.revenue - financialOverview.amountCollected),
            paymentsByMethod: {},
            timeSeries: tsData.map((t) => ({
              date: t.date,
              cashIn: t.cashCollected || 0,
              cashOut: t.expenses || 0,
              netCash: (t.cashCollected || 0) - (t.expenses || 0),
            })),
          };

          const lowStockItems = prodData.filter(
            (p) => p.stockStatus === 'low_stock' || p.stockStatus === 'out_of_stock'
          );
          const slowMovingItems = prodData.filter((p) => p.stockStatus === 'slow_moving');

          const inventorySummary = {
            totalValuation: financialOverview.inventoryValuation,
            totalActiveSKUs: prodData.length,
            lowStockCount: financialOverview.lowStockCount,
            outOfStockCount: financialOverview.outOfStockCount,
            slowMovingCount: slowMovingItems.length,
            lowStockItems,
            slowMovingItems,
          };

          const healthIndicator = this.calculateHealthScore(financialOverview, comparison, inventorySummary);
          const anomalies = this.detectAnomalies(financialOverview, comparison, inventorySummary, prodData);
          const dataSufficiency = this.assessDataSufficiency(financialOverview.transactionCount, window);

          return {
            businessId,
            businessName: overviewData.name || 'Business',
            currency: overviewData.currency || 'USD',
            timezone: overviewData.timezone || 'UTC',
            window,
            financialOverview,
            comparison,
            timeSeries: tsData,
            topProducts: prodData,
            customerAnalytics: custData,
            expenseAnalytics: {
              totalExpenses: Number(expData.total_expenses) || 0,
              expenseToRevenueRatio: Number(expData.expense_to_revenue_ratio) || 0,
              categories: expData.categories || [],
              recentExpenses: expData.recent_expenses || [],
            },
            cashFlow,
            inventorySummary,
            healthIndicator,
            anomalies,
            dataSufficiency,
          };
        }
      } catch (err) {
        console.warn('Supabase analytics RPC failed, falling back to direct table queries:', err);
      }

      // If RPC was not available or failed, fetch directly from Supabase tables
      if (isValidUUID(businessId)) {
        try {
          const tableAnalytics = await this.fetchAndCalculateFromSupabaseTables(businessId, window);
          if (tableAnalytics) {
            return tableAnalytics;
          }
        } catch (tableErr) {
          console.warn('Direct Supabase table query failed, falling back to localStorage:', tableErr);
        }
      }
    }

    // Comprehensive client-side deterministic fallback engine
    return this.calculateLocalAnalytics(businessId, window);
  },

  /**
   * Fetches data directly from Supabase tables when RPC functions are not present.
   */
  async fetchAndCalculateFromSupabaseTables(
    businessId: string,
    window: DateRangeWindow
  ): Promise<CompleteBusinessAnalytics | null> {
    try {
      const [
        bizRes,
        salesRes,
        itemsRes,
        productsRes,
        expensesRes,
        customersRes,
        paymentsRes,
      ] = await Promise.all([
        (supabase as any).from('businesses').select('name, currency, timezone').eq('id', businessId).maybeSingle(),
        (supabase as any).from('sales').select('*').eq('business_id', businessId),
        (supabase as any).from('sale_items').select('*').eq('business_id', businessId),
        (supabase as any).from('products').select('*').eq('business_id', businessId),
        (supabase as any).from('expenses').select('*').eq('business_id', businessId),
        (supabase as any).from('customers').select('*').eq('business_id', businessId),
        (supabase as any).from('payments').select('*').eq('business_id', businessId),
      ]);

      const bizData = bizRes.data || {};
      const salesList: Sale[] = (salesRes.data || []) as Sale[];
      const itemsList: SaleItem[] = (itemsRes.data || []) as SaleItem[];
      const productsList: Product[] = (productsRes.data || []) as Product[];
      const expensesList: Expense[] = (expensesRes.data || []) as Expense[];
      const customersList: Customer[] = (customersRes.data || []) as Customer[];
      const paymentsList: Payment[] = (paymentsRes.data || []) as Payment[];

      return this.computeAnalyticsFromLists(
        businessId,
        bizData.name || 'Business',
        bizData.currency || 'USD',
        bizData.timezone || 'UTC',
        window,
        salesList,
        itemsList,
        productsList,
        expensesList,
        customersList,
        paymentsList
      );
    } catch (err) {
      console.warn('Failed to query Supabase tables for analytics:', err);
      return null;
    }
  },

  /**
   * Deterministic client-side computation from stored entities (localStorage fallback).
   */
  calculateLocalAnalytics(businessId: string, window: DateRangeWindow): CompleteBusinessAnalytics {
    const salesKey = `ursella_sales_${businessId}`;
    const itemsKey = `ursella_sale_items_${businessId}`;
    const prodKey = `ursella_products_${businessId}`;
    const expKey = `ursella_expenses_${businessId}`;
    const custKey = `ursella_customers_${businessId}`;
    const payKey = `ursella_payments_${businessId}`;

    const salesList: Sale[] = JSON.parse(localStorage.getItem(salesKey) || '[]');
    const itemsList: SaleItem[] = JSON.parse(localStorage.getItem(itemsKey) || '[]');
    const productsList: Product[] = JSON.parse(localStorage.getItem(prodKey) || '[]');
    const expensesList: Expense[] = JSON.parse(localStorage.getItem(expKey) || '[]');
    const customersList: Customer[] = JSON.parse(localStorage.getItem(custKey) || '[]');
    const paymentsList: Payment[] = JSON.parse(localStorage.getItem(payKey) || '[]');

    return this.computeAnalyticsFromLists(
      businessId,
      'Business',
      'USD',
      'UTC',
      window,
      salesList,
      itemsList,
      productsList,
      expensesList,
      customersList,
      paymentsList
    );
  },

  /**
   * Core deterministic analytics engine that executes over any set of records (Supabase or Local).
   */
  computeAnalyticsFromLists(
    businessId: string,
    businessName: string,
    currency: string,
    timezone: string,
    window: DateRangeWindow,
    salesList: Sale[],
    itemsList: SaleItem[],
    productsList: Product[],
    expensesList: Expense[],
    customersList: Customer[],
    paymentsList: Payment[]
  ): CompleteBusinessAnalytics {
    const startMs = new Date(window.startDate).getTime();
    const endMs = new Date(window.endDate).getTime();
    const priorStartMs = new Date(window.priorStartDate).getTime();
    const priorEndMs = new Date(window.priorEndDate).getTime();

    // 1. Filter completed sales for current window
    const completedSales = salesList.filter((s) => s.sale_status === 'completed');
    const currentSales = completedSales.filter((s) => {
      const t = new Date(s.sold_at).getTime();
      return t >= startMs && t <= endMs;
    });

    const priorSales = completedSales.filter((s) => {
      const t = new Date(s.sold_at).getTime();
      return t >= priorStartMs && t <= priorEndMs;
    });

    // 2. Revenue and Units
    const revenue = currentSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const priorRevenue = priorSales.reduce((acc, s) => acc + Number(s.total || 0), 0);

    const currentSaleIds = new Set(currentSales.map((s) => s.id));
    const priorSaleIds = new Set(priorSales.map((s) => s.id));

    const currentItems = itemsList.filter((i) => currentSaleIds.has(i.sale_id));
    const priorItems = itemsList.filter((i) => priorSaleIds.has(i.sale_id));

    const unitsSold = currentItems.reduce((acc, i) => acc + Number(i.quantity || 0), 0);

    // 3. COGS from historical snapshot
    const cogs = currentItems.reduce(
      (acc, i) => acc + (Number(i.unit_cost) || 0) * (Number(i.quantity) || 0),
      0
    );
    const priorCogs = priorItems.reduce(
      (acc, i) => acc + (Number(i.unit_cost) || 0) * (Number(i.quantity) || 0),
      0
    );

    const grossProfit = revenue - cogs;
    const priorGrossProfit = priorRevenue - priorCogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // 4. Expenses in window
    const startDateStr = window.startDate.split('T')[0];
    const endDateStr = window.endDate.split('T')[0];
    const priorStartDateStr = window.priorStartDate.split('T')[0];
    const priorEndDateStr = window.priorEndDate.split('T')[0];

    const currentExpenses = expensesList.filter(
      (e) => e.expense_date >= startDateStr && e.expense_date <= endDateStr
    );
    const priorExpensesList = expensesList.filter(
      (e) => e.expense_date >= priorStartDateStr && e.expense_date <= priorEndDateStr
    );

    const totalExpenses = currentExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const priorExpenses = priorExpensesList.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    const estimatedNetProfit = grossProfit - totalExpenses;
    const priorNetProfit = priorGrossProfit - priorExpenses;
    const netMargin = revenue > 0 ? (estimatedNetProfit / revenue) * 100 : 0;

    const transactionCount = currentSales.length;
    const priorTransactionCount = priorSales.length;
    const averageOrderValue = transactionCount > 0 ? revenue / transactionCount : 0;
    const priorAOV = priorTransactionCount > 0 ? priorRevenue / priorTransactionCount : 0;

    // 5. Payments collected
    const currentPayments = paymentsList.filter((p) => {
      const t = new Date(p.paid_at).getTime();
      return t >= startMs && t <= endMs;
    });
    const priorPayments = paymentsList.filter((p) => {
      const t = new Date(p.paid_at).getTime();
      return t >= priorStartMs && t <= priorEndMs;
    });

    const amountCollected =
      currentPayments.length > 0
        ? currentPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
        : currentSales.reduce((acc, s) => acc + Number(s.amount_paid || 0), 0);

    const priorCollected =
      priorPayments.length > 0
        ? priorPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
        : priorSales.reduce((acc, s) => acc + Number(s.amount_paid || 0), 0);

    // 6. Outstanding Receivables
    const outstandingReceivables = completedSales.reduce(
      (acc, s) => acc + Number(s.amount_due || 0),
      0
    );

    // 7. Inventory
    const activeProducts = productsList.filter((p) => p.is_active);
    const inventoryValuation = activeProducts.reduce(
      (acc, p) => acc + Number(p.stock_quantity || 0) * Number(p.cost_price || 0),
      0
    );

    const lowStockCount = activeProducts.filter(
      (p) => p.stock_quantity > 0 && p.stock_quantity <= (p.minimum_stock_level || 5)
    ).length;

    const outOfStockCount = activeProducts.filter((p) => p.stock_quantity === 0).length;

    const financialOverview: FinancialOverviewMetrics = {
      revenue,
      costOfGoodsSold: cogs,
      grossProfit,
      grossMargin: Number(grossMargin.toFixed(2)),
      operatingExpenses: totalExpenses,
      estimatedNetProfit,
      netMargin: Number(netMargin.toFixed(2)),
      transactionCount,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      unitsSold,
      amountCollected,
      outstandingReceivables,
      inventoryValuation,
      lowStockCount,
      outOfStockCount,
    };

    // 8. Period Comparison Summary
    const comparison: PeriodComparisonSummary = {
      revenue: this.makeMetricComp(revenue, priorRevenue),
      grossProfit: this.makeMetricComp(grossProfit, priorGrossProfit),
      operatingExpenses: this.makeMetricComp(totalExpenses, priorExpenses),
      estimatedNetProfit: this.makeMetricComp(estimatedNetProfit, priorNetProfit),
      transactionCount: this.makeMetricComp(transactionCount, priorTransactionCount),
      averageOrderValue: this.makeMetricComp(averageOrderValue, priorAOV),
      amountCollected: this.makeMetricComp(amountCollected, priorCollected),
    };

    // 9. Time Series (Daily points)
    const timeSeries = this.generateLocalTimeSeries(
      currentSales,
      currentItems,
      currentExpenses,
      currentPayments,
      window
    );

    // 10. Product Performance
    const daysEvaluated = Math.max(1, (endMs - startMs) / (1000 * 60 * 60 * 24));
    const topProducts = this.calculateLocalProductPerformance(
      activeProducts,
      currentItems,
      currentSales,
      daysEvaluated
    );

    // 11. Customer Analytics
    const customerAnalytics = this.calculateLocalCustomerAnalytics(
      customersList,
      completedSales,
      currentSales,
      window
    );

    // 12. Expense Analytics
    const expenseAnalytics = this.calculateLocalExpenseAnalytics(
      currentExpenses,
      totalExpenses,
      revenue
    );

    // 13. Cash Flow
    const cashFlow: CashFlowMetrics = {
      cashInflows: amountCollected,
      cashOutflows: totalExpenses,
      netCashFlow: amountCollected - totalExpenses,
      accrualRevenue: revenue,
      outstandingCreditAdded: Math.max(0, revenue - amountCollected),
      paymentsByMethod: {},
      timeSeries: timeSeries.map((t) => ({
        date: t.date,
        cashIn: t.cashCollected,
        cashOut: t.expenses,
        netCash: t.cashCollected - t.expenses,
      })),
    };

    const lowStockItems = topProducts.filter(
      (p) => p.stockStatus === 'low_stock' || p.stockStatus === 'out_of_stock'
    );
    const slowMovingItems = topProducts.filter((p) => p.stockStatus === 'slow_moving');

    const inventorySummary = {
      totalValuation: inventoryValuation,
      totalActiveSKUs: activeProducts.length,
      lowStockCount,
      outOfStockCount,
      slowMovingCount: slowMovingItems.length,
      lowStockItems,
      slowMovingItems,
    };

    const healthIndicator = this.calculateHealthScore(financialOverview, comparison, inventorySummary);
    const anomalies = this.detectAnomalies(financialOverview, comparison, inventorySummary, topProducts);
    const dataSufficiency = this.assessDataSufficiency(transactionCount, window);

    return {
      businessId,
      businessName: businessName || 'Business',
      currency: currency || 'USD',
      timezone: timezone || 'UTC',
      window,
      financialOverview,
      comparison,
      timeSeries,
      topProducts,
      customerAnalytics,
      expenseAnalytics,
      cashFlow,
      inventorySummary,
      healthIndicator,
      anomalies,
      dataSufficiency,
    };
  },

  /**
   * Generates continuous daily time series data points.
   */
  generateLocalTimeSeries(
    sales: Sale[],
    items: SaleItem[],
    expenses: Expense[],
    payments: Payment[],
    window: DateRangeWindow
  ): TimeSeriesPoint[] {
    const points: Record<string, TimeSeriesPoint> = {};
    const cur = new Date(window.startDate);
    const end = new Date(window.endDate);

    // Initialize all days in window
    while (cur <= end) {
      const dateKey = cur.toISOString().split('T')[0];
      points[dateKey] = {
        date: dateKey,
        timestamp: cur.toISOString(),
        revenue: 0,
        costOfGoodsSold: 0,
        grossProfit: 0,
        expenses: 0,
        estimatedNetProfit: 0,
        cashCollected: 0,
        transactionCount: 0,
        unitsSold: 0,
      };
      cur.setDate(cur.getDate() + 1);
    }

    // Map sales & items
    const saleDateMap: Record<string, string> = {};
    for (const s of sales) {
      const d = s.sold_at.split('T')[0];
      saleDateMap[s.id] = d;
      if (points[d]) {
        points[d].revenue += Number(s.total || 0);
        points[d].transactionCount += 1;
        points[d].cashCollected += Number(s.amount_paid || 0);
      }
    }

    for (const i of items) {
      const d = saleDateMap[i.sale_id];
      if (d && points[d]) {
        points[d].costOfGoodsSold += (Number(i.unit_cost) || 0) * (Number(i.quantity) || 0);
        points[d].unitsSold += Number(i.quantity || 0);
      }
    }

    // Map expenses
    for (const e of expenses) {
      const d = e.expense_date;
      if (points[d]) {
        points[d].expenses += Number(e.amount || 0);
      }
    }

    // Calculate profits
    return Object.values(points).map((pt) => {
      pt.grossProfit = pt.revenue - pt.costOfGoodsSold;
      pt.estimatedNetProfit = pt.grossProfit - pt.expenses;
      return pt;
    });
  },

  /**
   * Calculates product sales velocity, profitability, and stock status.
   */
  calculateLocalProductPerformance(
    products: Product[],
    items: SaleItem[],
    sales: Sale[],
    daysEvaluated: number
  ): ProductPerformanceItem[] {
    const saleMap = new Map(sales.map((s) => [s.id, s]));

    const productMap = new Map<
      string,
      {
        unitsSold: number;
        revenue: number;
        cogs: number;
        txCount: number;
        lastSaleAt: string | null;
      }
    >();

    for (const i of items) {
      if (!i.product_id) continue;
      const s = saleMap.get(i.sale_id);
      const existing = productMap.get(i.product_id) || {
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        txCount: 0,
        lastSaleAt: null,
      };

      existing.unitsSold += Number(i.quantity || 0);
      existing.revenue += Number(i.total || 0);
      existing.cogs += (Number(i.unit_cost) || 0) * (Number(i.quantity) || 0);
      existing.txCount += 1;
      if (s?.sold_at && (!existing.lastSaleAt || s.sold_at > existing.lastSaleAt)) {
        existing.lastSaleAt = s.sold_at;
      }
      productMap.set(i.product_id, existing);
    }

    return products
      .map((p) => {
        const perf = productMap.get(p.id) || {
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          txCount: 0,
          lastSaleAt: null,
        };

        const grossProfit = perf.revenue - perf.cogs;
        const grossMargin = perf.revenue > 0 ? (grossProfit / perf.revenue) * 100 : 0;
        const velocity = Number((perf.unitsSold / daysEvaluated).toFixed(2));

        let stockStatus: 'out_of_stock' | 'low_stock' | 'healthy' | 'slow_moving' = 'healthy';
        if (p.stock_quantity === 0) stockStatus = 'out_of_stock';
        else if (p.stock_quantity <= (p.minimum_stock_level || 5)) stockStatus = 'low_stock';
        else if (perf.unitsSold === 0 && new Date(p.created_at).getTime() < Date.now() - 14 * 86400000) {
          stockStatus = 'slow_moving';
        }

        const daysRemaining = velocity > 0 ? Number((p.stock_quantity / velocity).toFixed(1)) : null;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          categoryName: null,
          currentStock: p.stock_quantity,
          costPrice: Number(p.cost_price),
          sellingPrice: Number(p.selling_price),
          minimumStockLevel: p.minimum_stock_level || 5,
          unitsSold: perf.unitsSold,
          revenue: perf.revenue,
          cogs: perf.cogs,
          grossProfit,
          grossMargin: Number(grossMargin.toFixed(2)),
          transactionCount: perf.txCount,
          lastSaleAt: perf.lastSaleAt,
          observedVelocityUnitsPerDay: velocity,
          stockStatus,
          daysOfInventoryRemaining: daysRemaining,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  },

  /**
   * Calculates customer segments, repeat rates, and receivables.
   */
  calculateLocalCustomerAnalytics(
    customers: Customer[],
    allCompletedSales: Sale[],
    currentSales: Sale[],
    window: DateRangeWindow
  ): CustomerSegmentMetrics {
    const startMs = new Date(window.startDate).getTime();
    const endMs = new Date(window.endDate).getTime();

    const activeCustomers = customers.filter((c) => c.is_active);
    const newInPeriod = customers.filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t >= startMs && t <= endMs;
    }).length;

    const activeInPeriodSet = new Set(
      currentSales.filter((s) => s.customer_id).map((s) => s.customer_id)
    );

    // Lifetime sales grouped by customer
    const lifetimeMap = new Map<
      string,
      {
        totalSpent: number;
        orderCount: number;
        outstandingDebt: number;
        lastPurchaseAt: string | null;
      }
    >();

    for (const s of allCompletedSales) {
      if (!s.customer_id) continue;
      const cur = lifetimeMap.get(s.customer_id) || {
        totalSpent: 0,
        orderCount: 0,
        outstandingDebt: 0,
        lastPurchaseAt: null,
      };
      cur.totalSpent += Number(s.total || 0);
      cur.orderCount += 1;
      cur.outstandingDebt += Number(s.amount_due || 0);
      if (!cur.lastPurchaseAt || s.sold_at > cur.lastPurchaseAt) {
        cur.lastPurchaseAt = s.sold_at;
      }
      lifetimeMap.set(s.customer_id, cur);
    }

    let repeatCustomers = 0;
    let debtorCustomers = 0;
    let totalDebt = 0;
    let inactiveCustomers = 0;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;

    for (const c of activeCustomers) {
      const stats = lifetimeMap.get(c.id);
      if (stats) {
        if (stats.orderCount > 1) repeatCustomers += 1;
        if (stats.outstandingDebt > 0) {
          debtorCustomers += 1;
          totalDebt += stats.outstandingDebt;
        }
        if (!stats.lastPurchaseAt || new Date(stats.lastPurchaseAt).getTime() < thirtyDaysAgo) {
          inactiveCustomers += 1;
        }
      } else {
        inactiveCustomers += 1;
      }
    }

    // Period sales grouped by customer for top ranking
    const periodMap = new Map<string, { revenue: number; orderCount: number }>();
    for (const s of currentSales) {
      if (!s.customer_id) continue;
      const cur = periodMap.get(s.customer_id) || { revenue: 0, orderCount: 0 };
      cur.revenue += Number(s.total || 0);
      cur.orderCount += 1;
      periodMap.set(s.customer_id, cur);
    }

    const topCustomers = activeCustomers
      .filter((c) => periodMap.has(c.id))
      .map((c) => {
        const pStats = periodMap.get(c.id)!;
        const lStats = lifetimeMap.get(c.id) || {
          totalSpent: 0,
          outstandingDebt: 0,
          lastPurchaseAt: null,
        };
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          revenueInPeriod: pStats.revenue,
          completedOrdersInPeriod: pStats.orderCount,
          lifetimeSpent: lStats.totalSpent,
          outstandingBalance: lStats.outstandingDebt,
          lastPurchaseAt: lStats.lastPurchaseAt,
        };
      })
      .sort((a, b) => b.revenueInPeriod - a.revenueInPeriod)
      .slice(0, 10);

    return {
      totalCustomers: activeCustomers.length,
      activeInPeriod: activeInPeriodSet.size,
      newCustomersInPeriod: newInPeriod,
      repeatCustomers,
      highValueCustomers: Math.max(1, Math.round(activeCustomers.length * 0.1)),
      inactiveCustomers,
      debtorCustomers,
      totalOutstandingDebt: totalDebt,
      topCustomersByRevenue: topCustomers,
    };
  },

  /**
   * Calculates expense categories, ratios, and distributions.
   */
  calculateLocalExpenseAnalytics(
    expenses: Expense[],
    totalExpenses: number,
    revenue: number
  ) {
    const categoryMap = new Map<string, { amount: number; count: number }>();

    for (const e of expenses) {
      const cat = e.category || 'Other Operational Expense';
      const cur = categoryMap.get(cat) || { amount: 0, count: 0 };
      cur.amount += Number(e.amount || 0);
      cur.count += 1;
      categoryMap.set(cat, cur);
    }

    const categories: ExpenseCategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        amount: stats.amount,
        count: stats.count,
        percentageOfTotalExpenses:
          totalExpenses > 0 ? Number(((stats.amount / totalExpenses) * 100).toFixed(2)) : 0,
        percentageOfRevenue:
          revenue > 0 ? Number(((stats.amount / revenue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const recentExpenses = expenses
      .slice()
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: (e as any).title || e.description || 'Expense',
        category: e.category,
        amount: Number(e.amount),
        expense_date: e.expense_date,
        payment_method: e.payment_method,
      }));

    return {
      totalExpenses,
      expenseToRevenueRatio: revenue > 0 ? Number(((totalExpenses / revenue) * 100).toFixed(2)) : 0,
      categories,
      recentExpenses,
    };
  },

  /**
   * Produces an explainable, weighted Business Health Indicator (0 to 100).
   */
  calculateHealthScore(
    overview: FinancialOverviewMetrics,
    comp: PeriodComparisonSummary,
    inv: { totalActiveSKUs: number; lowStockCount: number; outOfStockCount: number }
  ): BusinessHealthIndicator {
    // 1. Margin Pillar (30% weight)
    let marginScore = 50;
    let marginStatus: 'healthy' | 'moderate' | 'warning' = 'moderate';
    if (overview.grossMargin >= 40) {
      marginScore = 100;
      marginStatus = 'healthy';
    } else if (overview.grossMargin >= 25) {
      marginScore = 80;
      marginStatus = 'healthy';
    } else if (overview.grossMargin >= 15) {
      marginScore = 55;
      marginStatus = 'moderate';
    } else {
      marginScore = 25;
      marginStatus = 'warning';
    }

    // 2. Profitability Pillar (25% weight)
    let profitScore = 50;
    let profitStatus: 'healthy' | 'moderate' | 'warning' = 'moderate';
    if (overview.estimatedNetProfit > 0 && overview.netMargin >= 15) {
      profitScore = 100;
      profitStatus = 'healthy';
    } else if (overview.estimatedNetProfit > 0) {
      profitScore = 75;
      profitStatus = 'healthy';
    } else if (overview.estimatedNetProfit === 0 && overview.revenue === 0) {
      profitScore = 50;
      profitStatus = 'moderate';
    } else {
      profitScore = 20;
      profitStatus = 'warning';
    }

    // 3. Receivables & Cash Flow Pillar (20% weight)
    let cashScore = 80;
    let cashStatus: 'healthy' | 'moderate' | 'warning' = 'healthy';
    const debtRatio = overview.revenue > 0 ? (overview.outstandingReceivables / overview.revenue) * 100 : 0;
    if (debtRatio <= 10) {
      cashScore = 100;
      cashStatus = 'healthy';
    } else if (debtRatio <= 25) {
      cashScore = 75;
      cashStatus = 'moderate';
    } else {
      cashScore = 35;
      cashStatus = 'warning';
    }

    // 4. Inventory Health Pillar (15% weight)
    let invScore = 80;
    let invStatus: 'healthy' | 'moderate' | 'warning' = 'healthy';
    const stockRiskCount = inv.lowStockCount + inv.outOfStockCount;
    const stockRiskRatio = inv.totalActiveSKUs > 0 ? (stockRiskCount / inv.totalActiveSKUs) * 100 : 0;
    if (stockRiskRatio <= 5) {
      invScore = 100;
      invStatus = 'healthy';
    } else if (stockRiskRatio <= 20) {
      invScore = 70;
      invStatus = 'moderate';
    } else {
      invScore = 30;
      invStatus = 'warning';
    }

    // 5. Growth & Revenue Momentum (10% weight)
    let growthScore = 60;
    let growthStatus: 'healthy' | 'moderate' | 'warning' = 'moderate';
    if (comp.revenue.percentageChange !== null) {
      if (comp.revenue.percentageChange >= 10) {
        growthScore = 100;
        growthStatus = 'healthy';
      } else if (comp.revenue.percentageChange >= -5) {
        growthScore = 75;
        growthStatus = 'healthy';
      } else if (comp.revenue.percentageChange >= -20) {
        growthScore = 50;
        growthStatus = 'moderate';
      } else {
        growthScore = 25;
        growthStatus = 'warning';
      }
    }

    const compositeScore = Math.round(
      marginScore * 0.3 +
        profitScore * 0.25 +
        cashScore * 0.2 +
        invScore * 0.15 +
        growthScore * 0.1
    );

    let rating: BusinessHealthIndicator['rating'] = 'Good';
    if (compositeScore >= 85) rating = 'Excellent';
    else if (compositeScore >= 70) rating = 'Good';
    else if (compositeScore >= 55) rating = 'Fair';
    else if (compositeScore >= 40) rating = 'Needs Attention';
    else rating = 'Critical';

    return {
      score: compositeScore,
      rating,
      methodology:
        'Weighted financial index combining Gross Margin (30%), Net Profitability (25%), Receivables Risk (20%), Inventory Stock Health (15%), and Period Momentum (10%).',
      drivers: [
        {
          name: 'Gross Margin Strength',
          weight: 30,
          score: marginScore,
          status: marginStatus,
          detail: `Current gross margin is ${overview.grossMargin.toFixed(1)}% of revenue.`,
        },
        {
          name: 'Net Profitability',
          weight: 25,
          score: profitScore,
          status: profitStatus,
          detail:
            overview.estimatedNetProfit >= 0
              ? `Positive net profit after operating expenses (${overview.netMargin.toFixed(1)}% net margin).`
              : `Operating at a net loss in this period. Review expenses and pricing.`,
        },
        {
          name: 'Receivables & Debt Risk',
          weight: 20,
          score: cashScore,
          status: cashStatus,
          detail:
            debtRatio <= 15
              ? `Low uncollected debt (${debtRatio.toFixed(1)}% of period revenue).`
              : `Outstanding customer receivables represent ${debtRatio.toFixed(1)}% of period revenue.`,
        },
        {
          name: 'Inventory Health',
          weight: 15,
          score: invScore,
          status: invStatus,
          detail:
            stockRiskCount === 0
              ? `All ${inv.totalActiveSKUs} active product SKUs are adequately stocked.`
              : `${stockRiskCount} product(s) currently low or out of stock.`,
        },
        {
          name: 'Period Revenue Momentum',
          weight: 10,
          score: growthScore,
          status: growthStatus,
          detail:
            comp.revenue.percentageChange !== null
              ? `${comp.revenue.percentageChange >= 0 ? '+' : ''}${comp.revenue.percentageChange.toFixed(1)}% revenue change vs prior period.`
              : 'Initial period comparison baseline.',
        },
      ],
    };
  },

  /**
   * Deterministic rule-based anomaly detection.
   */
  detectAnomalies(
    overview: FinancialOverviewMetrics,
    comp: PeriodComparisonSummary,
    inv: { lowStockCount: number; outOfStockCount: number },
    products: ProductPerformanceItem[]
  ): BusinessAnomalyAlert[] {
    const alerts: BusinessAnomalyAlert[] = [];
    const nowIso = new Date().toISOString();

    // 1. Revenue drop anomaly
    if (comp.revenue.percentageChange !== null && comp.revenue.percentageChange <= -25) {
      alerts.push({
        id: 'anomaly-rev-drop',
        type: 'warning',
        category: 'sales',
        title: 'Significant Revenue Contraction',
        description: `Revenue contracted by ${Math.abs(comp.revenue.percentageChange).toFixed(1)}% compared to the prior period (${comp.revenue.prior} down to ${comp.revenue.current}).`,
        metricValue: `${comp.revenue.percentageChange.toFixed(1)}%`,
        detectedAt: nowIso,
        recommendationNote: 'Review top product sales velocity and recent customer purchasing activity.',
      });
    }

    // 2. High Expense-to-Revenue anomaly
    if (overview.revenue > 0 && overview.operatingExpenses > overview.revenue * 0.7) {
      const ratio = ((overview.operatingExpenses / overview.revenue) * 100).toFixed(1);
      alerts.push({
        id: 'anomaly-high-expense',
        type: 'critical',
        category: 'expenses',
        title: 'Elevated Expense Ratio',
        description: `Operating expenses represent ${ratio}% of period revenue, compressing operational net margin.`,
        metricValue: `${ratio}% of Rev`,
        detectedAt: nowIso,
        recommendationNote: 'Inspect top expense categories to identify variable cost reductions.',
      });
    }

    // 3. Receivables exposure anomaly
    if (overview.revenue > 0 && overview.outstandingReceivables > overview.revenue * 0.3) {
      alerts.push({
        id: 'anomaly-high-receivables',
        type: 'warning',
        category: 'receivables',
        title: 'High Receivables Concentration',
        description: `Unpaid customer balances represent over 30% of total revenue. Cash flow may lag revenue.`,
        metricValue: `Debt: ${overview.outstandingReceivables}`,
        detectedAt: nowIso,
        recommendationNote: 'Use the Debtors summary in Customer Intelligence to follow up on overdue payments.',
      });
    }

    // 4. Critical Stockout anomaly
    if (inv.outOfStockCount > 0 || inv.lowStockCount >= 3) {
      alerts.push({
        id: 'anomaly-stock-risk',
        type: 'warning',
        category: 'inventory',
        title: 'Inventory Stock Level Alert',
        description: `${inv.outOfStockCount} product(s) are fully stockout and ${inv.lowStockCount} are below minimum threshold.`,
        metricValue: `${inv.outOfStockCount + inv.lowStockCount} SKUs At Risk`,
        detectedAt: nowIso,
        recommendationNote: 'Initiate stock replenishment or purchase orders to avoid lost sales.',
      });
    }

    // 5. High seller concentration
    if (products.length > 1 && overview.revenue > 0) {
      const topProd = products[0];
      if (topProd.revenue > overview.revenue * 0.6) {
        const topRatio = ((topProd.revenue / overview.revenue) * 100).toFixed(1);
        alerts.push({
          id: 'anomaly-prod-concentration',
          type: 'info',
          category: 'sales',
          title: 'High Product Revenue Concentration',
          description: `"${topProd.name}" generated ${topRatio}% of total period revenue.`,
          metricValue: `${topRatio}% single-product share`,
          detectedAt: nowIso,
          recommendationNote: 'Diversify marketing and product availability across other catalog categories.',
        });
      }
    }

    return alerts;
  },

  /**
   * Assesses data sufficiency to distinguish mature vs preliminary trends.
   */
  assessDataSufficiency(txCount: number, window: DateRangeWindow): DataSufficiencyInfo {
    const days = Math.max(
      1,
      Math.round(
        (new Date(window.endDate).getTime() - new Date(window.startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    if (txCount >= 15) {
      return {
        confidence: 'high_confidence',
        transactionCount: txCount,
        daysEvaluated: days,
        description: `High statistical confidence based on ${txCount} completed transactions across ${days} days.`,
      };
    } else if (txCount >= 5) {
      return {
        confidence: 'moderate_confidence',
        transactionCount: txCount,
        daysEvaluated: days,
        description: `Moderate sample size (${txCount} transactions). Trend observations are indicative.`,
      };
    } else {
      return {
        confidence: 'insufficient_data',
        transactionCount: txCount,
        daysEvaluated: days,
        description: `Insufficient transaction history (${txCount} transactions recorded in this period). At least 5 transactions are recommended for reliable trend analysis.`,
      };
    }
  },

  /**
   * Builds factual structured JSON context for Gemini in Phase 4 (zero LLM calls in Phase 3).
   */
  async getAIBusinessContext(
    businessId: string,
    timeHorizonDays = 30
  ): Promise<AIBusinessContextPayload> {
    const analytics = await this.getCompleteAnalytics(
      businessId,
      timeHorizonDays <= 7 ? 'last_7_days' : timeHorizonDays <= 30 ? 'last_30_days' : 'this_month'
    );

    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      business: {
        id: analytics.businessId,
        name: analytics.businessName,
        type: 'Retail',
        currency: analytics.currency,
        timezone: analytics.timezone,
      },
      period: {
        label: analytics.window.label,
        startDate: analytics.window.startDate,
        endDate: analytics.window.endDate,
        daysCount: timeHorizonDays,
      },
      financialSummary: {
        revenue: analytics.financialOverview.revenue,
        costOfGoodsSold: analytics.financialOverview.costOfGoodsSold,
        grossProfit: analytics.financialOverview.grossProfit,
        grossMarginPct: analytics.financialOverview.grossMargin,
        operatingExpenses: analytics.financialOverview.operatingExpenses,
        estimatedNetProfit: analytics.financialOverview.estimatedNetProfit,
        netMarginPct: analytics.financialOverview.netMargin,
        cashCollected: analytics.financialOverview.amountCollected,
        netCashMovement: analytics.cashFlow.netCashFlow,
        outstandingReceivables: analytics.financialOverview.outstandingReceivables,
        transactionCount: analytics.financialOverview.transactionCount,
        averageOrderValue: analytics.financialOverview.averageOrderValue,
      },
      periodComparison: {
        priorPeriodLabel: analytics.window.priorLabel,
        revenuePctChange: analytics.comparison.revenue.percentageChange,
        grossProfitPctChange: analytics.comparison.grossProfit.percentageChange,
        expensesPctChange: analytics.comparison.operatingExpenses.percentageChange,
        netProfitPctChange: analytics.comparison.estimatedNetProfit.percentageChange,
        transactionsPctChange: analytics.comparison.transactionCount.percentageChange,
      },
      inventoryFacts: {
        totalValuation: analytics.inventorySummary.totalValuation,
        activeProductsCount: analytics.inventorySummary.totalActiveSKUs,
        lowStockCount: analytics.inventorySummary.lowStockCount,
        outOfStockCount: analytics.inventorySummary.outOfStockCount,
        criticalLowStockItems: analytics.inventorySummary.lowStockItems.map((p) => ({
          name: p.name,
          stockQuantity: p.currentStock,
          minStockLevel: p.minimumStockLevel,
        })),
        slowMovingItems: analytics.inventorySummary.slowMovingItems.map((p) => ({
          name: p.name,
          stockQuantity: p.currentStock,
          daysSinceLastSale: null,
        })),
      },
      topProductsByRevenue: analytics.topProducts.slice(0, 5).map((p) => ({
        name: p.name,
        revenue: p.revenue,
        unitsSold: p.unitsSold,
        grossProfit: p.grossProfit,
        grossMarginPct: p.grossMargin,
        salesVelocityPerDay: p.observedVelocityUnitsPerDay,
      })),
      customerFacts: {
        totalRegistered: analytics.customerAnalytics.totalCustomers,
        activeInPeriod: analytics.customerAnalytics.activeInPeriod,
        newInPeriod: analytics.customerAnalytics.newCustomersInPeriod,
        repeatCustomersCount: analytics.customerAnalytics.repeatCustomers,
        customersWithDebtCount: analytics.customerAnalytics.debtorCustomers,
        totalReceivables: analytics.customerAnalytics.totalOutstandingDebt,
      },
      expenseFacts: {
        total: analytics.expenseAnalytics.totalExpenses,
        percentageOfRevenue: analytics.expenseAnalytics.expenseToRevenueRatio,
        topCategories: analytics.expenseAnalytics.categories.map((c) => ({
          category: c.category,
          amount: c.amount,
          percentage: c.percentageOfTotalExpenses,
        })),
      },
      detectedAnomalies: analytics.anomalies.map((a) => ({
        type: a.type,
        category: a.category,
        title: a.title,
        description: a.description,
      })),
      businessHealth: {
        score: analytics.healthIndicator.score,
        rating: analytics.healthIndicator.rating,
        primaryDrivers: analytics.healthIndicator.drivers.map((d) => `${d.name}: ${d.detail}`),
      },
      dataSufficiency: {
        confidence: analytics.dataSufficiency.confidence,
        note: analytics.dataSufficiency.description,
      },
    };
  },

  makeMetricComp(current: number, prior: number) {
    const absChange = current - prior;
    const pctChange = prior > 0 ? Number(((absChange / prior) * 100).toFixed(2)) : null;
    let trend: 'positive' | 'negative' | 'neutral' | 'no_data' = 'neutral';
    if (current > prior) trend = 'positive';
    else if (current < prior) trend = 'negative';
    else if (prior === 0 && current === 0) trend = 'no_data';

    return {
      current,
      prior,
      absoluteChange: absChange,
      percentageChange: pctChange,
      trend,
    };
  },

  formatComparison(compRpc: any, fallbackOverview: FinancialOverviewMetrics): PeriodComparisonSummary {
    return {
      revenue: compRpc.revenue || this.makeMetricComp(fallbackOverview.revenue, 0),
      grossProfit: compRpc.gross_profit || this.makeMetricComp(fallbackOverview.grossProfit, 0),
      operatingExpenses:
        compRpc.operating_expenses || this.makeMetricComp(fallbackOverview.operatingExpenses, 0),
      estimatedNetProfit:
        compRpc.estimated_net_profit || this.makeMetricComp(fallbackOverview.estimatedNetProfit, 0),
      transactionCount:
        compRpc.transaction_count || this.makeMetricComp(fallbackOverview.transactionCount, 0),
      averageOrderValue:
        compRpc.average_order_value || this.makeMetricComp(fallbackOverview.averageOrderValue, 0),
      amountCollected:
        compRpc.amount_collected || this.makeMetricComp(fallbackOverview.amountCollected, 0),
    };
  },
};
