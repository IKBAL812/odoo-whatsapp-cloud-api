import dayjs from "dayjs";
import "dayjs/locale/tr";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
} from "react";
import en from "../locales/en.json";
import tr from "../locales/tr.json";

type Locale = "en" | "tr";

type Messages = typeof en;

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const messages: Record<Locale, Messages> = {
  en,
  tr,
};

const TranslationContext = createContext<TranslationContextValue | undefined>(
  undefined
);

const DEFAULT_LOCALE: Locale = "en";
const STORAGE_KEY = "app.locale";

const resolveKey = (
  source: Messages,
  key: string
): string | Record<string, unknown> | undefined => {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (typeof acc === "object" && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, source) as string | Record<string, unknown> | undefined;
};

export function TranslationProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && messages[stored]) {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    dayjs.locale(locale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const changeLocale = useCallback((nextLocale: Locale) => {
    if (messages[nextLocale]) {
      setLocale(nextLocale);
    }
  }, []);

  const translate = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dictionary = messages[locale] ?? messages[DEFAULT_LOCALE];
      const value = resolveKey(dictionary, key);
      const fallback = resolveKey(messages[DEFAULT_LOCALE], key);
      const resolved =
        typeof value === "string"
          ? value
          : typeof fallback === "string"
            ? fallback
            : key;

      if (!vars) {
        return resolved;
      }

      return Object.keys(vars).reduce(
        (acc, variable) =>
          acc.replace(
            new RegExp(`{{\\s*${variable}\\s*}}`, "g"),
            String(vars[variable])
          ),
        resolved
      );
    },
    [locale]
  );

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale: changeLocale,
      t: translate,
    }),
    [locale, translate, changeLocale]
  );

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
}

export const useTranslations = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      "useTranslations must be used within a TranslationProvider"
    );
  }
  return context;
};
