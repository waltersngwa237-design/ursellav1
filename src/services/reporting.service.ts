import type { BusinessReportData, DateRangePreset } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { AnalyticsService } from './analytics.service.ts';

export class ClientReportingService {
  static async fetchReport(
    businessId: string,
    type: 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow' | 'tax',
    options?: {
      period?: 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year' | 'custom';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<BusinessReportData> {
    const params = new URLSearchParams({
      businessId,
      period: options?.period || '30d',
    });

    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    // 1. Attempt server-side generation with authentication
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isSupabaseConfigured) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
          }
        } catch {
          // Continue without session if token retrieval fails
        }
      }

      const res = await fetch(`/api/reports/${type}?${params.toString()}`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (networkErr) {
      console.warn(`[ClientReportingService] Server report endpoint unavailable, generating via client analytics:`, networkErr);
    }

    // 2. Client-side Fallback Report Generator (for offline, Vercel SPA, or serverless resilience)
    return await this.generateClientFallbackReport(businessId, type, options);
  }

  /**
   * Deterministic client-side generator matching GAAP standard formulas.
   */
  private static async generateClientFallbackReport(
    businessId: string,
    type: 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow' | 'tax',
    options?: {
      period?: 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year' | 'custom';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<BusinessReportData> {
    const presetMap: Record<string, DateRangePreset> = {
      today: 'today',
      '7d': 'last_7_days',
      '30d': 'last_30_days',
      this_month: 'this_month',
      last_month: 'last_month',
      this_year: 'this_year',
      custom: 'custom',
    };

    const preset = presetMap[options?.period || '30d'] || 'last_30_days';
    const analytics = await AnalyticsService.getCompleteAnalytics(
      businessId,
      preset,
      options?.startDate,
      options?.endDate
    );

    const periodLabels: Record<string, string> = {
      today: 'Today',
      '7d': 'Past 7 Days',
      '30d': 'Past 30 Days',
      this_month: 'This Month',
      last_month: 'Last Month',
      this_year: 'This Year',
      custom: 'Custom Range',
    };
    const periodLabel = periodLabels[options?.period || '30d'] || 'Past 30 Days';

    switch (type) {
      case 'sales': {
        // Fetch recent sales rows if Supabase available
        let salesRows: any[] = [];
        if (isSupabaseConfigured) {
          try {
            const { data } = await supabase
              .from('sales')
              .select('id, receipt_number, total, subtotal, discount, amount_paid, payment_status, payment_method, sold_at')
              .eq('business_id', businessId)
              .order('sold_at', { ascending: false })
              .limit(50);
            if (data) salesRows = data;
          } catch {
            salesRows = [];
          }
        }

        if (salesRows.length === 0 && analytics.timeSeries.length > 0) {
          salesRows = analytics.timeSeries.map((ts) => ({
            date: ts.date,
            revenue: ts.revenue,
            transactions: ts.transactionCount,
            profit: ts.grossProfit,
          }));
        }

        return {
          reportType: 'sales',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency: 'USD',
          summaryMetrics: {
            totalRevenue: analytics.financialOverview.revenue,
            transactionCount: analytics.financialOverview.transactionCount,
            averageOrderValue: analytics.financialOverview.averageOrderValue,
            totalCashCollected: analytics.financialOverview.amountCollected,
            outstandingDebt: analytics.financialOverview.outstandingReceivables,
          },
          breakdownRows: salesRows,
        };
      }

      case 'profitability': {
        const prodRows = analytics.topProducts.map((p) => ({
          productName: p.name,
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice,
          unitMargin: p.sellingPrice - p.costPrice,
          marginPercent: p.grossMargin,
          unitsSold: p.unitsSold,
          totalRevenue: p.revenue,
          totalProfit: p.grossProfit,
        }));

        return {
          reportType: 'profitability',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency: 'USD',
          summaryMetrics: {
            grossRevenue: analytics.financialOverview.revenue,
            costOfGoodsSold: analytics.financialOverview.costOfGoodsSold,
            grossProfit: analytics.financialOverview.grossProfit,
            grossMarginPercent: analytics.financialOverview.grossMargin,
            operatingExpenses: analytics.financialOverview.operatingExpenses,
            netProfit: analytics.financialOverview.estimatedNetProfit,
            netMarginPercent: analytics.financialOverview.netMargin,
          },
          breakdownRows: prodRows,
        };
      }

      case 'inventory': {
        let products: any[] = [];
        if (isSupabaseConfigured) {
          try {
            const { data } = await supabase
              .from('products')
              .select('name, sku, selling_price, cost_price, stock_quantity, minimum_stock_level, is_active')
              .eq('business_id', businessId)
              .order('name');
            if (data) products = data;
          } catch {
            products = [];
          }
        }

        const totalValuationCost = products.reduce(
          (sum, p) => sum + (Number(p.stock_quantity) || 0) * (Number(p.cost_price) || 0),
          0
        );
        const totalValuationRetail = products.reduce(
          (sum, p) => sum + (Number(p.stock_quantity) || 0) * (Number(p.selling_price) || 0),
          0
        );
        const outOfStock = products.filter((p) => (Number(p.stock_quantity) || 0) <= 0).length;
        const lowStock = products.filter(
          (p) => (Number(p.stock_quantity) || 0) > 0 && (Number(p.stock_quantity) || 0) <= (Number(p.minimum_stock_level) || 5)
        ).length;

        return {
          reportType: 'inventory',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel: 'Current Stock Position',
          currency: 'USD',
          summaryMetrics: {
            totalSKUs: products.length || analytics.inventorySummary.totalActiveSKUs,
            totalValuationCost: totalValuationCost || analytics.inventorySummary.totalValuation,
            totalValuationRetail: totalValuationRetail || analytics.financialOverview.revenue,
            potentialGrossProfit: (totalValuationRetail - totalValuationCost) || analytics.financialOverview.grossProfit,
            outOfStockCount: outOfStock || analytics.inventorySummary.outOfStockCount,
            lowStockCount: lowStock || analytics.inventorySummary.lowStockCount,
          },
          breakdownRows: products.map((p) => ({
            name: p.name,
            sku: p.sku || 'N/A',
            currentStock: p.stock_quantity,
            minStock: p.minimum_stock_level || 5,
            costPrice: p.cost_price,
            sellingPrice: p.selling_price,
            stockValuation: (Number(p.stock_quantity) || 0) * (Number(p.cost_price) || 0),
            status:
              Number(p.stock_quantity) <= 0
                ? 'OUT_OF_STOCK'
                : Number(p.stock_quantity) <= (Number(p.minimum_stock_level) || 5)
                ? 'LOW_STOCK'
                : 'HEALTHY',
          })),
        };
      }

      case 'expenses': {
        const topCat = analytics.expenseAnalytics.categories[0];
        return {
          reportType: 'expenses',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency: 'USD',
          summaryMetrics: {
            totalExpenses: analytics.expenseAnalytics.totalExpenses,
            expenseCount: analytics.expenseAnalytics.categories.reduce((sum, c) => sum + c.count, 0),
            topCategory: topCat?.category || 'None',
            topCategoryAmount: topCat?.amount || 0,
          },
          breakdownRows: analytics.expenseAnalytics.categories.map((c) => ({
            category: c.category,
            totalAmount: c.amount,
            percentOfTotal: c.percentageOfTotalExpenses,
          })),
        };
      }

      case 'receivables': {
        let debtorsList: any[] = [];
        if (isSupabaseConfigured) {
          try {
            const { data } = await supabase
              .from('customers')
              .select('name, phone, current_debt, total_spent')
              .eq('business_id', businessId)
              .gt('current_debt', 0)
              .order('current_debt', { ascending: false });
            if (data) debtorsList = data;
          } catch {
            debtorsList = [];
          }
        }

        return {
          reportType: 'receivables',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel: 'Active Outstanding Receivables',
          currency: 'USD',
          summaryMetrics: {
            totalReceivables: analytics.customerAnalytics.totalOutstandingDebt,
            activeDebtorsCount: analytics.customerAnalytics.debtorCustomers,
            totalCustomers: analytics.customerAnalytics.totalCustomers,
          },
          breakdownRows: debtorsList.map((d) => ({
            customerName: d.name,
            phone: d.phone || 'N/A',
            balance: d.current_debt,
            totalSpent: d.total_spent,
          })),
        };
      }

      case 'cash_flow': {
        return {
          reportType: 'cash_flow',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency: 'USD',
          summaryMetrics: {
            totalCashIn: analytics.cashFlow.cashInflows,
            totalCashOut: analytics.cashFlow.cashOutflows,
            netCashVariance: analytics.cashFlow.netCashFlow,
            healthRating: analytics.cashFlow.netCashFlow >= 0 ? 'POSITIVE' : 'NEGATIVE',
          },
          breakdownRows: [
            {
              period: periodLabel,
              inflow: analytics.cashFlow.cashInflows,
              outflow: analytics.cashFlow.cashOutflows,
              net: analytics.cashFlow.netCashFlow,
              status: analytics.cashFlow.netCashFlow >= 0 ? 'SURPLUS' : 'DEFICIT',
            },
          ],
        };
      }

      case 'tax': {
        const revenue = Number(analytics.financialOverview.revenue || 0);
        const totalExpenses = Number(analytics.financialOverview.operatingExpenses || 0);
        const taxableIncome = Math.max(0, revenue - totalExpenses);
        const estimatedSalesTax = Math.round(revenue * 0.05 * 100) / 100;
        const estimatedIncomeTax = Math.round(taxableIncome * 0.15 * 100) / 100;
        const totalTaxLiability = Math.round((estimatedSalesTax + estimatedIncomeTax) * 100) / 100;

        return {
          reportType: 'tax',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency: 'USD',
          summaryMetrics: {
            taxableGrossRevenue: revenue,
            allowableDeductions: totalExpenses,
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
              taxCategory: 'Allowable Expense Deductions',
              applicableBase: totalExpenses,
              rateApplied: '100.0%',
              estimatedTax: -totalExpenses,
              status: 'SHIELDED',
            },
          ],
        };
      }
    }
  }
}

