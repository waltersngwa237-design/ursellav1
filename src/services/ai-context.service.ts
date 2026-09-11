import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { AIService } from './ai.service.ts';

/**
 * Service to supply Google Gemini with structured, pre-aggregated business intelligence context
 * extracted from PostgreSQL without exposing raw row dumps or violating multi-tenant boundaries.
 */
export const AIContextService = {
  async getBusinessContext(businessId: string, timeHorizonDays = 30) {
    if (isSupabaseConfigured) {
      const { data, error } = await (supabase as any).rpc('get_ai_business_context', {
        p_business_id: businessId,
        p_time_horizon_days: timeHorizonDays,
      });

      if (!error && data) {
        return data;
      }
    }
    return null;
  },

  /**
   * Generates proactive AI insights using server-proxied Gemini.
   */
  async generateBusinessAdvice(businessId: string, userQuery: string) {
    const res = await AIService.sendChatMessage({
      businessId,
      message: userQuery,
      contextType: 'general',
    });
    return res.response || res.message || '';
  },
};

