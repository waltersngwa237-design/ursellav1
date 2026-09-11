import {
  GROQ_API_ENDPOINT,
  GROQ_PRODUCTION_MODEL,
  getGroqApiKey,
  logAIProvenance,
} from './ai-config.ts';
import { sanitizeFollowUpSuggestions } from './ai-prompt.utils.ts';
import type { AIStructuredResponse, AIDailyBrief } from '../src/types/ai.ts';
import type { ChatReasoningContext } from './gemini.service.ts';

/**
 * Production-ready Secondary AI Provider: Groq API.
 * Uses authoritative model: openai/gpt-oss-120b.
 * Strictly receives the exact same system instructions, prompt, and business context as Gemini.
 */
export class GroqService {
  /**
   * Executes AI Chat reasoning using Groq API as secondary fallback.
   * Model: openai/gpt-oss-120b
   */
  public static async generateChatResponse(
    systemInstruction: string,
    contextPrompt: string,
    ctx: ChatReasoningContext,
    timeoutMs = 12000
  ): Promise<AIStructuredResponse | null> {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      console.warn('[Groq Router] GROQ_API_KEY is not configured in server environment.');
      return null;
    }

    if (ctx.testSimulation === 'all-fail') {
      console.warn('[Groq Router] Simulated secondary provider failure: all-fail');
      return null;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GROQ_API_ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_PRODUCTION_MODEL,
          messages: [
            {
              role: 'system',
              content: systemInstruction,
            },
            {
              role: 'user',
              content: contextPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Groq API returned HTTP ${response.status}: ${errorText.slice(0, 250)}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - startTime;

      if (!content || typeof content !== 'string') {
        throw new Error('Groq API returned empty response content');
      }

      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.answer === 'string') {
          logAIProvenance({
            endpoint: 'generateChatResponse',
            businessId: ctx.businessName,
            source: 'GROQ_RESPONSE',
            provider: 'groq',
            model: GROQ_PRODUCTION_MODEL,
            latencyMs,
          });

          return {
            answer: parsed.answer,
            intent: (parsed.intent as any) || ctx.parsedIntent?.intent || 'business_overview',
            keyMetrics: parsed.keyMetrics || [],
            observations: parsed.observations || [],
            recommendations: parsed.recommendations || [],
            anomaliesDetected: parsed.anomaliesDetected || [],
            confidence: parsed.confidence || 'high_confidence',
            dataSufficiencyNote: parsed.dataSufficiencyNote,
            followUpSuggestions: sanitizeFollowUpSuggestions(parsed.followUpSuggestions),
            proposedAction: parsed.proposedAction,
            responseSource: 'GROQ_RESPONSE',
            provider: 'groq',
          };
        }
      } catch (parseError: any) {
        logAIProvenance({
          endpoint: 'generateChatResponse',
          businessId: ctx.businessName,
          source: 'GROQ_RESPONSE',
          provider: 'groq',
          model: GROQ_PRODUCTION_MODEL,
          latencyMs,
          error: `JSON parse warning: ${parseError?.message}`,
        });

        return {
          answer: content,
          confidence: 'moderate_confidence',
          followUpSuggestions: ['What else should I focus on?'],
          responseSource: 'GROQ_RESPONSE',
          provider: 'groq',
        };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isTimeout = err?.name === 'AbortError';
      const errMsg = isTimeout ? `Groq request timed out after ${timeoutMs}ms` : err?.message || String(err);
      console.warn(`[Groq API Error] Model="${GROQ_PRODUCTION_MODEL}" failed after ${latencyMs}ms:`, errMsg);

      logAIProvenance({
        endpoint: 'generateChatResponse',
        businessId: ctx.businessName,
        source: 'GROQ_RESPONSE',
        provider: 'groq',
        model: GROQ_PRODUCTION_MODEL,
        latencyMs,
        error: errMsg,
      });

      return null;
    }

    return null;
  }

  /**
   * Executes secondary Daily Brief generation using Groq API.
   */
  public static async generateDailyBrief(
    prompt: string,
    systemInstruction: string,
    ctx: ChatReasoningContext,
    today: any,
    debtors: any,
    timeoutMs = 12000
  ): Promise<AIDailyBrief | null> {
    const apiKey = getGroqApiKey();
    if (!apiKey) return null;

    if (ctx.testSimulation === 'all-fail') {
      return null;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GROQ_API_ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_PRODUCTION_MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Groq HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      const latencyMs = Date.now() - startTime;

      logAIProvenance({
        endpoint: 'generateDailyBrief',
        businessId: ctx.businessName,
        source: 'GROQ_RESPONSE',
        provider: 'groq',
        model: GROQ_PRODUCTION_MODEL,
        latencyMs,
      });

      return {
        generatedAt: new Date().toISOString(),
        businessName: ctx.businessName,
        currency: ctx.currency,
        headline: parsed.headline || `Daily Briefing for ${ctx.businessName}`,
        executiveSummary: parsed.executiveSummary || `Today's performance overview for ${ctx.businessName}.`,
        performanceSnapshot: {
          revenue: today.revenueToday,
          transactions: today.transactionCountToday,
          amountCollected: today.cashCollectedToday,
          expenses: today.expensesToday,
          outstandingReceivables: debtors.totalOutstandingDebt,
        },
        keyTakeaways: parsed.keyTakeaways || [],
        inventoryAlerts: parsed.inventoryAlerts || [],
        debtFollowUps: parsed.debtFollowUps || [],
        recommendedFocusToday: parsed.recommendedFocusToday || 'Review daily sales and inventory levels.',
        confidence: parsed.confidence || (today.transactionCountToday >= 5 ? 'high_confidence' : 'insufficient_data'),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
