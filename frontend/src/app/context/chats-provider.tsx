import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../hooks/use-auth";
import { useSSE } from "../hooks/use-sse";
import { useThreadsPoller } from "../hooks/use-threads-poller";
import { useConnection } from "./connection-provider";
import { buildPartnerAvatarUrl } from "../lib/odoo/avatar-url";

export enum Filters {
  ALL = "all",
  UNREAD = "unread",
  FAVORITES = "favorites",
  GROUPS = "groups",
}

export type ReactionType = {
  emoji: string;
  count: number;
};

export type AttachmentType = "image" | "video" | "audio" | "document";

export type Attachment = {
  id: number;
  name: string;
  mimetype: string;
  url: string;
  file_size: number;
  type?: AttachmentType;
};

export type Message = {
  id?: string;
  contactId: string;
  message: string;
  timestamp: number;
  isSentFromUser: boolean;
  read?: boolean;
  sent?: boolean;
  delivered?: boolean;
  reactions?: ReactionType[];
  error?: string;
  userId?: number | null;
  whatsappId?: string | null;
  attachment?: Attachment;
  reactionEmoji?: string | null;
  replyTo?: {
    messageId: string;
    message: string;
    contactId: string;
    senderIsUser: boolean;
  };
};

export type Chat = {
  id: string;
  contactId: string | string[];
  groupName?: string;
  groupAvatar?: string;
  threadName?: string;
  phoneNumber?: string | null;
  backendId?: number | null;
  partnerId?: number | null; // Partner ID for opening in Odoo
  partnerName?: string | null; // Partner display name from Odoo
  partnerAvatar?: string | null; // Partner avatar URL from Odoo
  hasAvatar?: boolean; // NEW: Whether partner has an actual avatar image
  lastMessagePreview?: string;
  lastMessageAt?: number | null;
  unreadCount?: number; // NEW: Unread message count from backend
  read: boolean;
  group: boolean;
  favorite: boolean;
  messages: Message[];
};

export type Chats = {
  complete: Chat[];
  filtered: Chat[];
  isLoading: boolean;
};

export const ChatsContext = createContext<
  | undefined
  | {
      filter: string;
      updateFilter: (filter: string) => void;
      chats: Chats;
      hasMoreThreads: boolean;
      isLoadingMoreThreads: boolean;
      loadMoreThreads: () => void;
      updateThreadPreview: (
        chatId: string,
        preview: string,
        timestamp: number
      ) => void;
      markChatAsRead: (chatId: string) => void;
      totalUnreadCount: number;
      selectedBackendId: number | null;
      setSelectedBackendId: (backendId: number | null) => void;
      searchQuery: string;
      updateSearchQuery: (query: string) => void;
      clearSearch: () => void;
    }
>(undefined);

// Constants for localStorage persistence
const NOTIFICATION_STATE_KEY = "whatsapp.notificationState.threads";
const NOTIFIED_MESSAGES_KEY = "whatsapp.notificationState.messages";
const MESSAGE_NOTIFICATION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const NOTIFICATION_PERMISSION_KEY = "whatsapp.notificationPermission.dismissed";
const THREADS_PAGE_SIZE = 30;

// Helper to load notification state from localStorage
function loadNotificationState(): Map<string, number> {
  if (typeof window === "undefined") return new Map();

  try {
    const stored = localStorage.getItem(NOTIFICATION_STATE_KEY);
    if (!stored) return new Map();

    const parsed: { [key: string]: number } = JSON.parse(stored);
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.error(
      "[Notifications] Failed to restore state from localStorage:",
      error
    );
    return new Map();
  }
}

// Helper to save notification state to localStorage (debounced)
let saveTimeout: NodeJS.Timeout | null = null;
function saveNotificationState(state: Map<string, number>) {
  if (typeof window === "undefined") return;

  // Debounce saves to avoid excessive localStorage writes
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      const stateObj = Object.fromEntries(state);
      localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(stateObj));
    } catch (error) {
      console.error(
        "[Notifications] Failed to save state to localStorage:",
        error
      );
    }
  }, 1000); // Debounce for 1 second
}

