"use client";

import LoginForm from "./login-form";
import { useTranslations } from "@/app/context/translation-provider";
import { useTheme } from "@/app/hooks/use-theme";
import { SunIcon, MoonIcon } from "@phosphor-icons/react";

export default function LoginScreen() {
  const { t } = useTranslations();
  const { theme, toggleTheme } = useTheme();

  return (
    <section className="min-h-screen w-full flex items-center justify-center bg-[rgb(var(--bg-primary))] relative">
      {/* Theme toggle button in top-right corner */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-lg bg-[rgb(var(--bg-card)/var(--bg-card-opacity))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] transition-colors"
        title={t(
          theme === "dark" ? "navigation.lightTheme" : "navigation.darkTheme"
        )}
      >
        {theme === "dark" ? (
          <SunIcon
            className="size-6 text-[rgb(var(--text-primary))]"
            weight="bold"
          />
        ) : (
          <MoonIcon
            className="size-6 text-[rgb(var(--text-primary))]"
            weight="bold"
          />
        )}
      </button>

      <div className="w-full max-w-md mx-4 rounded-2xl border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] bg-[rgb(var(--bg-card)/var(--bg-card-opacity))] backdrop-blur-md p-8 shadow-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-[rgb(var(--text-primary))]">
            {t("auth.title")}
          </h1>
          <p className="mt-2 text-sm text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
            {t("auth.subtitle")}
          </p>
        </header>
        <LoginForm />
      </div>
    </section>
  );
}
