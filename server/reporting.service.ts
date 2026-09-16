import { BusinessToolsService, serverSupabase } from './business-tools.service.ts';

export interface ReportFilterOptions {
  period: 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year' | 'custom';
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  paymentMethod?: string;
}

export interface BusinessReportData {
  reportType: 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow' | 'performance';
  businessId: string;
  generatedAt: string;
  periodLabel: string;
  currency: string;
  summaryMetrics: Record<string, number | string>;
  breakdownRows: Array<Record<string, any>>;
}

export class ReportingService {
  /**
   * Resolve date boundaries for the given period
   */
  static resolveDateRange(opts: ReportFilterOptions): { startDate: Date; endDate: Date; periodLabel: string; daysCount: number } {
    const now = new Date();
    const endDate = opts.endDate ? new Date(opts.endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let startDate = new Date();
    let periodLabel = 'Last 30 Days';

    switch (opts.period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        periodLabel = 'Today';
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 86400000);
        periodLabel = 'Past 7 Days';
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = 'This Month';
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodLabel = 'Last Month';
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        periodLabel = 'This Year';
        break;
      case 'custom':
        startDate = opts.startDate ? new Date(opts.startDate) : new Date(Date.now() - 30 * 86400000);
        periodLabel = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
        break;
      case '30d':
      default:
        startDate = new Date(Date.now() - 30 * 86400000);
        periodLabel = 'Past 30 Days';
        break;
    }

    const daysCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    return { startDate, endDate, periodLabel, daysCount };
  }

  /**
   * Generate comprehensive Sales Report
   */
  static async generateSalesReport(businessId: string, opts: ReportFilterOptions): Promise<BusinessReportData> {
    const { startDate, endDate, periodLabel, daysCount } = this.resolveDateRange(opts);
    const overview = await BusinessToolsService.getBusinessOverview(businessId, daysCount);
    const salesSummary = await BusinessToolsService.getSalesSummary(businessId, daysCount);

    const { data: sales } = await serverSupabase
      .from('sales')
      .select('id, receipt_number, total, subtotal, discount, amount_paid, payment_status, payment_method, sold_at')
      .eq('business_id', businessId)
      .gte('sold_at', startDate.toISOString())
      .lte('sold_at', endDate.toISOString())
      .order('sold_at', { ascending: false });

    return {
      reportType: 'sales',
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel,
      currency: 'USD',
      summaryMetrics: {
        totalRevenue: overview.revenue,
        transactionCount: overview.transactionCount,
        averageOrderValue: overview.averageOrderValue,
        totalCashCollected: overview.totalCashCollected,
        outstandingDebt: overview.totalReceivablesOutstanding,
      },
      breakdownRows: sales || [],
    };
  }

  /**
   * Generate Profitability Report
   */
  static async generateProfitabilityReport(businessId: string, opts: ReportFilterOptions): Promise<BusinessReportData> {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const overview = await BusinessToolsService.getBusinessOverview(businessId, daysCount);
    const expenses = await BusinessToolsService.getExpenseSummary(businessId, daysCount);
    const products = await BusinessToolsService.getProductPerformance(businessId, 20);

    return {
      reportType: 'profitability',
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel,
      currency: 'USD',
      summaryMetrics: {
        grossRevenue: overview.revenue,
        costOfGoodsSold: overview.cogs,
        grossProfit: overview.grossProfit,
        grossMarginPercent: overview.grossMarginPercent,
        operatingExpenses: expenses.totalExpenses,
        netProfit: overview.netProfit,
        netMarginPercent: overview.netMarginPercent,
      },
      breakdownRows: (products as any[]).map((p) => ({
        productName: p.name,
        sellingPrice: p.sellingPrice,
        costPrice: p.costPrice,
        unitMargin: p.unitMargin,
        marginPercent: p.marginPct,
        stockQuantity: p.stockQuantity,
      })),
    };
  }

