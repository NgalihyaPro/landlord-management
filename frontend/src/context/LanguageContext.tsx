'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en'); // Default to English

  useEffect(() => {
    const savedLang = localStorage.getItem('landlord_lang') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'sw')) {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('landlord_lang', lang);
  };

  // Helper to get nested translation value
  const t = (path: string) => {
    const keys = path.split('.');
    let result: any = translations[language];
    
    for (const key of keys) {
      if (result && result[key] !== undefined) {
        result = result[key];
      } else {
        let fallback: any = translations.en;
        for (const fallbackKey of keys) {
          if (fallback && fallback[fallbackKey] !== undefined) {
            fallback = fallback[fallbackKey];
          } else {
            console.warn(`Translation missing for key: ${path} in language: ${language}`);
            return path;
          }
        }
        return fallback;
      }
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
