export type AIIntentCategory =
  | 'greeting'
  | 'conversational'
  | 'navigation'
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
  | 'full_report'
  | 'action_proposal'
  | 'action_confirmation'
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
  | 'conversational'
  | 'multi_domain';

export type AITimePeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_30_days'
  | 'last_90_days'
  | 'all_time'
  | 'multi_period'
  | 'comparison_period';

export interface IntentClassificationResult {
  intent: AIIntentCategory;
  domain: AIBusinessDomain;
  timePeriod: AITimePeriod;
  requiredTools: string[];
  suggestedTimeHorizonDays: number;
  confidence: number;
  primaryGoal: string;
  isEntitySpecific?: boolean;
  entityHint?: string;
  isReportMode?: boolean;
  resolvedContextTopic?: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Intelligent, conversation-aware deterministic intent, domain, and temporal parser.
 * Identifies the exact business intent, maintains conversational context across turns,
 * and determines the MINIMUM relevant business tools required.
 */
export function classifyBusinessQuery(
  query: string,
  history?: ConversationTurn[]
): IntentClassificationResult {
  const q = query.toLowerCase().trim();

  // =========================================================================
  // 1. GREETING & CHIT-CHAT (Zero database retrieval needed)
  // =========================================================================
  const isGreetingOnly =
    /^(hello|hi|hey|good\s+(morning|afternoon|evening|day)|greetings|howdy|salut|bonjour|bon courage|yo|hola)[\s!.,?]*$/i.test(
      q
    ) ||
    /^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+are\s+you|how\s+do\s+you\s+work|what\s+is\s+ursella|help\s+me|help)[\s!.,?]*$/i.test(
      q
    ) ||
    /^(thanks|thank\s+you|merci|great|awesome|understood|got\s+it|ok|okay)[\s!.,?]*$/i.test(
      q
    );

  if (isGreetingOnly) {
    return {
      intent: 'greeting',
      domain: 'conversational',
      timePeriod: 'all_time',
      requiredTools: [],
      suggestedTimeHorizonDays: 0,
      confidence: 0.99,
      primaryGoal: 'Engage warmly and conversationally with the merchant without querying database records.',
    };
  }

  // =========================================================================
  // 2. NAVIGATION INTENTS (Zero database retrieval needed)
  // =========================================================================
  if (
    q.startsWith('take me to ') ||
    q.startsWith('go to ') ||
    q.startsWith('navigate to ') ||
    q.startsWith('open ') ||
    q.startsWith('show me the ') ||
    q === 'take me to inventory' ||
    q === 'go to inventory' ||
    q === 'go to sales' ||
    q === 'open pos' ||
    q === 'open settings'
  ) {
    const isNavigation =
      q.includes('inventory') ||
      q.includes('products') ||
      q.includes('sales') ||
      q.includes('pos') ||
      q.includes('debtors') ||
      q.includes('customers') ||
      q.includes('expenses') ||
      q.includes('settings') ||
      q.includes('dashboard') ||
      q.includes('catalog');

    const isDataInquiry =
      q.includes('how much') ||
      q.includes('why') ||
      q.includes('what is') ||
      q.includes('top') ||
      q.includes('best') ||
      q.includes('most') ||
      q.includes('selling') ||
      q.includes('profit') ||
      q.includes('margin') ||
      q.includes('cost');

    if (isNavigation && !isDataInquiry) {
      return {
        intent: 'navigation',
        domain: 'store_info',
        timePeriod: 'all_time',
        requiredTools: [],
        suggestedTimeHorizonDays: 0,
        confidence: 0.98,
        primaryGoal: 'Guide the merchant directly to the requested application screen.',
      };
    }
  }

  // =========================================================================
  // 3. CONVERSATIONAL MEMORY & ANAPHORA RESOLUTION
  // Understands references to prior messages: "it", "that", "them", "check it",
  // "what about the hoodies?", "compare it with last month", "do that", etc.
  // =========================================================================
  const recentHistory = (history || []).slice(-6);
  const lastUserMsg = [...recentHistory].reverse().find((m) => m.role === 'user')?.content.toLowerCase() || '';
  const lastAssistantMsg = [...recentHistory].reverse().find((m) => m.role === 'assistant')?.content.toLowerCase() || '';

