"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { defaultLocale, dictionaries, locales, type Dictionary, type Locale } from "./dictionaries";

const LOCALE_STORAGE_KEY = "babyloop_locale";

type I18nContextValue = {
  dictionary: Dictionary;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const storedLocale = readStoredLocale();
    setLocaleState(storedLocale);
    document.documentElement.lang = storedLocale;
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale;

    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      return;
    }
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      dictionary: dictionaries[locale],
      locale,
      setLocale
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return value;
}

function readStoredLocale(): Locale {
  try {
    const storedValue = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return locales.includes(storedValue as Locale) ? (storedValue as Locale) : defaultLocale;
  } catch {
    return defaultLocale;
  }
}
