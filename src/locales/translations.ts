export type SupportedLanguage = 'en' | 'fr';

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    search: string;
    filter: string;
    export: string;
    import: string;
    confirm: string;
    back: string;
    actions: string;
    viewAll: string;
    retry: string;
    offline: string;
    online: string;
    date: string;
    total: string;
    status: string;
    active: string;
    beta: string;
    demoStore: string;
    language: string;
    switchToFrench: string;
    switchToEnglish: string;
    success: string;
    error: string;
    all: string;
    none: string;
    notes: string;
    optional: string;
    required: string;
    download: string;
    print: string;
    share: string;
    copy: string;
    copied: string;
  };
  navigation: {
    home: string;
    sell: string;
    pos: string;
    inventory: string;
    catalog: string;
    customers: string;
    crm: string;
    notes: string;
    analytics: string;
    reports: string;
    expenses: string;
    aiAdvisor: string;
    proactiveAI: string;
    dataHub: string;
    billing: string;
    settings: string;
    menu: string;
    logout: string;
  };
  dashboard: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    partner: string;
    overviewSubtitle: string;
    fullAnalyticsBtn: string;
    quickShortcuts: string;
    newSaleTitle: string;
    newSaleDesc: string;
    inventoryTitle: string;
    inventoryDesc: string;
    customersTitle: string;
    customersDesc: string;
    analyticsTitle: string;
    analyticsDesc: string;
    salesRevenue: string;
    grossProfit: string;
    operatingExpenses: string;
    estimatedNetProfit: string;
    topProductsTitle: string;
    viewAllProducts: string;
    unitsSold: string;
    profit: string;
    noSalesPeriod: string;
    noSalesPeriodDesc: string;
    launchPosBtn: string;
    aiOperatingLayer: string;
    aiLiveConnected: string;
    aiLayerDesc: string;
    chatWithAiBtn: string;
    stockAlertsTitle: string;
    lowStock: string;
    outOfStock: string;
    stockListBtn: string;
    customerReceivablesTitle: string;
    ledgersBtn: string;
    refreshing: string;
    releaseToRefresh: string;
    swipeToRefresh: string;
    timeframes: {
      today: string;
      last7Days: string;
      last30Days: string;
      thisMonth: string;
    };
    noBusinessFound: string;
    noBusinessDesc: string;
    createBusinessBtn: string;
  };
  landing: {
    heroBadge: string;
    heroTag: string;
    heroTitle: string;
    heroTitlePrefix: string;
    heroTitleHighlight: string;
    heroTitleSuffix: string;
    heroSubtitle: string;
    exploreDemo: string;
    startFree: string;
    createAccount: string;
    signIn: string;
    signUp: string;
    noCardNeeded: string;
    multiCurrency: string;
    offlinePwa: string;
    noCard: string;
    featuresTitle: string;
    featuresSubtitle: string;
    posFeatureTitle: string;
    posFeatureDesc: string;
    posFeatureMetric: string;
    fifoFeatureTitle: string;
    fifoFeatureDesc: string;
    fifoFeatureMetric: string;
    financeFeatureTitle: string;
    financeFeatureDesc: string;
    financeFeatureMetric: string;
    aiBannerTitle: string;
    aiBannerDesc: string;
    aiBannerBtn: string;
    aiFeatureTitle: string;
    aiFeatureDesc: string;
    debtorsFeatureTitle: string;
    debtorsFeatureDesc: string;
    receiptsTitle: string;
    receiptsDesc: string;
    momoTitle: string;
    momoDesc: string;
    pnlTitle: string;
    pnlDesc: string;
    securityTitle: string;
    securityDesc: string;
    proactiveTitle: string;
    proactiveDesc: string;
    teamTitle: string;
    teamDesc: string;
    footerTagline: string;
  };
  pos: {
    newSale: string;
    quickSell: string;
    cart: string;
    cartEmpty: string;
    subtotal: string;
    discount: string;
    tax: string;
    totalToPay: string;
    cashPayment: string;
    momoPayment: string;
    creditPayment: string;
    splitPayment: string;
    completeSale: string;
    amountTendered: string;
    changeDue: string;
    selectCustomer: string;
    walkInCustomer: string;
    printReceipt: string;
    whatsappReceipt: string;
    barcodeScan: string;
    outOfStockWarning: string;
    itemAdded: string;
    salesHistory: string;
    terminal: string;
    allCategories: string;
    searchProductsPlaceholder: string;
    itemsCount: string;
    clearCart: string;
    checkoutSummary: string;
    paymentMethod: string;
    paymentRef: string;
    paymentRefPlaceholder: string;
    saleNotes: string;
    saleNotesPlaceholder: string;
    customItem: string;
    customItemName: string;
    customItemPrice: string;
    addCustomItem: string;
    closeRegister: string;
    hardwareSettings: string;
    managerApprovalRequired: string;
    managerPinPlaceholder: string;
    approveOverride: string;
    discountExceedsMax: string;
  };
  inventory: {
    products: string;
    addProduct: string;
    editProduct: string;
    sku: string;
    productName: string;
    sellingPrice: string;
    costPrice: string;
    stockQuantity: string;
    lowStockThreshold: string;
    category: string;
    costLots: string;
    fifoValuation: string;
    retailValuation: string;
    lowStockAlert: string;
    outOfStock: string;
    healthyStock: string;
    restock: string;
    adjustStock: string;
    searchPlaceholder: string;
    allCategories: string;
    addCategory: string;
    valuationSummary: string;
    totalActiveSkus: string;
    fifoCostBasis: string;
    stockAdjustments: string;
    reasonLoss: string;
    reasonDamage: string;
    reasonAudit: string;
    reasonReturn: string;
    barcodeOrSku: string;
    batchLots: string;
    lotDate: string;
    lotSupplier: string;
    lotQty: string;
    lotCost: string;
    deleteProductConfirm: string;
  };
  customers: {
    title: string;
    addCustomer: string;
    customerName: string;
    phone: string;
    email: string;
    totalDebt: string;
    outstandingBalance: string;
    creditLimit: string;
    recordPayment: string;
    sendDebtReminder: string;
    purchaseHistory: string;
    searchPlaceholder: string;
    allCustomers: string;
    debtorsOnly: string;
    totalReceivables: string;
    activeAccounts: string;
    allowCredit: string;
    creditMaxLimit: string;
    customerNotes: string;
    paymentAmount: string;
    paymentMethod: string;
    confirmPayment: string;
    reminderSent: string;
    reminderMessageTemplate: string;
    noCustomersFound: string;
  };
  finance: {
    revenue: string;
    grossProfit: string;
    grossMargin: string;
    netProfit: string;
    cogs: string;
    operatingExpenses: string;
    cashInHand: string;
    todaySales: string;
    thisMonth: string;
    thisWeek: string;
    allTime: string;
    addExpense: string;
    expenseCategory: string;
    expenseAmount: string;
    expenseDescription: string;
    expenseDate: string;
    recordedBy: string;
    categories: {
      rent: string;
      utilities: string;
      salaries: string;
      transport: string;
      supplies: string;
      marketing: string;
      taxes: string;
      other: string;
    };
  };
  analytics: {
    title: string;
    subtitle: string;
    revenueTrends: string;
    marginEvolution: string;
    hourlyVelocity: string;
    categoryContribution: string;
    deadStockAnalysis: string;
    deadStockDescription: string;
    deadStockHealthy: string;
    anomaliesDetected: string;
    noAnomalies: string;
    paymentMethodSplit: string;
    customerRetention: string;
    periodComparison: string;
  };
  reports: {
    title: string;
    subtitle: string;
    profitAndLoss: string;
    cashFlowStatement: string;
    taxEstimate: string;
    dateRange: string;
    downloadPdf: string;
    downloadCsv: string;
    grossSalesRevenue: string;
    returnsAndDiscounts: string;
    netSalesRevenue: string;
    cogsFifo: string;
    grossProfitMargin: string;
    operatingExpensesTotal: string;
    netOperatingProfit: string;
    estimatedTaxPayable: string;
    registerCloseoutTitle: string;
    registerCloseoutDesc: string;
    cashCounted: string;
    momoCounted: string;
    discrepancy: string;
  };
  aiAdvisor: {
    title: string;
    subtitle: string;
    inputPlaceholder: string;
    askPrompt: string;
    listening: string;
    analyzing: string;
    dailyBrief: string;
    diagnosticTitle: string;
    suggestionsTitle: string;
    followUpTitle: string;
    clearChat: string;
    samplePrompts: {
      overview: string;
      salesToday: string;
      inventoryCheck: string;
      debtorsCheck: string;
      profitDiagnosis: string;
      topProducts: string;
    };
    languageNotice: string;
  };
  dataHub: {
    title: string;
    subtitle: string;
    exportCatalog: string;
    exportSales: string;
    exportCustomers: string;
    importCatalog: string;
    importCsvDesc: string;
    cloudBackup: string;
    cloudBackupDesc: string;
    downloadTemplate: string;
    uploadFile: string;
    syncStatus: string;
  };
  billing: {
    title: string;
    subtitle: string;
    currentPlan: string;
    freeTrial: string;
    starterPlan: string;
    proPlan: string;
    enterprisePlan: string;
    upgradePlan: string;
    monthly: string;
    annual: string;
    saveAnnual: string;
    payWithMomo: string;
    payWithCard: string;
    activeFeatures: string;
    unlimitedTransactions: string;
    fifoValuation: string;
    aiAdvisorUnlimited: string;
    multiUserRoles: string;
    offlinePwaSupport: string;
  };
  settings: {
    title: string;
    storeProfile: string;
    storeName: string;
    businessType: string;
    currency: string;
    phone: string;
    address: string;
    taxNumber: string;
    receiptHeader: string;
    receiptFooter: string;
    hardwarePrinters: string;
    printerType: string;
    thermal58: string;
    thermal80: string;
    bluetooth: string;
    usb: string;
    network: string;
    teamAndRoles: string;
    addTeamMember: string;
    securityPin: string;
    changePin: string;
    dangerZone: string;
    resetSampleData: string;
    resetSampleDataDesc: string;
  };
  auth: {
    welcomeBack: string;
    signInSubtitle: string;
    emailLabel: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    fullNameLabel: string;
    phoneLabel: string;
    staySignedIn: string;
    forgotPassword: string;
    signInBtn: string;
    instantDemoBtn: string;
    dontHaveAccount: string;
    createAccount: string;
    signUpTitle: string;
    signUpSubtitle: string;
    createAccountBtn: string;
    alreadyHaveAccount: string;
  };
}