  const isAnaphoraOrContinuation =
    q === 'check it' ||
    q === 'check that' ||
    q === 'check this' ||
    q === 'look into it' ||
    q === 'diagnose it' ||
    q === 'investigate it' ||
    q === 'why is that?' ||
    q === 'why is that' ||
    q === 'why?' ||
    q === 'why' ||
    q.startsWith('what about ') ||
    q.startsWith('how about ') ||
    q.startsWith('and ') ||
    q === 'do that' ||
    q === 'yes' ||
    q === 'go ahead' ||
    q === 'proceed' ||
    q === 'apply it' ||
    q === 'confirm it' ||
    q.includes('compare it') ||
    q.includes('tell me more about that');

  if (isAnaphoraOrContinuation && recentHistory.length > 0) {
    // 3A. Product follow-up: e.g. "What about the hoodies?" or "And the shirts?"
    const productFollowUpMatch = q.match(/^(?:what\s+about|how\s+about|and)\s+(?:the\s+)?([a-z0-9\s_-]+)\??$/i);
    if (productFollowUpMatch) {
      const extractedEntity = productFollowUpMatch[1].trim();
      return {
        intent: 'analysis',
        domain: 'products',
        timePeriod: 'last_30_days',
        requiredTools: ['get_product_performance'],
        suggestedTimeHorizonDays: 30,
        confidence: 0.95,
        isEntitySpecific: true,
        entityHint: extractedEntity,
        resolvedContextTopic: 'product_margin_continuation',
        primaryGoal: `Continue product analysis specifically targeting "${extractedEntity}".`,
      };
    }

    // 3B. Action execution confirmation: e.g. "do that", "go ahead", "yes", "proceed"
    if (q === 'do that' || q === 'yes' || q === 'go ahead' || q === 'proceed' || q === 'apply it') {
      return {
        intent: 'action_confirmation',
        domain: 'products',
        timePeriod: 'all_time',
        requiredTools: ['get_product_performance'],
        suggestedTimeHorizonDays: 1,
        confidence: 0.95,
        resolvedContextTopic: 'action_confirmation',
        primaryGoal: 'Confirm execution of the proposed action discussed in the previous message.',
      };
    }

    // 3C. "Check it" / "Why is that" after sales slowdown or sales pace discussion
    if (
      lastUserMsg.includes('slow') ||
      lastUserMsg.includes('sales') ||
      lastAssistantMsg.includes('slow') ||
      lastAssistantMsg.includes('sales volume') ||
      lastAssistantMsg.includes('product demand')
    ) {
      return {
        intent: 'diagnosis',
        domain: 'sales',
        timePeriod: 'comparison_period',
        requiredTools: ['get_sales_summary', 'get_period_comparison', 'get_inventory_alerts'],
        suggestedTimeHorizonDays: 30,
        confidence: 0.95,
        resolvedContextTopic: 'sales_slowdown_diagnosis',
        primaryGoal: 'Diagnose sales slowdown by checking recent sales trajectory, period comparison, and inventory availability.',
      };
    }

    // 3D. "Check it" after stock/inventory discussion
    if (lastUserMsg.includes('stock') || lastUserMsg.includes('inventory') || lastAssistantMsg.includes('inventory')) {
      return {
        intent: 'diagnosis',
        domain: 'inventory',
        timePeriod: 'all_time',
        requiredTools: ['get_inventory_alerts', 'get_product_performance'],
        suggestedTimeHorizonDays: 30,
        confidence: 0.94,
        resolvedContextTopic: 'inventory_continuation',
        primaryGoal: 'Check inventory stock levels and replenishment priorities from prior context.',
      };
    }

    // 3E. "Check it" after debt/receivables discussion
    if (lastUserMsg.includes('debt') || lastUserMsg.includes('owe') || lastAssistantMsg.includes('debt')) {
      return {
        intent: 'fact_retrieval',
        domain: 'debtors',
        timePeriod: 'all_time',
        requiredTools: ['get_customer_balances'],
        suggestedTimeHorizonDays: 30,
        confidence: 0.95,
        resolvedContextTopic: 'debtor_continuation',
        primaryGoal: 'Inspect customer balances and overdue credit based on preceding discussion.',
      };
    }
  }

