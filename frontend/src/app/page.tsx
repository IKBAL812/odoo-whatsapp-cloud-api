"use client";

import { useEffect, useState, useRef } from "react";
import TabActivePanel from "./components/tab-active-panel";
import TabIcons from "./components/tab-icons";
import TabPanel from "./components/tab-panel";
import ChatsProvider from "./context/chats-provider";
import ContactsProvider from "./context/contacts-provider";
import CurrentChatProvider from "./context/current-chat-provider";
import ProfileProvider from "./context/profile-provider";
import TabProvider from "./context/tab-provider";
import AuthProvider from "./context/auth-provider";
import { useAuth } from "./hooks/use-auth";
import LoginScreen from "./components/auth/login-screen";
import {
  TranslationProvider,
  useTranslations,
} from "./context/translation-provider";
import { ThemeProvider } from "./context/theme-provider";
import ConnectionProvider from "./context/connection-provider";
import ConnectionOverlay from "./components/connection-overlay";
import {
  MobileNavigationProvider,
  useMobileNavigation,
} from "./context/mobile-navigation-provider";
import { useResponsive } from "./hooks/use-responsive";
import { useChats } from "./hooks/use-chats";
import TabSyncProvider from "./context/tab-sync-provider";
import { useTabSync } from "./hooks/use-tab-sync";
import SessionBlockedOverlay from "./components/session-blocked-overlay";

function ResponsiveLayout() {
  const { isMobile, isInitialized } = useResponsive();
  const { currentView } = useMobileNavigation();

  // Prevent flash of wrong layout during hydration
  if (!isInitialized) {
    return null;
  }

  // Mobile layout: single panel view
  if (isMobile) {
    return (
      <section className="h-full min-h-0 w-full flex flex-col">
        {currentView === "chatList" ? (
          <>
            <TabPanel />
            <TabIcons />
          </>
        ) : (
          <TabActivePanel />
        )}
        <ConnectionOverlay />
      </section>
    );
  }

  // Tablet/Desktop layout: multi-panel grid
  return (
    <section className="h-full min-h-0 w-full grid grid-cols-14 md:grid-cols-24">
      <TabIcons />
      <TabPanel />
      <TabActivePanel />
      <ConnectionOverlay />
    </section>
  );
}

function PageTitleUpdater() {
  const { totalUnreadCount } = useChats();

  useEffect(() => {
    const baseTitle = "Odoo WhatsApp Web";
    if (totalUnreadCount > 0) {
      document.title = `(${totalUnreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [totalUnreadCount]);

  return null;
}

function AppShell() {
  return (
    <ProfileProvider>
      <TabProvider>
        <ContactsProvider>
          <ChatsProvider>
            <PageTitleUpdater />
            <CurrentChatProvider>
              <MobileNavigationProvider>
                <ResponsiveLayout />
              </MobileNavigationProvider>
            </CurrentChatProvider>
          </ChatsProvider>
        </ContactsProvider>
      </TabProvider>
    </ProfileProvider>
  );
}

function TabSyncGuard() {
  const { isBlocked } = useTabSync();

  if (isBlocked) {
    return <SessionBlockedOverlay />;
  }

  return null;
}

function AuthenticatedApp() {
  const { isAuthenticated, isCheckingAuth, loginWithSessionId } = useAuth();
  const { t } = useTranslations();
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const ssoAttemptedRef = useRef(false);

  // Mark as client-side after hydration to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-login from SSO parameter
  useEffect(() => {
    if (!isClient || ssoAttemptedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const ssoSession = params.get("sso_session");
    const error = params.get("error");

    // Handle error from SSO endpoint
    if (error) {
      setSsoError(error);
      ssoAttemptedRef.current = true;
      // Clean URL
      window.history.replaceState({}, "", "/");
      return;
    }

    // Perform SSO login if parameter exists and not already authenticated
    if (ssoSession && !isAuthenticated && !isCheckingAuth) {
      ssoAttemptedRef.current = true;
      setIsSsoLoading(true);
      // Clean URL immediately (before async operation to prevent bookmark with session)
      window.history.replaceState({}, "", "/");

      // Perform login using existing auth flow
      loginWithSessionId(ssoSession)
        .then(() => {
          // Success - auth state will update and component will re-render
          setIsSsoLoading(false);
        })
        .catch((err) => {
          console.error("[SSO] Auto-login failed:", err);
          setSsoError(
            err.message || "SSO login failed. Please try logging in manually."
          );
          setIsSsoLoading(false);
        });
    }
  }, [isClient, isAuthenticated, isCheckingAuth, loginWithSessionId]);

  // Show SSO loading state (only check after client hydration)
  if (isSsoLoading) {
    return (
      <section className="min-h-screen w-full flex items-center justify-center bg-[rgb(var(--bg-primary))] text-[rgb(var(--text-primary))]">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[rgb(var(--accent-primary)/0.3)] border-t-[rgb(var(--accent-primary))] rounded-full animate-spin mb-4"></div>
          <p className="text-lg text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]">
            {t("auth.ssoLoggingIn") || "Logging in from Odoo..."}
          </p>
        </div>
      </section>
    );
  }

  if (isCheckingAuth) {
    return (
      <section className="min-h-screen w-full flex items-center justify-center bg-[rgb(var(--bg-primary))] text-[rgb(var(--text-primary))]">
        <p className="text-lg text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]">
          {t("app.loadingWorkspace")}
        </p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen ssoError={ssoError} />;
  }

  return (
    <>
      <TabSyncGuard />
      <AppShell />
    </>
  );
}

export default function Home() {
  return (
    <TranslationProvider>
      <ThemeProvider>
        <TabSyncProvider>
          <AuthProvider>
            <ConnectionProvider>
              <AuthenticatedApp />
            </ConnectionProvider>
          </AuthProvider>
        </TabSyncProvider>
      </ThemeProvider>
    </TranslationProvider>
  );
}
