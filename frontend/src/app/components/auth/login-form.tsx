"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/app/hooks/use-auth";
import { useTranslations } from "@/app/context/translation-provider";

export default function LoginForm() {
  const { login, loginWithSessionId, isAuthenticating } = useAuth();
  const [loginMode, setLoginMode] = useState<"credentials" | "sessionId">(
    "credentials"
  );
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

  const isSubmitDisabled =
    loginMode === "sessionId"
      ? sessionId.trim().length === 0 || isAuthenticating
      : username.trim().length === 0 ||
        password.length === 0 ||
        isAuthenticating;

  return (
    <form
      className="w-full flex flex-col gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* Login Mode Toggle */}
      <div className="flex gap-2 p-1 bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] rounded-lg">
        <button
          type="button"
          onClick={() => setLoginMode("credentials")}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
            loginMode === "credentials"
              ? "bg-[rgb(var(--accent-primary))] text-white"
              : "text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
          }`}
        >
          {t("auth.loginModeCredentials")}
        </button>
        <button
          type="button"
          onClick={() => setLoginMode("sessionId")}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
            loginMode === "sessionId"
              ? "bg-[rgb(var(--accent-primary))] text-white"
              : "text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
          }`}
        >
          {t("auth.loginModeSessionId")}
        </button>
      </div>

      {loginMode === "credentials" ? (
        <>
          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-medium text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]"
              htmlFor="username"
            >
              {t("auth.username")}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-lg w-full p-3 outline-none bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] focus:border-[rgb(var(--accent-primary))] focus:ring-2 focus:ring-[rgb(var(--accent-primary)/0.4)] transition"
              placeholder={t("auth.username")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-medium text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]"
              htmlFor="password"
            >
              {t("auth.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg w-full p-3 outline-none bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] focus:border-[rgb(var(--accent-primary))] focus:ring-2 focus:ring-[rgb(var(--accent-primary)/0.4)] transition"
              placeholder={t("auth.password")}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]"
            htmlFor="sessionId"
          >
            {t("auth.sessionIdLabel")}
          </label>
          <textarea
            id="sessionId"
            name="sessionId"
            rows={3}
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="rounded-lg w-full p-3 outline-none bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] focus:border-[rgb(var(--accent-primary))] focus:ring-2 focus:ring-[rgb(var(--accent-primary)/0.4)] transition font-mono text-xs"
            placeholder={t("auth.sessionIdPlaceholder")}
          />
          <p className="text-xs text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
            {t("auth.sessionIdHelp")
              .split("<code>")
              .map((part, i) => {
                if (i === 0) return part;
                const [codeContent, ...rest] = part.split("</code>");
                return (
                  <span key={i}>
                    <code className="bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] px-1 py-0.5 rounded">
                      {codeContent}
                    </code>
                    {rest.join("</code>")}
                  </span>
                );
              })}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-[rgb(var(--status-error))] bg-[rgb(var(--status-error)/0.1)] border border-[rgb(var(--status-error)/0.3)] rounded-lg p-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-lg p-3 bg-[rgb(var(--accent-primary))] text-white font-semibold hover:bg-[rgb(var(--status-success))] transition disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={isSubmitDisabled}
      >
        {isAuthenticating ? t("auth.submitting") : t("auth.submit")}
      </button>
    </form>
  );
}