export const enTranslations: Translations = {
  common: {
    appName: 'Ursella',
    tagline: 'Retail & Business Operating System',
    loading: 'Loading system...',
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    search: 'Search...',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    confirm: 'Confirm',
    back: 'Back',
    actions: 'Actions',
    viewAll: 'View All',
    retry: 'Retry',
    offline: 'Offline Mode Active',
    online: 'Connected',
    date: 'Date',
    total: 'Total',
    status: 'Status',
    active: 'Active',
    beta: 'BETA',
    demoStore: 'Explore Demo',
    language: 'Language',
    switchToFrench: 'Passer en Français',
    switchToEnglish: 'Switch to English',
    success: 'Success',
    error: 'Error',
    all: 'All',
    none: 'None',
    notes: 'Notes',
    optional: 'Optional',
    required: 'Required',
    download: 'Download',
    print: 'Print',
    share: 'Share',
    copy: 'Copy',
    copied: 'Copied!',
  },
  navigation: {
    home: 'Home',
    sell: 'Sell (POS)',
    pos: 'POS Register',
    inventory: 'Stock & Catalog',
    catalog: 'Products',
    customers: 'Customers & CRM',
    crm: 'Debtors Ledger',
    notes: 'Notes & Memos',
    analytics: 'Analytics',
    reports: 'Financial Reports',
    expenses: 'Expenses',
    aiAdvisor: 'Ursa',
    proactiveAI: 'Proactive AI',
    dataHub: 'Data Hub',
    billing: 'Billing & Plan',
    settings: 'Settings',
    menu: 'Menu',
    logout: 'Sign Out',
  },
  dashboard: {
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    partner: 'Partner',
    overviewSubtitle: 'Operational and business intelligence overview for',
    fullAnalyticsBtn: 'Full Analytics',
    quickShortcuts: 'Quick Shortcuts',
    newSaleTitle: 'New Sale',
    newSaleDesc: 'Launch POS terminal',
    inventoryTitle: 'Inventory',
    inventoryDesc: 'Catalog & stock',
    customersTitle: 'Customers',
    customersDesc: 'Ledgers & debt',
    analyticsTitle: 'Analytics Hub',
    analyticsDesc: 'BI & Deep Insights',
    salesRevenue: 'Sales Revenue',
    grossProfit: 'Gross Profit',
    operatingExpenses: 'Operating Expenses',
    estimatedNetProfit: 'Estimated Net Profit',
    topProductsTitle: 'Top Performing Products',
    viewAllProducts: 'View all products',
    unitsSold: 'units sold',
    profit: 'Profit',
    noSalesPeriod: 'No sales recorded in this period',
    noSalesPeriodDesc: 'Start recording customer sales through the Point of Sale terminal.',
    launchPosBtn: 'Launch POS Terminal',
    aiOperatingLayer: 'AI Operating Layer',
    aiLiveConnected: 'Live Intelligence Connected',
    aiLayerDesc: 'Ursella tracks and synthesizes your core financial facts in real time: revenue, FIFO inventory margins, cash collections, and customer receivables.',
    chatWithAiBtn: 'Chat with Ursa',
    stockAlertsTitle: 'Inventory Stock Alerts',
    lowStock: 'low',
    outOfStock: 'out of stock',
    stockListBtn: 'Stock List',
    customerReceivablesTitle: 'Customer Receivables',
    ledgersBtn: 'Ledgers',
    refreshing: 'Refreshing dashboard...',
    releaseToRefresh: 'Release to refresh',
    swipeToRefresh: 'Swipe down to refresh',
    timeframes: {
      today: 'Today',
      last7Days: '7 Days',
      last30Days: '30 Days',
      thisMonth: 'This Month',
    },
    noBusinessFound: 'No Active Business Found',
    noBusinessDesc: 'Create your first business workspace or select an existing one to access the Ursella dashboard.',
    createBusinessBtn: 'Create Business Workspace',
  },
  landing: {
    heroBadge: 'Next-Gen Retail Operating System',
    heroTag: 'Modern Operating Co-pilot for Local Businesses',
    heroTitle: 'The simple way to run sales, track stock, and manage your business.',
    heroTitlePrefix: 'The Autonomous Business OS with ',
    heroTitleHighlight: 'FIFO Costing & AI Intelligence',
    heroTitleSuffix: ' for Modern Commerce',
    heroSubtitle:
      'unites rapid POS checkout, FIFO stock audits, customer credit reminders, and daily financial intelligence in one focused workspace.',
    exploreDemo: 'Explore Interactive Demo',
    startFree: 'Start Free Trial',
    createAccount: 'Create Free Account',
    signIn: 'Sign In',
    signUp: 'Get Started',
    noCardNeeded: 'No credit card required • Offline-first • Multi-tenant',
    multiCurrency: 'Multi-currency support (FCFA, USD, EUR)',
    offlinePwa: 'Offline-ready PWA',
    noCard: 'No credit card required',
    featuresTitle: 'Built for real retail, distribution, and service stores.',
    featuresSubtitle: 'Everything you need to maintain healthy cash flow and stop revenue leakage.',
    posFeatureTitle: 'Rapid POS & Mobile Money',
    posFeatureDesc: 'Designed for fast counter checkout, partial split payments, barcode scanner input, and instant WhatsApp receipts.',
    posFeatureMetric: 'Record sales in < 3s',
    fifoFeatureTitle: 'Automated Stock & Margins',
    fifoFeatureDesc: 'Tracks true cost of goods sold with FIFO layer calculations, low-stock threshold alerts, and expiry warnings.',
    fifoFeatureMetric: 'Automated reconciliations',
    financeFeatureTitle: 'Daily Financial Clarity',
    financeFeatureDesc: 'Instant cash position, debtors ledger, operational expense tracking, and deterministic net profit margins.',
    financeFeatureMetric: 'Real-time profit & loss',
    aiBannerTitle: 'Built-in AI Financial Co-pilot',
    aiBannerDesc: 'Ask questions like "What were my top sellers today?" or get automated alerts when margins fluctuate.',
    aiBannerBtn: 'Sign In to Ursella',
    aiFeatureTitle: 'Ursa — Personal Business Advisor',
    aiFeatureDesc: 'Chat in English or French. Ursa analyzes sales velocity, inventory depletion, and profit margins in real time.',
    debtorsFeatureTitle: 'Customer Debt Ledger',
    debtorsFeatureDesc: 'Record credit sales, track overdue customer balances, and send 1-click WhatsApp payment reminders.',
    receiptsTitle: 'Digital Receipts',
    receiptsDesc: 'Print via standard thermal receipt printers or share instant invoice receipts with customers via WhatsApp.',
    momoTitle: 'Mobile Money & Cash',
    momoDesc: 'Seamless support for local cash collections, Mobile Money transfers, and multi-tender payments.',
    pnlTitle: 'Profit & Loss Reports',
    pnlDesc: 'Deterministic calculation of gross revenue, COGS, operating expenses, and net profit margins.',
    securityTitle: 'Multi-Tenant Isolation',
    securityDesc: 'Each store runs in a secure, isolated database tenancy with enterprise-grade row-level security.',
    proactiveTitle: 'Proactive Health Checks',
    proactiveDesc: 'Continuous anomaly monitoring flags slow-moving stock, overdue debtors, and sudden expense spikes.',
    teamTitle: 'Team & Role Access',
    teamDesc: 'Add Cashiers, Store Managers, and Accountants with granular view and POS checkout permissions.',
    footerTagline: '— Operating Intelligence Platform for Modern Commerce',
  },
  pos: {
    newSale: 'New Sale',
    quickSell: 'Quick Sell',
    cart: 'Shopping Cart',
    cartEmpty: 'Your cart is empty. Scan barcode or tap products to add.',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'VAT / Tax',
    totalToPay: 'Total to Pay',
    cashPayment: 'Cash',
    momoPayment: 'Mobile Money (MoMo / OM)',
    creditPayment: 'Store Credit / Debt',
    splitPayment: 'Split Tender',
    completeSale: 'Complete Checkout',
    amountTendered: 'Amount Tendered',
    changeDue: 'Change Due',
    selectCustomer: 'Select Customer (Optional)',
    walkInCustomer: 'Walk-in Customer',
    printReceipt: 'Print Thermal Receipt',
    whatsappReceipt: 'Send WhatsApp Receipt',
    barcodeScan: 'Scan Barcode',
    outOfStockWarning: 'Insufficient stock on hand',
    itemAdded: 'Item added to cart',
    salesHistory: 'Sales History',
    terminal: 'POS Terminal',
    allCategories: 'All Categories',
    searchProductsPlaceholder: 'Search products by name, SKU, or barcode...',
    itemsCount: 'Items',
    clearCart: 'Clear Cart',
    checkoutSummary: 'Checkout Summary',
    paymentMethod: 'Payment Method',
    paymentRef: 'Reference / Transaction ID',
    paymentRefPlaceholder: 'e.g., MoMo Ref #987213',
    saleNotes: 'Sale Notes',
    saleNotesPlaceholder: 'Internal notes for this receipt...',
    customItem: 'Custom Non-Inventory Item',
    customItemName: 'Item Description',
    customItemPrice: 'Price',
    addCustomItem: 'Add Custom Item',
    closeRegister: 'Close Register (EOD)',
    hardwareSettings: 'Hardware / Printer',
    managerApprovalRequired: 'Manager Approval Required',
    managerPinPlaceholder: 'Enter Manager Security PIN',
    approveOverride: 'Approve Discount Override',
    discountExceedsMax: 'Discount exceeds cashier allowance limit',
  },
  inventory: {
    products: 'Products & SKUs',
    addProduct: 'Add Product',
    editProduct: 'Edit Product',
    sku: 'SKU / Barcode',
    productName: 'Product Name',
    sellingPrice: 'Selling Price',
    costPrice: 'Purchase / FIFO Cost',
    stockQuantity: 'Stock on Hand',
    lowStockThreshold: 'Reorder Level',
    category: 'Category',
    costLots: 'FIFO Cost Lots',
    fifoValuation: 'FIFO Cost Valuation',
    retailValuation: 'Retail Valuation',
    lowStockAlert: 'Low Stock Alerts',
    outOfStock: 'Out of Stock',
    healthyStock: 'Healthy Stock',
    restock: 'Restock / Purchase',
    adjustStock: 'Adjust Stock',
    searchPlaceholder: 'Search product catalog by name, code, or brand...',
    allCategories: 'All Categories',
    addCategory: 'Add Category',
    valuationSummary: 'Valuation & Asset Overview',
    totalActiveSkus: 'Total Active SKUs',
    fifoCostBasis: 'Total FIFO Cost Basis',
    stockAdjustments: 'Stock Adjustments',
    reasonLoss: 'Inventory Shrinkage / Loss',
    reasonDamage: 'Damaged Goods',
    reasonAudit: 'Physical Stock Count Audit',
    reasonReturn: 'Supplier Return',
    barcodeOrSku: 'Barcode / SKU Code',
    batchLots: 'Batch Purchase Lots (FIFO Queue)',
    lotDate: 'Purchase Date',
    lotSupplier: 'Supplier',
    lotQty: 'Qty Available',
    lotCost: 'Unit Cost',
    deleteProductConfirm: 'Are you sure you want to delete this product? This action cannot be undone.',
  },
  customers: {
    title: 'Customer Directory & Debtors',
    addCustomer: 'Add Customer',
    customerName: 'Customer Name',
    phone: 'Phone / WhatsApp',
    email: 'Email Address',
    totalDebt: 'Total Outstanding Debt',
    outstandingBalance: 'Balance Due',
    creditLimit: 'Credit Limit',
    recordPayment: 'Record Payment',
    sendDebtReminder: 'WhatsApp Reminder',
    purchaseHistory: 'Purchase History',
    searchPlaceholder: 'Search by customer name, phone, or company...',
    allCustomers: 'All Customers',
    debtorsOnly: 'Debtors with Balance Due',
    totalReceivables: 'Total Receivables',
    activeAccounts: 'Active Accounts',
    allowCredit: 'Allow Store Credit Purchases',
    creditMaxLimit: 'Maximum Allowed Credit Ceiling',
    customerNotes: 'Customer Profile Notes',
    paymentAmount: 'Amount Received',
    paymentMethod: 'Payment Channel',
    confirmPayment: 'Post Payment to Ledger',
    reminderSent: 'WhatsApp payment reminder generated!',
    reminderMessageTemplate: 'Hello {name}, this is a friendly reminder from {business} regarding your outstanding balance of {amount}. Thank you!',
    noCustomersFound: 'No customer accounts registered yet.',
  },
  finance: {
    revenue: 'Revenue',
    grossProfit: 'Gross Profit',
    grossMargin: 'Gross Margin %',
    netProfit: 'Net Profit',
    cogs: 'Cost of Goods Sold (COGS)',
    operatingExpenses: 'Operating Expenses',
    cashInHand: 'Estimated Cash in Hand',
    todaySales: "Today's Sales",
    thisMonth: 'This Month',
    thisWeek: 'This Week',
    allTime: 'All-Time',
    addExpense: 'Record Expense',
    expenseCategory: 'Expense Category',
    expenseAmount: 'Amount',
    expenseDescription: 'Description / Purpose',
    expenseDate: 'Date of Expense',
    recordedBy: 'Recorded By',
    categories: {
      rent: 'Store Rent & Lease',
      utilities: 'Electricity, Water & Internet',
      salaries: 'Staff Wages & Payroll',
      transport: 'Logistics & Transport',
      supplies: 'Packaging & Supplies',
      marketing: 'Advertising & Marketing',
      taxes: 'Local Licenses & Tax',
      other: 'General Miscellaneous',
    },
  },
  analytics: {
    title: 'Business Analytics & Intelligence',
    subtitle: 'Comprehensive financial, inventory velocity, and operational performance metrics',
    revenueTrends: 'Revenue & Gross Profit Trends',
    marginEvolution: 'Gross Margin % Evolution',
    hourlyVelocity: 'Sales Velocity by Hour of Day',
    categoryContribution: 'Revenue Contribution by Category',
    deadStockAnalysis: 'Dead Stock & Capital Trapped',
    deadStockDescription: 'Products with zero sales velocity over the last 30 days consuming working capital.',
    deadStockHealthy: 'No dead stock detected! Inventory turnover is healthy.',
    anomaliesDetected: 'Operational Anomalies & Risk Flags',
    noAnomalies: 'No anomalies detected. Operations are within expected normal thresholds.',
    paymentMethodSplit: 'Payment Tender Breakdown',
    customerRetention: 'Repeat vs New Customer Sales',
    periodComparison: 'Comparison Against Previous Period',
  },
  reports: {
    title: 'Financial & Tax Reports',
    subtitle: 'Audited financial summaries, P&L statements, and register closeout audit logs',
    profitAndLoss: 'Profit & Loss Statement (P&L)',
    cashFlowStatement: 'Cash Flow Statement',
    taxEstimate: 'Tax & VAT Estimate',
    dateRange: 'Reporting Period',
    downloadPdf: 'Download PDF Report',
    downloadCsv: 'Export CSV',
    grossSalesRevenue: 'Gross Sales Revenue',
    returnsAndDiscounts: 'Discounts & Returns',
    netSalesRevenue: 'Net Sales Revenue',
    cogsFifo: 'Cost of Goods Sold (FIFO Realized)',
    grossProfitMargin: 'Gross Profit (Margin %)',
    operatingExpensesTotal: 'Total Operating Expenses',
    netOperatingProfit: 'Net Operating Profit',
    estimatedTaxPayable: 'Estimated VAT / Sales Tax Payable',
    registerCloseoutTitle: 'End-of-Day Register Closeout',
    registerCloseoutDesc: 'Reconcile drawer cash, Mobile Money receipts, and verify POS drawer totals.',
    cashCounted: 'Physical Cash Counted',
    momoCounted: 'Digital MoMo Balance Counted',
    discrepancy: 'Register Discrepancy (Over / Short)',
  },
  aiAdvisor: {
    title: 'Ursa',
    subtitle: 'Personal business advisor and strategist grounded in your verified store ledger & FIFO engine',
    inputPlaceholder: 'Ask in English or French (e.g., "Comment se portent mes ventes ?" or "What is my profit?")...',
    askPrompt: 'Ask Ursa',
    listening: 'Listening to voice prompt...',
    analyzing: 'Ursa is reasoning with store ledger...',
    dailyBrief: "Today's Executive Brief",
    diagnosticTitle: 'Diagnostic Analysis',
    suggestionsTitle: 'Suggested Queries',
    followUpTitle: 'Follow-up Questions',
    clearChat: 'Clear History',
    samplePrompts: {
      overview: 'How is my business doing overall?',
      salesToday: 'How are my sales today?',
      inventoryCheck: 'Which products are low on stock?',
      debtorsCheck: 'Who owes me money?',
      profitDiagnosis: 'Diagnose my profit margins and expenses',
      topProducts: 'What is my best-selling product?',
    },
    languageNotice: 'Ursa dynamically reasons and answers in English and French.',
  },
  dataHub: {
    title: 'Data Import / Export Hub',
    subtitle: 'Manage catalog backups, CSV migrations, and secure offsite ledger sync',
    exportCatalog: 'Export Products & Cost Lots (CSV)',
    exportSales: 'Export Sales History (CSV)',
    exportCustomers: 'Export Customer Directory (CSV)',
    importCatalog: 'Import Products from CSV',
    importCsvDesc: 'Bulk upload your existing product list with SKU, selling price, and opening inventory.',
    cloudBackup: 'Automated Cloud Database Backup',
    cloudBackupDesc: 'Download complete encrypted JSON snapshot of your business workspace.',
    downloadTemplate: 'Download CSV Sample Template',
    uploadFile: 'Select or Drop CSV File',
    syncStatus: 'Encrypted & Synced to Cloud DB',
  },
  billing: {
    title: 'Subscription & Workspace Plan',
    subtitle: 'Choose the right plan to power your store growth with FIFO costing and AI copilot',
    currentPlan: 'Current Active Plan',
    freeTrial: '14-Day Free Pro Trial',
    starterPlan: 'Starter Boutique',
    proPlan: 'Pro Merchant & Retail',
    enterprisePlan: 'Enterprise Multi-Store',
    upgradePlan: 'Upgrade Plan',
    monthly: 'Billed Monthly',
    annual: 'Billed Annually (Save 20%)',
    saveAnnual: '20% OFF',
    payWithMomo: 'Pay with MTN MoMo / Orange Money',
    payWithCard: 'Pay with Debit / Credit Card',
    activeFeatures: 'Included Features',
    unlimitedTransactions: 'Unlimited POS Transactions',
    fifoValuation: 'FIFO Real-Time Cost Valuation',
    aiAdvisorUnlimited: 'Ursa Personal Business Advisor (Bilingual)',
    multiUserRoles: 'Multi-User Roles & Permissions',
    offlinePwaSupport: 'Offline PWA & Thermal Receipt Printing',
  },
  settings: {
    title: 'Business Settings & Hardware',
    storeProfile: 'Store Profile & Identity',
    storeName: 'Business Name',
    businessType: 'Industry / Business Type',
    currency: 'Operating Currency',
    phone: 'Store Phone / WhatsApp',
    address: 'Physical Address',
    taxNumber: 'Tax Identification Number (TIN / NIF)',
    receiptHeader: 'Receipt Header Message',
    receiptFooter: 'Receipt Footer Thank You Message',
    hardwarePrinters: 'Hardware & ESC/POS Printers',
    printerType: 'Printer Interface',
    thermal58: '58mm Thermal Receipt Printer',
    thermal80: '80mm Thermal Receipt Printer',
    bluetooth: 'Bluetooth Wireless Printer',
    usb: 'USB Direct Printer',
    network: 'LAN / Wi-Fi Network Printer',
    teamAndRoles: 'Team Members & Staff Access',
    addTeamMember: 'Invite Team Member',
    securityPin: 'Manager Security PIN',
    changePin: 'Change PIN',
    dangerZone: 'Data Management & Reset',
    resetSampleData: 'Load Sample Store Data',
    resetSampleDataDesc: 'Populate your workspace with sample African boutique inventory, transactions, and debtors to test features.',
  },
  auth: {
    welcomeBack: 'Welcome back to Ursella',
    signInSubtitle: 'Sign in to access your store ledger and point of sale',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    fullNameLabel: 'Full Name',
    phoneLabel: 'Phone Number',
    staySignedIn: 'Keep me signed in',
    forgotPassword: 'Forgot password?',
    signInBtn: 'Sign In',
    instantDemoBtn: 'Launch Demo Store',
    dontHaveAccount: "Don't have an account?",
    createAccount: 'Create Account',
    signUpTitle: 'Create your Ursella business account',
    signUpSubtitle: 'Set up your retail workspace with FIFO costing & AI intelligence',
    createAccountBtn: 'Create Account & Verify',
    alreadyHaveAccount: 'Already have an account?',
  },
};

