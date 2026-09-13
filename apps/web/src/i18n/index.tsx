import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@balsanskar/shared';
import { hi, type TranslationKey } from './strings.js';

/**
 * Translation, held deliberately small.
 *
 * No i18n library: there is no pluralisation or gender agreement to negotiate
 * in these strings, and a dependency here would cost more than it saves on a
 * 2G connection.
 *
 * Only the language being read is downloaded. Hindi is bundled with the first
 * load because it is the default and what almost every teacher will see;
 * English arrives as a separate chunk if somebody switches to it. A reader who
 * has asked for English waits for that chunk on the boot screen rather than
 * watching the interface change language under them.
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
  /**
   * The tables that have been loaded, seeded with the one that ships eagerly.
   *
   * A cache rather than a single current table, so that switching back to a
   * language already fetched is instant and costs no second request. Hindi is
   * present from the first render, which is why the common case never sees a
   * pending state at all.
   */
  const [tables, setTables] = useState<Partial<Record<Locale, Record<TranslationKey, string>>>>(
    () => ({ hi }),
  );
  const table = tables[locale] ?? null;

  useEffect(() => {
    if (table) return;
    let cancelled = false;
    void import('./tables/en.js').then((module) => {
      if (!cancelled) setTables((current) => ({ ...current, en: module.en }));
    });
    return () => {
      cancelled = true;
    };
  }, [table]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is a small loss, not an error.
    }
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nValue | null>(() => {
    if (!table) return null;
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
  }, [locale, setLocale, table]);

  // Only ever reached by a reader who has chosen English, and only until their
  // language chunk lands. It reuses the boot markup from index.html rather than
  // rendering a spinner, so the transition is one screen and not two.
  if (!value) {
    return (
      <div className="boot">
        <p lang="en">Loading…</p>
      </div>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside an I18nProvider');
  return value;
}

export type { TranslationKey };
