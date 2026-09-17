import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { Globe } from 'lucide-react';

interface LanguageToggleProps {
  variant?: 'pill' | 'button' | 'compact';
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  variant = 'pill',
  className = '',
}) => {
  const { language, setLanguage, toggleLanguage } = useLanguage();
  const { isDark } = useTheme();

  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-lg border select-none transition-colors h-7 sm:h-8 ${
          isDark
            ? 'bg-zinc-900/90 border-zinc-800'
            : 'bg-slate-100/90 border-slate-200'
        } ${className}`}
        role="group"
        aria-label="Language selection"
      >
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`flex items-center justify-center px-2 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all cursor-pointer leading-none ${
            language === 'en'
              ? isDark
                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                : 'bg-white text-emerald-700 shadow-xs font-bold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Switch to English"
          aria-pressed={language === 'en'}
        >
          <span>EN</span>
        </button>
        <button
          type="button"
          onClick={() => setLanguage('fr')}
          className={`flex items-center justify-center px-2 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all cursor-pointer leading-none ${
            language === 'fr'
              ? isDark
                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                : 'bg-white text-emerald-700 shadow-xs font-bold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Passer en Français"
          aria-pressed={language === 'fr'}
        >
          <span>FR</span>
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 h-7 sm:h-8 rounded-lg border text-[11px] sm:text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
          isDark
            ? 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200'
            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-xs'
        } ${className}`}
        title={language === 'en' ? 'Passer en Français' : 'Switch to English'}
      >
        <Globe className="w-3 h-3 text-emerald-500 shrink-0" />
        <span className="font-bold tracking-wider">{language.toUpperCase()}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-7 sm:h-8 rounded-lg border text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
        isDark
          ? 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200'
          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-xs'
      } ${className}`}
      title={language === 'en' ? 'Passer en Français' : 'Switch to English'}
    >
      <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      <span>{language === 'en' ? 'English' : 'Français'}</span>
    </button>
  );
};
