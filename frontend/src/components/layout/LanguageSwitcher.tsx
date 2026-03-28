'use client';

import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-brand-100/50 dark:bg-brand-800/50 p-1 rounded-full border border-border/50 backdrop-blur-sm">
      <button
        onClick={() => setLanguage('sw')}
        className={cn(
          "relative px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 z-10",
          language === 'sw' ? "text-white" : "text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-200"
        )}
      >
        {language === 'sw' && (
          <motion.div
            layoutId="active-lang"
            className="absolute inset-0 bg-primary rounded-full -z-10 shadow-sm"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="hidden sm:inline">Kiswahili</span>
        <span className="sm:hidden">SW</span>
      </button>

      <button
        onClick={() => setLanguage('en')}
        className={cn(
          "relative px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 z-10",
          language === 'en' ? "text-white" : "text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-200"
        )}
      >
        {language === 'en' && (
          <motion.div
            layoutId="active-lang"
            className="absolute inset-0 bg-primary rounded-full -z-10 shadow-sm"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="hidden sm:inline">English</span>
        <span className="sm:hidden">EN</span>
      </button>
    </div>
  );
}
