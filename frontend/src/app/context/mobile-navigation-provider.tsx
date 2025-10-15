"use client";

import { createContext, PropsWithChildren, useState, useCallback, useContext } from "react";

type MobileView = "chatList" | "activeChat";

type MobileNavigationContextType = {
  currentView: MobileView;
  setCurrentView: (view: MobileView) => void;
  showChatList: () => void;
  showActiveChat: () => void;
};

const MobileNavigationContext = createContext<MobileNavigationContextType | undefined>(
  undefined
);

export function MobileNavigationProvider({ children }: PropsWithChildren) {
  const [currentView, setCurrentView] = useState<MobileView>("chatList");

  const showChatList = useCallback(() => {
    setCurrentView("chatList");
  }, []);

  const showActiveChat = useCallback(() => {
    setCurrentView("activeChat");
  }, []);

  return (
    <MobileNavigationContext.Provider
      value={{
        currentView,
        setCurrentView,
        showChatList,
        showActiveChat,
      }}
    >
      {children}
    </MobileNavigationContext.Provider>
  );
}

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (!context) {
    throw new Error("useMobileNavigation must be used within MobileNavigationProvider");
  }
  return context;
}
