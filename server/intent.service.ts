export type AIIntentType =
  | 'business_overview'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'receivables'
  | 'expenses'
  | 'cash_flow'
  | 'profitability'
  | 'comparison'
  | 'recommendation'
  | 'daily_brief'
  | 'general_business_question'
  | 'unknown';

export interface IntentClassificationResult {
  intent: AIIntentType;
  requiredTools: string[];
  suggestedTimeHorizonDays: number;
  confidence: number;
}

/**
 * Lightweight, fast, deterministic intent classification and context requirement mapper.
 * Determines exactly what slice of business data is needed without burning LLM tokens.
 */
export function classifyBusinessQuery(query: string): IntentClassificationResult {
  const q = query.toLowerCase().trim();

  // 1. Daily Briefing
  if (
    q.includes('daily brief') ||
    q.includes('morning brief') ||
    q.includes('start my day') ||
    q.includes('today briefing') ||
    q.includes('today brief') ||
    q.includes('daily report')
  ) {
    return {
      intent: 'daily_brief',
      requiredTools: ['get_daily_brief_facts', 'get_inventory_alerts', 'get_customer_balances'],
      suggestedTimeHorizonDays: 1,
      confidence: 0.95,
    };
  }

  // 2. Receivables & Debtors
  if (
    q.includes('who owes') ||
    q.includes('debt') ||
    q.includes('unpaid') ||
    q.includes('receivable') ||
    q.includes('owing') ||
    q.includes('credit balance') ||
    q.includes('collect money')
  ) {
    return {
      intent: 'receivables',
      requiredTools: ['get_customer_balances', 'get_sales_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.92,
    };
  }

  // 3. Inventory & Low Stock
  if (
    q.includes('low stock') ||
    q.includes('running low') ||
    q.includes('out of stock') ||
    q.includes('restock') ||
    q.includes('inventory') ||
    q.includes('stock level') ||
    q.includes('stockout') ||
    q.includes('reorder')
  ) {
    return {
      intent: 'inventory',
      requiredTools: ['get_inventory_alerts', 'get_product_performance'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.93,
    };
  }

  // 4. Products & Catalog Performance
  if (
    q.includes('product') ||
    q.includes('best selling') ||
    q.includes('fastest selling') ||
    q.includes('top product') ||
    q.includes('makes me the most money') ||
    q.includes('slow moving') ||
    q.includes('margin on product') ||
    q.includes('best seller')
  ) {
    return {
      intent: 'products',
      requiredTools: ['get_product_performance', 'get_inventory_alerts'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.9,
    };
  }

  // 5. Expenses & Costs
  if (
    q.includes('expense') ||
    q.includes('spending') ||
    q.includes('spending the most') ||
    q.includes('costs') ||
    q.includes('where am i spending') ||
    q.includes('operating expense') ||
    q.includes('cost of goods')
  ) {
    return {
      intent: 'expenses',
      requiredTools: ['get_expense_summary', 'get_business_overview'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.9,
    };
  }

  // 6. Cash Flow & Payments
  if (
    q.includes('cash flow') ||
    q.includes('cash collected') ||
    q.includes('money in') ||
    q.includes('inflow') ||
    q.includes('deposits') ||
    q.includes('cash vs')
  ) {
    return {
      intent: 'cash_flow',
      requiredTools: ['get_cash_flow', 'get_business_overview'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.88,
    };
  }

  // 7. Profitability & Margins
  if (
    q.includes('gross margin') ||
    q.includes('net profit') ||
    q.includes('profit margin') ||
    q.includes('profitable') ||
    q.includes('margins') ||
    q.includes('profitability')
  ) {
    return {
      intent: 'profitability',
      requiredTools: ['get_business_overview', 'get_period_comparison'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.89,
    };
  }

  // 8. Trends & Comparisons ("Why are sales down", "Compare to last month")
  if (
    q.includes('why are sales') ||
    q.includes('sales down') ||
    q.includes('sales up') ||
    q.includes('compared') ||
    q.includes('last month') ||
    q.includes('growth') ||
    q.includes('change in revenue') ||
    q.includes('trend') ||
    q.includes('drop') ||
    q.includes('contraction')
  ) {
    return {
      intent: 'comparison',
      requiredTools: ['get_period_comparison', 'get_product_performance', 'get_expense_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.91,
    };
  }

  // 9. Recommendations & Planning ("What should I focus on")
  if (
    q.includes('focus on') ||
    q.includes('what should i do') ||
    q.includes('advice') ||
    q.includes('recommend') ||
    q.includes('priority') ||
    q.includes('priorities') ||
    q.includes('how to improve')
  ) {
    return {
      intent: 'recommendation',
      requiredTools: [
        'get_business_overview',
        'get_inventory_alerts',
        'get_customer_balances',
        'get_business_health',
      ],
      suggestedTimeHorizonDays: 30,
      confidence: 0.87,
    };
  }

  // 10. Store Identity & Preferences
  if (
    q.includes('business name') ||
    q.includes('store name') ||
    q.includes('shop name') ||
    q.includes('currency') ||
    q.includes('timezone') ||
    q.includes('preference') ||
    q.includes('setting') ||
    q.includes('who am i') ||
    q.includes('about my business') ||
    q.includes('about my store')
  ) {
    return {
      intent: 'general_business_question',
      requiredTools: ['get_business_overview'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
    };
  }

  // 11. Sales / What did I sell today
  if (
    q.includes('sell today') ||
    q.includes('sold today') ||
    q.includes('today sales') ||
    q.includes('sales today') ||
    q.includes('sales this week') ||
    q.includes('sales this month') ||
    q.includes('revenue') ||
    q.includes('transactions')
  ) {
    const isToday = q.includes('today');
    return {
      intent: 'sales',
      requiredTools: ['get_sales_summary', 'get_business_overview'],
      suggestedTimeHorizonDays: isToday ? 1 : 30,
      confidence: 0.9,
    };
  }

  // 11. Customer intelligence
  if (q.includes('customer') || q.includes('clients') || q.includes('buyer')) {
    return {
      intent: 'customers',
      requiredTools: ['get_customer_balances', 'get_sales_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.86,
    };
  }

  // 12. General Business Overview ("How is my business doing")
  return {
    intent: 'business_overview',
    requiredTools: [
      'get_business_overview',
      'get_period_comparison',
      'get_inventory_alerts',
      'get_business_health',
    ],
    suggestedTimeHorizonDays: 30,
    confidence: 0.8,
  };
}
