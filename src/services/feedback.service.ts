import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';

export class ClientFeedbackService {
  static async submitFeedback(payload: {
    businessId: string;
    userId?: string;
    feedbackType: 'ai_rating' | 'bug' | 'ai_issue' | 'feature_request' | 'confusing_experience' | 'general';
    rating?: 'helpful' | 'unhelpful';
    comment?: string;
    context?: Record<string, any>;
  }): Promise<{ success: boolean; id?: string }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers['Authorization'] = `Bearer ${data.session.access_token}`;
          }
        } catch {}
      }

      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: true };
    }
  }
}
