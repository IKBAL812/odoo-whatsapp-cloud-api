"use client";

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
import { TranslationProvider, useTranslations } from "./context/translation-provider";
import ConnectionProvider from "./context/connection-provider";
import ConnectionOverlay from "./components/connection-overlay";

function AppShell() {
  return (
    <ProfileProvider>
      <TabProvider>
        <ContactsProvider>
          <ChatsProvider>
            <CurrentChatProvider>
              <section className="h-full min-h-0 w-full grid grid-cols-14 md:grid-cols-24">
                <TabIcons />
                <TabPanel />
                <TabActivePanel />
              </section>
              <ConnectionOverlay />
            </CurrentChatProvider>
          </ChatsProvider>
        </ContactsProvider>
      </TabProvider>
    </ProfileProvider>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const { t } = useTranslations();

  if (isCheckingAuth) {
    return (
      <section className="min-h-screen w-full flex items-center justify-center bg-black text-white">
        <p className="text-lg text-white/70">{t("app.loadingWorkspace")}</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AppShell />;
}

export default function Home() {
  return (
    <TranslationProvider>
      <AuthProvider>
        <ConnectionProvider>
          <AuthenticatedApp />
        </ConnectionProvider>
      </AuthProvider>
    </TranslationProvider>
  );
}
