import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { ClientFeedbackService } from '../../services/feedback.service.ts';

interface AIResponseFeedbackProps {
  businessId: string;
  messageId?: string;
  intent?: string;
}

export const AIResponseFeedback: React.FC<AIResponseFeedbackProps> = ({
  businessId,
  messageId,
  intent,
}) => {
  const [rated, setRated] = useState<'helpful' | 'unhelpful' | null>(null);

  const handleRate = async (rating: 'helpful' | 'unhelpful') => {
    if (rated) return;
    setRated(rating);
    await ClientFeedbackService.submitFeedback({
      businessId,
      feedbackType: 'ai_rating',
      rating,
      context: { messageId, intent },
    });
  };

  if (rated) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-2">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-2">
      <span className="text-zinc-500">Was this insight helpful?</span>
      <button
        onClick={() => handleRate('helpful')}
        className="p-1 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
        title="Helpful insight"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleRate('unhelpful')}
        className="p-1 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
        title="Not helpful"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
