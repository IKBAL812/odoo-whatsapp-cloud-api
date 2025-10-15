"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/app/hooks/use-auth";
import { useTranslations } from "@/app/context/translation-provider";

export default function LoginForm() {
  const { login, loginWithSessionId, isAuthenticating } = useAuth();
  const [loginMode, setLoginMode] = useState<"credentials" | "sessionId">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslations();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      if (loginMode === "sessionId") {
        await loginWithSessionId(sessionId.trim());
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.submitError");
      setError(message);
    }
  };

  const isSubmitDisabled = loginMode === "sessionId"
    ? sessionId.trim().length === 0 || isAuthenticating
    : username.trim().length === 0 || password.length === 0 || isAuthenticating;

  return (
    <form
      className="w-full flex flex-col gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* Login Mode Toggle */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
        <button
          type="button"
          onClick={() => setLoginMode("credentials")}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
            loginMode === "credentials"
              ? "bg-emerald-600 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          {t("auth.loginModeCredentials")}
        </button>
        <button
          type="button"
          onClick={() => setLoginMode("sessionId")}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
            loginMode === "sessionId"
              ? "bg-emerald-600 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          {t("auth.loginModeSessionId")}
        </button>
      </div>

      {loginMode === "credentials" ? (
        <>
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
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-white/70" htmlFor="sessionId">
            {t("auth.sessionIdLabel")}
          </label>
          <textarea
            id="sessionId"
            name="sessionId"
            rows={3}
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="rounded-lg w-full p-3 outline-none bg-white/10 text-white placeholder-white/50 border border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 transition font-mono text-xs"
            placeholder={t("auth.sessionIdPlaceholder")}
          />
          <p className="text-xs text-white/50">
            {t("auth.sessionIdHelp").split("<code>").map((part, i) => {
              if (i === 0) return part;
              const [codeContent, ...rest] = part.split("</code>");
              return (
                <span key={i}>
                  <code className="bg-white/10 px-1 py-0.5 rounded">{codeContent}</code>
                  {rest.join("</code>")}
                </span>
              );
            })}
          </p>
        </div>
      )}

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