  // =========================================================================
  // 4. BUSINESS CONCEPT & EDUCATIONAL EXPLANATIONS (No database retrieval needed)
  // e.g. "Can you explain gross margin?", "What is COGS?", "What is working capital?"
  // =========================================================================
  const isEducationalConcept =
    (q.includes('explain') ||
      q.startsWith('what is ') ||
      q.startsWith('what does ') ||
      q.startsWith('how to calculate ') ||
      q.startsWith('how do you calculate ') ||
      q.startsWith('difference between ')) &&
    (q.includes('gross margin') ||
      q.includes('net profit') ||
      q.includes('profit margin') ||
      q.includes('cogs') ||
      q.includes('cost of goods') ||
      q.includes('fifo') ||
      q.includes('working capital') ||
      q.includes('markup') ||
      q.includes('break even') ||
      q.includes('breakeven') ||
      q.includes('cash flow') ||
      q.includes('depreciation') ||
      q.includes('inventory turnover') ||
      q.includes('safety stock')) &&
    !q.includes('my ') &&
    !q.includes('our ') &&
    !q.includes('store') &&
    !q.includes('business') &&
    !q.includes('today') &&
    !q.includes('this month');

  if (isEducationalConcept) {
    return {
      intent: 'explanation',
      domain: 'profitability',
      timePeriod: 'all_time',
      requiredTools: [], // ZERO database retrieval!
      suggestedTimeHorizonDays: 0,
      confidence: 0.98,
      primaryGoal: 'Provide a clear, conversational explanation of the business financial concept with practical examples, without querying store database records.',
    };
  }

  // =========================================================================
  // 5. AGENT ACTION INTENTS (HUMAN-IN-THE-LOOP TASK PROPOSALS)
  // Detects explicit requests to perform a task: expenses, restock, catalog,
  // debt payments, customer reminders, and business tasks.
  // =========================================================================

  // 5a. Expense Logging
  const isExpenseAction =
    q.startsWith('spent ') ||
    q.startsWith('pay ') ||
    q.startsWith('paid ') ||
    q.startsWith('dépensé ') ||
    q.startsWith('depense ') ||
    q.startsWith('payé ') ||
    q.startsWith('payer ') ||
    q.includes('log expense') ||
    q.includes('record expense') ||
    q.includes('add expense') ||
    q.includes('new expense') ||
    q.includes('expense of') ||
    q.includes('enregistrer une dépense') ||
    q.includes('enregistrer dépense') ||
    q.includes('noter une dépense') ||
    q.includes('noter dépense') ||
    q.includes('ajouter une dépense') ||
    q.includes('ajouter dépense') ||
    q.includes('dépense de');

  if (isExpenseAction) {
    return {
      intent: 'action_proposal',
      domain: 'expenses',
      timePeriod: 'today',
      requiredTools: ['get_expense_summary', 'get_today_sales_summary'],
      suggestedTimeHorizonDays: 1,
      confidence: 0.98,
      isEntitySpecific: false,
      primaryGoal: 'Parse expense amount, category, payment method, description, and prepare proposedAction for merchant confirmation.',
    };
  }

  // 5b. Customer Payment / Debt Settlement
  const isPaymentAction =
    q.includes('record payment') ||
    q.includes('received payment') ||
    q.includes('settle debt') ||
    q.includes('paid debt') ||
    q.includes('paid balance') ||
    q.includes('paid their balance') ||
    q.includes('paid part of') ||
    q.includes('customer paid') ||
    q.includes('paid me') ||
    q.includes('enregistrer le paiement') ||
    q.includes('enregistrer un paiement') ||
    q.includes('reçu le paiement') ||
    q.includes('reçu un paiement') ||
    q.includes('a payé sa dette') ||
    q.includes('a réglé') ||
    q.includes('régler la dette') ||
    q.includes('regler sa dette') ||
    q.includes('verser un acompte');

