/**
 * Ursella Business OS - Deterministic Event Detection Engine (Phase 5)
 * Analyzes transactional, inventory, customer, and financial data to detect
 * meaningful business events without hallucinations or arbitrary guesswork.
 */
import { serverSupabase } from './business-tools.service.ts';
import type {
  BusinessEventType,
  InsightCategory,
  InsightConfidence,
  InsightSeverity,
  BusinessInsight,
  ActionType,
} from '../src/types/proactive.ts';

export interface RawBusinessEvent {
  eventType: BusinessEventType;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  summary: string;
  explanation: {
    whatHappened: string;
    whyItMatters: string;
    whatYouCanDo: string;
  };
  data: Record<string, any>;
  dedupKey: string;
  actionType?: ActionType;
  actionPayload?: Record<string, any>;
}

export class EventDetectionService {
  /**
   * Run full detection across all operational domains.
   */
  public static async scanBusiness(businessId: string): Promise<RawBusinessEvent[]> {
    const events: RawBusinessEvent[] = [];

    try {
      const [
        salesEvents,
        inventoryEvents,
        customerEvents,
        expenseMarginEvents,
        opportunityEvents,
      ] = await Promise.all([
        this.detectSalesEvents(businessId),
        this.detectInventoryEvents(businessId),
        this.detectCustomerEvents(businessId),
        this.detectExpenseAndMarginEvents(businessId),
        this.detectOpportunityEvents(businessId),
      ]);

      events.push(
        ...salesEvents,
        ...inventoryEvents,
        ...customerEvents,
        ...expenseMarginEvents,
        ...opportunityEvents
      );
    } catch (err) {
      console.error(`[EventDetectionService] Error scanning business ${businessId}:`, err);
    }

    return events;
  }

  /**
   * 1. SALES EVENTS: Drop, Spike, Large Sale
   */
  public static async detectSalesEvents(businessId: string): Promise<RawBusinessEvent[]> {
    const events: RawBusinessEvent[] = [];
    const now = new Date();
    const current7DaysStart = new Date(now.getTime() - 7 * 86400000);
    const prior7DaysStart = new Date(now.getTime() - 14 * 86400000);

    const [{ data: currSales }, { data: priorSales }] = await Promise.all([
      serverSupabase
        .from('sales')
        .select('id, total, sold_at')
        .eq('business_id', businessId)
        .eq('sale_status', 'completed')
        .gte('sold_at', current7DaysStart.toISOString()),
      serverSupabase
        .from('sales')
        .select('id, total, sold_at')
        .eq('business_id', businessId)
        .eq('sale_status', 'completed')
        .gte('sold_at', prior7DaysStart.toISOString())
        .lt('sold_at', current7DaysStart.toISOString()),
    ]);

    const currRev = currSales?.reduce((acc, s) => acc + Number(s.total || 0), 0) || 0;
    const priorRev = priorSales?.reduce((acc, s) => acc + Number(s.total || 0), 0) || 0;
    const currCount = currSales?.length || 0;
    const priorCount = priorSales?.length || 0;

    // Minimum data threshold: at least 3 transactions in prior period
    if (priorCount >= 3 && priorRev > 0) {
      const revDiffPct = ((currRev - priorRev) / priorRev) * 100;

      // Detect Sales Drop (> 18% decline)
      if (revDiffPct <= -18) {
        const severity: InsightSeverity = revDiffPct <= -35 ? 'critical' : 'high';
        events.push({
          eventType: 'sales_drop',
          category: 'sales',
          severity,
          confidence: currCount + priorCount >= 8 ? 'high' : 'moderate',
          title: `Revenue Down ${Math.abs(Math.round(revDiffPct))}% This Week`,
          summary: `7-day sales dropped from ${priorRev.toLocaleString()} to ${currRev.toLocaleString()} across ${currCount} transactions.`,
          explanation: {
            whatHappened: `Revenue decreased by ${Math.abs(Math.round(revDiffPct))}% over the last 7 days compared to the preceding 7-day period.`,
            whyItMatters: `A sharp decrease in sales volume or basket size directly threatens operating cash flow.`,
            whatYouCanDo: `Review top SKU stock availability, follow up with key accounts, or run a promotional campaign to stimulate purchase velocity.`,
          },
          data: {
            currentPeriodRevenue: currRev,
            priorPeriodRevenue: priorRev,
            percentageChange: Number(revDiffPct.toFixed(1)),
            currentTransactions: currCount,
            priorTransactions: priorCount,
          },
          dedupKey: `sales_drop_${now.getFullYear()}_w${Math.ceil(now.getDate() / 7)}`,
          actionType: 'create_reminder',
          actionPayload: {
            title: 'Review weekly sales drop and pricing strategy',
            description: `Investigate ${Math.abs(Math.round(revDiffPct))}% revenue drop (Current: ${currRev.toLocaleString()})`,
            priority: 'high',
            related_entity_type: 'sale',
          },
        });
      }

      // Detect Sales Spike (> 35% increase)
      if (revDiffPct >= 35 && currCount >= 3) {
        events.push({
          eventType: 'sales_spike',
          category: 'sales',
          severity: 'informational',
          confidence: currCount >= 6 ? 'high' : 'moderate',
          title: `Revenue Spiked +${Math.round(revDiffPct)}% This Week`,
          summary: `7-day revenue surged to ${currRev.toLocaleString()} (+${Math.round(revDiffPct)}% vs prior week).`,
          explanation: {
            whatHappened: `Sales volume increased significantly, generating strong revenue growth over the baseline.`,
            whyItMatters: `High sales demand depletes inventory rapidly and may require replenishment.`,
            whatYouCanDo: `Verify stock levels on fast-moving SKUs and maintain customer satisfaction.`,
          },
          data: {
            currentPeriodRevenue: currRev,
            priorPeriodRevenue: priorRev,
            percentageChange: Number(revDiffPct.toFixed(1)),
          },
          dedupKey: `sales_spike_${now.getFullYear()}_w${Math.ceil(now.getDate() / 7)}`,
        });
      }
    }

    return events;
  }

