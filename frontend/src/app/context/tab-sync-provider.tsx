"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  PropsWithChildren,
} from "react";

const STORAGE_KEY = "whatsapp_active_tab";
const CHANNEL_NAME = "whatsapp_tab_sync";
const HEARTBEAT_INTERVAL = 3000; // 3 seconds
const HEARTBEAT_TIMEOUT = 8000; // 8 seconds - consider tab dead if no heartbeat

type TabInfo = {
  tabId: string;
  timestamp: number;
};

type TabSyncMessage =
  | { type: "claim"; tabId: string; timestamp: number }
  | { type: "heartbeat"; tabId: string; timestamp: number }
  | { type: "release"; tabId: string };

type TabSyncContextValue = {
  isBlocked: boolean;
  isActive: boolean;
  tabId: string;
};

export const TabSyncContext = createContext<TabSyncContextValue | undefined>(
  undefined
);

export default function TabSyncProvider({ children }: PropsWithChildren) {
  // Generate unique tab ID on mount (persists for this tab's lifetime)
  const tabIdRef = useRef<string>(
    typeof window !== "undefined" ? crypto.randomUUID() : ""
  );
  const tabId = tabIdRef.current;

  const [isBlocked, setIsBlocked] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkActiveTabIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get active tab info from localStorage
  const getActiveTab = useCallback((): TabInfo | null => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as TabInfo;
    } catch {
      return null;
    }
  }, []);

  // Set this tab as active in localStorage
  const setActiveTab = useCallback((tabIdToSet: string) => {
    if (typeof window === "undefined") return;
    const tabInfo: TabInfo = {
      tabId: tabIdToSet,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabInfo));
  }, []);

  // Check if active tab is expired (no heartbeat)
  const isActiveTabExpired = useCallback((): boolean => {
    const activeTab = getActiveTab();
    if (!activeTab) return true;
    return Date.now() - activeTab.timestamp > HEARTBEAT_TIMEOUT;
  }, [getActiveTab]);

  // Claim active status for this tab
  const claimActive = useCallback(() => {
    setActiveTab(tabId);
    setIsActive(true);
    setIsBlocked(false);

    // Broadcast to other tabs that this tab is now active
    if (channelRef.current) {
      const message: TabSyncMessage = {
        type: "claim",
        tabId,
        timestamp: Date.now(),
      };
      channelRef.current.postMessage(message);
    }
  }, [tabId, setActiveTab]);

  // Send heartbeat to update timestamp
  const sendHeartbeat = useCallback(() => {
    if (!isActive) return;

    setActiveTab(tabId);

    // Broadcast heartbeat to other tabs
    if (channelRef.current) {
      const message: TabSyncMessage = {
        type: "heartbeat",
        tabId,
        timestamp: Date.now(),
      };
      channelRef.current.postMessage(message);
    }
  }, [isActive, tabId, setActiveTab]);

  // Check if we should try to claim active status (recovery)
  const checkAndRecoverIfNeeded = useCallback(() => {
    if (isActive) return; // Already active, nothing to do

    const activeTab = getActiveTab();

    // No active tab or active tab is expired - we can claim it
    if (!activeTab || isActiveTabExpired()) {
      claimActive();
    } else if (activeTab.tabId !== tabId) {
      // Another tab is active and not expired
      setIsBlocked(true);
      setIsActive(false);
    }
  }, [isActive, getActiveTab, isActiveTabExpired, claimActive, tabId]);

  // Initialize tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Create BroadcastChannel for tab communication
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    // Handle messages from other tabs
    channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
      const message = event.data;

      if (message.type === "claim") {
        // Another tab is claiming active status
        if (message.tabId !== tabId) {
          setIsBlocked(true);
          setIsActive(false);

          // Stop sending heartbeats
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        }
      } else if (message.type === "heartbeat") {
        // Another tab is still alive
        if (message.tabId !== tabId) {
          setIsBlocked(true);
          setIsActive(false);
        }
      } else if (message.type === "release") {
        // Another tab released active status (closed)
        if (message.tabId !== tabId && !isActive) {
          // Try to claim active status after a small delay
          // (to avoid race conditions with other tabs)
          setTimeout(() => {
            checkAndRecoverIfNeeded();
          }, 100);
        }
      }
    };

    // Check current state and decide if we should be active
    const activeTab = getActiveTab();

    if (!activeTab || isActiveTabExpired()) {
      // No active tab or expired - claim it
      claimActive();
    } else if (activeTab.tabId === tabId) {
      // We are the active tab (refresh scenario)
      setIsActive(true);
      setIsBlocked(false);
    } else {
      // Another tab is active
      // According to plan: newest tab takes over, so we claim it
      claimActive();
    }

    // Set up heartbeat interval for active tab
    heartbeatIntervalRef.current = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL
    );

    // Set up periodic check for expired active tab (recovery mechanism)
    checkActiveTabIntervalRef.current = setInterval(
      checkAndRecoverIfNeeded,
      HEARTBEAT_INTERVAL
    );

    // Cleanup on unmount
    return () => {
      // Release active status if this tab is active
      if (isActive) {
        const releaseMessage: TabSyncMessage = {
          type: "release",
          tabId,
        };
        channel.postMessage(releaseMessage);
      }

      channel.close();
      channelRef.current = null;

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (checkActiveTabIntervalRef.current) {
        clearInterval(checkActiveTabIntervalRef.current);
        checkActiveTabIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Update heartbeat when isActive changes
  useEffect(() => {
    if (!isActive && heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    } else if (isActive && !heartbeatIntervalRef.current) {
      heartbeatIntervalRef.current = setInterval(
        sendHeartbeat,
        HEARTBEAT_INTERVAL
      );
    }
  }, [isActive, sendHeartbeat]);

  const value = useMemo<TabSyncContextValue>(
    () => ({
      isBlocked,
      isActive,
      tabId,
    }),
    [isBlocked, isActive, tabId]
  );

  return (
    <TabSyncContext.Provider value={value}>{children}</TabSyncContext.Provider>
  );
}
