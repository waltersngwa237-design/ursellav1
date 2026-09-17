import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { Globe } from 'lucide-react';

interface LanguageToggleProps {
  variant?: 'compact' | 'pill' | 'button';
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { language, toggleLanguage, setLanguage } = useLanguage();
  const { isDark } = useTheme();

  // If explicit button variant with full text is requested
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={`inline-flex items-center gap-2 px-3 h-8 rounded-lg border text-xs font-semibold transition-all active:scale-95 cursor-pointer select-none ${
          isDark
            ? 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200'
            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-xs'
        } ${className}`}
        title={language === 'en' ? 'Passer en Français' : 'Switch to English'}
        aria-label="Toggle language"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>{language === 'en' ? 'English' : 'Français'}</span>
      </button>
    );
  }

  // Single compact globe toggle 🌐 EN that toggles cleanly without taking up horizontal real estate
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 h-8 rounded-lg border text-xs font-semibold transition-all active:scale-95 cursor-pointer select-none shrink-0 ${
        isDark
          ? 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white'
          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs'
      } ${className}`}
      title={language === 'en' ? 'Passer en Français (FR)' : 'Switch to English (EN)'}
      aria-label={`Current language: ${language.toUpperCase()}. Click to switch language.`}
    >
      <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      <span className="font-bold tracking-wider">{language.toUpperCase()}</span>
    </button>
  );
};
