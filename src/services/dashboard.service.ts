import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { isValidUUID } from '../lib/uuid.ts';
import type { DashboardMetrics, Sale, Product, Expense, Customer, SaleItem } from '../types/index.ts';

export interface DashboardSummaryRPC {
  business_id: string;
  currency: string;
  period_start: string;
  period_end: string;
  revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  transaction_count: number;
  average_order_value: number;
  outstanding_receivables: number;
  inventory_valuation: number;
  low_stock_count: number;
}

export const DashboardService = {
  /**
   * Fetches real-time dashboard financial metrics for the active business.
   * If there is no sales/inventory data, returns zero values without generating fake numbers.
   */
  async getMetrics(businessId: string): Promise<DashboardMetrics> {
    if (!businessId) {
      return {
        revenueToday: 0,
        grossProfitToday: 0,
        outstandingReceivables: 0,
        transactionCountToday: 0,
        lowStockCount: 0,
        totalExpensesToday: 0,
        recentTransactions: [],
      };
    }

    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayIso = todayStart.toISOString();

        // 1. Try to invoke the PostgreSQL aggregation RPC
        let rpcData: DashboardSummaryRPC | null = null;
        try {
          const { data, error } = await (supabase as any).rpc('get_business_dashboard_summary', {
            p_business_id: businessId,
            p_start_date: todayIso,
            p_end_date: null,
          });
          if (!error && data) {
            rpcData = data as DashboardSummaryRPC;
          }
        } catch {
          // fallback to manual table queries
        }

        // 2. Query today's sales
        const { data: salesToday } = await supabase
          .from('sales')
          .select(`
            id,
            total,
            amount_paid,
            amount_due,
            payment_status,
            payment_method,
            sold_at,
            customers ( name ),
            sale_items ( product_name_snapshot, quantity )
          `)
          .eq('business_id', businessId)
          .eq('sale_status', 'completed')
          .gte('sold_at', todayIso)
          .order('sold_at', { ascending: false });

        // 3. Query low stock products
        const { data: lowStockProducts } = await (supabase as any)
          .from('products')
          .select('id, stock_quantity, minimum_stock_level')
          .eq('business_id', businessId)
          .eq('is_active', true);

        const lowStockCount = ((lowStockProducts as any[]) || []).filter(
          (p: any) => Number(p.stock_quantity) <= (Number(p.minimum_stock_level) || 5)
        ).length;

        // 4. Query outstanding receivables across all unpaid/partial sales
        const { data: pendingSales } = await (supabase as any)
          .from('sales')
          .select('amount_due')
          .eq('business_id', businessId)
          .eq('sale_status', 'completed')
          .in('payment_status', ['unpaid', 'partial']);

        const outstandingTotal = ((pendingSales as any[]) || []).reduce(
          (sum: number, s: any) => sum + (Number(s.amount_due) || 0),
          0
        );

        // 5. Query today's expenses
        const { data: expensesToday } = await (supabase as any)
          .from('expenses')
          .select('amount')
          .eq('business_id', businessId)
          .gte('expense_date', todayIso.split('T')[0]);

        const totalExpenses = (expensesToday || []).reduce(
          (sum: number, e: any) => sum + (Number(e.amount) || 0),
          0
        );

        // 6. Query recent 5 transactions
        const { data: recentSales } = await (supabase as any)
          .from('sales')
          .select(`
            id,
            total,
            amount_paid,
            payment_status,
            payment_method,
            sold_at,
            customers ( name ),
            sale_items ( product_name_snapshot, quantity )
          `)
          .eq('business_id', businessId)
          .order('sold_at', { ascending: false })
          .limit(5);

        const salesList = (salesToday as any[]) || [];
        const revenueToday = rpcData?.revenue ?? salesList.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
        const grossProfitToday = rpcData?.gross_profit ?? 0;
        const transactionCountToday = rpcData?.transaction_count ?? salesList.length;

        const formattedRecent = (recentSales || []).map((s: any) => {
          const items = (s.sale_items || [])
            .map((item: any) => `${item.quantity}x ${item.product_name_snapshot}`)
            .join(', ');

          return {
            id: s.id,
            total: Number(s.total) || 0,
            amount_paid: Number(s.amount_paid) || 0,
            payment_status: s.payment_status,
            payment_method: s.payment_method,
            sold_at: s.sold_at,
            customer_name: s.customers?.name || undefined,
            items_summary: items || 'General items',
          };
        });

        return {
          revenueToday,
          grossProfitToday,
          outstandingReceivables: rpcData?.outstanding_receivables ?? outstandingTotal,
          transactionCountToday,
          lowStockCount: rpcData?.low_stock_count ?? lowStockCount,
          totalExpensesToday: rpcData?.expenses ?? totalExpenses,
          recentTransactions: formattedRecent,
        };
      } catch (err) {
        console.error('Error in DashboardService.getMetrics:', err);
        return {
          revenueToday: 0,
          grossProfitToday: 0,
          outstandingReceivables: 0,
          transactionCountToday: 0,
          lowStockCount: 0,
          totalExpensesToday: 0,
          recentTransactions: [],
        };
      }
    } else {
      // Local fallback with real calculations from localStorage
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const salesKey = `ursella_sales_${businessId}`;
      const salesStored = localStorage.getItem(salesKey);
      const salesList: Sale[] = salesStored ? JSON.parse(salesStored) : [];

      const itemsKey = `ursella_sale_items_${businessId}`;
      const itemsStored = localStorage.getItem(itemsKey);
      const itemsList: SaleItem[] = itemsStored ? JSON.parse(itemsStored) : [];

      const prodKey = `ursella_products_${businessId}`;
      const prodStored = localStorage.getItem(prodKey);
      const prods: Product[] = prodStored ? JSON.parse(prodStored) : [];

      const expKey = `ursella_expenses_${businessId}`;
      const expStored = localStorage.getItem(expKey);
      const expensesList: Expense[] = expStored ? JSON.parse(expStored) : [];

      const custKey = `ursella_customers_${businessId}`;
      const custStored = localStorage.getItem(custKey);
      const custList: Customer[] = custStored ? JSON.parse(custStored) : [];

      const completedSales = salesList.filter((s) => s.sale_status === 'completed');

      const todaySales = completedSales.filter(
        (s) => new Date(s.sold_at).getTime() >= todayStart.getTime()
      );

      const revenueToday = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);

      // COGS today
      const todaySaleIds = new Set(todaySales.map((s) => s.id));
      const todayItems = itemsList.filter((i) => todaySaleIds.has(i.sale_id));
      const cogsToday = todayItems.reduce(
        (sum, item) => sum + (Number(item.unit_cost) || 0) * (Number(item.quantity) || 1),
        0
      );
      const grossProfitToday = Math.max(0, revenueToday - cogsToday);

      const outstandingReceivables = completedSales.reduce(
        (sum, s) => sum + Number(s.amount_due || 0),
        0
      );

      const lowStockCount = prods.filter(
        (p) => p.is_active && p.stock_quantity <= (p.minimum_stock_level || 5)
      ).length;

      const todayDateStr = todayStart.toISOString().split('T')[0];
      const totalExpensesToday = expensesList
        .filter((e) => e.expense_date >= todayDateStr)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const recentTransactions = salesList.slice(0, 5).map((s) => {
        const items = itemsList
          .filter((i) => i.sale_id === s.id)
          .map((i) => `${i.quantity}x ${i.product_name_snapshot}`)
          .join(', ');
        const cust = custList.find((c) => c.id === s.customer_id);

        return {
          id: s.id,
          total: Number(s.total) || 0,
          amount_paid: Number(s.amount_paid) || 0,
          payment_status: s.payment_status,
          payment_method: s.payment_method,
          sold_at: s.sold_at,
          customer_name: cust?.name,
          items_summary: items || 'General items',
        };
      });

      return {
        revenueToday,
        grossProfitToday,
        outstandingReceivables,
        transactionCountToday: todaySales.length,
        lowStockCount,
        totalExpensesToday,
        recentTransactions,
      };
    }
  },
};
