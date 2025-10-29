"use client";

import { useTranslations } from "@/app/context/translation-provider";

const SUPPORTED_LOCALES = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
] as const;

export default function LanguageSelector() {
  const { locale, setLocale, t } = useTranslations();

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        className="text-sm text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]"
        htmlFor="language-selector"
      >
        {t("navigation.language")}
      </label>
      <select
        id="language-selector"
        className="bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] text-[rgb(var(--text-primary))] text-sm rounded-lg px-3 py-2 border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-primary))]"
        value={locale}
        onChange={(event) =>
          setLocale(
            event.target.value as (typeof SUPPORTED_LOCALES)[number]["value"]
          )
        }
      >
        {SUPPORTED_LOCALES.map(({ value, label }) => (
          <option
            key={value}
            value={value}
            className="text-[rgb(var(--text-primary))] bg-[rgb(var(--bg-primary))]"
          >
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
