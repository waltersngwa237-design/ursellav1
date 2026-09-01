import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase/client.ts';

/**
 * Service to supply Google Gemini with structured, pre-aggregated business intelligence context
 * extracted from PostgreSQL without exposing raw row dumps or violating multi-tenant boundaries.
 */
export const AIContextService = {
  async getBusinessContext(businessId: string, timeHorizonDays = 30) {
    const { data, error } = await (supabase as any).rpc('get_ai_business_context', {
      p_business_id: businessId,
      p_time_horizon_days: timeHorizonDays,
    });

    if (error) {
      throw new Error(`Failed to fetch AI business context: ${error.message}`);
    }

    return data;
  },

  /**
   * Generates proactive AI insights using Gemini and structured business context.
   * Model selection adheres to standard recommendations (gemini-3.7-flash for fast reasoning).
   */
  async generateBusinessAdvice(businessId: string, userQuery: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment.');
    }

    const businessContext = await this.getBusinessContext(businessId);
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are Ursella's executive AI business analyst for small businesses.
You have access to the business's real-time financial, sales, inventory, and customer metrics in the context below.
Provide actionable, concise, mathematically grounded business guidance. Do not guess numbers; cite the authoritative facts.

AUTHORITATIVE BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        { role: 'user', parts: [{ text: userQuery }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    return response.text;
  }
};
