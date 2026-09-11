/**
 * Ursella Business OS - Proactive AI Service (Phase 5)
 * Combines deterministic event signals with Gemini 3.7 Flash reasoning
 * for human-friendly narratives, prioritized "What to do today" recommendations,
 * and robust, deduplicated notifications.
 */
import { generateUUID } from '../src/lib/uuid.ts';
import type { RawBusinessEvent } from './event-detection.service.ts';
import type {
  BusinessInsight,
  AppNotification,
  DailyPriorityItem,
  NotificationPreferences,
} from '../src/types/proactive.ts';
import { getGeminiClient, getActiveGeminiModel } from './ai-config.ts';

// In-memory caches for fast retrieval and state tracking
const businessInsightsCache = new Map<string, { timestamp: number; insights: BusinessInsight[] }>();
const businessNotificationsCache = new Map<string, AppNotification[]>();
const businessPreferencesCache = new Map<string, NotificationPreferences>();

export class ProactiveAIService {
  /**
   * Convert raw detected events into full BusinessInsight models with deduplication
   * and optional Gemini AI synthesis.
   */
  public static async processDetectedEvents(
    businessId: string,
    rawEvents: RawBusinessEvent[],
    businessMetadata?: { name?: string; type?: string; currency?: string }
  ): Promise<BusinessInsight[]> {
    const existingCache = businessInsightsCache.get(businessId)?.insights || [];
    const existingMap = new Map(existingCache.map((i) => [i.dedup_key, i]));
    const updatedInsights: BusinessInsight[] = [];

    for (const raw of rawEvents) {
      const existing = existingMap.get(raw.dedupKey);

      if (existing) {
        // If already acted on or dismissed, preserve user's conscious decision
        if (existing.status === 'dismissed' || existing.status === 'acted_on') {
          updatedInsights.push(existing);
          continue;
        }

        // Update existing insight with fresh data
        const updated: BusinessInsight = {
          ...existing,
          title: raw.title,
          summary: raw.summary,
          data: raw.data,
          severity: raw.severity,
          confidence: raw.confidence,
          explanation: raw.explanation,
          action_type: raw.actionType || existing.action_type,
          action_payload: raw.actionPayload || existing.action_payload,
          updated_at: new Date().toISOString(),
        };
        updatedInsights.push(updated);
        existingMap.delete(raw.dedupKey);
      } else {
        // New insight
        const newInsight: BusinessInsight = {
          id: generateUUID(),
          business_id: businessId,
          event_type: raw.eventType,
          category: raw.category,
          severity: raw.severity,
          confidence: raw.confidence,
          title: raw.title,
          summary: raw.summary,
          explanation: raw.explanation,
          data: raw.data,
          detected_at: new Date().toISOString(),
          status: 'new',
          action_type: raw.actionType || null,
          action_payload: raw.actionPayload || null,
          source: 'hybrid',
          dedup_key: raw.dedupKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatedInsights.push(newInsight);

        // Generate matching in-app notification with deduplication
        this.addNotification(businessId, {
          id: generateUUID(),
          business_id: businessId,
          title: raw.title,
          message: raw.summary,
          priority: raw.severity,
          category: raw.category,
          is_read: false,
          insight_id: newInsight.id,
          action_type: raw.actionType || null,
          action_payload: raw.actionPayload || null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Auto-resolve inventory insights if the product is no longer detected as out/low stock
    for (const [, oldInsight] of existingMap.entries()) {
      if (oldInsight.category === 'inventory' && oldInsight.status === 'new') {
        oldInsight.status = 'resolved';
        oldInsight.updated_at = new Date().toISOString();
        updatedInsights.push(oldInsight);
      } else {
        updatedInsights.push(oldInsight);
      }
    }

    // Sort by severity (critical > high > medium > low > informational)
    const severityRank: Record<string, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      informational: 1,
    };

    updatedInsights.sort((a, b) => {
      const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    });

    // Optional: Enhance top insights with Gemini AI reasoning if available
    const gemini = getGeminiClient();
    if (gemini && updatedInsights.some((i) => i.severity === 'critical' || i.severity === 'high')) {
      try {
        const criticalItems = updatedInsights
          .filter((i) => i.status === 'new' && (i.severity === 'critical' || i.severity === 'high'))
          .slice(0, 3);

        if (criticalItems.length > 0) {
          const prompt = `You are Ursella AI Business Operating System. Review these detected critical business events for "${businessMetadata?.name || 'the business'}" and provide a 1-sentence strategic action summary for each item:
${JSON.stringify(criticalItems.map((c) => ({ id: c.id, title: c.title, summary: c.summary, data: c.data })))}
Respond in valid JSON array of objects: [{"id": string, "strategicAdvice": string}]`;

          const aiRes = await gemini.models.generateContent({
            model: getActiveGeminiModel(),
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          if (aiRes.text) {
            const parsed = JSON.parse(aiRes.text);
            if (Array.isArray(parsed)) {
              for (const advice of parsed) {
                const target = updatedInsights.find((i) => i.id === advice.id);
                if (target && target.explanation && advice.strategicAdvice) {
                  target.explanation.whatYouCanDo = advice.strategicAdvice;
                }
              }
            }
          }
        }
      } catch (aiErr) {
        console.warn('[ProactiveAIService] Optional Gemini synthesis skipped:', (aiErr as any)?.message);
      }
    }

    businessInsightsCache.set(businessId, {
      timestamp: Date.now(),
      insights: updatedInsights,
    });

    return updatedInsights;
  }

  /**
   * Get cached insights with filtering.
   */
  public static getInsights(
    businessId: string,
    filter?: { category?: string; status?: string }
  ): BusinessInsight[] {
    const all = businessInsightsCache.get(businessId)?.insights || [];
    return all.filter((ins) => {
      if (filter?.category && filter.category !== 'all' && ins.category !== filter.category) {
        return false;
      }
      if (filter?.status && filter.status !== 'all' && ins.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  /**
   * Update insight status (dismiss, mark seen, mark acted_on).
   */
  public static updateInsightStatus(
    businessId: string,
    insightId: string,
    status: BusinessInsight['status']
  ): boolean {
    const list = businessInsightsCache.get(businessId)?.insights;
    if (!list) return false;
    const cleanId = insightId.replace(/^(prio_|dp_)/, '');
    const found = list.find(
      (i) => i.id === insightId || i.id === cleanId || i.id.replace(/^(prio_|dp_)/, '') === cleanId
    );
    if (!found) return false;
    found.status = status;
    found.updated_at = new Date().toISOString();
    return true;
  }

  /**
   * Generate "What should I do today?" prioritized action ranking.
   */
  public static getTodayPriorities(businessId: string): DailyPriorityItem[] {
    const insights = (businessInsightsCache.get(businessId)?.insights || []).filter(
      (i) => i.status === 'new' || i.status === 'seen'
    );

    const priorities: DailyPriorityItem[] = [];
    let rank = 1;

    for (const ins of insights) {
      if (ins.action_type && ins.action_payload && rank <= 4) {
        priorities.push({
          id: `prio_${ins.id}`,
          rank,
          title: ins.title,
          reason: ins.explanation?.whyItMatters || ins.summary,
          category: ins.category,
          severity: ins.severity,
          actionType: ins.action_type,
          actionPayload: ins.action_payload,
          impactDescription: ins.explanation?.whatYouCanDo || 'Review and take prompt action.',
        });
        rank++;
      }
    }

    return priorities;
  }

  /**
   * In-App Notifications with robust deduplication.
   */
  public static addNotification(businessId: string, notif: AppNotification) {
    const list = businessNotificationsCache.get(businessId) || [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Check if an existing notification with same insight_id or same title exists within 24 hours
    const isDuplicate = list.some((n) => {
      const isSameInsight = notif.insight_id && n.insight_id === notif.insight_id;
      const isSameTitle = n.title === notif.title;
      const isRecent = new Date(n.created_at).getTime() >= oneDayAgo;
      return (isSameInsight || isSameTitle) && (isRecent || !n.is_read);
    });

    if (!isDuplicate) {
      list.unshift(notif);
      if (list.length > 50) list.pop();
      businessNotificationsCache.set(businessId, list);
    }
  }

  public static getNotifications(businessId: string): AppNotification[] {
    return businessNotificationsCache.get(businessId) || [];
  }

  public static markAllNotificationsRead(businessId: string): void {
    const list = businessNotificationsCache.get(businessId) || [];
    for (const n of list) {
      n.is_read = true;
      n.read_at = new Date().toISOString();
    }
    businessNotificationsCache.set(businessId, list);
  }

  public static deleteNotification(businessId: string, notificationId: string): boolean {
    const list = businessNotificationsCache.get(businessId) || [];
    const filtered = list.filter((n) => n.id !== notificationId);
    businessNotificationsCache.set(businessId, filtered);
    return true;
  }

  public static clearAllNotifications(businessId: string): boolean {
    businessNotificationsCache.set(businessId, []);
    return true;
  }

  public static toggleNotificationRead(businessId: string, notificationId: string): boolean {
    const list = businessNotificationsCache.get(businessId) || [];
    const item = list.find((n) => n.id === notificationId);
    if (item) {
      item.is_read = !item.is_read;
      item.read_at = item.is_read ? new Date().toISOString() : undefined;
      businessNotificationsCache.set(businessId, list);
      return true;
    }
    return false;
  }

  /**
   * Notification Preferences
   */
  public static getPreferences(businessId: string): NotificationPreferences {
    return (
      businessPreferencesCache.get(businessId) || {
        enabledCategories: ['sales', 'inventory', 'customers', 'expenses', 'opportunities', 'health'],
        minSeverity: 'low',
        dailyBriefEnabled: true,
        dailyBriefTime: '08:00',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      }
    );
  }

  public static savePreferences(
    businessId: string,
    prefs: Partial<NotificationPreferences>
  ): NotificationPreferences {
    const current = this.getPreferences(businessId);
    const updated = { ...current, ...prefs };
    businessPreferencesCache.set(businessId, updated);
    return updated;
  }
}
