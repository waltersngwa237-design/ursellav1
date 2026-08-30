export type AIIntentCategory =
  | 'fact_retrieval'
  | 'explanation'
  | 'analysis'
  | 'comparison'
  | 'recommendation'
  | 'diagnosis'
  | 'calculation'
  | 'daily_brief'
  | 'identity_lookup'
  | 'fifo_audit'
  | 'general_overview';

export type AIBusinessDomain =
  | 'sales'
  | 'inventory'
  | 'debtors'
  | 'products'
  | 'expenses'
  | 'cash_flow'
  | 'profitability'
  | 'fifo_costing'
  | 'customers'
  | 'store_info'
  | 'multi_domain';

export type AITimePeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'all_time'
  | 'comparison_period';

export interface IntentClassificationResult {
  intent: AIIntentCategory;
  domain: AIBusinessDomain;
  timePeriod: AITimePeriod;
  requiredTools: string[];
  suggestedTimeHorizonDays: number;
  confidence: number;
  primaryGoal: string;
}

/**
 * Intelligent, deterministic intent, domain, and temporal parser.
 * Identifies the exact business domain, time horizon, and surgical slice of data required.
 * Guarantees that only strictly relevant business tools are executed.
 */
export function classifyBusinessQuery(query: string): IntentClassificationResult {
  const q = query.toLowerCase().trim();

  // 1. Store Identity & Meta Information (Store name, currency, timezone, operator)
  if (
    q.includes('business name') ||
    q.includes('store name') ||
    q.includes('shop name') ||
    q.includes('name of my business') ||
    q.includes('name of this business') ||
    q.includes('what is my store') ||
    q.includes('what is my business') ||
    q.includes('about my store') ||
    q.includes('about my business') ||
    q.includes('who am i') ||
    q.includes('who is the owner') ||
    q.includes('operating currency') ||
    q.includes('what currency') ||
    q.includes('which currency') ||
    q.includes('currency am i using') ||
    q.includes('currency do we use') ||
    q.includes('timezone') ||
    q.includes('what timezone')
  ) {
    return {
      intent: 'identity_lookup',
      domain: 'store_info',
      timePeriod: 'all_time',
      requiredTools: ['get_business_overview'],
      suggestedTimeHorizonDays: 1,
      confidence: 0.98,
      primaryGoal: 'Identify store settings, active currency, timezone, or business identity.',
    };
  }

  // 2. FIFO Costing, Inventory Valuation & Cost Drift Audit
  if (
    q.includes('fifo') ||
    q.includes('cost drift') ||
    q.includes('cost basis') ||
    q.includes('inventory valuation') ||
    q.includes('valuation by product') ||
    q.includes('cost layer') ||
    q.includes('first in first out') ||
    q.includes('cost of inventory')
  ) {
    return {
      intent: 'fifo_audit',
      domain: 'fifo_costing',
      timePeriod: 'all_time',
      requiredTools: ['get_fifo_inventory_valuation', 'get_inventory_alerts'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.98,
      primaryGoal: 'Run pure FIFO ledger valuation, layer breakdown, and cost drift audit.',
    };
  }

  // 3. Daily Brief / Morning Briefing
  if (
    q.includes('daily brief') ||
    q.includes('morning brief') ||
    q.includes('start my day') ||
    q.includes('today briefing') ||
    q.includes('today brief') ||
    q.includes('daily report') ||
    q.includes('day report') ||
    q.includes('morning update')
  ) {
    return {
      intent: 'daily_brief',
      domain: 'multi_domain',
      timePeriod: 'today',
      requiredTools: ['get_daily_brief_facts', 'get_today_sales_summary', 'get_inventory_alerts', 'get_customer_balances'],
      suggestedTimeHorizonDays: 1,
      confidence: 0.96,
      primaryGoal: 'Synthesize comprehensive daily executive briefing across today sales, inventory alerts, and debtor follow-ups.',
    };
  }

  // 4. Receivables, Debtors & Unpaid Customer Balances
  if (
    q.includes('who owes') ||
    q.includes('debt') ||
    q.includes('debtor') ||
    q.includes('unpaid') ||
    q.includes('receivable') ||
    q.includes('owing') ||
    q.includes('credit balance') ||
    q.includes('collect money') ||
    q.includes('customers owe') ||
    q.includes('owe me') ||
    q.includes('money owed') ||
    q.includes('pending payment') ||
    q.includes('uncollected')
  ) {
    const isRecommendation = q.includes('who should i call') || q.includes('who to collect') || q.includes('priority');
    return {
      intent: isRecommendation ? 'recommendation' : 'fact_retrieval',
      domain: 'debtors',
      timePeriod: 'all_time',
      requiredTools: ['get_customer_balances'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
      primaryGoal: 'Retrieve outstanding customer debts, credit balances, and debtor contact details.',
    };
  }

  // 5. Inventory, Stockouts & Low-Stock Alerts
  if (
    q.includes('low stock') ||
    q.includes('running low') ||
    q.includes('out of stock') ||
    q.includes('restock') ||
    q.includes('inventory') ||
    q.includes('stock level') ||
    q.includes('stockout') ||
    q.includes('reorder') ||
    q.includes('stock valuation') ||
    q.includes('how much stock') ||
    q.includes('items in stock') ||
    q.includes('depleted')
  ) {
    const isRecommendation = q.includes('what should i restock') || q.includes('what to buy') || q.includes('priority');
    return {
      intent: isRecommendation ? 'recommendation' : 'fact_retrieval',
      domain: 'inventory',
      timePeriod: 'all_time',
      requiredTools: ['get_inventory_alerts', 'get_product_performance'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.94,
      primaryGoal: 'Check stock quantities, identify out-of-stock and low-stock SKUs, and evaluate replenishment urgency.',
    };
  }

  // 6. Product Performance, Top Sellers & Product Margins
  if (
    q.includes('best selling') ||
    q.includes('top product') ||
    q.includes('fastest selling') ||
    q.includes('best seller') ||
    q.includes('highest margin product') ||
    q.includes('most profitable product') ||
    q.includes('margin on product') ||
    q.includes('slow moving') ||
    q.includes('top selling') ||
    q.includes('product sales') ||
    q.includes('product performance') ||
    q.includes('which product')
  ) {
    return {
      intent: 'analysis',
      domain: 'products',
      timePeriod: 'last_30_days',
      requiredTools: ['get_product_performance', 'get_inventory_alerts'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.92,
      primaryGoal: 'Analyze product revenue, unit gross margins, velocity, and catalog performance.',
    };
  }

  // 7. Expenses & Operating Costs
  if (
    q.includes('expense') ||
    q.includes('spending') ||
    q.includes('spent') ||
    q.includes('spending the most') ||
    q.includes('costs') ||
    q.includes('where am i spending') ||
    q.includes('operating expense') ||
    q.includes('cost breakdown') ||
    q.includes('bills') ||
    q.includes('rent') ||
    q.includes('salaries') ||
    q.includes('utilities')
  ) {
    const isMonth = q.includes('this month') || q.includes('month');
    const isWeek = q.includes('this week') || q.includes('week');
    return {
      intent: 'analysis',
      domain: 'expenses',
      timePeriod: isWeek ? 'this_week' : isMonth ? 'this_month' : 'last_30_days',
      requiredTools: ['get_expense_summary'],
      suggestedTimeHorizonDays: isWeek ? 7 : 30,
      confidence: 0.92,
      primaryGoal: 'Analyze operating expenses, cost categories, and major expenditure drivers.',
    };
  }

  // 8. Cash Flow & Liquidity
  if (
    q.includes('cash flow') ||
    q.includes('cash collected') ||
    q.includes('money in') ||
    q.includes('inflow') ||
    q.includes('outflow') ||
    q.includes('net cash') ||
    q.includes('liquidity') ||
    q.includes('deposits') ||
    q.includes('cash vs credit')
  ) {
    return {
      intent: 'analysis',
      domain: 'cash_flow',
      timePeriod: 'last_30_days',
      requiredTools: ['get_cash_flow', 'get_expense_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.9,
      primaryGoal: 'Evaluate cash inflows from payments vs cash outflows from operational expenses.',
    };
  }

  // 9. Profitability, COGS & Margins
  if (
    q.includes('gross margin') ||
    q.includes('net profit') ||
    q.includes('profit margin') ||
    q.includes('profitable') ||
    q.includes('margins') ||
    q.includes('profitability') ||
    q.includes('cogs') ||
    q.includes('cost of goods') ||
    q.includes('gross profit')
  ) {
    return {
      intent: 'analysis',
      domain: 'profitability',
      timePeriod: 'last_30_days',
      requiredTools: ['get_business_overview', 'get_today_sales_summary', 'get_product_performance'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.91,
      primaryGoal: 'Examine gross margin percentage, cost of goods sold, and bottom-line operational profit.',
    };
  }

  // 10. Period Comparisons & Trend Diagnosis
  if (
    q.includes('why are sales') ||
    q.includes('sales down') ||
    q.includes('sales up') ||
    q.includes('compared') ||
    q.includes('compare') ||
    q.includes('vs last') ||
    q.includes('growth') ||
    q.includes('drop in sales') ||
    q.includes('trend') ||
    q.includes('contraction') ||
    q.includes('this week vs last week') ||
    q.includes('this month vs last month')
  ) {
    return {
      intent: 'comparison',
      domain: 'sales',
      timePeriod: 'comparison_period',
      requiredTools: ['get_period_comparison', 'get_sales_summary', 'get_product_performance'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.93,
      primaryGoal: 'Compare current period metrics with previous period to diagnose trends and variations.',
    };
  }

  // 11. Specific "Today" queries
  if (
    q.includes('today') ||
    q.includes('sell today') ||
    q.includes('sold today') ||
    q.includes('sales today') ||
    q.includes('revenue today') ||
    q.includes('profit today') ||
    q.includes('orders today') ||
    q.includes('what did i sell today') ||
    q.includes('how much did i sell today') ||
    q.includes('how are my sales today')
  ) {
    return {
      intent: 'fact_retrieval',
      domain: 'sales',
      timePeriod: 'today',
      requiredTools: ['get_today_sales_summary'],
      suggestedTimeHorizonDays: 1,
      confidence: 0.97,
      primaryGoal: 'Answer exact sales revenue, transaction count, gross profit, and cash collected for today.',
    };
  }

  // 12. Yesterday Queries
  if (
    q.includes('yesterday') ||
    q.includes('sales yesterday') ||
    q.includes('revenue yesterday') ||
    q.includes('sold yesterday')
  ) {
    return {
      intent: 'fact_retrieval',
      domain: 'sales',
      timePeriod: 'yesterday',
      requiredTools: ['get_sales_summary'],
      suggestedTimeHorizonDays: 2,
      confidence: 0.95,
      primaryGoal: 'Answer sales revenue and order counts for yesterday.',
    };
  }

  // 13. Strategic Priorities & Recommendations
  if (
    q.includes('focus on') ||
    q.includes('what should i do') ||
    q.includes('advice') ||
    q.includes('recommend') ||
    q.includes('priority') ||
    q.includes('priorities') ||
    q.includes('how to improve') ||
    q.includes('next step') ||
    q.includes('action plan')
  ) {
    return {
      intent: 'recommendation',
      domain: 'multi_domain',
      timePeriod: 'last_30_days',
      requiredTools: [
        'get_business_overview',
        'get_inventory_alerts',
        'get_customer_balances',
        'get_business_health',
      ],
      suggestedTimeHorizonDays: 30,
      confidence: 0.88,
      primaryGoal: 'Formulate actionable, prioritized business actions grounded in health, inventory, and debtors.',
    };
  }

  // 14. General Sales / Revenue Queries
  if (
    q.includes('sales') ||
    q.includes('revenue') ||
    q.includes('transactions') ||
    q.includes('orders') ||
    q.includes('turnover')
  ) {
    const isWeek = q.includes('this week') || q.includes('week');
    const isMonth = q.includes('this month') || q.includes('month');
    return {
      intent: 'analysis',
      domain: 'sales',
      timePeriod: isWeek ? 'this_week' : isMonth ? 'this_month' : 'last_30_days',
      requiredTools: ['get_sales_summary', 'get_business_overview'],
      suggestedTimeHorizonDays: isWeek ? 7 : 30,
      confidence: 0.9,
      primaryGoal: 'Analyze sales volume, total revenue, and average transaction values for the requested timeframe.',
    };
  }

  // 15. Customer Intelligence
  if (q.includes('customer') || q.includes('clients') || q.includes('buyer')) {
    return {
      intent: 'analysis',
      domain: 'customers',
      timePeriod: 'last_30_days',
      requiredTools: ['get_customer_balances', 'get_sales_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.88,
      primaryGoal: 'Provide registered customer counts, purchasing activity, and receivables.',
    };
  }

  // 16. Default: General Business Overview
  return {
    intent: 'general_overview',
    domain: 'multi_domain',
    timePeriod: 'last_30_days',
    requiredTools: [
      'get_business_overview',
      'get_today_sales_summary',
      'get_inventory_alerts',
      'get_customer_balances',
      'get_business_health',
    ],
    suggestedTimeHorizonDays: 30,
    confidence: 0.8,
    primaryGoal: 'Provide balanced business summary covering revenue, margins, inventory alerts, and debtor balance.',
  };
}