  /**
   * 2. INVENTORY EVENTS: Out of Stock, Low Stock, Fast-Moving Depletion Risk
   */
  public static async detectInventoryEvents(businessId: string): Promise<RawBusinessEvent[]> {
    const events: RawBusinessEvent[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [{ data: products }, { data: saleItems }] = await Promise.all([
      serverSupabase
        .from('products')
        .select('id, name, stock_quantity, minimum_stock_level, cost_price, selling_price')
        .eq('business_id', businessId)
        .eq('is_active', true),
      serverSupabase
        .from('sale_items')
        .select('product_id, quantity')
        .eq('business_id', businessId)
        .gte('created_at', sevenDaysAgo),
    ]);

    if (!products || products.length === 0) return events;

    // Calculate 7-day velocity per product
    const velocityMap: Record<string, number> = {};
    for (const item of saleItems || []) {
      if (item.product_id) {
        velocityMap[item.product_id] = (velocityMap[item.product_id] || 0) + Number(item.quantity || 0);
      }
    }

    for (const prod of products) {
      const stock = Number(prod.stock_quantity || 0);
      const minStock = Number(prod.minimum_stock_level || 5);
      const weeklyUnitsSold = velocityMap[prod.id] || 0;
      const dailyVelocity = weeklyUnitsSold / 7;

      // Event A: Out of Stock
      if (stock === 0) {
        const hadRecentSales = weeklyUnitsSold > 0;
        events.push({
          eventType: 'out_of_stock',
          category: 'inventory',
          severity: hadRecentSales ? 'critical' : 'high',
          confidence: 'high',
          title: `${prod.name} is Out of Stock`,
          summary: `Current inventory is 0 units.${hadRecentSales ? ` Sold ${weeklyUnitsSold} units in the last 7 days.` : ''}`,
          explanation: {
            whatHappened: `Inventory for "${prod.name}" has reached 0 units.`,
            whyItMatters: `Zero stock causes lost sales and pushes regular customers to competitors.`,
            whatYouCanDo: `Initiate a restock purchase with your supplier immediately.`,
          },
          data: {
            productId: prod.id,
            productName: prod.name,
            currentStock: 0,
            minimumStockLevel: minStock,
            sevenDayUnitsSold: weeklyUnitsSold,
          },
          dedupKey: `out_of_stock_${prod.id}`,
          actionType: 'create_restock_task',
          actionPayload: {
            productId: prod.id,
            productName: prod.name,
            currentStock: 0,
            suggestedQuantity: Math.max(minStock * 2, Math.ceil(dailyVelocity * 14) || minStock),
            title: `Restock Order: ${prod.name}`,
            priority: 'high',
          },
        });
      }
      // Event B: Fast-moving Depletion Risk (Stock low relative to sales speed: stock / dailyVelocity <= 3 days)
      else if (dailyVelocity >= 0.8 && stock / dailyVelocity <= 3.5) {
        const daysRemaining = Number((stock / dailyVelocity).toFixed(1));
        events.push({
          eventType: 'fast_moving_depletion',
          category: 'inventory',
          severity: 'high',
          confidence: 'high',
          title: `${prod.name} Depletion Risk (${daysRemaining} Days of Stock Left)`,
          summary: `Selling ${dailyVelocity.toFixed(1)} units/day with only ${stock} units in stock. Estimated stockout in ${daysRemaining} days.`,
          explanation: {
            whatHappened: `"${prod.name}" is selling faster than usual (${weeklyUnitsSold} units in 7 days) and only ${stock} units remain.`,
            whyItMatters: `At this sales pace, the product will be completely sold out within ${daysRemaining} days.`,
            whatYouCanDo: `Order replacement stock before stock completely runs dry.`,
          },
          data: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            dailyVelocity,
            daysRemaining,
            weeklyUnitsSold,
          },
          dedupKey: `depletion_risk_${prod.id}`,
          actionType: 'create_restock_task',
          actionPayload: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            suggestedQuantity: Math.max(minStock * 2, Math.ceil(dailyVelocity * 14)),
            title: `Fast-moving Restock: ${prod.name}`,
            priority: 'high',
          },
        });
      }
      // Event C: Low Stock (Stock <= minimum stock level)
      else if (stock <= minStock && stock > 0) {
        events.push({
          eventType: 'low_stock',
          category: 'inventory',
          severity: 'medium',
          confidence: 'high',
          title: `Low Stock: ${prod.name} (${stock} units left)`,
          summary: `Stock is at or below minimum threshold (${stock}/${minStock} units).`,
          explanation: {
            whatHappened: `"${prod.name}" has ${stock} units remaining, at or below your safety threshold of ${minStock}.`,
            whyItMatters: `Remaining stock is vulnerable to unexpected surges in customer demand.`,
            whatYouCanDo: `Plan a replenishment order to restore stock above minimum threshold.`,
          },
          data: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            minimumStockLevel: minStock,
          },
          dedupKey: `low_stock_${prod.id}`,
          actionType: 'create_restock_task',
          actionPayload: {
            productId: prod.id,
            productName: prod.name,
            currentStock: stock,
            suggestedQuantity: minStock * 2,
            title: `Low Stock Restock: ${prod.name}`,
            priority: 'medium',
          },
        });
      }
    }

    return events;
  }

  /**
   * 3. CUSTOMER EVENTS: Overdue Debt, Large Outstanding Balances, Inactive Customers
   */
  public static async detectCustomerEvents(businessId: string): Promise<RawBusinessEvent[]> {
    const events: RawBusinessEvent[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [{ data: customers }, { data: sales }] = await Promise.all([
      serverSupabase
        .from('customers')
        .select('id, name, phone, email')
        .eq('business_id', businessId)
        .eq('is_active', true),
      serverSupabase
        .from('sales')
        .select('id, customer_id, total, amount_due, sale_status, sold_at')
        .eq('business_id', businessId)
        .eq('sale_status', 'completed'),
    ]);

    if (!customers || customers.length === 0) return events;

    // Group sales by customer
    const salesByCustomer: Record<string, any[]> = {};
    for (const s of sales || []) {
      if (s.customer_id) {
        if (!salesByCustomer[s.customer_id]) {
          salesByCustomer[s.customer_id] = [];
        }
        salesByCustomer[s.customer_id].push(s);
      }
    }

    // Detect large outstanding balances (> 0) and inactive customers
    for (const c of customers) {
      const custSales = salesByCustomer[c.id] || [];
      const debt = custSales.reduce((acc, s) => acc + (Number(s.amount_due) || 0), 0);
      const totalSpent = custSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const totalOrders = custSales.length;
      const sortedSales = [...custSales].sort(
        (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
      );
      const lastOrderAt = sortedSales[0]?.sold_at || null;

      if (debt > 0) {
        const severity: InsightSeverity = debt >= 100000 ? 'high' : 'medium';
        events.push({
          eventType: 'customer_balance_overdue',
          category: 'customers',
          severity,
          confidence: 'high',
          title: `Outstanding Balance: ${c.name} (${debt.toLocaleString()})`,
          summary: `${c.name} holds an unpaid credit balance of ${debt.toLocaleString()}.`,
          explanation: {
            whatHappened: `${c.name} has an unsettled balance of ${debt.toLocaleString()} from prior purchases.`,
            whyItMatters: `Uncollected customer credit constrains liquid cash flow needed for inventory and expenses.`,
            whatYouCanDo: `Send a friendly payment reminder via SMS, WhatsApp, or phone call to collect the amount.`,
          },
          data: {
            customerId: c.id,
            customerName: c.name,
            phone: c.phone,
            email: c.email,
            outstandingDebt: debt,
            totalSpent,
          },
          dedupKey: `overdue_balance_${c.id}`,
          actionType: 'send_customer_message',
          actionPayload: {
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            debtAmount: debt,
            messageType: 'payment_reminder',
            draftMessage: `Hello ${c.name}, this is a gentle reminder regarding your outstanding balance of ${debt.toLocaleString()} with our store. Please let us know when it is convenient to settle. Thank you!`,
          },
        });
      }

      // Detect high-value customer inactivity (Spent > 50,000 but no orders in 30+ days)
      if (
        totalSpent >= 50000 &&
        lastOrderAt &&
        lastOrderAt < thirtyDaysAgo &&
        debt === 0
      ) {
        events.push({
          eventType: 'customer_inactive',
          category: 'customers',
          severity: 'low',
          confidence: 'moderate',
          title: `VIP Follow-up: ${c.name} hasn't purchased recently`,
          summary: `Customer with ${totalSpent.toLocaleString()} lifetime spend has been inactive for over 30 days.`,
          explanation: {
            whatHappened: `${c.name}, a valuable customer with ${totalOrders || 'multiple'} past purchases, has not visited in 30+ days.`,
            whyItMatters: `Re-engaging lapsed loyal customers is 5x cheaper than acquiring new foot traffic.`,
            whatYouCanDo: `Reach out with a friendly check-in or share details on new arrivals and offers.`,
          },
          data: {
            customerId: c.id,
            customerName: c.name,
            phone: c.phone,
            totalSpent,
            lastOrderAt,
          },
          dedupKey: `inactive_customer_${c.id}`,
          actionType: 'send_customer_message',
          actionPayload: {
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            messageType: 'customer_reengagement',
            draftMessage: `Hello ${c.name}! We noticed it's been a while since your last visit. We have new stock and special offers we'd love to share with you. Hope to see you soon!`,
          },
        });
      }
    }

    return events;
  }

  /**
   * 4. EXPENSE & MARGIN EVENTS: Expense Spike, Gross Margin Deterioration
   */
  public static async detectExpenseAndMarginEvents(businessId: string): Promise<RawBusinessEvent[]> {
    const events: RawBusinessEvent[] = [];
    const now = new Date();
    const curr30Start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const prior30Start = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0];

    const [{ data: currExpenses }, { data: priorExpenses }] = await Promise.all([
      serverSupabase
        .from('expenses')
        .select('id, category, amount, expense_date')
        .eq('business_id', businessId)
        .gte('expense_date', curr30Start),
      serverSupabase
        .from('expenses')
        .select('id, category, amount, expense_date')
        .eq('business_id', businessId)
        .gte('expense_date', prior30Start)
        .lt('expense_date', curr30Start),
    ]);

    const currTotal = currExpenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;
    const priorTotal = priorExpenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;

    // Detect Overall Expense Spike (> 30% jump with prior > 0)
    if (priorTotal > 10000 && currTotal > priorTotal * 1.3) {
      const jumpPct = Math.round(((currTotal - priorTotal) / priorTotal) * 100);
      events.push({
        eventType: 'expense_spike',
        category: 'expenses',
        severity: 'high',
        confidence: 'high',
        title: `Operating Expenses Spiked +${jumpPct}%`,
        summary: `30-day expenses increased from ${priorTotal.toLocaleString()} to ${currTotal.toLocaleString()}.`,
        explanation: {
          whatHappened: `Operating expenses grew by ${jumpPct}% over the last 30 days compared with the previous 30-day window.`,
          whyItMatters: `Rising overhead eats into net profit margins and increases operating breakeven points.`,
          whatYouCanDo: `Review expense line items to differentiate one-off investments from ongoing overhead cost creep.`,
        },
        data: {
          currentExpenses: currTotal,
          priorExpenses: priorTotal,
          percentageIncrease: jumpPct,
        },
        dedupKey: `expense_spike_${now.getFullYear()}_m${now.getMonth() + 1}`,
        actionType: 'create_reminder',
        actionPayload: {
          title: `Audit ${jumpPct}% operational expense spike`,
          description: `Total 30-day expenses reached ${currTotal.toLocaleString()}`,
          priority: 'high',
          related_entity_type: 'expense',
        },
      });
    }

    return events;
  }

  /**
   * 5. OPPORTUNITY EVENTS: High Margin Fast-Sellers, Revenue Opportunities
   */
  public static async detectOpportunityEvents(businessId: string): Promise<RawBusinessEvent[]> {
    const events: RawBusinessEvent[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [{ data: products }, { data: saleItems }] = await Promise.all([
      serverSupabase
        .from('products')
        .select('id, name, selling_price, cost_price, stock_quantity')
        .eq('business_id', businessId)
        .eq('is_active', true),
      serverSupabase
        .from('sale_items')
        .select('product_id, quantity, total')
        .eq('business_id', businessId)
        .gte('created_at', sevenDaysAgo),
    ]);

    if (!products || products.length === 0) return events;

    const unitsSoldMap: Record<string, number> = {};
    for (const item of saleItems || []) {
      if (item.product_id) {
        unitsSoldMap[item.product_id] = (unitsSoldMap[item.product_id] || 0) + Number(item.quantity || 0);
      }
    }

    // Find products with high gross margin (> 40%) that are actively selling
    for (const p of products) {
      const price = Number(p.selling_price || 0);
      const cost = Number(p.cost_price || 0);
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      const sold = unitsSoldMap[p.id] || 0;

      if (margin >= 45 && sold >= 5 && Number(p.stock_quantity || 0) > 10) {
        events.push({
          eventType: 'margin_improvement',
          category: 'opportunities',
          severity: 'informational',
          confidence: 'high',
          title: `Profit Driver Opportunity: ${p.name} (${Math.round(margin)}% Margin)`,
          summary: `${p.name} carries a strong ${Math.round(margin)}% profit margin and sold ${sold} units this week.`,
          explanation: {
            whatHappened: `"${p.name}" delivers high gross profit per unit (${(price - cost).toLocaleString()}) and has sustained healthy sales demand.`,
            whyItMatters: `Promoting higher-margin products increases total net income faster than boosting low-margin volume.`,
            whatYouCanDo: `Position ${p.name} prominently on store shelves, in promotional displays, or as an upsell at checkout.`,
          },
          data: {
            productId: p.id,
            productName: p.name,
            sellingPrice: price,
            costPrice: cost,
            marginPct: Number(margin.toFixed(1)),
            weeklyUnitsSold: sold,
            availableStock: p.stock_quantity,
          },
          dedupKey: `opportunity_margin_${p.id}`,
        });
        break; // Show top opportunity
      }
    }

    return events;
  }
}