  /**
   * Generate Inventory Valuation & Health Report
   */
  static async generateInventoryReport(businessId: string): Promise<BusinessReportData> {
    const inv = await BusinessToolsService.getInventoryAlerts(businessId);
    const { data: products } = await serverSupabase
      .from('products')
      .select('name, sku, selling_price, cost_price, stock_quantity, minimum_stock_level, is_active')
      .eq('business_id', businessId)
      .order('name');

    const totalValuationCost = (products || []).reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0);
    const totalValuationRetail = (products || []).reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.selling_price || 0)), 0);

    return {
      reportType: 'inventory',
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel: 'Current Stock Position',
      currency: 'USD',
      summaryMetrics: {
        totalSKUs: inv.totalActiveSKUs,
        totalValuationCost: inv.totalInventoryValuation || totalValuationCost,
        totalValuationRetail,
        potentialGrossProfit: totalValuationRetail - totalValuationCost,
        outOfStockCount: inv.outOfStockCount,
        lowStockCount: inv.lowStockCount,
      },
      breakdownRows: (products || []).map((p) => ({
        name: p.name,
        sku: p.sku || 'N/A',
        currentStock: p.stock_quantity,
        minStock: p.minimum_stock_level,
        costPrice: p.cost_price,
        sellingPrice: p.selling_price,
        stockValuation: (p.stock_quantity || 0) * (p.cost_price || 0),
        status: p.stock_quantity === 0 ? 'OUT_OF_STOCK' : (p.stock_quantity || 0) <= (p.minimum_stock_level || 5) ? 'LOW_STOCK' : 'HEALTHY',
      })),
    };
  }

  /**
   * Generate Expense Breakdown Report
   */
  static async generateExpenseReport(businessId: string, opts: ReportFilterOptions): Promise<BusinessReportData> {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const expenseData = await BusinessToolsService.getExpenseSummary(businessId, daysCount);

    const topCategory = expenseData.expensesByCategory[0];

    return {
      reportType: 'expenses',
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel,
      currency: 'USD',
      summaryMetrics: {
        totalExpenses: expenseData.totalExpenses,
        expenseCount: expenseData.expenseCount,
        topCategory: topCategory?.category || 'None',
        topCategoryAmount: topCategory?.amount || 0,
      },
      breakdownRows: expenseData.expensesByCategory.map((c) => ({
        category: c.category,
        totalAmount: c.amount,
        percentOfTotal: c.percentage,
      })),
    };
  }

  /**
   * Generate Customer Receivables & Debt Aging Report
   */
  static async generateReceivablesReport(businessId: string): Promise<BusinessReportData> {
    const debtors = await BusinessToolsService.getCustomerBalances(businessId);

    return {
      reportType: 'receivables',
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel: 'Active Outstanding Debtors',
      currency: 'USD',
      summaryMetrics: {
        totalReceivables: debtors.totalOutstandingDebt,
        activeDebtorsCount: debtors.debtorsCount,
        totalCustomers: debtors.debtorsCount,
      },
      breakdownRows: debtors.topDebtors.map((d) => ({
        customerName: d.name,
        phone: d.phone || 'N/A',
        balance: d.debtAmount,
        totalSpent: d.debtAmount,
      })),
    };
  }

  /**
   * Generate Cash Flow Statement Report
   */
  static async generateCashFlowReport(businessId: string, opts: ReportFilterOptions): Promise<BusinessReportData> {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const cashFlow = await BusinessToolsService.getCashFlow(businessId, daysCount);

    return {
      reportType: 'cash_flow',
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel,
      currency: 'USD',
      summaryMetrics: {
        totalCashIn: cashFlow.cashInflows,
        totalCashOut: cashFlow.cashOutflows,
        netCashVariance: cashFlow.netCashFlow,
        healthRating: cashFlow.netCashFlow >= 0 ? 'POSITIVE' : 'NEGATIVE',
      },
      breakdownRows: [
        {
          period: periodLabel,
          inflow: cashFlow.cashInflows,
          outflow: cashFlow.cashOutflows,
          net: cashFlow.netCashFlow,
          status: cashFlow.netCashFlow >= 0 ? 'SURPLUS' : 'DEFICIT',
        },
      ],
    };
  }

  /**
   * Generate Tax & Statutory Compliance Estimation Report
   */
  static async generateTaxReport(businessId: string, opts: ReportFilterOptions): Promise<BusinessReportData> {
    const { daysCount, periodLabel } = this.resolveDateRange(opts);
    const overview = await BusinessToolsService.getBusinessOverview(businessId, daysCount);
    const expenses = await BusinessToolsService.getExpenseSummary(businessId, daysCount);

    const revenue = Number(overview.revenue || 0);
    const totalExpenses = Number(expenses.totalExpenses || 0);
    const cogs = Number(overview.cost_of_goods_sold || 0);
    const taxableIncome = Math.max(0, revenue - totalExpenses - cogs);
    const estimatedSalesTax = Math.round(revenue * 0.05 * 100) / 100;
    const estimatedIncomeTax = Math.round(taxableIncome * 0.15 * 100) / 100;
    const totalTaxLiability = Math.round((estimatedSalesTax + estimatedIncomeTax) * 100) / 100;

    let currency = 'USD';
    try {
      const { data: b } = await serverSupabase
        .from('businesses')
        .select('currency')
        .eq('id', businessId)
        .single();
      if (b?.currency) currency = b.currency;
    } catch {}

    return {
      reportType: 'tax' as any,
      businessId,
      generatedAt: new Date().toISOString(),
      periodLabel,
      currency,
      summaryMetrics: {
        taxableGrossRevenue: revenue,
        allowableDeductions: totalExpenses + cogs,
        netTaxableIncome: taxableIncome,
        estimatedSalesTax,
        estimatedCorporateTax: estimatedIncomeTax,
        totalEstimatedTaxLiability: totalTaxLiability,
      },
      breakdownRows: [
        {
          taxCategory: 'Sales & Indirect Tax (Est. 5%)',
          applicableBase: revenue,
          rateApplied: '5.0%',
          estimatedTax: estimatedSalesTax,
          status: 'ACCRUING',
        },
        {
          taxCategory: 'Corporate Income Tax (Est. 15%)',
          applicableBase: taxableIncome,
          rateApplied: '15.0%',
          estimatedTax: estimatedIncomeTax,
          status: taxableIncome > 0 ? 'LIABLE' : 'NIL',
        },
        {
          taxCategory: 'Cost of Goods Sold (COGS)',
          applicableBase: cogs,
          rateApplied: '100.0%',
          estimatedTax: -cogs,
          status: 'DEDUCTIBLE',
        },
        {
          taxCategory: 'Operating Expense Deductions',
          applicableBase: totalExpenses,
          rateApplied: '100.0%',
          estimatedTax: -totalExpenses,
          status: 'SHIELDED',
        },
      ],
    };
  }
}
