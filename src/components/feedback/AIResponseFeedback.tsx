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
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <Check className="w-3.5 h-3.5" />
        <span className="font-medium">Thanks for feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="hidden xs:inline text-zinc-500">Helpful?</span>
      <button
        onClick={() => handleRate('helpful')}
        className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:text-emerald-400 hover:bg-zinc-800 rounded-lg transition-colors active:scale-95"
        title="Helpful insight"
        aria-label="Mark insight as helpful"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleRate('unhelpful')}
        className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors active:scale-95"
        title="Not helpful"
        aria-label="Mark insight as not helpful"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

