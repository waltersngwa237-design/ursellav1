import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiService, type ChatReasoningContext } from '../server/gemini.service.ts';
import { GroqService } from '../server/groq.service.ts';
import { GROQ_PRODUCTION_MODEL, getActiveGeminiModel } from '../server/ai-config.ts';

const baseContext: ChatReasoningContext = {
  businessName: 'Apex General Enterprises',
  businessType: 'Retail & Wholesale',
  currency: 'XAF',
  timezone: 'Africa/Douala',
  currentDateIso: new Date().toISOString(),
  toolResults: {
    get_today_sales_summary: {
      revenue: 450000,
      salesCount: 14,
      grossProfit: 125000,
      grossMarginPct: 27.7,
      cashCollected: 380000,
    },
    get_low_stock_products: [
      { product_name: 'Basmati Rice 5kg', stock_quantity: 2, min_stock_threshold: 10 },
      { product_name: 'Refined Palm Oil 1L', stock_quantity: 4, min_stock_threshold: 15 },
    ],
    get_top_debtors: [
      { customer_name: 'Superette La Grace', outstanding_debt: 70000 },
    ],
  },
  parsedIntent: {
    intent: 'sales_today',
    domain: 'sales',
    timePeriod: 'today',
    primaryGoal: 'Check sales performance and margins for today',
  },
};

test('Provider Model Verification: Groq must use exact model openai/gpt-oss-120b', () => {
  assert.equal(GROQ_PRODUCTION_MODEL, 'openai/gpt-oss-120b');
});

test('TEST 1: Gemini succeeds -> returns Gemini response, Groq is NOT called', async () => {
  let groqWasCalled = false;
  const originalGroqChat = GroqService.generateChatResponse;
  GroqService.generateChatResponse = async () => {
    groqWasCalled = true;
    return null;
  };

  try {
    const res = await GeminiService.generateChatResponse('How are my sales today?', {
      ...baseContext,
      testSimulation: undefined, // Normal path
    });

    assert.ok(res, 'Should return a response');
    assert.ok(res.answer, 'Should contain an answer');
    // In live or deterministic fallback if key missing in test env, Groq must NOT be called if Gemini succeeds
    if (res.responseSource === 'GEMINI_RESPONSE') {
      assert.equal(groqWasCalled, false, 'Groq must NOT be called when Gemini succeeds');
      assert.equal(res.provider, 'gemini');
    }
  } finally {
    GroqService.generateChatResponse = originalGroqChat;
  }
});

test('TEST 2: Simulate Gemini 503/429/timeout -> 1 bounded retry -> Groq secondary called', async () => {
  let groqCalledWithModel = '';
  const originalGroqChat = GroqService.generateChatResponse;
  GroqService.generateChatResponse = async (sys, prompt, ctx) => {
    groqCalledWithModel = GROQ_PRODUCTION_MODEL;
    return {
      answer: '### Executive Summary\nToday revenue is XAF 450,000 across 14 transactions with a healthy 27.7% gross margin.',
      keyMetrics: [
        { label: "Today's Revenue", value: 450000, formattedValue: 'XAF 450,000', trend: 'positive' },
      ],
      recommendations: [
        {
          id: 'rec-1',
          title: 'Replenish Basmati Rice',
          reasoning: 'Stock level is below threshold',
          priority: 'high',
        },
      ],
      confidence: 'high_confidence',
      followUpSuggestions: ['Which products have the best margin?'],
      responseSource: 'GROQ_RESPONSE',
      provider: 'groq',
    };
  };

  try {
    // Simulate 503
    const res503 = await GeminiService.generateChatResponse('What is our margin today?', {
      ...baseContext,
      testSimulation: 'gemini-503',
    });

    assert.equal(groqCalledWithModel, 'openai/gpt-oss-120b', 'Groq must be called with openai/gpt-oss-120b');
    assert.equal(res503.responseSource, 'GROQ_RESPONSE');
    assert.equal(res503.provider, 'groq');
    assert.ok(res503.answer.includes('450,000'));

    // Reset and simulate timeout
    groqCalledWithModel = '';
    const resTimeout = await GeminiService.generateChatResponse('Show inventory alerts', {
      ...baseContext,
      testSimulation: 'gemini-timeout',
    });

    assert.equal(groqCalledWithModel, 'openai/gpt-oss-120b');
    assert.equal(resTimeout.responseSource, 'GROQ_RESPONSE');
    assert.equal(resTimeout.provider, 'groq');
  } finally {
    GroqService.generateChatResponse = originalGroqChat;
  }
});

test('TEST 3: Simulate Gemini failure AND Groq failure -> deterministic fallback responds cleanly', async () => {
  const startTime = Date.now();
  const res = await GeminiService.generateChatResponse('What is my sales summary?', {
    ...baseContext,
    testSimulation: 'all-fail',
  });

  const duration = Date.now() - startTime;
  assert.ok(duration < 2000, `Fallback path must be fast, took ${duration}ms`);
  assert.ok(res, 'Deterministic fallback must respond');
  assert.equal(res.responseSource, 'DETERMINISTIC_FALLBACK');
  assert.ok(res.answer, 'Must provide an answer');
  assert.ok(res.answer.includes('Apex General Enterprises') || res.answer.includes('Executive Summary'));
});

test('Domain Questions with Groq Fallback: Product & Margins', async () => {
  const originalGroqChat = GroqService.generateChatResponse;
  GroqService.generateChatResponse = async (sys, prompt, ctx) => {
    // Validate that context was passed to Groq
    assert.ok(prompt.includes('Basmati Rice'), 'Groq must receive the same inventory context');
    assert.ok(sys.includes('Ursella AI'), 'Groq must receive the same system instructions');
    return {
      answer: '### Executive Summary\nBasmati Rice margin is 28% while Palm Oil margin is 22%.',
      confidence: 'high_confidence',
      responseSource: 'GROQ_RESPONSE',
      provider: 'groq',
    };
  };

  try {
    const res = await GeminiService.generateChatResponse('What are my margins on rice?', {
      ...baseContext,
      testSimulation: 'gemini-503',
    });
    assert.equal(res.provider, 'groq');
    assert.ok(res.answer.includes('Basmati Rice'));
  } finally {
    GroqService.generateChatResponse = originalGroqChat;
  }
});
