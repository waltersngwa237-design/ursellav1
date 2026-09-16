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
        const serverData: BusinessReportData = await res.json();
        const hasServerMetrics =
          serverData &&
          (serverData.breakdownRows?.length > 0 ||
            Object.values(serverData.summaryMetrics || {}).some(
              (v) => typeof v === 'number' && Math.abs(v) > 0
            ));

        if (hasServerMetrics) {
          return serverData;
        }
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

    let currency = 'USD';
    try {
      if (typeof localStorage !== 'undefined') {
        const storedBiz = localStorage.getItem('ursella_active_business_v1') || localStorage.getItem('ursella_businesses_v1');
        if (storedBiz) {
          const parsed = JSON.parse(storedBiz);
          if (parsed?.currency) currency = parsed.currency;
          else if (Array.isArray(parsed) && parsed[0]?.currency) currency = parsed[0].currency;
        }
      }
    } catch {}

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
            if (data && data.length > 0) salesRows = data;
          } catch {
            salesRows = [];
          }
        }

        if (salesRows.length === 0 && typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem(`ursella_sales_${businessId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                salesRows = parsed.slice(0, 50).map((s: any) => ({
                  receipt_number: s.receipt_number || s.id?.slice(0, 8),
                  total: Number(s.total) || 0,
                  amount_paid: Number(s.amount_paid ?? s.total) || 0,
                  payment_status: s.payment_status || 'paid',
                  payment_method: s.payment_method || 'cash',
                  sold_at: s.sold_at || s.created_at || new Date().toISOString(),
                }));
              }
            }
          } catch {}
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
          currency,
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
        let prodRows = analytics.topProducts.map((p) => ({
          productName: p.name,
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice,
          unitMargin: p.sellingPrice - p.costPrice,
          marginPercent: p.grossMargin,
          unitsSold: p.unitsSold,
          totalRevenue: p.revenue,
          totalProfit: p.grossProfit,
        }));

        if (prodRows.length === 0 && typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem(`ursella_products_${businessId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                prodRows = parsed.slice(0, 50).map((p: any) => {
                  const sp = Number(p.selling_price) || 0;
                  const cp = Number(p.cost_price) || 0;
                  const unitMargin = sp - cp;
                  const marginPercent = sp > 0 ? Math.round((unitMargin / sp) * 1000) / 10 : 0;
                  return {
                    productName: p.name,
                    sellingPrice: sp,
                    costPrice: cp,
                    unitMargin,
                    marginPercent,
                    unitsSold: 0,
                    totalRevenue: 0,
                    totalProfit: 0,
                  };
                });
              }
            }
          } catch {}
        }

        return {
          reportType: 'profitability',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency,
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
            if (data && data.length > 0) products = data;
          } catch {
            products = [];
          }
        }

        if (products.length === 0 && typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem(`ursella_products_${businessId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) products = parsed;
            }
          } catch {}
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
          currency,
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
        let expenseCategories = analytics.expenseAnalytics.categories;
        if (expenseCategories.length === 0 && typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem(`ursella_expenses_${businessId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const map = new Map<string, { count: number; total: number }>();
                for (const exp of parsed) {
                  const cat = exp.category || 'General';
                  const amt = Number(exp.amount) || 0;
                  const curr = map.get(cat) || { count: 0, total: 0 };
                  map.set(cat, { count: curr.count + 1, total: curr.total + amt });
                }
                const totalAll = Array.from(map.values()).reduce((sum, v) => sum + v.total, 0);
                const totalRev = Number(analytics.financialOverview.revenue) || 0;
                expenseCategories = Array.from(map.entries()).map(([category, stats]) => ({
                  category,
                  count: stats.count,
                  amount: stats.total,
                  percentageOfTotalExpenses: totalAll > 0 ? Math.round((stats.total / totalAll) * 1000) / 10 : 0,
                  percentageOfRevenue: totalRev > 0 ? Math.round((stats.total / totalRev) * 1000) / 10 : 0,
                }));
              }
            }
          } catch {}
        }

        const totalExpenses = expenseCategories.reduce((sum, c) => sum + c.amount, 0) || analytics.expenseAnalytics.totalExpenses;
        const topCat = expenseCategories[0];
        return {
          reportType: 'expenses',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel,
          currency,
          summaryMetrics: {
            totalExpenses,
            expenseCount: expenseCategories.reduce((sum, c) => sum + c.count, 0),
            topCategory: topCat?.category || 'None',
            topCategoryAmount: topCat?.amount || 0,
          },
          breakdownRows: expenseCategories.map((c) => ({
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
            if (data && data.length > 0) debtorsList = data;
          } catch {
            debtorsList = [];
          }
        }

        if (debtorsList.length === 0 && typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem(`ursella_customers_${businessId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                debtorsList = parsed.filter((c: any) => (Number(c.current_debt) || 0) > 0);
              }
            }
          } catch {}
        }

        return {
          reportType: 'receivables',
          businessId,
          generatedAt: new Date().toISOString(),
          periodLabel: 'Active Outstanding Receivables',
          currency,
          summaryMetrics: {
            totalReceivables: analytics.customerAnalytics.totalOutstandingDebt,
            activeDebtorsCount: debtorsList.length || analytics.customerAnalytics.debtorCustomers,
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
          currency,
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
        const cogs = Number(analytics.financialOverview.costOfGoodsSold || 0);
        const taxableIncome = Math.max(0, revenue - totalExpenses - cogs);
        const estimatedSalesTax = Math.round(revenue * 0.05 * 100) / 100;
        const estimatedIncomeTax = Math.round(taxableIncome * 0.15 * 100) / 100;
        const totalTaxLiability = Math.round((estimatedSalesTax + estimatedIncomeTax) * 100) / 100;

        return {
          reportType: 'tax',
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

