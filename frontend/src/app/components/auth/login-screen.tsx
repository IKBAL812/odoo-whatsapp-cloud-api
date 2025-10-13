"use client";

import LoginForm from "./login-form";
import { useTranslations } from "@/app/context/translation-provider";

export default function LoginScreen() {
  const { t } = useTranslations();
  return (
    <section className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-black via-neutral-900 to-black">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-white">
            {t("auth.title")}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {t("auth.subtitle")}
          </p>
        </header>
        <LoginForm />
      </div>
    </section>
  );
}
