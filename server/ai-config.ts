import { GoogleGenAI } from '@google/genai';
import type { AIResponseSource } from '../src/types/ai.ts';

/**
 * Single Source of Truth for Gemini AI Configuration across Ursella Backend.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
export const FALLBACK_LITE_MODEL = 'gemini-3.1-flash-lite';

/** List of known deprecated models that return 404 NOT_FOUND on modern Google GenAI endpoints */
const DEPRECATED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
]);

/**
 * Validates and resolves the active Gemini model identifier.
 * Prevents 404 NOT_FOUND errors if legacy/deprecated model names are passed via environment variables.
 */
export function getActiveGeminiModel(): string {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (!envModel) {
    return DEFAULT_GEMINI_MODEL;
  }

  if (DEPRECATED_MODELS.has(envModel.toLowerCase())) {
    console.warn(
      `[AI Config] Warning: configured GEMINI_MODEL "${envModel}" is deprecated and unsupported. Auto-resolving to authoritative "${DEFAULT_GEMINI_MODEL}".`
    );
    return DEFAULT_GEMINI_MODEL;
  }

  return envModel;
}

let geminiClientInstance: GoogleGenAI | null = null;

/**
 * Returns a lazily-initialized GoogleGenAI client singleton.
 * Returns null if GEMINI_API_KEY is not configured.
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey.length > 0 && apiKey !== 'placeholder-key' && !apiKey.includes('MY_GEMINI_API_KEY')) {
      geminiClientInstance = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return geminiClientInstance;
}

/**
 * Observability helper to log execution provenance and runtime metrics.
 */
export function logAIProvenance(meta: {
  endpoint: string;
  businessId: string;
  source: AIResponseSource;
  model: string;
  latencyMs: number;
  error?: string;
}) {
  const statusEmoji = meta.source === 'GEMINI_RESPONSE' ? '✨ [GEMINI_LIVE]' : '🛡️ [DETERMINISTIC_FALLBACK]';
  console.log(
    `[AI Provenance] ${statusEmoji} endpoint=${meta.endpoint} business=${meta.businessId} model=${meta.model} source=${meta.source} latency=${meta.latencyMs}ms${meta.error ? ` err="${meta.error}"` : ''}`
  );
}
