import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, type SupportedLanguage, type Translations } from '../locales/translations.ts';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: Translations;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  formatNumber: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'ursella_preferred_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (stored === 'en' || stored === 'fr') return stored;
      if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) {
        return 'fr';
      }
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {}
  }, [language]);

  const formatNumber = (amount: number): string => {
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale).format(amount);
  };

  const formatCurrency = (amount: number, currencyCode = 'XAF'): string => {
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const formattedNum = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(amount);

    if (currencyCode === 'XAF' || currencyCode === 'FCFA') {
      return language === 'fr' ? `${formattedNum} FCFA` : `XAF ${formattedNum}`;
    }
    return `${currencyCode} ${formattedNum}`;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t: translations[language],
        formatCurrency,
        formatNumber,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