// Helper to load notified messages from localStorage
function loadNotifiedMessages(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = localStorage.getItem(NOTIFIED_MESSAGES_KEY);
    if (!stored) return new Set();

    const parsed: { [key: string]: number } = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired entries (older than TTL)
    const validKeys = Object.entries(parsed)
      .filter(([, timestamp]) => now - timestamp < MESSAGE_NOTIFICATION_TTL)
      .map(([key]) => key);

    return new Set(validKeys);
  } catch (error) {
    console.error(
      "[Notifications] Failed to restore notified messages from localStorage:",
      error
    );
    return new Set();
  }
}

// Helper to save notified messages to localStorage (debounced)
let saveMessagesTimeout: NodeJS.Timeout | null = null;
function saveNotifiedMessages(messages: Set<string>) {
  if (typeof window === "undefined") return;

  // Debounce saves to avoid excessive localStorage writes
  if (saveMessagesTimeout) clearTimeout(saveMessagesTimeout);

  saveMessagesTimeout = setTimeout(() => {
    try {
      const now = Date.now();
      // Store message keys with current timestamp
      const messageObj: { [key: string]: number } = {};
      messages.forEach((key) => {
        messageObj[key] = now;
      });

      localStorage.setItem(NOTIFIED_MESSAGES_KEY, JSON.stringify(messageObj));
    } catch (error) {
      console.error(
        "[Notifications] Failed to save notified messages to localStorage:",
        error
      );
    }
  }, 1000); // Debounce for 1 second
}

// Helper to build message notification key
function buildMessageNotificationKey(
  messageId: number,
  threadId: string,
  timestamp: number
): string {
  return `${threadId}-${messageId}-${timestamp}`;
}

// Helper to check if permission was previously dismissed
function wasPermissionDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATION_PERMISSION_KEY) === "true";
}

// Helper to mark permission as dismissed
function markPermissionDismissed() {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "true");
}

// Helper to show browser notification for a thread
function showBrowserNotification(
  threadName: string,
  messagePreview: string,
  threadId: string
) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(threadName || "New message", {
      body: messagePreview || "You have a new message",
      tag: `thread-${threadId}`, // Prevent duplicate notifications for same thread
    });
  } else if (
    Notification.permission === "default" &&
    !wasPermissionDismissed()
  ) {
    Notification.requestPermission()
      .then((permission) => {
        if (permission === "denied") {
          markPermissionDismissed();
        } else if (permission === "granted") {
          // Permission granted, show the notification now
          new Notification(threadName || "New message", {
            body: messagePreview || "You have a new message",
            tag: `thread-${threadId}`,
          });
        }
      })
      .catch(() => undefined);
  }
}

type ChatsProviderProps = PropsWithChildren<{
  includeThreadId?: string | null;
}>;

