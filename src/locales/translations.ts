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
  };
  navigation: {
    home: string;
    sell: string;
    pos: string;
    inventory: string;
    catalog: string;
    customers: string;
    crm: string;
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
  reports: {
    title: string;
    profitAndLoss: string;
    cashFlowStatement: string;
    taxEstimate: string;
    dateRange: string;
    downloadPdf: string;
    downloadCsv: string;
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
  },
  navigation: {
    home: 'Home',
    sell: 'Sell (POS)',
    pos: 'POS Register',
    inventory: 'Stock & Catalog',
    catalog: 'Products',
    customers: 'Customers & CRM',
    crm: 'Debtors Ledger',
    analytics: 'Analytics',
    reports: 'Financial Reports',
    expenses: 'Expenses',
    aiAdvisor: 'Ursella AI',
    proactiveAI: 'Proactive AI',
    dataHub: 'Data Hub',
    billing: 'Billing & Plan',
    settings: 'Settings',
    menu: 'Menu',
    logout: 'Sign Out',
  },
  landing: {
    heroBadge: 'Next-Gen Retail Operating System',
    heroTag: 'Modern Operating Co-pilot for Local Businesses',
    heroTitle: 'The simple way to run sales, track stock, and manage your business.',
    heroTitlePrefix: 'The Autonomous Business OS with ',
    heroTitleHighlight: 'FIFO Costing & AI Intelligence',
    heroTitleSuffix: ' for Modern Commerce',
    heroSubtitle:
      'Ursella unites rapid POS checkout, FIFO stock audits, customer credit reminders, and daily financial intelligence in one focused workspace.',
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
    aiFeatureTitle: 'Bilingual AI Business Advisor',
    aiFeatureDesc: 'Chat in English or French. Ursella AI analyzes sales velocity, inventory depletion, and profit margins in real time.',
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
  },
  aiAdvisor: {
    title: 'Ursella AI Advisor',
    subtitle: 'Strategic AI business advisor grounded in your verified store ledger & FIFO engine',
    inputPlaceholder: 'Ask in English or French (e.g., "Comment se portent mes ventes ?" or "What is my profit?")...',
    askPrompt: 'Ask Ursella',
    listening: 'Listening to voice prompt...',
    analyzing: 'Ursella is reasoning with store ledger...',
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
    languageNotice: 'Ursella AI dynamically reasons and answers in English and French.',
  },
  reports: {
    title: 'Financial & Tax Reports',
    profitAndLoss: 'Profit & Loss Statement (P&L)',
    cashFlowStatement: 'Cash Flow Statement',
    taxEstimate: 'Tax & VAT Estimate',
    dateRange: 'Reporting Period',
    downloadPdf: 'Download PDF Report',
    downloadCsv: 'Export CSV',
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
  },
  navigation: {
    home: 'Accueil',
    sell: 'Vente (Caisse)',
    pos: 'Caisse / POS',
    inventory: 'Stock & Catalogue',
    catalog: 'Produits',
    customers: 'Clients & Débiteurs',
    crm: 'Carnet de Dettes',
    analytics: 'Statistiques',
    reports: 'Rapports Financiers',
    expenses: 'Dépenses',
    aiAdvisor: 'Ursella IA',
    proactiveAI: 'IA Proactive',
    dataHub: 'Centre de Données',
    billing: 'Abonnement & Forfait',
    settings: 'Paramètres',
    menu: 'Menu',
    logout: 'Déconnexion',
  },
  landing: {
    heroBadge: 'Système d’Exploitation Commercial Moderne',
    heroTag: 'Co-pilote Moderne de Gestion pour le Commerce',
    heroTitle: 'La façon simple de gérer vos ventes, suivre vos stocks et piloter votre commerce.',
    heroTitlePrefix: 'Le Système d’Exploitation Commercial avec ',
    heroTitleHighlight: 'Méthode PEPS (FIFO) & Intelligence IA',
    heroTitleSuffix: ' pour le Commerce Moderne',
    heroSubtitle:
      'Ursella réunit une caisse ultra-rapide, le suivi rigoureux des stocks PEPS (FIFO), les relances clients et l’intelligence financière quotidienne dans un espace unique et épuré.',
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
    aiFeatureTitle: 'Conseiller IA Bilingue Français / Anglais',
    aiFeatureDesc: 'Posez vos questions en français. Ursella IA analyse vos ventes du jour, vos ruptures de stock et vos marges en temps réel.',
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
  },
  aiAdvisor: {
    title: 'Conseiller Ursella IA',
    subtitle: 'Conseiller financier et stratégique bilingue alimenté par votre grand livre certifié et l’algorithme PEPS',
    inputPlaceholder: 'Posez votre question en français ou anglais (ex. "Comment se portent mes ventes ?" ou "Qui me doit de l’argent ?")...',
    askPrompt: 'Demander à Ursella',
    listening: 'Écoute vocale en cours...',
    analyzing: 'Ursella analyse vos comptes...',
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
    languageNotice: 'Ursella IA raisonne et répond naturellement en français et en anglais.',
  },
  reports: {
    title: 'Rapports & Déclarations Financières',
    profitAndLoss: 'Compte de Résultat (P&L)',
    cashFlowStatement: 'Tableau de Flux de Trésorerie',
    taxEstimate: 'Estimation TVA & Impôts',
    dateRange: 'Période d’Analyse',
    downloadPdf: 'Télécharger le Rapport PDF',
    downloadCsv: 'Exporter en CSV',
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
