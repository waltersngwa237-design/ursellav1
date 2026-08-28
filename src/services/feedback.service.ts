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
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: true };
    }
  }
}
