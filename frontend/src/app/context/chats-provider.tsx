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
import { useConnection } from "./connection-provider";

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
      updateThreadPreview: (
        chatId: string,
        preview: string,
        timestamp: number
      ) => void;
      markChatAsRead: (chatId: string) => void;
      totalUnreadCount: number;
    }
>(undefined);

export default function ChatsProvider({ children }: PropsWithChildren) {
  const [filter, setFilter] = useState<Filters>(Filters.ALL);
  const [chats, setChats] = useState<Chats>({
    complete: [],
    filtered: [],
    isLoading: false,
  });
  const { sessionId, backendId: authBackendId } = useAuth();
  const { reportApiError, reportConnectionRestored } = useConnection();
  const isFetchingRef = useRef(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedUnreadCountRef = useRef<Map<string, number>>(new Map()); // threadId -> last notified unread count

  // Initialize notification audio
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    notificationAudioRef.current = new Audio("/notification.mp3");
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
      }>;

      // Track if any thread has a genuinely new message for notifications
      // Use ref to check outside of setChats to avoid stale closure
      let shouldPlayNotification = false;

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
              ? new Date(thread.last_message_date).getTime()
              : existingChat.lastMessageAt;

            const newUnreadCount = thread.unread_count ?? 0;
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
              lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
            } else if (lastNotifiedCount === undefined) {
              // First time seeing this thread - set baseline without notifying
              lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
            } else if (newUnreadCount < lastNotifiedCount) {
              // Unread count decreased (user read messages) - update baseline
              lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);
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

            existingChatsMap.set(threadId, {
              ...existingChat,
              lastMessagePreview:
                thread.last_message_preview || existingChat.lastMessagePreview,
              lastMessageAt: newTimestamp,
              threadName: thread.name || existingChat.threadName,
              partnerId: partnerId ?? existingChat.partnerId,
              partnerName: partnerName ?? existingChat.partnerName,
              unreadCount: newUnreadCount, // Update unread count
              read: !hasUnread, // Mark as read if no unread messages
            });
          } else {
            // Add new chat
            const newTimestamp = thread.last_message_date
              ? new Date(thread.last_message_date).getTime()
              : Date.now();
            const newUnreadCount = thread.unread_count ?? 0;

            // For new chats, set baseline without notifying (they're new to the list)
            lastNotifiedUnreadCountRef.current.set(threadId, newUnreadCount);

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

            existingChatsMap.set(threadId, {
              id: threadId,
              contactId: thread.phone_number || "",
              threadName: thread.name || undefined,
              phoneNumber: thread.phone_number || null,
              backendId: thread.backend_id || null,
              partnerId,
              partnerName,
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
      }
    },
    [filter]
  );

  // Initialize SSE connection for threads
  const { isConnected: sseConnected } = useSSE(
    {
      onThreadsUpdate: handleThreadsUpdate,
      onError: (error) => {
        reportApiError(error);
      },
      onReconnect: () => {
        reportConnectionRestored();
      },
    },
    {
      enabled: !!sessionId,
    }
  );

  const applyFilter = useCallback(
    (completeChats: Chat[]) => {
      return completeChats.filter((chat) => {
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
    [filter]
  );

  const updateFilter = (filter: string) => {
    setFilter(filter as Filters);
  };

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
  };

  const transformThreads = useCallback(
    (threads: ThreadRecord[]): Chat[] => {
      return threads.map((thread) => {
        const chatId = String(thread.id);
        const preview = thread.last_message_preview ?? "";
        const timestamp = thread.last_message_date
          ? new Date(thread.last_message_date).getTime()
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
    [authBackendId]
  );

  const fetchThreads = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
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

      try {
        const response = await fetch("/api/threads", {
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
        const filteredChats = applyFilter(mappedChats);

        setChats((prev) => ({
          ...prev,
          complete: mappedChats,
          filtered: filteredChats,
          isLoading: false,
        }));
      } catch {
        setChats((prev) => ({
          ...prev,
          isLoading: false,
        }));
      } finally {
        isFetchingRef.current = false;
      }
    },
    [sessionId, transformThreads, applyFilter]
  );

  useEffect(() => {
    if (!sessionId) {
      isFetchingRef.current = false;
      setChats((prev) => ({
        ...prev,
        complete: [],
        filtered: [],
        isLoading: false,
      }));
      return;
    }

    // Initial fetch only - SSE will handle updates
    fetchThreads({ showLoading: true });

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
        updateThreadPreview,
        markChatAsRead,
        totalUnreadCount,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
