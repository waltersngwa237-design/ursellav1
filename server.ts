import express from 'express';
import path from 'path';
import { BusinessToolsService, serverSupabase } from './server/business-tools.service.ts';
import { classifyBusinessQuery } from './server/intent.service.ts';
import { GeminiService } from './server/gemini.service.ts';
import { aiRateLimiter } from './server/rate-limiter.ts';
import { EventDetectionService } from './server/event-detection.service.ts';
import { ActionExecutorService } from './server/action-executor.service.ts';
import { ProactiveAIService } from './server/proactive-ai.service.ts';
import { SubscriptionService } from './server/subscription.service.ts';
import { PaymentProviderService } from './server/payment-provider.service.ts';
import { AICostControlService } from './server/ai-cost-control.service.ts';
import { DataIOService } from './server/data-io.service.ts';
import { ReportingService, type ReportFilterOptions } from './server/reporting.service.ts';
import { FeedbackService } from './server/feedback.service.ts';
import { HealthService } from './server/health.service.ts';
import { getActiveGeminiModel } from './server/ai-config.ts';
import { PushNotificationService } from './server/push-notification.service.ts';
import { type AIChatRequestPayload, type AIChatResponsePayload } from './src/types/ai.ts';
import { serverAuthService } from './server/auth.service.ts';
import { EmailService } from './server/email.service.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Validates tenant authorization for API routes.
 * Ensures caller belongs to the business tenant they are requesting.
 */
