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
          icon: <WifiXIcon className="size-16 text-red-400" weight="bold" />,
          title: t("connection.disconnected.title") || "Connection Lost",
          message: t("connection.disconnected.message") || "Unable to connect to the server. Please check your internet connection.",
          buttonText: t("connection.retry") || "Retry",
          buttonAction: handleRetry,
          buttonClass: "bg-blue-600 hover:bg-blue-500"
        };
      case "session-expired":
        return {
          icon: <SignOutIcon className="size-16 text-orange-400" weight="bold" />,
          title: t("connection.sessionExpired.title") || "Session Expired",
          message: t("connection.sessionExpired.message") || "Your session has expired. Please log in again.",
          buttonText: t("connection.login") || "Log In",
          buttonAction: handleLogout,
          buttonClass: "bg-emerald-600 hover:bg-emerald-500"
        };
      default:
        return null;
    }
  };

  const content = getOverlayContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-md w-full p-8 text-center">
        <div className="flex flex-col items-center gap-6">
          {content.icon}
          
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">
              {content.title}
            </h2>
            <p className="text-gray-300 leading-relaxed">
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
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              <WifiXIcon className="size-4" />
              <span>{t("connection.checking") || "Checking connection..."}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}