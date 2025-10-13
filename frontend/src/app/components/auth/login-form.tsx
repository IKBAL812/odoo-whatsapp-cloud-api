"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/app/hooks/use-auth";
import { useTranslations } from "@/app/context/translation-provider";

export default function LoginForm() {
  const { login, isAuthenticating } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslations();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await login(username.trim(), password);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.submitError");
      setError(message);
    }
  };

  const isSubmitDisabled =
    username.trim().length === 0 ||
    password.length === 0 ||
    isAuthenticating;

  return (
    <form
      className="w-full flex flex-col gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/70" htmlFor="username">
          {t("auth.username")}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="rounded-lg w-full p-3 outline-none bg-white/10 text-white placeholder-white/50 border border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 transition"
          placeholder={t("auth.username")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/70" htmlFor="password">
          {t("auth.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg w-full p-3 outline-none bg-white/10 text-white placeholder-white/50 border border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 transition"
          placeholder={t("auth.password")}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-lg p-3 bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={isSubmitDisabled}
      >
        {isAuthenticating ? t("auth.submitting") : t("auth.submit")}
      </button>
    </form>
  );
}
