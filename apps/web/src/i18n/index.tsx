import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@balsanskar/shared';
import { strings, type TranslationKey } from './strings.js';

/**
 * Translation, held deliberately small.
 *
 * No i18n library: the whole string table is a few kilobytes, there is no
 * pluralisation or gender agreement to negotiate in these strings, and a
 * dependency here would cost more than it saves on a 2G connection.
 */

const STORAGE_KEY = 'balsanskar.locale';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  /** Renders a number in the locale's own digits and grouping. */
  n: (value: number) => string;
  d: (value: string | Date) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    // Private browsing, or storage disabled by policy. Fall through.
  }
  // Hindi unless the device clearly prefers English: the default should match
  // the language the schools actually work in.
  const preferred = typeof navigator === 'undefined' ? '' : navigator.language;
  return preferred.startsWith('en') ? 'en' : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is a small loss, not an error.
    }
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nValue>(() => {
    const table = strings[locale];
    const numberFormat = new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN');
    const dateFormat = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return {
      locale,
      setLocale,
      t: (key) => table[key],
      n: (number) => numberFormat.format(number),
      d: (input) => {
        const date = typeof input === 'string' ? new Date(input) : input;
        return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date);
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside an I18nProvider');
  return value;
}

export type { TranslationKey };
