import type { PaymentMethodType } from './index.ts';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export type TimeSeriesInterval = 'day' | 'week' | 'month';

export type DataConfidenceLevel = 'high_confidence' | 'moderate_confidence' | 'insufficient_data';

export interface DateRangeWindow {
  startDate: string; // ISO string
  endDate: string; // ISO string
  label: string;
  priorStartDate: string; // Equivalent comparison window
  priorEndDate: string;
  priorLabel: string;
}

export interface MetricComparison {
  current: number;
  prior: number;
  absoluteChange: number;
  percentageChange: number | null; // null if prior was 0
  trend: 'positive' | 'negative' | 'neutral' | 'no_data';
}

export interface FinancialOverviewMetrics {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number; // percentage (e.g. 35.5%)
  operatingExpenses: number;
  estimatedNetProfit: number;
  netMargin: number; // percentage
  transactionCount: number;
  averageOrderValue: number;
  unitsSold: number;
  amountCollected: number; // Actual cash collected from payments
  outstandingReceivables: number; // Total unpaid or partial balance
  inventoryValuation: number; // Stock * current cost basis
  lowStockCount: number;
  outOfStockCount: number;
}

export interface PeriodComparisonSummary {
  revenue: MetricComparison;
  grossProfit: MetricComparison;
  operatingExpenses: MetricComparison;
  estimatedNetProfit: MetricComparison;
  transactionCount: MetricComparison;
  averageOrderValue: MetricComparison;
  amountCollected: MetricComparison;
}

export interface TimeSeriesPoint {
  date: string; // e.g. "2026-08-20" or "Aug 20"
  timestamp: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  expenses: number;
  estimatedNetProfit: number;
  cashCollected: number;
  transactionCount: number;
  unitsSold: number;
}

export interface ProductPerformanceItem {
  id: string;
  name: string;
  sku: string | null;
  categoryName: string | null;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  minimumStockLevel: number;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  transactionCount: number;
  lastSaleAt: string | null;
  observedVelocityUnitsPerDay: number;
  stockStatus: 'out_of_stock' | 'low_stock' | 'healthy' | 'slow_moving';
  daysOfInventoryRemaining: number | null;
}

export interface CustomerSegmentMetrics {
  totalCustomers: number;
  activeInPeriod: number;
  newCustomersInPeriod: number;
  repeatCustomers: number; // Customers with >1 completed sale
  highValueCustomers: number; // Top 10% spenders
  inactiveCustomers: number; // No sale within 30+ days
  debtorCustomers: number; // Customers with outstanding_balance > 0
  totalOutstandingDebt: number;
  topCustomersByRevenue: Array<{
    id: string;
    name: string;
    phone: string | null;
    revenueInPeriod: number;
    completedOrdersInPeriod: number;
    lifetimeSpent: number;
    outstandingBalance: number;
    lastPurchaseAt: string | null;
  }>;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  percentageOfTotalExpenses: number;
  percentageOfRevenue: number;
}

export interface CashFlowMetrics {
  cashInflows: number; // Payments collected
  cashOutflows: number; // Expenses paid
  netCashFlow: number; // Inflows - Outflows
  accrualRevenue: number; // Revenue generated (earned)
  outstandingCreditAdded: number; // Uncollected part of sales
  paymentsByMethod: Record<PaymentMethodType | string, number>;
  timeSeries: Array<{
    date: string;
    cashIn: number;
    cashOut: number;
    netCash: number;
  }>;
}

export interface BusinessAnomalyAlert {
  id: string;
  type: 'warning' | 'info' | 'critical' | 'positive';
  category: 'sales' | 'expenses' | 'inventory' | 'receivables' | 'margin';
  title: string;
  description: string;
  metricValue?: string;
  detectedAt: string;
  recommendationNote?: string;
}

export interface BusinessHealthIndicator {
  score: number; // 0 to 100
  rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention' | 'Critical';
  methodology: string;
  drivers: Array<{
    name: string;
    weight: number;
    score: number;
    status: 'healthy' | 'moderate' | 'warning';
    detail: string;
  }>;
}

export interface DataSufficiencyInfo {
  confidence: DataConfidenceLevel;
  transactionCount: number;
  daysEvaluated: number;
  description: string;
}

export interface CompleteBusinessAnalytics {
  businessId: string;
  businessName: string;
  currency: string;
  timezone: string;
  window: DateRangeWindow;
  financialOverview: FinancialOverviewMetrics;
  comparison: PeriodComparisonSummary;
  timeSeries: TimeSeriesPoint[];
  topProducts: ProductPerformanceItem[];
  customerAnalytics: CustomerSegmentMetrics;
  expenseAnalytics: {
    totalExpenses: number;
    expenseToRevenueRatio: number;
    categories: ExpenseCategoryBreakdown[];
    recentExpenses: Array<{
      id: string;
      title: string;
      category: string;
      amount: number;
      expense_date: string;
      payment_method: string;
    }>;
  };
  cashFlow: CashFlowMetrics;
  inventorySummary: {
    totalValuation: number;
    totalActiveSKUs: number;
    lowStockCount: number;
    outOfStockCount: number;
    slowMovingCount: number;
    lowStockItems: ProductPerformanceItem[];
    slowMovingItems: ProductPerformanceItem[];
  };
  healthIndicator: BusinessHealthIndicator;
  anomalies: BusinessAnomalyAlert[];
  dataSufficiency: DataSufficiencyInfo;
}

/**
 * Structured Factual Context format prepared for Gemini in Phase 4.
 * Contains only authorized, verified mathematical aggregates (zero hallucinations, zero secrets).
 */
export interface AIBusinessContextPayload {
  version: '1.0';
  generatedAt: string;
  business: {
    id: string;
    name: string;
    type: string;
    currency: string;
    timezone: string;
  };
  period: {
    label: string;
    startDate: string;
    endDate: string;
    daysCount: number;
  };
  financialSummary: {
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingExpenses: number;
    estimatedNetProfit: number;
    netMarginPct: number;
    cashCollected: number;
    netCashMovement: number;
    outstandingReceivables: number;
    transactionCount: number;
    averageOrderValue: number;
  };
  periodComparison: {
    priorPeriodLabel: string;
    revenuePctChange: number | null;
    grossProfitPctChange: number | null;
    expensesPctChange: number | null;
    netProfitPctChange: number | null;
    transactionsPctChange: number | null;
  };
  inventoryFacts: {
    totalValuation: number;
    activeProductsCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    criticalLowStockItems: Array<{
      name: string;
      stockQuantity: number;
      minStockLevel: number;
    }>;
    slowMovingItems: Array<{
      name: string;
      stockQuantity: number;
      daysSinceLastSale: number | null;
    }>;
  };
  topProductsByRevenue: Array<{
    name: string;
    revenue: number;
    unitsSold: number;
    grossProfit: number;
    grossMarginPct: number;
    salesVelocityPerDay: number;
  }>;
  customerFacts: {
    totalRegistered: number;
    activeInPeriod: number;
    newInPeriod: number;
    repeatCustomersCount: number;
    customersWithDebtCount: number;
    totalReceivables: number;
  };
  expenseFacts: {
    total: number;
    percentageOfRevenue: number;
    topCategories: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  detectedAnomalies: Array<{
    type: string;
    category: string;
    title: string;
    description: string;
  }>;
  businessHealth: {
    score: number;
    rating: string;
    primaryDrivers: string[];
  };
  dataSufficiency: {
    confidence: DataConfidenceLevel;
    note: string;
  };
}
