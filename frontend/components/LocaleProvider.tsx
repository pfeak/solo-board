'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getStoredLocale, setStoredLocale, type Locale } from '@/lib/locale';
import { getMessage } from '@/lib/i18n';
import { authApi } from '@/lib/api';

interface LocaleContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const applyLocale = (l: Locale) => {
      setLocale(l);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
      }
    };

    const isAuthPage = pathname === '/login' || pathname === '/change-password';
    if (isAuthPage) {
      applyLocale(getStoredLocale());
      return;
    }

    authApi
      .getPreferences()
      .then((prefs) => {
        if (prefs?.locale) {
          setStoredLocale(prefs.locale);
          applyLocale(prefs.locale);
        } else {
          applyLocale(getStoredLocale());
        }
      })
      .catch(() => {
        applyLocale(getStoredLocale());
      });
  }, [pathname]);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => getMessage(locale, key, params),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: 'en',
      t: (key: string, params?: Record<string, string>) => getMessage('en', key, params),
    };
  }
  return ctx;
}
