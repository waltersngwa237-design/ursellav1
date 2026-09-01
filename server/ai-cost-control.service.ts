import { serverSupabase } from './business-tools.service.ts';
import { SubscriptionService } from './subscription.service.ts';
import { getActiveGeminiModel, FALLBACK_LITE_MODEL } from './ai-config.ts';

export interface AIUsageLogEntry {
  businessId: string;
  userId?: string;
  requestType: 'chat' | 'daily_brief' | 'proactive_scan' | 'action_reasoning';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

// Cost estimation per 1k tokens for Gemini models (approximate USD)
const MODEL_COSTS: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'gemini-3.7-flash': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gemini-3.6-flash': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gemini-3.1-flash-lite': { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  'gemini-3.1-pro-preview': { inputPer1k: 0.00125, outputPer1k: 0.005 },
};

export class AICostControlService {
  /**
   * Determine the most cost-effective and task-appropriate model tier
   */
  static selectModelForTask(taskType: 'chat' | 'intent_classification' | 'daily_brief' | 'proactive_insights'): string {
    const configuredModel = getActiveGeminiModel();
    const fallbackLiteModel = process.env.GEMINI_FALLBACK_MODEL || FALLBACK_LITE_MODEL;

    if (taskType === 'intent_classification') {
      return fallbackLiteModel; // High speed, minimal cost
    }
    return configuredModel;
  }

  /**
   * Log AI request metrics and track token expenditures
   */
  static async logUsage(entry: AIUsageLogEntry): Promise<void> {
    const inputTokens = entry.inputTokens || 450;
    const outputTokens = entry.outputTokens || 350;

    const rate = MODEL_COSTS[entry.model] || MODEL_COSTS['gemini-3.7-flash'];
    const estimatedCostUsd =
      (inputTokens / 1000) * rate.inputPer1k + (outputTokens / 1000) * rate.outputPer1k;

    try {
      await serverSupabase.from('ai_usage_logs').insert({
        business_id: entry.businessId,
        user_id: entry.userId || null,
        request_type: entry.requestType,
        model: entry.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
        latency_ms: entry.latencyMs,
        success: entry.success,
        error_message: entry.errorMessage || null,
      });
    } catch (err) {
      console.warn('[AICostControlService] Error recording usage log in Supabase:', err);
    }
  }

  /**
   * Verify whether a business is within its AI query budget
   */
  static async verifyQuota(businessId: string): Promise<{ allowed: boolean; reason?: string }> {
    return SubscriptionService.checkEntitlement(businessId, 'ai_query');
  }
}
