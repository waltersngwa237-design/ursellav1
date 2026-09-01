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
import { type AIChatRequestPayload, type AIChatResponsePayload } from './src/types/ai.ts';

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
): Promise<{ authorized: boolean; userId?: string; error?: string; status?: number }> {
  if (!isValidUUID(businessId)) {
    return { authorized: true };
  }

  const isServerSupabaseConfigured = Boolean(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  ) && !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').includes('placeholder.supabase.co');

  if (!isServerSupabaseConfigured) {
    return { authorized: true };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      status: 401,
      error: 'Missing or malformed Authorization header. Please sign in.',
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const { data: userData, error: userError } = await serverSupabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return {
        authorized: false,
        status: 401,
        error: 'Invalid or expired authentication session. Please sign in again.',
      };
    }

    const userId = userData.user.id;
    const hasAccess = await BusinessToolsService.verifyTenantAccess(userId, businessId);
    if (!hasAccess) {
      return {
        authorized: false,
        status: 403,
        error: 'Access denied: You are not authorized to view or analyze data for this business.',
      };
    }

    return { authorized: true, userId };
  } catch (err: any) {
    return {
      authorized: false,
      status: 500,
      error: err?.message || 'Tenant verification failed.',
    };
  }
}

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
    const { businessId, message, conversationId, history = [], preferredTimeHorizonDays = 30, businessContext } = payload;

    if (!businessId || !message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing required parameters: businessId and message are mandatory.' });
    }

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
    let currency = businessContext?.currency || businessContext?.currencySymbol || 'USD';
    let timezone = businessContext?.timezone || 'UTC';
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

    // 3. Deterministic Intent Classification
    const intentResult = classifyBusinessQuery(message);
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
        toolExecutionPromises.push(
          BusinessToolsService.getProductPerformance(businessId, 50, message).then((res) => {
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
      }
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
      toolResults,
      conversationHistory: history,
      parsedIntent: {
        intent: intentResult.intent,
        domain: intentResult.domain,
        timePeriod: intentResult.timePeriod,
        primaryGoal: intentResult.primaryGoal,
      },
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
      model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
      latencyMs,
      success: true,
    }).catch(() => {});

    return res.json(responsePayload);
  } catch (error: any) {
    console.error(`[AI Chat Error] req=${requestId}:`, error);

    AICostControlService.logUsage({
      businessId: req.body?.businessId || 'unknown',
      requestType: 'chat',
      model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
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
    let currency = businessContext?.currency || inputCurrency || 'USD';
    let timezone = businessContext?.timezone || inputTz || 'UTC';
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
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const rawEvents = await EventDetectionService.scanBusiness(businessId);
    const insights = await ProactiveAIService.processDetectedEvents(businessId, rawEvents);

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
app.get('/api/insights', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    const category = (req.query.category as string) || 'all';
    const status = (req.query.status as string) || 'all';

    if (!businessId) return res.status(400).json({ error: 'businessId query param required' });

    const insights = ProactiveAIService.getInsights(businessId, { category, status });
    return res.json(insights);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve insights' });
  }
});

// 3. Update insight status (seen, dismissed, acted_on)
app.post('/api/insights/:id/status', (req, res) => {
  try {
    const insightId = req.params.id;
    const { businessId, status } = req.body;

    if (!businessId || !status) {
      return res.status(400).json({ error: 'businessId and status are required' });
    }

    const success = ProactiveAIService.updateInsightStatus(businessId, insightId, status);
    return res.json({ success, insightId, status });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update insight status' });
  }
});

// 4. Get today's top prioritized actions ("What should I do today?")
app.get('/api/priorities/today', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const priorities = ProactiveAIService.getTodayPriorities(businessId);
    return res.json(priorities);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get daily priorities' });
  }
});