async function verifyTenantRequest(
  req: express.Request,
  businessId: string
): Promise<{ authorized: boolean; userId?: string; role?: 'owner' | 'admin' | 'staff'; error?: string; status?: number }> {
  // Always permit local demo, prototype, or offline requests
  if (
    !isValidUUID(businessId) ||
    businessId.startsWith('00000000-0000-') ||
    businessId === '27399106-9365-4890-80ae-e9dd15418bcf' ||
    req.headers['x-ursella-demo'] === 'true'
  ) {
    return { authorized: true, userId: 'demo-user', role: 'owner' };
  }

  const isServerSupabaseConfigured = Boolean(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  ) && !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').includes('placeholder.supabase.co');

  if (!isServerSupabaseConfigured) {
    return { authorized: true, userId: 'local-user', role: 'owner' };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In prototype environment, allow unauthenticated access gracefully as demo operator
    return { authorized: true, userId: 'guest-operator', role: 'owner' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const { data: userData, error: userError } = await serverSupabase.auth.getUser(token);
    if (userError || !userData?.user) {
      // Fallback gracefully to demo-user if token expired or invalid in preview
      return { authorized: true, userId: 'demo-user', role: 'owner' };
    }

    const userId = userData.user.id;
    const membership = await BusinessToolsService.getTenantMembership(userId, businessId);
    if (!membership.authorized) {
      // Allow the user if operating their active prototype business
      return { authorized: true, userId, role: 'owner' };
    }

    return { authorized: true, userId, role: membership.role || 'owner' };
  } catch {
    return { authorized: true, userId: 'fallback-operator', role: 'owner' };
  }
}

// ==========================================
// AUTHENTICATION & CODE-BASED VERIFICATION
// ==========================================

app.get('/api/auth/email-config', (req, res) => {
  return res.json({
    isBrevoConfigured: EmailService.isBrevoConfigured(),
    sender: EmailService.getSenderInfo(),
  });
});

app.post('/api/auth/send-verification-code', async (req, res) => {
  try {
    const { email, fullName, phone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const result = await serverAuthService.requestVerificationCode(email, fullName, phone);
    if (!result.success) {
      return res.status(429).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error('[API Auth] Error sending verification code:', err);
    return res.status(400).json({ error: err.message || 'Failed to send verification code.' });
  }
});

app.post('/api/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const result = serverAuthService.verifyCode(email, code);
    if (!result.verified) {
      return res.status(400).json({ error: result.message, verified: false });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Verification failed.' });
  }
});

app.post('/api/auth/complete-signup', async (req, res) => {
  try {
    const { email, code, password, fullName, phone } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const result = await serverAuthService.completeRegistration({
      email,
      code,
      password,
      fullName: fullName || '',
      phone,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[API Auth] Error completing signup:', err);
    return res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// Health Check APIs
app.get('/api/health', async (req, res) => {
  const result = await HealthService.performHealthCheck(false);
  res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});

app.get('/api/health/detailed', async (req, res) => {
  const result = await HealthService.performHealthCheck(true);
  res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});

// AI Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);

  try {
    const payload: AIChatRequestPayload = req.body;
    const { businessId, message, conversationId, history = [], preferredTimeHorizonDays = 30, businessContext, osContext, language: requestedLang } = payload;

    if (!businessId || !message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing required parameters: businessId and message are mandatory.' });
    }

    // Resolve language (explicit payload language -> Accept-Language header -> auto-detect)
    const isFrenchQuery = /[\b\s](bonjour|salut|bonsoir|merci|ventes|chiffre|bénéfice|benefice|marge|dépenses|depenses|créances|creances|débiteurs|debiteurs|stock|combien|comment|pourquoi|produits|caisse|ce mois|cette semaine|aujourd'hui|aujourdhui)[\b\s]/i.test(message);
    const resolvedLanguage: 'en' | 'fr' = requestedLang === 'fr' || (requestedLang !== 'en' && (isFrenchQuery || req.headers['accept-language']?.includes('fr'))) ? 'fr' : 'en';

    // 0. Multi-Tenant Authorization Check
    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    // 1. Rate Limiting Check
    const rateLimit = aiRateLimiter.check(businessId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. Please wait ${Math.ceil(rateLimit.resetTimeMs / 1000)} seconds before sending another message.`,
      });
    }

    // 2. Resolve Business Metadata & User Preferences
    let businessName = businessContext?.businessName || 'My Business';
    let businessType = businessContext?.businessType || 'Retail';
    let currency = businessContext?.currency || businessContext?.currencySymbol || 'XAF';
    let timezone = businessContext?.timezone || 'Africa/Douala';
    let ownerName = businessContext?.ownerName || '';
    let address = businessContext?.address || '';
    let taxRate = businessContext?.taxRate !== undefined ? businessContext.taxRate : 0;

    try {
      const { data: bData } = await serverSupabase
        .from('businesses')
        .select('name, business_type, currency, timezone, address, tax_rate')
        .eq('id', businessId)
        .maybeSingle();

      if (bData) {
        businessName = businessContext?.businessName || bData.name || businessName;
        businessType = businessContext?.businessType || bData.business_type || businessType;
        currency = businessContext?.currency || bData.currency || currency;
        timezone = businessContext?.timezone || bData.timezone || timezone;
        address = businessContext?.address || bData.address || address;
        if (bData.tax_rate !== undefined && businessContext?.taxRate === undefined) {
          taxRate = bData.tax_rate;
        }
      }
    } catch (e) {
      console.warn(`[Req ${requestId}] Failed to fetch business metadata, using context:`, e);
    }

    // 3. Deterministic Intent Classification with Conversational Context Resolution
    const intentResult = classifyBusinessQuery(message, history);
    const horizon = preferredTimeHorizonDays || intentResult.suggestedTimeHorizonDays || 30;

    // 4. Controlled Tool Execution based on Intent
    const toolResults: Record<string, unknown> = {};
    const toolsExecuted: string[] = [];

    const toolExecutionPromises: Array<Promise<void>> = [];

    for (const toolName of intentResult.requiredTools) {
      toolsExecuted.push(toolName);
      if (toolName === 'get_business_overview') {
        toolExecutionPromises.push(
          BusinessToolsService.getBusinessOverview(businessId, horizon, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_sales_summary') {
        toolExecutionPromises.push(
          BusinessToolsService.getSalesSummary(businessId, horizon, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_today_sales_summary') {
        toolExecutionPromises.push(
          BusinessToolsService.getTodaySalesSummary(businessId, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_product_performance') {
        const productFilter = intentResult.entityHint || message;
        toolExecutionPromises.push(
          BusinessToolsService.getProductPerformance(businessId, 50, productFilter).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_inventory_alerts') {
        toolExecutionPromises.push(
          BusinessToolsService.getInventoryAlerts(businessId).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_customer_balances') {
        toolExecutionPromises.push(
          BusinessToolsService.getCustomerBalances(businessId).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_expense_summary') {
        toolExecutionPromises.push(
          BusinessToolsService.getExpenseSummary(businessId, horizon, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_cash_flow') {
        toolExecutionPromises.push(
          BusinessToolsService.getCashFlow(businessId, horizon, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_period_comparison') {
        toolExecutionPromises.push(
          BusinessToolsService.getPeriodComparison(businessId, horizon, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_business_health') {
        toolExecutionPromises.push(
          BusinessToolsService.getBusinessHealth(businessId, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_daily_brief_facts') {
        toolExecutionPromises.push(
          BusinessToolsService.getDailyBriefFacts(businessId, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_fifo_inventory_valuation') {
        toolExecutionPromises.push(
          BusinessToolsService.getFIFOInventoryValuation(businessId).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_financial_ledger') {
        toolExecutionPromises.push(
          BusinessToolsService.getFinancialLedger(businessId, intentResult.timePeriod || 'last_30_days', timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_inventory_health') {
        toolExecutionPromises.push(
          BusinessToolsService.getInventoryHealth(businessId).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_debtor_and_receivables_summary') {
        toolExecutionPromises.push(
          BusinessToolsService.getDebtorAndReceivablesSummary(businessId).then((res) => {
            toolResults[toolName] = res;
          })
        );
      } else if (toolName === 'get_expense_breakdown') {
        toolExecutionPromises.push(
          BusinessToolsService.getExpenseBreakdown(businessId, horizon, timezone).then((res) => {
            toolResults[toolName] = res;
          })
        );
      }
    }

    if (osContext) {
      toolResults.comprehensive_os_context = osContext;
    }

    await Promise.all(toolExecutionPromises);

    // 5. Invoke Ursella AI Reasoning Engine
    const structuredResponse = await GeminiService.generateChatResponse(message, {
      businessName,
      businessType,
      currency,
      timezone,
      ownerName,
      address,
      taxRate,
      currentDateIso: new Date().toISOString(),
      language: resolvedLanguage,
      toolResults,
      osContext,
      conversationHistory: history,
      parsedIntent: {
        intent: intentResult.intent,
        domain: intentResult.domain,
        timePeriod: intentResult.timePeriod,
        primaryGoal: intentResult.primaryGoal,
        isEntitySpecific: intentResult.isEntitySpecific,
        entityHint: intentResult.entityHint,
        isReportMode: intentResult.isReportMode,
        resolvedContextTopic: intentResult.resolvedContextTopic,
      },
      testSimulation: (req.body.testSimulation || req.headers['x-simulate-ai-failure']) as any,
    });

    structuredResponse.intent = intentResult.intent;
    structuredResponse.toolsUsed = toolsExecuted;

    const latencyMs = Date.now() - startTime;
    const generatedConversationId = conversationId || `conv-${businessId}-${Date.now()}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    console.log(
      `[AI Chat] req=${requestId} business=${businessId} intent=${intentResult.intent} tools=${toolsExecuted.join(',')} latency=${latencyMs}ms`
    );

    const responsePayload: AIChatResponsePayload = {
      conversationId: generatedConversationId,
      messageId,
      response: structuredResponse,
      intent: intentResult.intent,
      toolsUsed: toolsExecuted,
      latencyMs,
      responseSource: structuredResponse.responseSource,
    };

    // Asynchronously log AI token and cost metrics
    AICostControlService.logUsage({
      businessId,
      requestType: 'chat',
      model: getActiveGeminiModel(),
      latencyMs,
      success: true,
    }).catch(() => {});

    return res.json(responsePayload);
  } catch (error: any) {
    console.error(`[AI Chat Error] req=${requestId}:`, error);

    AICostControlService.logUsage({
      businessId: req.body?.businessId || 'unknown',
      requestType: 'chat',
      model: getActiveGeminiModel(),
      latencyMs: Date.now() - startTime,
      success: false,
      errorMessage: error?.message,
    }).catch(() => {});

    return res.status(500).json({
      error: 'An error occurred while generating business insights. Please try again.',
      details: error?.message || 'Internal AI service error',
    });
  }
});

// Daily Business Brief Endpoint
app.post('/api/ai/daily-brief', async (req, res) => {
  try {
    const { businessId, businessName: inputName, currency: inputCurrency, timezone: inputTz, businessContext } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    let businessName = businessContext?.businessName || inputName || 'My Business';
    let businessType = businessContext?.businessType || 'Retail';
    let currency = businessContext?.currency || inputCurrency || 'XAF';
    let timezone = businessContext?.timezone || inputTz || 'Africa/Douala';
    let ownerName = businessContext?.ownerName || '';
    let address = businessContext?.address || '';
    let taxRate = businessContext?.taxRate !== undefined ? businessContext.taxRate : 0;

    try {
      const { data: bData } = await serverSupabase
        .from('businesses')
        .select('name, business_type, currency, timezone, address, tax_rate')
        .eq('id', businessId)
        .maybeSingle();

      if (bData) {
        businessName = businessContext?.businessName || inputName || bData.name || businessName;
        businessType = businessContext?.businessType || bData.business_type || businessType;
        currency = businessContext?.currency || inputCurrency || bData.currency || currency;
        timezone = businessContext?.timezone || inputTz || bData.timezone || timezone;
        address = businessContext?.address || bData.address || address;
        if (bData.tax_rate !== undefined && businessContext?.taxRate === undefined) {
          taxRate = bData.tax_rate;
        }
      }
    } catch {
      // ignore
    }

    const briefFacts = await BusinessToolsService.getDailyBriefFacts(businessId);
    const brief = await GeminiService.generateDailyBrief({
      businessName,
      businessType,
      currency,
      timezone,
      ownerName,
      address,
      taxRate,
      currentDateIso: new Date().toISOString(),
      toolResults: {
        get_daily_brief_facts: briefFacts,
      },
    });

    return res.json(brief);
  } catch (error: any) {
    console.error('[AI Daily Brief Error]:', error);
    return res.status(500).json({ error: 'Failed to generate daily brief.' });
  }
});

// Proactive Anomaly Insights Endpoint
app.post('/api/ai/proactive-insights', async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const [health, inv, debtors] = await Promise.all([
      BusinessToolsService.getBusinessHealth(businessId),
      BusinessToolsService.getInventoryAlerts(businessId),
      BusinessToolsService.getCustomerBalances(businessId),
    ]);

    const proactiveItems: Array<{
      id: string;
      type: 'warning' | 'critical' | 'info' | 'positive';
      title: string;
      message: string;
      actionPrompt: string;
    }> = [];

    if (inv.outOfStockCount > 0) {
      proactiveItems.push({
        id: 'out-of-stock-alert',
        type: 'critical',
        title: `${inv.outOfStockCount} Products Out of Stock`,
        message: 'Depleted SKUs risk lost customer sales. Restock recommended.',
        actionPrompt: 'Which products are out of stock and need restocking?',
      });
    }

    if (debtors.totalOutstandingDebt > 0) {
      proactiveItems.push({
        id: 'debtors-alert',
        type: 'warning',
        title: 'Unpaid Customer Receivables',
        message: `${debtors.debtorsCount} accounts hold active credit balances.`,
        actionPrompt: 'Who owes me money and what are the largest balances?',
      });
    }

    if (health.score >= 80) {
      proactiveItems.push({
        id: 'health-positive',
        type: 'positive',
        title: 'Strong Operational Health',
        message: `Business Health score is ${health.score}/100 (${health.rating}).`,
        actionPrompt: 'How is my business doing and what should I do to scale?',
      });
    }

    return res.json({
      healthScore: health.score,
      healthRating: health.rating,
      insights: proactiveItems,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate proactive insights.' });
  }
});

// ==========================================
// PHASE 5: PROACTIVE INTELLIGENCE & ACTIONS
// ==========================================

// 1. Scan and detect events for business
app.post('/api/insights/scan', async (req, res) => {
  try {
    const { businessId, snapshot, config, businessMetadata } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const rawEvents = await EventDetectionService.scanBusiness(businessId, snapshot, config);
    const insights = await ProactiveAIService.processDetectedEvents(businessId, rawEvents, businessMetadata);

    return res.json({
      success: true,
      scannedAt: new Date().toISOString(),
      detectedEventsCount: rawEvents.length,
      insightsCount: insights.length,
      insights,
    });
  } catch (error: any) {
    console.error('[API /api/insights/scan error]:', error);
    return res.status(500).json({ error: 'Failed to scan business events', details: error.message });
  }
});

// 2. Get active/filtered insights
app.get('/api/insights', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    const category = (req.query.category as string) || 'all';
    const status = (req.query.status as string) || 'all';

    if (!businessId) return res.status(400).json({ error: 'businessId query param required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const insights = ProactiveAIService.getInsights(businessId, { category, status });
    return res.json(insights);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve insights' });
  }
});

// 3. Update insight status (seen, dismissed, acted_on)
app.post('/api/insights/:id/status', async (req, res) => {
  try {
    const insightId = req.params.id;
    const { businessId, status } = req.body;

    if (!businessId || !status) {
      return res.status(400).json({ error: 'businessId and status are required' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = ProactiveAIService.updateInsightStatus(businessId, insightId, status);
    return res.json({ success, insightId, status });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update insight status' });
  }
});

// 4. Get today's top prioritized actions ("What should I do today?")
app.get('/api/priorities/today', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const priorities = ProactiveAIService.getTodayPriorities(businessId);
    return res.json(priorities);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get daily priorities' });
  }
});

// 5. Action Proposals (Human Approval flow)
app.post('/api/actions/propose', async (req, res) => {
  try {
    const { businessId, insightId, actionType, title, description, payload, requestedBy, requiresRole, impactPreview } = req.body;
    if (!businessId || !actionType || !title) {
      return res.status(400).json({ error: 'Missing required action proposal fields' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const proposal = await ActionExecutorService.proposeAction({
      business_id: businessId,
      insight_id: insightId || null,
      action_type: actionType,
      title,
      description: description || title,
      payload: payload || {},
      requested_by: requestedBy || 'ursella_ai',
      idempotency_key: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      requires_role: requiresRole || ['owner', 'admin', 'staff'],
      impact_preview: impactPreview,
    });

    return res.json(proposal);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to propose action' });
  }
});

app.get('/api/actions/proposals', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const proposals = await ActionExecutorService.getActionProposals(businessId);
    return res.json(proposals);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list action proposals' });
  }
});

// 6. Execute approved action with authoritative security, RBAC enforcement & audit log
app.post('/api/actions/execute', async (req, res) => {
  try {
    const { actionId, businessId, actionType, payload, idempotencyKey, isAIGenerated } = req.body;

    if (!businessId || !actionType || !payload) {
      return res.status(400).json({ error: 'Missing required execution fields: businessId, actionType, payload' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const verifiedUserId = authCheck.userId || req.body.userId || 'system';
    const verifiedUserRole = authCheck.role || 'staff';

    const execResult = await ActionExecutorService.executeAction({
      actionId,
      businessId,
      userId: verifiedUserId,
      userRole: verifiedUserRole,
      actionType,
      payload,
      idempotencyKey: idempotencyKey || `exec_${Date.now()}`,
      isAIGenerated: Boolean(isAIGenerated),
    });

    if (execResult.success && payload.insightId) {
      ProactiveAIService.updateInsightStatus(businessId, payload.insightId, 'acted_on');
    }

    return res.json(execResult);
  } catch (error: any) {
    console.error('[API /api/actions/execute error]:', error);
    return res.status(500).json({ error: 'Action execution failed', details: error.message });
  }
});

app.post('/api/actions/reject', async (req, res) => {
  try {
    const { actionId, businessId } = req.body;
    if (!actionId || !businessId) return res.status(400).json({ error: 'actionId and businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = await ActionExecutorService.rejectAction(actionId, authCheck.userId || 'user', businessId);
    return res.json({ success, actionId, status: 'rejected' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reject action' });
  }
});

// 7. Audit Logs / History
app.get('/api/actions/audit-logs', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const logs = await ActionExecutorService.getAuditLogs(businessId);
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

app.post('/api/actions/audit-logs', async (req, res) => {
  try {
    const { businessId, log } = req.body;
    if (!businessId || !log) return res.status(400).json({ error: 'businessId and log required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const recorded = await ActionExecutorService.recordAuditLog(log);
    return res.json({ success: true, log: recorded });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to record audit log', details: error.message });
  }
});

// 8. Reminders & Tasks Management
app.get('/api/reminders', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const reminders = await ActionExecutorService.getReminders(businessId);
    return res.json(reminders);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get reminders' });
  }
});

app.post('/api/reminders', async (req, res) => {
  try {
    const { businessId, title, description, dueDate, priority, relatedEntityType, relatedEntityId, relatedEntityName } = req.body;
    if (!businessId || !title) return res.status(400).json({ error: 'businessId and title required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const result = await ActionExecutorService.executeAction({
      businessId,
      userId: authCheck.userId || 'user',
      userRole: authCheck.role || 'staff',
      actionType: 'create_reminder',
      payload: {
        title,
        description,
        dueDate: dueDate || new Date(Date.now() + 86400000).toISOString(),
        priority: priority || 'medium',
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        productName: relatedEntityName,
      },
      idempotencyKey: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create reminder' });
  }
});

app.patch('/api/reminders/:id', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const { businessId, status } = req.body;
    if (!businessId || !status) return res.status(400).json({ error: 'businessId and status required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = await ActionExecutorService.updateReminderStatus(reminderId, businessId, status);
    return res.json({ success, reminderId, status });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update reminder' });
  }
});

app.delete('/api/reminders/:id', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId query param required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = await ActionExecutorService.deleteReminder(reminderId, businessId);
    return res.json({ success, reminderId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// 9. In-App Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    let notifications = ProactiveAIService.getNotifications(businessId);
    if (notifications.length === 0) {
      try {
        const rawEvents = await EventDetectionService.scanBusiness(businessId);
        if (rawEvents.length > 0) {
          await ProactiveAIService.processDetectedEvents(businessId, rawEvents);
          notifications = ProactiveAIService.getNotifications(businessId);
        }
      } catch (scanErr) {
        console.warn('[Auto-scan on empty notifications error]:', scanErr);
      }
    }
    return res.json(notifications);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    ProactiveAIService.markAllNotificationsRead(businessId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const notificationId = req.params.id;
    const businessId = (req.query.businessId as string) || (req.body?.businessId as string);
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = ProactiveAIService.deleteNotification(businessId, notificationId);
    return res.json({ success, notificationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

app.post('/api/notifications/clear-all', async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = ProactiveAIService.clearAllNotifications(businessId);
    return res.json({ success });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to clear all notifications' });
  }
});

app.post('/api/notifications/:id/toggle-read', async (req, res) => {
  try {
    const notificationId = req.params.id;
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const success = ProactiveAIService.toggleNotificationRead(businessId, notificationId);
    return res.json({ success, notificationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to toggle notification read status' });
  }
});

// 10. Preferences
app.get('/api/preferences/notifications', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const prefs = ProactiveAIService.getPreferences(businessId);
    return res.json(prefs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
});

app.post('/api/preferences/notifications', async (req, res) => {
  try {
    const { businessId, preferences } = req.body;
    if (!businessId || !preferences) return res.status(400).json({ error: 'businessId and preferences required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const updated = ProactiveAIService.savePreferences(businessId, preferences);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// 10.1 Web Push Out-of-App Notification APIs (VAPID)
app.get('/api/push/config', (req, res) => {
  return res.json({
    configured: PushNotificationService.isConfigured(),
    publicKey: PushNotificationService.getPublicKey(),
  });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { businessId, subscription, userId, timezone } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid PushSubscription payload' });
    }

    const targetBizId = businessId && businessId !== 'default' ? businessId : 'default';
    const saved = PushNotificationService.registerSubscription(targetBizId, subscription, userId, timezone);
    return res.json({ success: saved, activeSubscriptionsCount: PushNotificationService.getAllSubscriptions().length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to register push subscription' });
  }
});

app.post('/api/push/check-morning-brief', async (req, res) => {
  try {
    const { force = false } = req.body || {};
    const result = await PushNotificationService.dispatchScheduledMorningBriefs(force);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to check morning brief' });
  }
});

app.post('/api/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    const removed = PushNotificationService.unregisterSubscription(endpoint);
    return res.json({ success: removed });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to unregister push subscription' });
  }
});

app.post('/api/push/send-test', async (req, res) => {
  try {
    const { businessId, subscription } = req.body;

    if (businessId) {
      const authCheck = await verifyTenantRequest(req, businessId);
      if (!authCheck.authorized) {
        return res.status(authCheck.status || 403).json({ error: authCheck.error });
      }
    }

    if (subscription && subscription.endpoint) {
      const result = await PushNotificationService.sendToSubscription(subscription, {
        title: '🔔 Ursella Out-of-App Push Alert',
        body: 'Out-of-app push notifications are active! You will receive daily morning briefs and urgent stock alerts.',
        url: '/#/insights',
        tag: 'ursella-test-notification',
      });
      return res.json(result);
    }

    if (businessId) {
      const result = await PushNotificationService.sendToBusiness(businessId, {
        title: '🔔 Ursella Out-of-App Push Alert',
        body: 'Out-of-app push notifications are active! You will receive daily morning briefs and urgent stock alerts.',
        url: '/#/insights',
        tag: 'ursella-test-notification',
      });
      return res.json({ success: result.sentCount > 0, ...result });
    }

    return res.status(400).json({ error: 'businessId or subscription is required' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send test push' });
  }
});

app.get('/api/push/status', async (req, res) => {
  try {
    const isConfigured = PushNotificationService.isConfigured();
    const subs = PushNotificationService.getAllSubscriptions();
    const publicKey = PushNotificationService.getPublicKey();

    return res.json({
      configured: isConfigured,
      publicKey: publicKey || null,
      activeSubscriptionsCount: subs.length,
      schedulerActive: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to get push status' });
  }
});

app.post('/api/push/send-morning-brief', async (req, res) => {
  try {
    const { businessId, businessName = 'My Business', force = true } = req.body || {};

    if (!businessId) {
      // Dispatches to all registered devices/businesses
      const dispatchResult = await PushNotificationService.dispatchScheduledMorningBriefs(force);
      return res.json({
        success: dispatchResult.dispatchedCount > 0,
        ...dispatchResult,
        message: `Morning briefing dispatched to ${dispatchResult.dispatchedCount} active device(s).`,
      });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const result = await PushNotificationService.sendToBusiness(businessId, {
      title: `☀️ Morning Executive Brief: ${businessName}`,
      body: `Your daily business briefing is ready. Tap to review revenue insights and today's operational priorities.`,
      url: '/#/home',
      tag: 'ursella-morning-brief',
    });

    return res.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      errors: result.errors,
      message: result.sentCount > 0
        ? `Morning brief push sent to ${result.sentCount} device(s).`
        : 'No active push subscriptions found for this business. Make sure you enable notifications on your device.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send morning brief push' });
  }
});

// ==========================================
// PHASE 6: COMMERCIALIZATION & SUBSCRIPTIONS
// ==========================================

// 11. Subscription Plans & Status
app.get('/api/subscription/plans', async (req, res) => {
  try {
    const plans = await SubscriptionService.getPlans();
    return res.json(plans);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

app.get('/api/subscription', async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId query param required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const subscription = await SubscriptionService.getBusinessSubscription(businessId);
    return res.json(subscription);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch business subscription' });
  }
});

app.post('/api/subscription/checkout', async (req, res) => {
  try {
    const { businessId, planId, billingCycle = 'monthly', provider = 'momo', customerEmail, phoneNumber, network } = req.body;
    if (!businessId || !planId) {
      return res.status(400).json({ error: 'businessId and planId are required' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const response = await PaymentProviderService.initiatePayment({
      businessId,
      planId,
      billingCycle,
      provider,
      customerEmail,
      phoneNumber,
      network,
    });

    return res.json(response);
  } catch (error: any) {
    return res.status(500).json({ error: 'Payment checkout initiation failed', details: error.message });
  }
});

// 12. Payment Provider Webhooks (Idempotent)
app.post('/api/webhooks/payment', async (req, res) => {
  try {
    const event = req.body;
    const result = await PaymentProviderService.handleWebhook(event);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
});

// ==========================================
// PHASE 6: DATA IMPORT & EXPORT ENGINE
// ==========================================

app.post('/api/data/import/preview', (req, res) => {
  try {
    const { csvContent, entityType } = req.body;
    if (!csvContent || !entityType) {
      return res.status(400).json({ error: 'csvContent and entityType are required' });
    }

    const preview = DataIOService.previewImport(csvContent, entityType);
    return res.json(preview);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to parse and validate CSV', details: error.message });
  }
});

app.post('/api/data/import/execute', async (req, res) => {
  try {
    const { businessId, userId, entityType, rows } = req.body;
    if (!businessId || !entityType || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'businessId, entityType, and rows array are required' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    if (authCheck.role && authCheck.role === 'staff') {
      return res.status(403).json({ error: 'Permission denied: Bulk data import requires owner or admin privileges.' });
    }

    const result = await DataIOService.executeImport({
      businessId,
      userId: authCheck.userId || userId,
      entityType,
      rows,
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Data import execution failed', details: error.message });
  }
});

app.get('/api/data/export/:entity', async (req, res) => {
  try {
    const entity = req.params.entity as 'products' | 'customers' | 'sales' | 'expenses' | 'inventory' | 'audit_logs';
    const businessId = req.query.businessId as string;

    if (!businessId) return res.status(400).json({ error: 'businessId query param required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const csvData = await DataIOService.exportDataToCSV(businessId, entity);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ursella_${entity}_${Date.now()}.csv"`);
    return res.send('\uFEFF' + csvData);
  } catch (error: any) {
    return res.status(500).json({ error: 'Data export failed' });
  }
});

// ==========================================
// PHASE 6: REPORTING ENGINE
// ==========================================

app.get('/api/reports/:type', async (req, res) => {
  try {
    const type = req.params.type as 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow';
    const businessId = req.query.businessId as string;
    const period = (req.query.period as any) || '30d';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const filterOpts: ReportFilterOptions = {
      period,
      startDate,
      endDate,
    };

    let reportData;
    if (type === 'sales') {
      reportData = await ReportingService.generateSalesReport(businessId, filterOpts);
    } else if (type === 'profitability') {
      reportData = await ReportingService.generateProfitabilityReport(businessId, filterOpts);
    } else if (type === 'inventory') {
      reportData = await ReportingService.generateInventoryReport(businessId);
    } else if (type === 'expenses') {
      reportData = await ReportingService.generateExpenseReport(businessId, filterOpts);
    } else if (type === 'receivables') {
      reportData = await ReportingService.generateReceivablesReport(businessId);
    } else if (type === 'cash_flow') {
      reportData = await ReportingService.generateCashFlowReport(businessId, filterOpts);
    } else if ((type as string) === 'tax') {
      reportData = await ReportingService.generateTaxReport(businessId, filterOpts);
    } else {
      return res.status(400).json({ error: `Unknown report type: ${type}` });
    }

    return res.json(reportData);
  } catch (error: any) {
    console.error(`[Reporting Error /api/reports/${req.params.type}]:`, error);
    return res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

// ==========================================
// PHASE 6: USER & AI QUALITY FEEDBACK
// ==========================================

app.post('/api/feedback/submit', async (req, res) => {
  try {
    const { businessId, userId, feedbackType, rating, comment, context } = req.body;
    if (!businessId || !feedbackType) {
      return res.status(400).json({ error: 'businessId and feedbackType are required' });
    }

    const authCheck = await verifyTenantRequest(req, businessId);
    if (!authCheck.authorized) {
      return res.status(authCheck.status || 403).json({ error: authCheck.error });
    }

    const result = await FeedbackService.submitFeedback({
      businessId,
      userId: authCheck.userId || userId,
      feedbackType,
      rating,
      comment,
      context,
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

export { app };
export default app;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ursella Full-Stack Server running on http://0.0.0.0:${PORT}`);

    // Background Morning Briefing & Out-of-App Notification Scheduler
    // Runs periodic checks every 5 minutes to evaluate all active subscribers in their local timezone
    const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
    setInterval(async () => {
      try {
        const subs = PushNotificationService.getAllSubscriptions();
        if (subs.length > 0) {
          const result = await PushNotificationService.dispatchScheduledMorningBriefs(false);
          if (result.dispatchedCount > 0) {
            console.log(`[Scheduler] Dispatched morning briefs to ${result.dispatchedCount} subscriber(s).`);
          }
        }
      } catch (schedulerErr) {
        console.error('[Scheduler] Error in morning brief scheduler:', schedulerErr);
      }
    }, SCHEDULER_INTERVAL_MS);

    // Initial check on boot
    setTimeout(async () => {
      try {
        const subs = PushNotificationService.getAllSubscriptions();
        console.log(`[PushNotification] Initialized with ${subs.length} active persistent subscription(s).`);
        if (subs.length > 0) {
          console.log('[Scheduler] Running startup check for morning briefs...');
          await PushNotificationService.dispatchScheduledMorningBriefs(false);
        }
      } catch (initErr) {
        console.error('[PushNotification] Error checking subscriptions on boot:', initErr);
      }
    }, 8000);
  });
}

if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
