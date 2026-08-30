export type AIIntentType =
  | 'business_overview'
  | 'sales'
  | 'sales_today'
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
  | 'identity_lookup'
  | 'fact_retrieval'
  | 'explanation'
  | 'analysis'
  | 'diagnosis'
  | 'calculation'
  | 'general_overview'
  | 'fifo_audit'
  | 'unknown';

export type AIDataConfidence = 'high_confidence' | 'moderate_confidence' | 'insufficient_data';

export interface AIMetricCard {
  label: string;
  value: string | number;
  formattedValue?: string;
  change?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
}

export interface AIRecommendation {
  id: string;
  title: string;
  reasoning: string;
  actionSuggestion?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: 'inventory' | 'sales' | 'expenses' | 'credit' | 'pricing' | 'general';
}

export interface AIProposedAction {
  actionType: string;
  title: string;
  description: string;
  category: 'inventory_restock' | 'debt_reminder' | 'expense_review' | 'pricing_update' | 'marketing';
  payload?: Record<string, unknown>;
  phaseStatus: 'phase4_preview_only' | 'ready_for_execution';
}

export type AIResponseSource = 'GEMINI_RESPONSE' | 'DETERMINISTIC_FALLBACK';

export interface AIStructuredResponse {
  answer: string;
  intent?: AIIntentType;
  keyMetrics?: AIMetricCard[];
  observations?: string[];
  recommendations?: AIRecommendation[];
  anomaliesDetected?: string[];
  confidence: AIDataConfidence;
  dataSufficiencyNote?: string;
  followUpSuggestions?: string[];
  toolsUsed?: string[];
  proposedAction?: AIProposedAction;
  responseSource?: AIResponseSource;
}

export interface AIConversationSummary {
  id: string;
  business_id: string;
  user_id: string;
  title: string;
  context_type: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_preview?: string;
}

export interface AIChatMessage {
  id: string;
  conversation_id: string;
  business_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    intent?: AIIntentType;
    structured?: AIStructuredResponse;
    toolsUsed?: string[];
    latencyMs?: number;
    tokensUsed?: number;
    responseSource?: AIResponseSource;
    error?: string;
  };
  created_at: string;
}

export interface AIDailyBrief {
  generatedAt: string;
  businessName: string;
  currency: string;
  headline: string;
  executiveSummary: string;
  performanceSnapshot: {
    revenue: number;
    transactions: number;
    amountCollected: number;
    expenses: number;
    outstandingReceivables: number;
  };
  keyTakeaways: string[];
  inventoryAlerts: string[];
  debtFollowUps: string[];
  recommendedFocusToday: string;
  confidence: AIDataConfidence;
}

export interface AIChatBusinessContext {
  businessName?: string;
  businessType?: string;
  currency?: string;
  currencySymbol?: string;
  timezone?: string;
  ownerName?: string;
  address?: string;
  taxRate?: number;
  country?: string;
}

export interface AIChatRequestPayload {
  businessId: string;
  conversationId?: string;
  message: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  preferredTimeHorizonDays?: number;
  businessContext?: AIChatBusinessContext;
}

export interface AIChatResponsePayload {
  conversationId: string;
  messageId: string;
  response: AIStructuredResponse;
  intent: AIIntentType;
  toolsUsed: string[];
  latencyMs: number;
  responseSource?: AIResponseSource;
}
