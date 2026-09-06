import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.tsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isOpen) return;

    // Mobile / Android back button support via History API
    let statePushed = false;
    try {
      window.history.pushState({ ursella_modal: true }, '');
      statePushed = true;
    } catch {
      // ignore history restriction in constrained iframe if any
    }

    const handlePopState = () => {
      statePushed = false;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);

      if (statePushed && window.history.state?.ursella_modal) {
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 ${
      isDark ? 'bg-zinc-950/80' : 'bg-slate-900/50'
    }`}>
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxWidthMap[maxWidth]} ${
          isDark 
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-zinc-950/80' 
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        } border rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto`}
        style={{
          paddingBottom: 'max(1.25rem, calc(1rem + env(safe-area-inset-bottom, 0px)))',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && <h3 className={`text-lg font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>{title}</h3>}
            {description && <p className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{description}</p>}
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
              isDark 
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 focus:ring-zinc-600' 
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:ring-slate-400'
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div>{children}</div>
      </div>
    </div>
  );
};
