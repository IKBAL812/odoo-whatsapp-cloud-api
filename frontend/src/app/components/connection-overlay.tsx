"use client";

import { WifiXIcon, SignOutIcon } from "@phosphor-icons/react";
import { useTranslations } from "../context/translation-provider";
import { useAuth } from "../hooks/use-auth";
import { useConnection } from "../context/connection-provider";

export default function ConnectionOverlay() {
  const { connectionStatus } = useConnection();
  const { t } = useTranslations();
  const { logout } = useAuth();

  const isVisible = connectionStatus !== "connected";

  const handleRetry = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
  };

  if (!isVisible) {
    return null;
  }

  const getOverlayContent = () => {
    switch (connectionStatus) {
      case "disconnected":
        return {
          icon: (
            <WifiXIcon
              className="size-16 text-[rgb(var(--status-error))]"
              weight="bold"
            />
          ),
          title: t("connection.disconnected.title") || "Connection Lost",
          message:
            t("connection.disconnected.message") ||
            "Unable to connect to the server. Please check your internet connection.",
          buttonText: t("connection.retry") || "Retry",
          buttonAction: handleRetry,
          buttonClass:
            "bg-[rgb(var(--status-info))] hover:bg-[rgb(var(--status-info)/0.8)]",
        };
      case "session-expired":
        return {
          icon: (
            <SignOutIcon
              className="size-16 text-[rgb(var(--status-warning))]"
              weight="bold"
            />
          ),
          title: t("connection.sessionExpired.title") || "Session Expired",
          message:
            t("connection.sessionExpired.message") ||
            "Your session has expired. Please log in again.",
          buttonText: t("connection.login") || "Log In",
          buttonAction: handleLogout,
          buttonClass:
            "bg-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--accent-primary)/0.8)]",
        };
      default:
        return null;
    }
  };

  const content = getOverlayContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-[rgb(var(--bg-primary)/0.8)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[rgb(var(--bg-card)/var(--bg-card-opacity))] rounded-2xl border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] shadow-2xl max-w-md w-full p-8 text-center">
        <div className="flex flex-col items-center gap-6">
          {content.icon}

          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
              {content.title}
            </h2>
            <p className="text-[rgb(var(--text-secondary))] leading-relaxed">
              {content.message}
            </p>
          </div>

          <button
            onClick={content.buttonAction}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${content.buttonClass}`}
          >
            {content.buttonText}
          </button>

          {connectionStatus === "disconnected" && (
            <div className="flex items-center justify-center gap-2 text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] text-sm">
              <WifiXIcon className="size-4" />
              <span>
                {t("connection.checking") || "Checking connection..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