  if (isPaymentAction) {
    return {
      intent: 'action_proposal',
      domain: 'debtors',
      timePeriod: 'all_time',
      requiredTools: ['get_customer_balances', 'get_today_sales_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.98,
      isEntitySpecific: true,
      primaryGoal: 'Match customer from debtor ledger, extract payment amount, and prepare proposedAction for debt payment record.',
    };
  }

  // 5c. Customer Follow-up / WhatsApp Payment Reminder
  const isCustomerReminderAction =
    q.startsWith('send reminder') ||
    q.startsWith('remind customer') ||
    q.startsWith('message customer') ||
    q.includes('send reminder to') ||
    q.includes('whatsapp reminder') ||
    q.includes('draft reminder') ||
    q.includes('remind customer') ||
    q.includes('envoyer un rappel') ||
    q.includes('rappeler à') ||
    q.includes('rappeler au client') ||
    q.includes('relancer le client') ||
    q.includes('relancer ') ||
    q.includes('message de rappel pour');

  if (isCustomerReminderAction) {
    return {
      intent: 'action_proposal',
      domain: 'customers',
      timePeriod: 'all_time',
      requiredTools: ['get_customer_balances'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.98,
      isEntitySpecific: true,
      primaryGoal: 'Retrieve customer contact and unpaid balance, draft polite reminder text, and prepare proposedAction for WhatsApp follow-up.',
    };
  }

  // 5d. Business Reminders & Tasks
  const isReminderAction =
    q.startsWith('remind me') ||
    q.startsWith('set reminder') ||
    q.startsWith('create reminder') ||
    q.startsWith('create task') ||
    q.startsWith('add task') ||
    q.startsWith('rappelle-moi') ||
    q.startsWith('rappelle moi') ||
    q.startsWith('mettre un rappel') ||
    q.startsWith('créer un rappel') ||
    q.startsWith('créer une tâche') ||
    q.includes('remind me to') ||
    q.includes('set a reminder') ||
    q.includes('create a reminder');

  if (isReminderAction) {
    return {
      intent: 'action_proposal',
      domain: 'store_info',
      timePeriod: 'today',
      requiredTools: ['get_today_sales_summary'],
      suggestedTimeHorizonDays: 7,
      confidence: 0.98,
      isEntitySpecific: false,
      primaryGoal: 'Extract task title, target deadline, priority, and prepare proposedAction for business reminder creation.',
    };
  }

  // 5e. Product Creation, Restock, Inventory Adjustment
  const isProductOrStockAction =
    q.startsWith('add ') ||
    q.startsWith('create ') ||
    q.startsWith('register ') ||
    q.startsWith('new product') ||
    q.startsWith('ajouter ') ||
    q.startsWith('créer ') ||
    q.includes('add product') ||
    q.includes('create product') ||
    q.includes('new product') ||
    q.includes('add new item') ||
    q.includes('add to inventory') ||
    q.includes('add to catalog') ||
    q.includes('add stock') ||
    q.includes('restock') ||
    q.includes('reapprovisionner') ||
    q.includes('adjust stock') ||
    q.includes('write off') ||
    q.includes('damaged stock') ||
    q.includes('abîmé') ||
    q.includes('perte');

  if (isProductOrStockAction) {
    // Extract entity name if possible (e.g. "Add 20 units of Milo" -> Milo)
    let extractedEntity: string | undefined;
    const addUnitsMatch = q.match(/add\s+\d+\s*(?:units?|pcs?|items?|bags?|cartons?|kg|bottles?|pieces?)?\s*(?:of\s+)?([a-z0-9\s_-]+)/i);
    if (addUnitsMatch) {
      extractedEntity = addUnitsMatch[1].trim();
    }

    return {
      intent: 'action_proposal',
      domain: 'products',
      timePeriod: 'all_time',
      requiredTools: ['get_product_performance'], // Only product catalog needed!
      suggestedTimeHorizonDays: 30,
      confidence: 0.98,
      isEntitySpecific: Boolean(extractedEntity),
      entityHint: extractedEntity,
      primaryGoal: 'Validate product catalog entry, check existing stock or price parameters, and prepare proposedAction for confirmation.',
    };
  }

  // =========================================================================
  // 6. FULL BUSINESS ANALYSIS & REPORT MODE (Explicitly requested by user)
  // =========================================================================
  const isExplicitReportRequested =
    q.includes('full business analysis') ||
    q.includes('full analysis') ||
    q.includes('detailed performance report') ||
    q.includes('comprehensive diagnostics') ||
    q.includes('detailed report') ||
    q.includes('business overview report') ||
    q.includes('comprehensive analysis') ||
    q.includes('full report') ||
    q.includes('complete business analysis');

  if (isExplicitReportRequested) {
    return {
      intent: 'full_report',
      domain: 'multi_domain',
      timePeriod: 'last_30_days',
      isReportMode: true,
      requiredTools: [
        'get_business_overview',
        'get_today_sales_summary',
        'get_inventory_alerts',
        'get_customer_balances',
        'get_business_health',
      ],
      suggestedTimeHorizonDays: 30,
      confidence: 0.99,
      primaryGoal: 'Generate an in-depth, comprehensive executive report with structured sections as explicitly requested by the merchant.',
    };
  }

  // =========================================================================
  // 7. BEST-SELLING PRODUCTS & PRODUCT-SPECIFIC INQUIRIES
  // Retrieve relevant sales/product data only.
  // =========================================================================
  const isBestSellingOrProductMargin =
    q.includes('best selling') ||
    q.includes('best-selling') ||
    q.includes('top product') ||
    q.includes('top products') ||
    q.includes('top selling') ||
    q.includes('top-selling') ||
    q.includes('best sellers') ||
    q.includes('best-sellers') ||
    q.includes('best seller') ||
    q.includes('best-seller') ||
    q.includes('top seller') ||
    q.includes('top sellers') ||
    q.includes('top-sellers') ||
    q.includes('top items') ||
    q.includes('top item') ||
    q.includes('top-selling items') ||
    q.includes('top selling items') ||
    q.includes('best-selling products') ||
    q.includes('best selling products') ||
    q.includes('fastest selling') ||
    q.includes('fastest-selling') ||
    q.includes('fast moving') ||
    q.includes('fast-moving') ||
    q.includes('most sold') ||
    q.includes('most popular') ||
    q.includes('popular product') ||
    q.includes('popular products') ||
    q.includes('makes me the most money') ||
    q.includes('make me the most money') ||
    q.includes('most profitable product') ||
    q.includes('most profitable products') ||
    q.includes('highest margin product') ||
    q.includes('highest margin products') ||
    q.includes('highest profit product') ||
    q.includes('highest profit products') ||
    q.includes('which product') ||
    q.includes('what product') ||
    q.includes('which products') ||
    q.includes('what products') ||
    q.includes('product performance') ||
    q.includes('products performance') ||
    q.includes('slow moving product') ||
    q.includes('slow moving products') ||
    q.includes('slow-moving product') ||
    q.includes('slow-moving products') ||
    q.includes('meilleur produit') ||
    q.includes('meilleurs produits') ||
    q.includes('plus vendu') ||
    q.includes('plus vendus') ||
    q.includes('produit le plus vendu') ||
    q.includes('produits les plus vendus') ||
    q.includes('meilleure vente') ||
    q.includes('meilleures ventes') ||
    q.includes('top ventes') ||
    q.includes('top vente') ||
    q.includes('articles les plus vendus') ||
    q.includes('plus rentable') ||
    q.includes('plus rentables') ||
    q.includes('produit le plus rentable') ||
    q.includes('produits les plus rentables') ||
    q.includes('quel produit') ||
    q.includes('quels produits');

  if (isBestSellingOrProductMargin) {
    return {
      intent: 'analysis',
      domain: 'products',
      timePeriod: 'last_30_days',
      requiredTools: ['get_product_performance', 'get_today_sales_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.98,
      isEntitySpecific: false,
      primaryGoal: 'Retrieve product sales velocity, volume, ranking, and unit economics to answer top-selling and profitable product inquiries directly with exact product names, units sold, and margins.',
    };
  }

  // =========================================================================
  // 8. SPECIFIC TIME-BOUND SALES & REVENUE
  // =========================================================================

  // 8A. Today's sales only
  if (
    q.includes('today') ||
    q.includes('sell today') ||
    q.includes('sold today') ||
    q.includes('sales today') ||
    q.includes('revenue today') ||
    q.includes('orders today') ||
    q.includes("aujourd'hui") ||
    q.includes('aujourdhui') ||
    q.includes('ce jour') ||
    q.includes('ventes du jour') ||
    q.includes('chiffre du jour') ||
    q.includes('recette du jour') ||
    q.includes('caisse aujourd')
  ) {
    return {
      intent: 'fact_retrieval',
      domain: 'sales',
      timePeriod: 'today',
      requiredTools: ['get_today_sales_summary'], // Today only!
      suggestedTimeHorizonDays: 1,
      confidence: 0.98,
      primaryGoal: 'Retrieve today sales revenue, transaction count, and orders directly.',
    };
  }

  // 8B. Yesterday's sales only
  if (
    q.includes('yesterday') ||
    q.includes('sales yesterday') ||
    q.includes('sold yesterday') ||
    q.includes('hier') ||
    q.includes("ventes d'hier") ||
    q.includes('ventes hier')
  ) {
    return {
      intent: 'fact_retrieval',
      domain: 'sales',
      timePeriod: 'yesterday',
      requiredTools: ['get_sales_summary'], // Sales summary only!
      suggestedTimeHorizonDays: 2,
      confidence: 0.95,
      primaryGoal: 'Retrieve sales revenue and orders for yesterday.',
    };
  }

  // 8C. Profitability & Earnings ("What is my profit?", "Net profit", "Gross margin")
  if (
    q.includes('what is my profit') ||
    q.includes('how much profit') ||
    q.includes('net profit') ||
    q.includes('gross profit') ||
    q.includes('profitability') ||
    q.includes('am i profitable') ||
    q.includes('am i making profit') ||
    q.includes('make a profit') ||
    q.includes('earnings') ||
    q.includes('how much did i earn') ||
    q.includes('mon bénéfice') ||
    q.includes('mon benefice') ||
    q.includes('ma marge') ||
    q.includes('bénéfice net') ||
    q.includes('marge brute') ||
    q.includes('rentabilité') ||
    q.includes('suis-je rentable') ||
    q.includes('combien ai-je gagné') ||
    q.includes('combien ai je gagne')
  ) {
    const isToday = q.includes('today') || q.includes("aujourd'hui");
    const isThisMonth = q.includes('month') || q.includes('mois');
    const isAllTime = q.includes('all time') || q.includes('total') || q.includes('ever') || q.includes('tout le temps');
    const period = isToday ? 'today' : isThisMonth ? 'this_month' : isAllTime ? 'all_time' : 'last_30_days';

    return {
      intent: 'calculation',
      domain: 'profitability',
      timePeriod: period,
      requiredTools: ['get_financial_ledger', 'get_business_overview', 'get_expense_summary'],
      suggestedTimeHorizonDays: isToday ? 1 : 30,
      confidence: 0.98,
      primaryGoal: 'Calculate exact gross profit, FIFO COGS, operating expenses, and net profit with deterministic arithmetic.',
    };
  }

  // 8D. Specific Time-Bound Sales & Revenue ("This month", "This week", "This year", "All time", "Total sales")
  if (
    q.includes('this month') ||
    q.includes('make this month') ||
    q.includes('made this month') ||
    q.includes('monthly sales') ||
    q.includes('this week') ||
    q.includes('weekly sales') ||
    q.includes('this year') ||
    q.includes('annual sales') ||
    q.includes('total sales') ||
    q.includes('all time sales') ||
    q.includes('how much did i sell') ||
    q.includes('how much have i sold') ||
    q.includes('ce mois') ||
    q.includes('cette semaine') ||
    q.includes('cette année') ||
    q.includes('ventes du mois') ||
    q.includes('ventes de la semaine') ||
    q.includes('chiffre d affaires') ||
    q.includes("chiffre d'affaires") ||
    q.includes('combien ai-je vendu') ||
    q.includes('combien ai je vendu')
  ) {
    let period: AITimePeriod = 'last_30_days';
    let days = 30;
    if (q.includes('this week') || q.includes('weekly') || q.includes('cette semaine')) {
      period = 'this_week';
      days = 7;
    } else if (q.includes('this year') || q.includes('annual') || q.includes('cette année')) {
      period = 'this_year';
      days = 365;
    } else if (q.includes('all time') || q.includes('total') || q.includes('tout le temps')) {
      period = 'all_time';
      days = 365;
    } else if (q.includes('this month') || q.includes('monthly') || q.includes('ce mois')) {
      period = 'this_month';
      days = 30;
    }

    return {
      intent: 'fact_retrieval',
      domain: 'sales',
      timePeriod: period,
      requiredTools: ['get_financial_ledger', 'get_sales_summary'],
      suggestedTimeHorizonDays: days,
      confidence: 0.96,
      primaryGoal: `Retrieve recorded sales and financial ledger for ${period.replace(/_/g, ' ')}.`,
    };
  }

  // 8E. General Sales Queries ("How are my sales?", "Sales slowdown", "Sales performance")
  if (
    q.includes('sales have been slow') ||
    q.includes('sales are slow') ||
    q.includes('slow lately') ||
    q.includes('how are my sales doing') ||
    q.includes('how are sales doing') ||
    q.includes('how are my sales') ||
    q.includes('how are sales') ||
    q.includes('what are my sales') ||
    q.includes('sales drop') ||
    q.includes('drop in sales') ||
    q.includes('sales down') ||
    q.includes('sales report') ||
    q.includes('sales summary') ||
    q.includes('sales overview') ||
    q.includes('mes ventes') ||
    q.includes('comment vont mes ventes') ||
    q.includes('comment se portent mes ventes') ||
    q.includes('rapport des ventes') ||
    q.includes('baisse des ventes')
  ) {
    return {
      intent: 'analysis',
      domain: 'sales',
      timePeriod: 'comparison_period',
      requiredTools: ['get_financial_ledger', 'get_sales_summary', 'get_today_sales_summary', 'get_period_comparison'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      primaryGoal: 'Analyze sales performance across today and the broader period with comparison metrics.',
    };
  }

  // 8F. "Why did my profit drop?"
  if (
    q.includes('why did my profit drop') ||
    q.includes('why did profit drop') ||
    q.includes('profit drop') ||
    q.includes('profit down')
  ) {
    return {
      intent: 'diagnosis',
      domain: 'profitability',
      timePeriod: 'comparison_period',
      requiredTools: ['get_financial_ledger', 'get_business_overview', 'get_period_comparison', 'get_expense_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
      primaryGoal: 'Diagnose profit change by comparing revenue, COGS, and operating expenses against previous period.',
    };
  }

  // =========================================================================
  // 9. INVENTORY & STOCKOUTS ("Which products are low on stock?", "Stock value")
  // =========================================================================
  if (
    q.includes('low stock') ||
    q.includes('running low') ||
    q.includes('out of stock') ||
    q.includes('inventory') ||
    q.includes('stock level') ||
    q.includes('items in stock') ||
    q.includes('how much stock') ||
    q.includes('depleted') ||
    q.includes('stockout') ||
    q.includes('inventory value') ||
    q.includes('stock value') ||
    q.includes('inventory health') ||
    q.includes('stock faible') ||
    q.includes('rupture de stock') ||
    q.includes('ruptures') ||
    q.includes('produits en rupture') ||
    q.includes('valeur de mon stock') ||
    q.includes('valeur du stock') ||
    q.includes('état du stock') ||
    q.includes('niveau de stock')
  ) {
    return {
      intent: 'fact_retrieval',
      domain: 'inventory',
      timePeriod: 'all_time',
      requiredTools: ['get_inventory_health', 'get_inventory_alerts'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      primaryGoal: 'Provide comprehensive inventory health, valuation, and stockout replenishment alerts.',
    };
  }

  // =========================================================================
  // 10. CUSTOMER RECEIVABLES & DEBTORS ("Who owes me money?")
  // =========================================================================
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
    q.includes('qui me doit') ||
    q.includes('débiteur') ||
    q.includes('debiteur') ||
    q.includes('débiteurs') ||
    q.includes('debiteurs') ||
    q.includes('créance') ||
    q.includes('creance') ||
    q.includes('créances') ||
    q.includes('dettes clients') ||
    q.includes('dette') ||
    q.includes('impayé') ||
    q.includes('impayes') ||
    q.includes('impayés')
  ) {
    return {
      intent: 'fact_retrieval',
      domain: 'debtors',
      timePeriod: 'all_time',
      requiredTools: ['get_debtor_and_receivables_summary', 'get_customer_balances'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      primaryGoal: 'Retrieve outstanding customer receivables and debtor balances.',
    };
  }

  // =========================================================================
  // 11. EXPENSES & OPERATING COSTS
  // =========================================================================
  if (
    q.includes('expense') ||
    q.includes('spending') ||
    q.includes('spent') ||
    q.includes('costs') ||
    q.includes('operating cost') ||
    q.includes('where am i spending') ||
    q.includes('dépense') ||
    q.includes('depense') ||
    q.includes('dépenses') ||
    q.includes('depenses') ||
    q.includes('charges') ||
    q.includes('frais') ||
    q.includes('combien ai-je dépensé') ||
    q.includes('combien ai je depense')
  ) {
    return {
      intent: 'analysis',
      domain: 'expenses',
      timePeriod: 'this_month',
      requiredTools: ['get_expense_breakdown', 'get_expense_summary'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.95,
      primaryGoal: 'Retrieve operating expenditures and cost category breakdowns.',
    };
  }

  // =========================================================================
  // 12. CASH FLOW & LIQUIDITY
  // =========================================================================
  if (
    q.includes('cash flow') ||
    q.includes('cash collected') ||
    q.includes('liquidity') ||
    q.includes('money in') ||
    q.includes('inflow') ||
    q.includes('flux de trésorerie') ||
    q.includes('tresorerie') ||
    q.includes('trésorerie') ||
    q.includes('liquidités') ||
    q.includes('liquidites')
  ) {
    return {
      intent: 'analysis',
      domain: 'cash_flow',
      timePeriod: 'last_30_days',
      requiredTools: ['get_cash_flow'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.92,
      primaryGoal: 'Evaluate cash inflows vs operational outflows.',
    };
  }

  // =========================================================================
  // 13. FIFO AUDIT
  // =========================================================================
  if (
    q.includes('fifo') ||
    q.includes('peps') ||
    q.includes('cost drift') ||
    q.includes('cost basis') ||
    q.includes('inventory valuation') ||
    q.includes('cost layer') ||
    q.includes('lots de coût') ||
    q.includes('lots de cout')
  ) {
    return {
      intent: 'fifo_audit',
      domain: 'fifo_costing',
      timePeriod: 'all_time',
      requiredTools: ['get_fifo_inventory_valuation', 'get_inventory_health'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.97,
      primaryGoal: 'Run FIFO inventory valuation and layer inspection.',
    };
  }

  // =========================================================================
  // 14. STORE IDENTITY & METADATA
  // =========================================================================
  if (
    q.includes('business name') ||
    q.includes('store name') ||
    q.includes('operating currency') ||
    q.includes('what currency') ||
    q.includes('timezone') ||
    q.includes('who am i') ||
    q.includes('nom de la boutique') ||
    q.includes('mon commerce')
  ) {
    return {
      intent: 'identity_lookup',
      domain: 'store_info',
      timePeriod: 'all_time',
      requiredTools: ['get_business_overview'],
      suggestedTimeHorizonDays: 1,
      confidence: 0.98,
      primaryGoal: 'Answer store configuration, name, currency, or timezone.',
    };
  }

  // =========================================================================
  // 15. BUSINESS HEALTH & HOLISTIC OVERVIEW
  // =========================================================================
  if (
    q.includes('how is my business') ||
    q.includes('how is the business') ||
    q.includes('business doing') ||
    q.includes('store doing') ||
    q.includes('business health') ||
    q.includes('store health') ||
    q.includes('business status') ||
    q.includes('give me an update') ||
    q.includes('business update') ||
    q.includes('store overview') ||
    q.includes('business overview') ||
    q.includes('comment va mon commerce') ||
    q.includes('comment se porte mon entreprise') ||
    q.includes('comment se porte mon commerce') ||
    q.includes('santé de mon entreprise') ||
    q.includes('bilan global') ||
    q.includes('bilan général') ||
    q.includes('situation globale') ||
    q.includes('situation de mon commerce')
  ) {
    return {
      intent: 'analysis',
      domain: 'multi_domain',
      timePeriod: 'last_30_days',
      requiredTools: ['get_financial_ledger', 'get_today_sales_summary', 'get_business_health', 'get_inventory_health'],
      suggestedTimeHorizonDays: 30,
      confidence: 0.96,
      primaryGoal: 'Synthesize holistic business health spanning sales, profit, inventory, and operations.',
    };
  }

  // =========================================================================
  // 16. DEFAULT CONVERSATIONAL BUSINESS FALLBACK
  // For open-ended queries, provide both today's pulse and the 30-day financial ledger
  // so Ursella understands both the immediate daily activity and the broader business operating system.
  // =========================================================================
  return {
    intent: 'conversational',
    domain: 'multi_domain',
    timePeriod: 'multi_period',
    requiredTools: ['get_today_sales_summary', 'get_financial_ledger', 'get_product_performance'],
    suggestedTimeHorizonDays: 30,
    confidence: 0.90,
    primaryGoal: 'Respond naturally with complete awareness of today activity, the broader business financial state, and core product performance.',
  };
}
