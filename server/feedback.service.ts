import { serverSupabase } from './business-tools.service.ts';
import { generateUUID, isValidUUID } from '../src/lib/uuid.ts';

export interface UserFeedbackPayload {
  businessId: string;
  userId?: string;
  feedbackType: 'ai_rating' | 'bug' | 'feature_request' | 'general';
  rating?: 'helpful' | 'unhelpful';
  comment?: string;
  context?: Record<string, any>;
}

export class FeedbackService {
  static async submitFeedback(payload: UserFeedbackPayload): Promise<{ success: boolean; id?: string }> {
    const feedbackId = generateUUID();
    try {
      if (isValidUUID(payload.businessId)) {
        const { data, error } = await serverSupabase.from('user_feedback').insert({
          id: feedbackId,
          business_id: payload.businessId,
          user_id: payload.userId && isValidUUID(payload.userId) ? payload.userId : null,
          feedback_type: payload.feedbackType,
          rating: payload.rating || null,
          comment: payload.comment || null,
          context_json: payload.context || {},
        }).select('id').maybeSingle();

        if (error) {
          console.warn('[FeedbackService] Error inserting feedback to Supabase:', error);
        }

        return { success: true, id: data?.id || feedbackId };
      }
      return { success: true, id: feedbackId };
    } catch (e) {
      console.warn('[FeedbackService] Fallback feedback acknowledgment:', e);
      return { success: true, id: feedbackId };
    }
  }
}
