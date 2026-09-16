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
        className={`inline-flex items-center p-0.5 rounded-full border backdrop-blur-sm transition-colors ${
          isDark
            ? 'bg-zinc-800/80 border-zinc-700/60'
            : 'bg-slate-100 border-slate-300 shadow-xs'
        } ${className}`}
        role="group"
        aria-label="Language selection"
      >
        <button
          onClick={() => setLanguage('en')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
            language === 'en'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
          title="Switch to English"
          aria-pressed={language === 'en'}
        >
          <span className="text-[11px]">🇬🇧</span>
          <span>EN</span>
        </button>
        <button
          onClick={() => setLanguage('fr')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
            language === 'fr'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
          title="Passer en Français"
          aria-pressed={language === 'fr'}
        >
          <span className="text-[11px]">🇫🇷</span>
          <span>FR</span>
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleLanguage}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
          isDark
            ? 'border-zinc-700/70 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200'
            : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-xs'
        } ${className}`}
        title={language === 'en' ? 'Passer en Français' : 'Switch to English'}
      >
        <span className="text-xs">{language === 'en' ? '🇬🇧' : '🇫🇷'}</span>
        <span className="font-bold">{language.toUpperCase()}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
        isDark
          ? 'border-zinc-700/70 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200'
          : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-xs'
      } ${className}`}
      title={language === 'en' ? 'Passer en Français' : 'Switch to English'}
    >
      <Globe className="w-3.5 h-3.5 text-blue-500" />
      <span>{language === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}</span>
    </button>
  );
};