// 5. Action Proposals (Human Approval flow)
app.post('/api/actions/propose', (req, res) => {
  try {
    const { businessId, insightId, actionType, title, description, payload, requestedBy, requiresRole, impactPreview } = req.body;
    if (!businessId || !actionType || !title) {
      return res.status(400).json({ error: 'Missing required action proposal fields' });
    }

    const proposal = ActionExecutorService.proposeAction({
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

app.get('/api/actions/proposals', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const proposals = ActionExecutorService.getActionProposals(businessId);
    return res.json(proposals);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list action proposals' });
  }
});

// 6. Execute approved action with atomic security & audit log
app.post('/api/actions/execute', async (req, res) => {
  try {
    const { actionId, businessId, userId, userRole = 'owner', actionType, payload, idempotencyKey, isAIGenerated } = req.body;

    if (!businessId || !userId || !actionType || !payload) {
      return res.status(400).json({ error: 'Missing required execution fields: businessId, userId, actionType, payload' });
    }

    const execResult = await ActionExecutorService.executeAction({
      actionId,
      businessId,
      userId,
      userRole,
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

app.post('/api/actions/reject', (req, res) => {
  try {
    const { actionId, userId, businessId } = req.body;
    if (!actionId || !businessId) return res.status(400).json({ error: 'actionId and businessId required' });

    const success = ActionExecutorService.rejectAction(actionId, userId || 'user', businessId);
    return res.json({ success, actionId, status: 'rejected' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reject action' });
  }
});

// 7. Audit Logs / History
app.get('/api/actions/audit-logs', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const logs = ActionExecutorService.getAuditLogs(businessId);
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// 8. Reminders & Tasks Management
app.get('/api/reminders', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const reminders = ActionExecutorService.getReminders(businessId);
    return res.json(reminders);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get reminders' });
  }
});

app.post('/api/reminders', async (req, res) => {
  try {
    const { businessId, userId, title, description, dueDate, priority, relatedEntityType, relatedEntityId, relatedEntityName } = req.body;
    if (!businessId || !title) return res.status(400).json({ error: 'businessId and title required' });

    const result = await ActionExecutorService.executeAction({
      businessId,
      userId: userId || 'user',
      userRole: 'owner',
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

app.patch('/api/reminders/:id', (req, res) => {
  try {
    const reminderId = req.params.id;
    const { businessId, status } = req.body;
    if (!businessId || !status) return res.status(400).json({ error: 'businessId and status required' });

    const success = ActionExecutorService.updateReminderStatus(reminderId, businessId, status);
    return res.json({ success, reminderId, status });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update reminder' });
  }
});

app.delete('/api/reminders/:id', (req, res) => {
  try {
    const reminderId = req.params.id;
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId query param required' });

    const success = ActionExecutorService.deleteReminder(reminderId, businessId);
    return res.json({ success, reminderId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// 9. In-App Notifications
app.get('/api/notifications', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const notifications = ProactiveAIService.getNotifications(businessId);
    return res.json(notifications);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
});

app.post('/api/notifications/read-all', (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    ProactiveAIService.markAllNotificationsRead(businessId);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

app.delete('/api/notifications/:id', (req, res) => {
  try {
    const notificationId = req.params.id;
    const businessId = (req.query.businessId as string) || (req.body?.businessId as string);
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const success = ProactiveAIService.deleteNotification(businessId, notificationId);
    return res.json({ success, notificationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
});

app.post('/api/notifications/clear-all', (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const success = ProactiveAIService.clearAllNotifications(businessId);
    return res.json({ success });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to clear all notifications' });
  }
});

app.post('/api/notifications/:id/toggle-read', (req, res) => {
  try {
    const notificationId = req.params.id;
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const success = ProactiveAIService.toggleNotificationRead(businessId, notificationId);
    return res.json({ success, notificationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to toggle notification read status' });
  }
});

// 10. Preferences
app.get('/api/preferences/notifications', (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const prefs = ProactiveAIService.getPreferences(businessId);
    return res.json(prefs);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
});

app.post('/api/preferences/notifications', (req, res) => {
  try {
    const { businessId, preferences } = req.body;
    if (!businessId || !preferences) return res.status(400).json({ error: 'businessId and preferences required' });

    const updated = ProactiveAIService.savePreferences(businessId, preferences);
    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to save preferences' });
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

    const result = await DataIOService.executeImport({
      businessId,
      userId,
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
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ursella_${entity}_${Date.now()}.csv"`);
    return res.send(csvData);
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

    const result = await FeedbackService.submitFeedback({
      businessId,
      userId,
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
  });
}

if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