export const frTranslations: Translations = {
  common: {
    appName: 'Ursella',
    tagline: 'Système d’Exploitation Commercial & Point de Vente',
    loading: 'Chargement du système...',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    search: 'Rechercher...',
    filter: 'Filtrer',
    export: 'Exporter',
    import: 'Importer',
    confirm: 'Confirmer',
    back: 'Retour',
    actions: 'Actions',
    viewAll: 'Voir tout',
    retry: 'Réessayer',
    offline: 'Mode Hors-Ligne Actif',
    online: 'Connecté',
    date: 'Date',
    total: 'Total',
    status: 'Statut',
    active: 'Actif',
    beta: 'BÊTA',
    demoStore: 'Explorer la Démo',
    language: 'Langue',
    switchToFrench: 'Passer en Français',
    switchToEnglish: 'Switch to English',
    success: 'Succès',
    error: 'Erreur',
    all: 'Tous',
    none: 'Aucun',
    notes: 'Remarques',
    optional: 'Optionnel',
    required: 'Obligatoire',
    download: 'Télécharger',
    print: 'Imprimer',
    share: 'Partager',
    copy: 'Copier',
    copied: 'Copié !',
  },
  navigation: {
    home: 'Accueil',
    sell: 'Vente (Caisse)',
    pos: 'Caisse / POS',
    inventory: 'Stock & Catalogue',
    catalog: 'Produits',
    customers: 'Clients & Débiteurs',
    crm: 'Carnet de Dettes',
    notes: 'Notes & Mémos',
    analytics: 'Statistiques',
    reports: 'Rapports Financiers',
    expenses: 'Dépenses',
    aiAdvisor: 'Ursa',
    proactiveAI: 'IA Proactive',
    dataHub: 'Centre de Données',
    billing: 'Abonnement & Forfait',
    settings: 'Paramètres',
    menu: 'Menu',
    logout: 'Déconnexion',
  },
  dashboard: {
    greetingMorning: 'Bonjour',
    greetingAfternoon: 'Bon après-midi',
    greetingEvening: 'Bonsoir',
    partner: 'Partenaire',
    overviewSubtitle: 'Aperçu opérationnel et financier pour',
    fullAnalyticsBtn: 'Statistiques Complètes',
    quickShortcuts: 'Raccourcis Rapides',
    newSaleTitle: 'Nouvelle Vente',
    newSaleDesc: 'Lancer la caisse enregistreuse',
    inventoryTitle: 'Stocks & Articles',
    inventoryDesc: 'Catalogue et inventaire',
    customersTitle: 'Clients & Dettes',
    customersDesc: 'Carnet de crédit & impayés',
    analyticsTitle: 'Centre Statistique',
    analyticsDesc: 'Rapports & Indicateurs Clés',
    salesRevenue: 'Chiffre d’Affaires',
    grossProfit: 'Marge Brute',
    operatingExpenses: 'Charges d’Exploitation',
    estimatedNetProfit: 'Bénéfice Net Estimé',
    topProductsTitle: 'Produits les Plus Performants',
    viewAllProducts: 'Voir tous les produits',
    unitsSold: 'unités vendues',
    profit: 'Marge',
    noSalesPeriod: 'Aucune vente enregistrée sur cette période',
    noSalesPeriodDesc: 'Commencez à enregistrer des encaissements sur la caisse.',
    launchPosBtn: 'Ouvrir la Caisse',
    aiOperatingLayer: 'Moteur IA Opérationnel',
    aiLiveConnected: 'Intelligence en Direct Connectée',
    aiLayerDesc: 'Ursella consolide et synthétise vos chiffres clés en temps réel : chiffre d’affaires, marges réelles PEPS, encaissements et créances clients.',
    chatWithAiBtn: 'Discuter avec Ursa',
    stockAlertsTitle: 'Alertes de Stock & Ruptures',
    lowStock: 'faible',
    outOfStock: 'en rupture',
    stockListBtn: 'Liste du Stock',
    customerReceivablesTitle: 'Créances & Dettes Clients',
    ledgersBtn: 'Carnet de Crédit',
    refreshing: 'Actualisation du tableau de bord...',
    releaseToRefresh: 'Relâchez pour actualiser',
    swipeToRefresh: 'Tirez vers le bas pour actualiser',
    timeframes: {
      today: 'Aujourd’hui',
      last7Days: '7 Jours',
      last30Days: '30 Jours',
      thisMonth: 'Ce Mois',
    },
    noBusinessFound: 'Aucune Entreprise Active Trouvée',
    noBusinessDesc: 'Créez votre première boutique ou sélectionnez-en une pour accéder au tableau de bord Ursella.',
    createBusinessBtn: 'Créer une Boutique',
  },
  landing: {
    heroBadge: 'Système d’Exploitation Commercial Moderne',
    heroTag: 'Co-pilote Moderne de Gestion pour le Commerce',
    heroTitle: 'La façon simple de gérer vos ventes, suivre vos stocks et piloter votre commerce.',
    heroTitlePrefix: 'Le Système d’Exploitation Commercial avec ',
    heroTitleHighlight: 'Méthode PEPS (FIFO) & Intelligence IA',
    heroTitleSuffix: ' pour le Commerce Moderne',
    heroSubtitle:
      'réunit une caisse ultra-rapide, le suivi rigoureux des stocks PEPS (FIFO), les relances clients et l’intelligence financière quotidienne dans un espace unique et épuré.',
    exploreDemo: 'Explorer la Démo Interactive',
    startFree: 'Essai Gratuit',
    createAccount: 'Créer un Compte Gratuit',
    signIn: 'Connexion',
    signUp: 'Démarrer',
    noCardNeeded: 'Sans carte bancaire • Fonctionne hors-ligne • Multi-boutiques',
    multiCurrency: 'Support multi-devises (FCFA, USD, EUR)',
    offlinePwa: 'PWA utilisable hors-ligne',
    noCard: 'Sans carte bancaire requise',
    featuresTitle: 'Conçu pour le commerce de détail, la distribution et les services.',
    featuresSubtitle: 'Tout ce dont vous avez besoin pour maintenir une trésorerie saine et éliminer les fuites de marge.',
    posFeatureTitle: 'Caisse Rapide & Mobile Money',
    posFeatureDesc: 'Conçu pour l’encaissement rapide au comptoir, paiements mixtes, lecteur code-barres et reçus WhatsApp instantanés.',
    posFeatureMetric: 'Encaissement en < 3s',
    fifoFeatureTitle: 'Gestion des Stocks & Marges',
    fifoFeatureDesc: 'Calcule le coût réel d’achat avec la méthode PEPS (FIFO), alertes de seuil de sécurité et alertes de péremption.',
    fifoFeatureMetric: 'Rapprochement automatisé',
    financeFeatureTitle: 'Clarté Financière Quotidienne',
    financeFeatureDesc: 'Trésorerie en direct, carnet des débiteurs, suivi des charges d’exploitation et calcul déterministe de la marge nette.',
    financeFeatureMetric: 'Compte de résultat en direct',
    aiBannerTitle: 'Co-pilote Financier IA Intégré',
    aiBannerDesc: 'Posez des questions comme « Quels sont mes produits les plus vendus ? » ou recevez des alertes automatiques de marge.',
    aiBannerBtn: 'Se connecter à Ursella',
    aiFeatureTitle: 'Ursa — Conseillère d’Entreprise Personnelle',
    aiFeatureDesc: 'Posez vos questions en français. Ursa analyse vos ventes du jour, vos ruptures de stock et vos marges en temps réel.',
    debtorsFeatureTitle: 'Gestion des Crédits & Débiteurs',
    debtorsFeatureDesc: 'Enregistrez les ventes à crédit, visualisez les impayés et envoyez des relances WhatsApp en 1 clic.',
    receiptsTitle: 'Reçus Numériques & Thermiques',
    receiptsDesc: 'Imprimez sur imprimante thermique standard ou partagez instantanément des factures et reçus sur WhatsApp.',
    momoTitle: 'Mobile Money & Espèces',
    momoDesc: 'Encaissement fluide en espèces locales, virements Mobile Money (Orange Money, MTN MoMo) et paiements mixtes.',
    pnlTitle: 'Rapports Financiers & P&L',
    pnlDesc: 'Calcul déterministe du chiffre d’affaires, coût d’achat réel (CMV), charges d’exploitation et bénéfice net.',
    securityTitle: 'Sécurité & Isolation Multi-Boutiques',
    securityDesc: 'Chaque magasin fonctionne dans une base de données isolée et sécurisée avec contrôle d’accès strict.',
    proactiveTitle: 'Surveillance & Diagnostics Proactifs',
    proactiveDesc: 'Détection en continu des anomalies : stock dormant, retards de paiement débiteurs et variations anormales des dépenses.',
    teamTitle: 'Gestion d’Équipe & Rôles',
    teamDesc: 'Ajoutez des caissiers, gestionnaires de stock et comptables avec des droits d’accès et d’encaissement personnalisés.',
    footerTagline: '— Plateforme d’Intelligence Opérationnelle pour le Commerce Moderne',
  },
  pos: {
    newSale: 'Nouvelle Vente',
    quickSell: 'Vente Rapide',
    cart: 'Panier d’Achat',
    cartEmpty: 'Votre panier est vide. Scannez un code-barres ou touchez un produit.',
    subtotal: 'Sous-total',
    discount: 'Remise',
    tax: 'TVA / Taxes',
    totalToPay: 'Total à Payer',
    cashPayment: 'Espèces',
    momoPayment: 'Mobile Money (OM / MoMo)',
    creditPayment: 'Crédit / Dette Client',
    splitPayment: 'Paiement Mixte',
    completeSale: 'Valider l’Encaissement',
    amountTendered: 'Montant Reçu',
    changeDue: 'Monnaie à Rendre',
    selectCustomer: 'Sélectionner un Client (Optionnel)',
    walkInCustomer: 'Client de Passage',
    printReceipt: 'Imprimer Ticket Thermique',
    whatsappReceipt: 'Envoyer Reçu WhatsApp',
    barcodeScan: 'Scanner Code-Barres',
    outOfStockWarning: 'Stock insuffisant en rayon',
    itemAdded: 'Article ajouté au panier',
    salesHistory: 'Historique des Ventes',
    terminal: 'Caisse POS',
    allCategories: 'Toutes les Catégories',
    searchProductsPlaceholder: 'Rechercher par nom, SKU ou code-barres...',
    itemsCount: 'Articles',
    clearCart: 'Vider le Panier',
    checkoutSummary: 'Récapitulatif de Vente',
    paymentMethod: 'Mode de Règlement',
    paymentRef: 'Référence / ID de Transaction',
    paymentRefPlaceholder: 'ex. Réf MoMo #987213',
    saleNotes: 'Notes sur la Vente',
    saleNotesPlaceholder: 'Notes internes sur ce reçu...',
    customItem: 'Article Hors-Catalogue',
    customItemName: 'Désignation de l’Article',
    customItemPrice: 'Prix',
    addCustomItem: 'Ajouter l’Article Personnalisé',
    closeRegister: 'Clôturer la Caisse (Fin de Journée)',
    hardwareSettings: 'Matériel / Imprimante',
    managerApprovalRequired: 'Validation Responsable Requise',
    managerPinPlaceholder: 'Entrez le Code PIN Responsable',
    approveOverride: 'Approuver la Remise',
    discountExceedsMax: 'La remise dépasse le plafond autorisé du caissier',
  },
  inventory: {
    products: 'Produits & Articles',
    addProduct: 'Ajouter un Produit',
    editProduct: 'Modifier le Produit',
    sku: 'Code-Barres / SKU',
    productName: 'Nom du Produit',
    sellingPrice: 'Prix de Vente',
    costPrice: 'Prix d’Achat / Coût FIFO',
    stockQuantity: 'Stock en Rayon',
    lowStockThreshold: 'Seuil d’Alerte',
    category: 'Catégorie',
    costLots: 'Lots de Coût (PEPS)',
    fifoValuation: 'Valeur du Stock (Coût d’Achat)',
    retailValuation: 'Valeur Marchande (Prix de Vente)',
    lowStockAlert: 'Alertes Stock Faible',
    outOfStock: 'Rupture de Stock',
    healthyStock: 'Stock Conforme',
    restock: 'Réapprovisionner / Achat',
    adjustStock: 'Ajuster l’Inventaire',
    searchPlaceholder: 'Rechercher par nom, code ou marque...',
    allCategories: 'Toutes les Catégories',
    addCategory: 'Ajouter une Catégorie',
    valuationSummary: 'Aperçu & Valorisation du Stock',
    totalActiveSkus: 'Total Références Actives',
    fifoCostBasis: 'Valeur Totale au Coût d’Achat',
    stockAdjustments: 'Ajustements d’Inventaire',
    reasonLoss: 'Perte / Démarque Inconnue',
    reasonDamage: 'Marchandises Endommagées',
    reasonAudit: 'Comptage Physique d’Inventaire',
    reasonReturn: 'Retour au Fournisseur',
    barcodeOrSku: 'Code-Barres / Code SKU',
    batchLots: 'Lots d’Achat en File PEPS',
    lotDate: 'Date d’Achat',
    lotSupplier: 'Fournisseur',
    lotQty: 'Quantité Disponible',
    lotCost: 'Coût Unitaire',
    deleteProductConfirm: 'Êtes-vous certain de vouloir supprimer cet article ? Cette action est irréversible.',
  },
  customers: {
    title: 'Répertoire Clients & Créances',
    addCustomer: 'Ajouter un Client',
    customerName: 'Nom du Client',
    phone: 'Téléphone / WhatsApp',
    email: 'Adresse Email',
    totalDebt: 'Total Créances & Dettes',
    outstandingBalance: 'Reste à Recouvrer',
    creditLimit: 'Plafond de Crédit',
    recordPayment: 'Encaisser un Remboursement',
    sendDebtReminder: 'Relance WhatsApp',
    purchaseHistory: 'Historique des Achats',
    searchPlaceholder: 'Rechercher par nom, téléphone ou société...',
    allCustomers: 'Tous les Clients',
    debtorsOnly: 'Clients Débiteurs avec Impayés',
    totalReceivables: 'Total des Créances',
    activeAccounts: 'Comptes Clients Actifs',
    allowCredit: 'Autoriser les Achats à Crédit',
    creditMaxLimit: 'Plafond Maximal de Crédit Accordé',
    customerNotes: 'Notes sur le Profil Client',
    paymentAmount: 'Montant Encaissé',
    paymentMethod: 'Canal de Paiement',
    confirmPayment: 'Enregistrer le Remboursement',
    reminderSent: 'Message de relance WhatsApp généré !',
    reminderMessageTemplate: 'Bonjour {name}, voici un rappel de la part de {business} concernant votre solde restant de {amount}. Merci pour votre confiance !',
    noCustomersFound: 'Aucun client enregistré pour le moment.',
  },
  finance: {
    revenue: 'Chiffre d’Affaires',
    grossProfit: 'Marge Brute',
    grossMargin: 'Taux de Marge Brute',
    netProfit: 'Bénéfice Net',
    cogs: 'Coût des Marchandises Vendues (CMV)',
    operatingExpenses: 'Dépenses d’Exploitation',
    cashInHand: 'Trésorerie Estimée',
    todaySales: 'Ventes du Jour',
    thisMonth: 'Ce Mois',
    thisWeek: 'Cette Semaine',
    allTime: 'Historique Global',
    addExpense: 'Enregistrer une Dépense',
    expenseCategory: 'Catégorie de Dépense',
    expenseAmount: 'Montant',
    expenseDescription: 'Description / Objet',
    expenseDate: 'Date de la Dépense',
    recordedBy: 'Enregistré par',
    categories: {
      rent: 'Loyer & Charges Commerciales',
      utilities: 'Électricité, Eau & Internet',
      salaries: 'Salaires & Rémunérations',
      transport: 'Logistique & Transport',
      supplies: 'Emballages & Fournitures',
      marketing: 'Publicité & Marketing',
      taxes: 'Licences & Taxes Locales',
      other: 'Divers & Frais Généraux',
    },
  },
  analytics: {
    title: 'Statistiques & Intelligence Commerciale',
    subtitle: 'Indicateurs financiers, rotation des stocks et performance opérationnelle',
    revenueTrends: 'Évolution du Chiffre d’Affaires & Marge Brute',
    marginEvolution: 'Taux de Marge Brute %',
    hourlyVelocity: 'Vitesse des Ventes par Heure de la Journée',
    categoryContribution: 'Contribution au Chiffre d’Affaires par Catégorie',
    deadStockAnalysis: 'Stock Dormant & Trésorerie Bloquée',
    deadStockDescription: 'Articles sans aucune vente au cours des 30 derniers jours immobilisant du capital.',
    deadStockHealthy: 'Aucun stock dormant détecté ! La rotation des articles est saine.',
    anomaliesDetected: 'Anomalies Opérationnelles & Drapeaux de Risque',
    noAnomalies: 'Aucune anomalie détectée. Les opérations sont dans les normes attendues.',
    paymentMethodSplit: 'Répartition par Mode de Paiement',
    customerRetention: 'Clients Fidèles vs Nouveaux Clients',
    periodComparison: 'Comparaison par Rapport à la Période Précédente',
  },
  reports: {
    title: 'Rapports & Déclarations Financières',
    subtitle: 'États financiers certifiés, compte de résultat et clôtures de caisse journalières',
    profitAndLoss: 'Compte de Résultat (P&L)',
    cashFlowStatement: 'Tableau de Flux de Trésorerie',
    taxEstimate: 'Estimation TVA & Impôts',
    dateRange: 'Période d’Analyse',
    downloadPdf: 'Télécharger le Rapport PDF',
    downloadCsv: 'Exporter en CSV',
    grossSalesRevenue: 'Chiffre d’Affaires Brut',
    returnsAndDiscounts: 'Remises & Retours',
    netSalesRevenue: 'Chiffre d’Affaires Net',
    cogsFifo: 'Coût des Marchandises Vendues (Réalisé PEPS)',
    grossProfitMargin: 'Marge Brute (Taux de Marge %)',
    operatingExpensesTotal: 'Total des Dépenses d’Exploitation',
    netOperatingProfit: 'Résultat d’Exploitation Net',
    estimatedTaxPayable: 'Estimation de TVA / Taxes Déductibles',
    registerCloseoutTitle: 'Clôture de Caisse Journalière',
    registerCloseoutDesc: 'Rapprochez les espèces physiques en caisse, les virements Mobile Money et validez le total du tiroir-caisse.',
    cashCounted: 'Espèces Physiques Comptées',
    momoCounted: 'Solde Numérique Mobile Money Vérifié',
    discrepancy: 'Écart de Caisse (Excédent / Déficit)',
  },
  aiAdvisor: {
    title: 'Ursa',
    subtitle: 'Conseillère d’entreprise personnelle et stratégique alimentée par votre grand livre certifié et l’algorithme PEPS',
    inputPlaceholder: 'Posez votre question en français ou anglais (ex. "Comment se portent mes ventes ?" ou "Qui me doit de l’argent ?")...',
    askPrompt: 'Demander à Ursa',
    listening: 'Écoute vocale en cours...',
    analyzing: 'Ursa analyse vos comptes...',
    dailyBrief: 'Point de Situation du Jour',
    diagnosticTitle: 'Diagnostic Stratégique',
    suggestionsTitle: 'Suggestions Rapides',
    followUpTitle: 'Questions Suivantes',
    clearChat: 'Effacer l’Historique',
    samplePrompts: {
      overview: 'Comment se porte mon commerce aujourd’hui ?',
      salesToday: 'Quel est mon chiffre d’affaires du jour ?',
      inventoryCheck: 'Quels sont les produits en rupture de stock ?',
      debtorsCheck: 'Quels clients ont des dettes impayées ?',
      profitDiagnosis: 'Analyse mes marges bénéficiaires et mes dépenses',
      topProducts: 'Quel est mon produit le plus vendu ?',
    },
    languageNotice: 'Ursa raisonne et répond naturellement en français et en anglais.',
  },
  dataHub: {
    title: 'Centre d’Import & Export de Données',
    subtitle: 'Sauvegardez vos catalogues, gérez vos fichiers CSV et synchronisez vos registres',
    exportCatalog: 'Exporter Produits & Lots de Coût (CSV)',
    exportSales: 'Exporter l’Historique des Ventes (CSV)',
    exportCustomers: 'Exporter le Répertoire Clients (CSV)',
    importCatalog: 'Importer des Produits depuis un Fichier CSV',
    importCsvDesc: 'Importez en masse votre catalogue avec codes-barres, prix de vente et stocks initiaux.',
    cloudBackup: 'Sauvegarde Complète Cloud Sécurisée',
    cloudBackupDesc: 'Téléchargez une sauvegarde instantanée au format JSON crypté de votre boutique.',
    downloadTemplate: 'Télécharger le Modèle CSV Exemplaire',
    uploadFile: 'Sélectionner ou Déposer un Fichier CSV',
    syncStatus: 'Chiffré & Synchronisé dans la Base Cloud',
  },
  billing: {
    title: 'Abonnement & Formule Entreprise',
    subtitle: 'Choisissez la formule adaptée pour accélérer la croissance de votre commerce avec PEPS et l’IA',
    currentPlan: 'Forfait Actif',
    freeTrial: 'Essai Gratuit Pro de 14 Jours',
    starterPlan: 'Boutique Starter',
    proPlan: 'Commerce Pro & Retail',
    enterprisePlan: 'Entreprise & Multi-Magasins',
    upgradePlan: 'Changer de Forfait',
    monthly: 'Facturation Mensuelle',
    annual: 'Facturation Annuelle (Économisez 20%)',
    saveAnnual: '20% DE RÉDUCTION',
    payWithMomo: 'Payer avec MTN MoMo / Orange Money',
    payWithCard: 'Payer par Carte Bancaire',
    activeFeatures: 'Fonctionnalités Incluses',
    unlimitedTransactions: 'Transactions de Caisse Illimitées',
    fifoValuation: 'Valorisation des Stocks PEPS en Temps Réel',
    aiAdvisorUnlimited: 'Conseillère d’Entreprise Ursa (Bilingue)',
    multiUserRoles: 'Gestion des Rôles & Accès Collaborateurs',
    offlinePwaSupport: 'PWA Hors-Ligne & Impression Reçus Thermiques',
  },
  settings: {
    title: 'Paramètres & Matériel de Caisse',
    storeProfile: 'Profil du Commerce & Identité',
    storeName: 'Nom de la Boutique',
    businessType: 'Secteur d’Activité / Type',
    currency: 'Devise Principale',
    phone: 'Téléphone / WhatsApp',
    address: 'Adresse Physique',
    taxNumber: 'Numéro d’Identification Fiscale (NIF / TIN)',
    receiptHeader: 'Message d’En-tête de Ticket',
    receiptFooter: 'Message de Remerciement en Bas de Ticket',
    hardwarePrinters: 'Imprimantes Thermiques ESC/POS & Matériel',
    printerType: 'Interface de Connexion Imprimante',
    thermal58: 'Imprimante Thermique Ticket 58mm',
    thermal80: 'Imprimante Thermique Ticket 80mm',
    bluetooth: 'Imprimante Sans Fil Bluetooth',
    usb: 'Connexion Directe USB',
    network: 'Imprimante Réseau LAN / Wi-Fi',
    teamAndRoles: 'Équipe & Gestion des Droits d’Accès',
    addTeamMember: 'Inviter un Collaborateur',
    securityPin: 'Code PIN de Sécurité Responsable',
    changePin: 'Modifier le Code PIN',
    dangerZone: 'Gestion des Données & Réinitialisation',
    resetSampleData: 'Charger les Données Démo de la Boutique',
    resetSampleDataDesc: 'Remplissez votre espace avec un catalogue exemple de boutique africaine, ventes et carnet de dettes pour tester.',
  },
  auth: {
    welcomeBack: 'Bienvenue sur Ursella',
    signInSubtitle: 'Connectez-vous pour accéder à votre point de vente et à vos registres',
    emailLabel: 'Adresse E-mail',
    passwordLabel: 'Mot de Passe',
    confirmPasswordLabel: 'Confirmez le Mot de Passe',
    fullNameLabel: 'Nom Complet',
    phoneLabel: 'Numéro de Téléphone',
    staySignedIn: 'Rester connecté',
    forgotPassword: 'Mot de passe oublié ?',
    signInBtn: 'Se Connecter',
    instantDemoBtn: 'Lancer la Démo Interactive',
    dontHaveAccount: 'Pas encore de compte ?',
    createAccount: 'Créer un Compte',
    signUpTitle: 'Créez votre compte entreprise Ursella',
    signUpSubtitle: 'Configurez votre espace de vente avec valorisation PEPS et IA intégrée',
    createAccountBtn: 'Créer le Compte & Valider',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
  },
};

export const translations: Record<SupportedLanguage, Translations> = {
  en: enTranslations,
  fr: frTranslations,
};
