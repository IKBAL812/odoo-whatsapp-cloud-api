"use client";

import { useTranslations } from "@/app/context/translation-provider";

const SUPPORTED_LOCALES = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" }
] as const;

export default function LanguageSelector() {
  const { locale, setLocale, t } = useTranslations();

  return (
    <div className="flex flex-col items-center gap-2">
      <label className="text-sm text-white/70" htmlFor="language-selector">
        {t("navigation.language")}
      </label>
      <select
        id="language-selector"
        className="bg-white/10 text-white text-sm rounded-lg px-3 py-2 border border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={locale}
        onChange={(event) => setLocale(event.target.value as typeof SUPPORTED_LOCALES[number]["value"])}
      >
        {SUPPORTED_LOCALES.map(({ value, label }) => (
          <option key={value} value={value} className="text-black">
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