export default function ChatsProvider({
  children,
  includeThreadId,
}: ChatsProviderProps) {
  const [filter, setFilter] = useState<Filters>(Filters.ALL);
  const [selectedBackendId, setSelectedBackendId] = useState<number | null>(
    null
  ); // null = all backends
  const [chats, setChats] = useState<Chats>({
    complete: [],
    filtered: [],
    isLoading: false,
  });
  const [hasMoreThreads, setHasMoreThreads] = useState(true);
  const [isLoadingMoreThreads, setIsLoadingMoreThreads] = useState(false);
  const [nextThreadsOffset, setNextThreadsOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { sessionId, backendId: authBackendId } = useAuth();
  const { reportApiError, reportConnectionRestored } = useConnection();
  const isFetchingRef = useRef(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedUnreadCountRef = useRef<Map<string, number>>(new Map()); // threadId -> last notified unread count
  const notifiedMessagesRef = useRef<Set<string>>(new Set()); // messageId-threadId-timestamp -> notified
  const [odooBaseUrl, setOdooBaseUrl] = useState<string | null>(null);

  // Initialize notification audio
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    notificationAudioRef.current = new Audio("/notification.mp3");
  }, []);

  // Restore notification state from localStorage on mount
  useEffect(() => {
    const restoredState = loadNotificationState();
    lastNotifiedUnreadCountRef.current = restoredState;

    const restoredMessages = loadNotifiedMessages();
    notifiedMessagesRef.current = restoredMessages;
  }, []);

  // Fetch Odoo base URL for avatar generation
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.odooBaseUrl) {
          setOdooBaseUrl(data.odooBaseUrl);
        }
      })
      .catch(() => {
        // Silently fail - avatars just won't display
      });
  }, []);

  // SSE callbacks for real-time thread updates
  const handleThreadsUpdate = useCallback(
    (threads: unknown[]) => {
      // Process new threads from SSE
      const odooThreads = threads as Array<{
        id: number;
        name: string;
        last_message_date: string | null;
        last_message_preview: string | null;
        phone_number: string | null;
        backend_id: number | null;
        partner_id?: [number, string] | number | null | false;
        write_date: string;
        unread_count?: number; // NEW: Unread count from backend
        has_avatar?: boolean; // NEW: Whether partner has an actual avatar image
      }>;

      // Track if any thread has a genuinely new message for notifications
      // Use ref to check outside of setChats to avoid stale closure
      let shouldPlayNotification = false;
      const threadsToNotify: Array<{
        id: string;
        name: string;
        preview: string;
      }> = [];

      setChats((prev) => {
        // Create a map of existing chats for efficient lookup
        const existingChatsMap = new Map(
          prev.complete.map((chat) => [chat.id, chat])
        );

        // Process updates from SSE
        odooThreads.forEach((thread) => {
          const threadId = thread.id.toString();
          const existingChat = existingChatsMap.get(threadId);

          if (existingChat) {
            // Update existing chat, preserving important data like messages
            const newTimestamp = thread.last_message_date
              ? new Date(thread.last_message_date + "Z").getTime()
              : existingChat.lastMessageAt;

            // Prefer backend data, but respect frontend optimistic updates
            // Use Math.max() to handle race conditions where:
            // - Frontend SSE gets message webhook first → increments unread immediately
            // - Backend thread.updated webhook arrives with stale count (queue delay)
            // - Polling syncs to backend ground truth periodically
            const backendUnreadCount = thread.unread_count ?? 0;
            const frontendUnreadCount = existingChat.unreadCount ?? 0;
            const newUnreadCount = Math.max(
              backendUnreadCount,
              frontendUnreadCount
            );
            const lastNotifiedCount =
              lastNotifiedUnreadCountRef.current.get(threadId);

            // Check if we should play notification for this thread
            // Play if: unread count INCREASED compared to last notified count
            // This handles ONLY incoming messages (outgoing messages don't increase unread count)
            if (
              lastNotifiedCount !== undefined &&
              newUnreadCount > lastNotifiedCount
            ) {
              // Unread count increased - play notification!
              shouldPlayNotification = true;
              threadsToNotify.push({
                id: threadId,
                name: thread.name || `Thread ${threadId}`,
                preview: thread.last_message_preview || "New message",
              });
              lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
              saveNotificationState(lastNotifiedUnreadCountRef.current);
            } else if (lastNotifiedCount === undefined) {
              // First time seeing this thread - set baseline without notifying
              lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
              saveNotificationState(lastNotifiedUnreadCountRef.current);
            } else if (newUnreadCount < lastNotifiedCount) {
              // Unread count decreased (user read messages) - update baseline
              lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
              saveNotificationState(lastNotifiedUnreadCountRef.current);
            }

            const hasUnread = newUnreadCount > 0;

            // Extract partner ID and display name from Odoo tuple
            const partnerId =
              Array.isArray(thread.partner_id) && thread.partner_id.length > 0
                ? thread.partner_id[0]
                : typeof thread.partner_id === "number"
                  ? thread.partner_id
                  : null;
            const partnerName =
              Array.isArray(thread.partner_id) && thread.partner_id.length > 1
                ? thread.partner_id[1]
                : null;

            // Always build partner avatar URL if we have partnerId and odooBaseUrl
            // The component will decide whether to use it based on hasAvatar flag
            const hasAvatar = thread.has_avatar === true;
            const partnerAvatar =
              partnerId && odooBaseUrl
                ? buildPartnerAvatarUrl(odooBaseUrl, partnerId, sessionId)
                : null;

            existingChatsMap.set(threadId, {
              ...existingChat,
              lastMessagePreview:
                thread.last_message_preview || existingChat.lastMessagePreview,
              lastMessageAt: newTimestamp,
              threadName: thread.name || existingChat.threadName,
              partnerId: partnerId ?? existingChat.partnerId,
              partnerName: partnerName ?? existingChat.partnerName,
              // Keep existing avatar URL if new one is null (odooBaseUrl not loaded yet)
              partnerAvatar:
                partnerAvatar !== null
                  ? partnerAvatar
                  : existingChat.partnerAvatar,
              hasAvatar: hasAvatar, // Update avatar availability flag
              unreadCount: newUnreadCount, // Update unread count
              read: !hasUnread, // Mark as read if no unread messages
            });
          } else {
            // Add new chat
            const newTimestamp = thread.last_message_date
              ? new Date(thread.last_message_date + "Z").getTime()
              : Date.now();
            const newUnreadCount = thread.unread_count ?? 0;

            // For new chats, set baseline without notifying (they're new to the list)
            lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
            saveNotificationState(lastNotifiedUnreadCountRef.current);

            // Extract partner ID and display name from Odoo tuple
            const partnerId =
              Array.isArray(thread.partner_id) && thread.partner_id.length > 0
                ? thread.partner_id[0]
                : typeof thread.partner_id === "number"
                  ? thread.partner_id
                  : null;
            const partnerName =
              Array.isArray(thread.partner_id) && thread.partner_id.length > 1
                ? thread.partner_id[1]
                : null;

            // Always build partner avatar URL if we have partnerId and odooBaseUrl
            // The component will decide whether to use it based on hasAvatar flag
            const hasAvatar = thread.has_avatar === true;
            const partnerAvatar =
              partnerId && odooBaseUrl
                ? buildPartnerAvatarUrl(odooBaseUrl, partnerId, sessionId)
                : null;

            existingChatsMap.set(threadId, {
              id: threadId,
              contactId: thread.phone_number || "",
              threadName: thread.name || undefined,
              phoneNumber: thread.phone_number || null,
              backendId: thread.backend_id || null,
              partnerId,
              partnerName,
              partnerAvatar,
              hasAvatar, // Include avatar availability flag
              lastMessagePreview: thread.last_message_preview || "",
              lastMessageAt: newTimestamp,
              unreadCount: newUnreadCount, // Set unread count
              groupName: undefined,
              groupAvatar: undefined,
              read: newUnreadCount === 0, // Mark as read if no unread messages
              favorite: false,
              group: false,
              messages: [],
            });
          }
        });

        // Sort by last message timestamp
        const updatedComplete = Array.from(existingChatsMap.values()).sort(
          (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)
        );

        // Apply filter to get filtered list
        let filteredList = updatedComplete;
        if (filter === Filters.UNREAD) {
          filteredList = updatedComplete.filter((chat) => !chat.read);
        } else if (filter === Filters.FAVORITES) {
          filteredList = updatedComplete.filter((chat) => chat.favorite);
        } else if (filter === Filters.GROUPS) {
          filteredList = updatedComplete.filter((chat) => chat.group);
        }

        return {
          ...prev,
          complete: updatedComplete,
          filtered: filteredList,
          isLoading: false,
        };
      });

      // Play notification sound if any thread had a new message
      // This fixes Bug 2: notifications for messages from inactive threads
      if (shouldPlayNotification) {
        if (notificationAudioRef.current) {
          notificationAudioRef.current.currentTime = 0;
          notificationAudioRef.current.play().catch(() => {
            // Failed to play notification sound
          });
        } else {
          // Try to initialize audio if it doesn't exist
          try {
            const audio = new Audio("/notification.mp3");
            audio.play().catch(() => undefined);
            notificationAudioRef.current = audio;
          } catch {
            // Failed to create audio element
          }
        }

        // Show browser notifications for all threads that triggered notifications
        // This works for ALL threads, not just the active one
        threadsToNotify.forEach((thread) => {
          showBrowserNotification(thread.name, thread.preview, thread.id);
        });
      }
    },
    [filter, odooBaseUrl, sessionId]
  );

  // Handle message arrivals to update thread list (unread count, preview, timestamp)
  // This provides immediate optimistic updates, with polling as ground truth sync
  const handleMessageArrival = useCallback(
    (messages: unknown[], threadId: string) => {
      const odooMessages = messages as Array<{
        id: number;
        body: string | null;
        direction: string;
        timestamp: number;
      }>;

      if (odooMessages.length === 0) return;

      // Check for new incoming messages to notify about
      const incomingMessagesToNotify: Array<{
        id: number;
        body: string;
        threadId: string;
        threadName: string;
      }> = [];

      setChats((prev) => {
        const existingChatsMap = new Map(
          prev.complete.map((chat) => [chat.id, chat])
        );
        const chat = existingChatsMap.get(threadId);

        if (!chat) {
          return prev;
        }

        // Count incoming messages in this batch
        let incomingMessageCount = 0;
        const latestMessage = odooMessages[odooMessages.length - 1];

        odooMessages.forEach((message) => {
          const isIncoming = message.direction === "incoming";
          if (isIncoming) {
            incomingMessageCount++;

            // Check if this message should trigger a notification
            const messageKey = buildMessageNotificationKey(
              message.id,
              threadId,
              message.timestamp
            );

            if (!notifiedMessagesRef.current.has(messageKey)) {
              // New incoming message - add to notification list
              incomingMessagesToNotify.push({
                id: message.id,
                body: message.body || "New message",
                threadId: threadId,
                threadName:
                  chat.threadName || chat.phoneNumber || `Thread ${threadId}`,
              });

              // Mark as notified
              notifiedMessagesRef.current.add(messageKey);
            }
          }
        });

        // Calculate new unread count
        // IMPORTANT: Start with existing count (don't override initial value!)
        // Then add the new incoming messages we just received
        const currentUnreadCount = chat.unreadCount || 0;
        const newUnreadCount = currentUnreadCount + incomingMessageCount;

        // Update thread with new message info
        const updatedChat = {
          ...chat,
          lastMessagePreview: latestMessage.body || chat.lastMessagePreview,
          lastMessageAt: latestMessage.timestamp * 1000,
          unreadCount: newUnreadCount,
          read: newUnreadCount === 0, // Thread is "read" only when unread count is 0
        };

        existingChatsMap.set(threadId, updatedChat);

        // Rebuild array and sort by lastMessageAt (most recent first)
        const updatedChats = Array.from(existingChatsMap.values()).sort(
          (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)
        );

        return {
          ...prev,
          complete: updatedChats,
        };
      });

      // Show browser notifications for new incoming messages
      // This works for ALL threads, including closed ones!
      if (incomingMessagesToNotify.length > 0) {
        // Save updated notification state
        saveNotifiedMessages(notifiedMessagesRef.current);

        // Show browser notification for each message
        incomingMessagesToNotify.forEach((msg) => {
          showBrowserNotification(msg.threadName, msg.body, msg.threadId);
        });

        // Play audio notification sound
        if (notificationAudioRef.current) {
          notificationAudioRef.current.currentTime = 0;
          notificationAudioRef.current.play().catch(() => {
            // Failed to play notification sound
          });
        }
      }
    },
    []
  );

  // Initialize SSE connection for threads
  const { isConnected: sseConnected } = useSSE(
    {
      onThreadsUpdate: handleThreadsUpdate,
      onMessagesUpdate: handleMessageArrival, // Optimistic unread count updates
      // STRATEGY: Optimistic updates + polling sync
      // - message.created webhooks → immediate optimistic unread count increment
      // - thread.updated webhooks + polling → backend ground truth (via Math.max)
      // - Polling every 10 min corrects any drift between frontend and backend
      onError: (error) => {
        reportApiError(error);
      },
      onReconnect: () => {
        reportConnectionRestored();
      },
    },
    {
      enabled: !!sessionId,
      threadId: null, // Subscribe to GLOBAL messages and thread updates
    }
  );

  // Initialize periodic thread list polling as a fallback mechanism
  // This ensures unopened threads receive updates even if SSE fails
  useThreadsPoller(
    {
      onThreadsFound: (threads) => {
        // Reuse the same handler as SSE - it already handles thread merging
        handleThreadsUpdate(threads);
      },
      onError: (error) => {
        // Don't report polling errors as aggressively as SSE errors
        // Polling is a fallback mechanism, not the primary delivery method
        console.warn(`[ChatsProvider] Thread polling error:`, error.message);
      },
      onPollComplete: () => {
        // Report successful poll as connection restored
        reportConnectionRestored();
      },
    },
    {
      enabled: !!sessionId,
      interval: 600000, // 10 minutes
    }
  );

  const applyFilter = useCallback(
    (completeChats: Chat[]) => {
      return completeChats.filter((chat) => {
        // First check backend filter
        if (selectedBackendId !== null) {
          if (chat.backendId !== selectedBackendId) {
            return false;
          }
        }

        // Then apply status filters
        if (filter === Filters.UNREAD && chat.read === false) {
          return true;
        }
        if (filter === Filters.FAVORITES && chat.favorite === true) {
          return true;
        }
        if (filter === Filters.GROUPS && chat.group === true) {
          return true;
        }
        if (filter === Filters.ALL) {
          return true;
        }
        return false;
      });
    },
    [filter, selectedBackendId]
  );

  const updateFilter = (filter: string) => {
    setFilter(filter as Filters);
  };

  // Search query handler with debouncing
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the actual search (300ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(query);
      // Reset pagination when search changes
      setNextThreadsOffset(0);
      setHasMoreThreads(true);
    }, 300);
  }, []);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setNextThreadsOffset(0);
    setHasMoreThreads(true);
  }, []);

  const updateThreadPreview = useCallback(
    (chatId: string, preview: string, timestamp: number) => {
      setChats((prev) => {
        const updatedComplete = prev.complete.map((chat) => {
          if (chat.id === chatId) {
            return {
              ...chat,
              lastMessagePreview: preview,
              lastMessageAt: timestamp,
            };
          }
          return chat;
        });

        // Sort by lastMessageAt to put the updated thread at the top
        const sortedComplete = updatedComplete.sort(
          (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)
        );

        // Apply current filters to the updated complete list
        const filteredChats = applyFilter(sortedComplete);

        return {
          ...prev,
          complete: sortedComplete,
          filtered: filteredChats,
        };
      });
    },
    [applyFilter]
  );

  const markChatAsRead = useCallback(
    (chatId: string) => {
      // Reset the notified unread count so we don't re-notify
      lastNotifiedUnreadCountRef.current.set(chatId, 0);
      saveNotificationState(lastNotifiedUnreadCountRef.current);

      setChats((prev) => {
        const updatedComplete = prev.complete.map((chat) => {
          if (chat.id === chatId) {
            // Also reset unread count when marking as read
            return { ...chat, read: true, unreadCount: 0 };
          }
          return chat;
        });

        const filteredChats = applyFilter(updatedComplete);

        return {
          ...prev,
          complete: updatedComplete,
          filtered: filteredChats,
        };
      });
    },
    [applyFilter]
  );

  type ThreadRecord = {
    id: number;
    name: string;
    last_message_date: string | null;
    last_message_preview: string | null;
    phone_number?: string | null;
    backend_id?: [number, string] | number | null | false;
    partner_id?: [number, string] | number | null | false;
    unread_count?: number; // NEW: Unread count from backend
    has_avatar?: boolean; // NEW: Whether partner has an actual avatar image
  };

  const transformThreads = useCallback(
    (threads: ThreadRecord[]): Chat[] => {
      return threads.map((thread) => {
        const chatId = String(thread.id);
        const preview = thread.last_message_preview ?? "";
        const timestamp = thread.last_message_date
          ? new Date(thread.last_message_date + "Z").getTime()
          : null;
        const backendId =
          Array.isArray(thread.backend_id) && thread.backend_id.length > 0
            ? thread.backend_id[0]
            : typeof thread.backend_id === "number"
              ? thread.backend_id
              : (authBackendId ?? null);

        // Extract partner ID and display name from Odoo tuple
        const partnerId =
          Array.isArray(thread.partner_id) && thread.partner_id.length > 0
            ? thread.partner_id[0]
            : typeof thread.partner_id === "number"
              ? thread.partner_id
              : null;
        const partnerName =
          Array.isArray(thread.partner_id) && thread.partner_id.length > 1
            ? thread.partner_id[1]
            : null;

        // Always build partner avatar URL if we have partnerId and odooBaseUrl
        // The component will decide whether to use it based on hasAvatar flag
        const hasAvatar = thread.has_avatar === true;
        const partnerAvatar =
          partnerId && odooBaseUrl
            ? buildPartnerAvatarUrl(odooBaseUrl, partnerId, sessionId)
            : null;

        const phoneNumber = thread.phone_number;
        const unreadCount = thread.unread_count || 0;

        const messages: Message[] = preview
          ? [
              {
                id: `thread-${thread.id}-preview`,
                contactId: chatId,
                message: preview,
                timestamp: timestamp ?? Date.now(),
                isSentFromUser: false,
                whatsappId: null,
              },
            ]
          : [];

        return {
          id: chatId,
          contactId: chatId,
          threadName: thread.name,
          phoneNumber,
          backendId,
          partnerId,
          partnerName,
          partnerAvatar,
          hasAvatar, // Include avatar availability flag
          lastMessagePreview: preview,
          lastMessageAt: timestamp,
          unreadCount, // Include unread count
          read: unreadCount === 0, // Mark as read if no unread messages
          group: false,
          favorite: false,
          messages,
        };
      });
    },
    [authBackendId, odooBaseUrl, sessionId]
  );

  const fetchThreads = useCallback(
    async ({
      showLoading = false,
      append = false,
      offset = 0,
    }: {
      showLoading?: boolean;
      append?: boolean;
      offset?: number;
    } = {}) => {
      if (!sessionId) {
        return;
      }

      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      if (showLoading) {
        setChats((prev) => ({ ...prev, isLoading: true }));
      }
      if (append) {
        setIsLoadingMoreThreads(true);
      }

      try {
        // Build URL with optional includeThreadId and search parameters
        let url = `/api/threads?limit=${THREADS_PAGE_SIZE}&offset=${offset}`;
        if (includeThreadId && offset === 0) {
          url += `&includeThreadId=${encodeURIComponent(includeThreadId)}`;
        }
        if (debouncedSearchQuery.trim().length > 0) {
          url += `&search=${encodeURIComponent(debouncedSearchQuery.trim())}`;
        }

        const response = await fetch(url, {
          headers: {
            "x-session-id": sessionId,
          },
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message =
            errorBody?.error ?? `Failed to fetch threads (${response.status})`;
          throw new Error(message);
        }

        const data = await response.json();
        const threads: ThreadRecord[] = Array.isArray(data?.threads)
          ? data.threads
          : [];
        const mappedChats = transformThreads(threads);
        const hasMore = threads.length >= THREADS_PAGE_SIZE;

        setHasMoreThreads(hasMore);
        setNextThreadsOffset(offset + THREADS_PAGE_SIZE);

        setChats((prev) => {
          if (!append) {
            const filteredChats = applyFilter(mappedChats);
            return {
              ...prev,
              complete: mappedChats,
              filtered: filteredChats,
              isLoading: false,
            };
          }

          const merged = new Map(prev.complete.map((chat) => [chat.id, chat]));
          mappedChats.forEach((chat) => {
            if (!merged.has(chat.id)) {
              merged.set(chat.id, chat);
            }
          });

          const mergedList = Array.from(merged.values()).sort(
            (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)
          );

          return {
            ...prev,
            complete: mergedList,
            filtered: applyFilter(mergedList),
            isLoading: false,
          };
        });
      } catch {
        setChats((prev) => ({
          ...prev,
          isLoading: false,
        }));
      } finally {
        isFetchingRef.current = false;
        setIsLoadingMoreThreads(false);
      }
    },
    [
      sessionId,
      transformThreads,
      applyFilter,
      includeThreadId,
      debouncedSearchQuery,
    ]
  );

  const loadMoreThreads = useCallback(() => {
    if (!sessionId || isLoadingMoreThreads || !hasMoreThreads) {
      return;
    }

    fetchThreads({ append: true, offset: nextThreadsOffset });
  }, [
    fetchThreads,
    hasMoreThreads,
    isLoadingMoreThreads,
    nextThreadsOffset,
    sessionId,
  ]);

  useEffect(() => {
    if (!sessionId) {
      isFetchingRef.current = false;
      setHasMoreThreads(false);
      setIsLoadingMoreThreads(false);
      setNextThreadsOffset(0);
      setChats((prev) => ({
        ...prev,
        complete: [],
        filtered: [],
        isLoading: false,
      }));
      return;
    }

    // Initial fetch only - SSE will handle updates
    setHasMoreThreads(true);
    setIsLoadingMoreThreads(false);
    setNextThreadsOffset(0);
    fetchThreads({ showLoading: true, offset: 0 });

    return () => {
      isFetchingRef.current = false;
    };
  }, [sessionId, fetchThreads, sseConnected]);

  useEffect(() => {
    setChats((prev) => {
      const filtered = applyFilter(prev.complete);
      return {
        ...prev,
        filtered,
      };
    });
  }, [filter, applyFilter, chats.complete]);

  // Refetch when search query changes
  useEffect(() => {
    if (!sessionId) return;

    // Skip on initial mount (empty string)
    // The initial fetch effect will handle the first load
    if (debouncedSearchQuery === "" && chats.complete.length === 0) {
      return;
    }

    // Fetch with new search query
    fetchThreads({ showLoading: true, offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, sessionId]);

  // Calculate total unread count
  const totalUnreadCount = chats.complete.reduce((total, chat) => {
    return total + (chat.unreadCount ?? 0);
  }, 0);

  return (
    <ChatsContext.Provider
      value={{
        chats,
        filter,
        updateFilter,
        hasMoreThreads,
        isLoadingMoreThreads,
        loadMoreThreads,
        updateThreadPreview,
        markChatAsRead,
        totalUnreadCount,
        selectedBackendId,
        setSelectedBackendId,
        searchQuery,
        updateSearchQuery,
        clearSearch,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
