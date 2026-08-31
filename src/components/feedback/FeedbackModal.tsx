import React, { useState } from 'react';
import { X, MessageSquare, Bug, Lightbulb, Sparkles, Send, CheckCircle2, Bot, HelpCircle } from 'lucide-react';
import { ClientFeedbackService } from '../../services/feedback.service.ts';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
}

type FeedbackType = 'bug' | 'ai_issue' | 'feature_request' | 'confusing_experience' | 'general';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, businessId }) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await ClientFeedbackService.submitFeedback({
        businessId,
        feedbackType,
        comment: comment.trim(),
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
        },
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setComment('');
        onClose();
      }, 2000);
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: Array<{ id: FeedbackType; label: string; icon: React.ReactNode; color: string }> = [
    { id: 'bug', label: 'Bug', icon: <Bug className="w-3.5 h-3.5" />, color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' },
    { id: 'ai_issue', label: 'AI Issue', icon: <Bot className="w-3.5 h-3.5" />, color: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
    { id: 'feature_request', label: 'Feature Request', icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    { id: 'confusing_experience', label: 'Confusing Experience', icon: <HelpCircle className="w-3.5 h-3.5" />, color: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
    { id: 'general', label: 'General Feedback', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 text-zinc-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center flex flex-col items-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <h3 className="text-lg font-bold text-white">Thank You!</h3>
            <p className="text-sm text-zinc-400 mt-1">Your feedback directly shapes the future of Ursella.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Beta Feedback</span>
            </div>
            <h3 className="text-xl font-bold text-white">Share Your Experience</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-4">
              Help us polish Ursella. Let us know what worked, what broke, or what you'd like to see.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {categories.map((cat) => {
                const isSelected = feedbackType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFeedbackType(cat.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                      isSelected
                        ? cat.color
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {cat.icon}
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Description & Context
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  feedbackType === 'bug'
                    ? 'What went wrong? Steps to reproduce...'
                    : feedbackType === 'ai_issue'
                    ? 'What prompt did you run and what was inaccurate or unexpected?'
                    : feedbackType === 'feature_request'
                    ? 'What capability or workflow would help your business most?'
                    : feedbackType === 'confusing_experience'
                    ? 'Which screen or button felt unclear or difficult to navigate?'
                    : 'Share your general thoughts or impressions...'
                }
                rows={4}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !comment.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Submit Feedback'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
