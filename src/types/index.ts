import type {
  Database,
  MemberRole,
  PaymentMethodType,
  SaleStatusType,
  PaymentStatusType,
  InventoryTransactionType,
} from './database.types.ts';

export type {
  MemberRole,
  PaymentMethodType,
  SaleStatusType,
  PaymentStatusType,
  InventoryTransactionType,
};

export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type Business = Database['public']['Tables']['businesses']['Row'];
export type BusinessMember = Database['public']['Tables']['business_members']['Row'];
export type BusinessSettings = Database['public']['Tables']['business_settings']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type InventoryTransaction = Database['public']['Tables']['inventory_transactions']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];

export interface UserBusinessMembership {
  business: Business;
  role: MemberRole;
  settings: BusinessSettings | null;
}

// Cart Item for Point of Sale
export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
}

// Detailed Sale Record with Items & Customer
export interface SaleWithDetails extends Sale {
  customers?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  sale_items: Array<
    SaleItem & {
      products?: {
        id: string;
        name: string;
        sku: string | null;
      } | null;
    }
  >;
  payments?: Payment[];
}

// Customer Profile with Calculated Balance and History
export interface CustomerWithSummary extends Customer {
  total_spent: number;
  purchase_count: number;
  last_purchase_at: string | null;
  outstanding_balance: number;
  recent_sales?: Sale[];
}

// Product with Category & Performance Metrics
export interface ProductWithCategory extends Product {
  category?: ProductCategory | null;
  supplier?: Supplier | null;
  sales_count?: number;
  total_units_sold?: number;
}

// Expense Categories
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Transport & Logistics',
  'Salaries & Wages',
  'Utilities (Power, Water, Internet)',
  'Marketing & Advertising',
  'Stock & Procurement',
  'Equipment & Hardware',
  'Office Supplies',
  'Taxes & Licenses',
  'Maintenance & Repairs',
  'Other Operational Expense',
] as const;

export type ExpenseCategoryType = (typeof EXPENSE_CATEGORIES)[number] | string;

export type SupportedCurrency = 'XAF' | 'NGN' | 'GHS' | 'KES' | 'USD' | 'EUR' | 'GBP' | 'ZAR';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  format: (amount: number) => string;
}

export const CURRENCY_MAP: Record<SupportedCurrency, CurrencyConfig> = {
  XAF: {
    code: 'XAF',
    symbol: 'FCFA',
    name: 'Central African CFA Franc (FCFA)',
    format: (val) => `${Math.round(val).toLocaleString()} FCFA`,
  },
  NGN: {
    code: 'NGN',
    symbol: '₦',
    name: 'Nigerian Naira (₦)',
    format: (val) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  GHS: {
    code: 'GHS',
    symbol: 'GH₵',
    name: 'Ghanaian Cedi (GH₵)',
    format: (val) => `GH₵${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  KES: {
    code: 'KES',
    symbol: 'KSh',
    name: 'Kenyan Shilling (KSh)',
    format: (val) => `KSh ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar ($)',
    format: (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro (€)',
    format: (val) => `€${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound (£)',
    format: (val) => `£${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand (R)',
    format: (val) => `R ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
};

export const BUSINESS_TYPES = [
  'Retail & Supermarket',
  'Food & Restaurant / Cafe',
  'Fashion & Apparel',
  'Beauty & Cosmetics',
  'Pharmacy & Health',
  'Services & Consulting',
  'Agriculture & Produce',
  'Electronics & Gadgets',
  'Wholesale & Distribution',
  'Other Business',
] as const;

export type BusinessType = typeof BUSINESS_TYPES[number];

export interface DashboardMetrics {
  revenueToday: number;
  grossProfitToday: number;
  outstandingReceivables: number;
  transactionCountToday: number;
  lowStockCount: number;
  totalExpensesToday: number;
  recentTransactions: Array<{
    id: string;
    total: number;
    amount_paid: number;
    payment_status: PaymentStatusType;
    payment_method: PaymentMethodType | null;
    sold_at: string;
    customer_name?: string;
    items_summary: string;
  }>;
}

export type AppNavRoute =
  | 'home'
  | 'sell'
  | 'business'
  | 'customers'
  | 'analytics'
  | 'reports'
  | 'insights'
  | 'ai'
  | 'data-io'
  | 'billing'
  | 'more';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  description: string;
  monthly_price: number;
  annual_price: number;
  currency: string;
  features_json: string[];
  max_members: number;
  ai_monthly_quota: number;
  max_products: number;
  allows_csv_import: boolean;
  allows_export: boolean;
  allows_advanced_reports: boolean;
  allows_push_notifications: boolean;
  is_active: boolean;
}

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'incomplete';
  provider: 'momo' | 'stripe' | 'flutterwave' | 'paystack' | 'manual';
  provider_subscription_id?: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan?: SubscriptionPlan;
  usage?: {
    ai_queries_used: number;
    ai_monthly_quota: number;
    members_count: number;
    max_members: number;
  };
}

export interface BusinessReportData {
  reportType: 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow';
  businessId: string;
  generatedAt: string;
  periodLabel: string;
  currency: string;
  summaryMetrics: Record<string, number | string>;
  breakdownRows: Array<Record<string, any>>;
}

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export interface ImportPreviewResponse {
  entityType: 'products' | 'customers' | 'expenses';
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ImportPreviewRow[];
  headers: string[];
}

export * from './analytics.ts';
export * from './ai.ts';
export * from './proactive.ts';

