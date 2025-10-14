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

export type AttachmentType = 'image' | 'video' | 'audio' | 'document';

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
  lastMessagePreview?: string;
  lastMessageAt?: number | null;
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
      updateThreadPreview: (chatId: string, preview: string, timestamp: number) => void;
      markChatAsRead: (chatId: string) => void;
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

  
  // SSE callbacks for real-time thread updates
  const handleThreadsUpdate = useCallback((threads: unknown[]) => {
    console.log('Thread SSE update received:', threads.length, 'threads');
    console.log('First thread data:', threads[0]);
    // Process new threads from SSE
    const odooThreads = threads as Array<{
      id: number;
      name: string;
      last_message_date: string | null;
      last_message_preview: string | null;
      phone_number: string | null;
      backend_id: number | null;
      write_date: string;
    }>;

    setChats((prev) => {
      // Create a map of existing chats for efficient lookup
      const existingChatsMap = new Map(prev.complete.map(chat => [chat.id, chat]));
      
      // Process updates from SSE
      odooThreads.forEach((thread) => {
        const threadId = thread.id.toString();
        const existingChat = existingChatsMap.get(threadId);
        
        if (existingChat) {
          // Update existing chat, preserving important data like messages
          const newTimestamp = thread.last_message_date 
            ? new Date(thread.last_message_date).getTime() 
            : existingChat.lastMessageAt;
          
          // Only mark as unread if there's actually a new message (timestamp changed)
          const hasNewMessage = newTimestamp && newTimestamp > (existingChat.lastMessageAt || 0);
          
          console.log(`Thread ${threadId}: existing timestamp=${existingChat.lastMessageAt}, new timestamp=${newTimestamp}, hasNewMessage=${hasNewMessage}, currentRead=${existingChat.read}`);
          
          existingChatsMap.set(threadId, {
            ...existingChat,
            lastMessagePreview: thread.last_message_preview || existingChat.lastMessagePreview,
            lastMessageAt: newTimestamp,
            threadName: thread.name || existingChat.threadName,
            read: hasNewMessage ? false : existingChat.read,
          });
        } else {
          // Add new chat
          existingChatsMap.set(threadId, {
            id: threadId,
            contactId: thread.phone_number || "",
            threadName: thread.name || undefined,
            phoneNumber: thread.phone_number || null,
            backendId: thread.backend_id || null,
            lastMessagePreview: thread.last_message_preview || "",
            lastMessageAt: thread.last_message_date ? new Date(thread.last_message_date).getTime() : Date.now(),
            groupName: undefined,
            groupAvatar: undefined,
            read: false,
            favorite: false,
            group: false,
            messages: [],
          });
        }
      });
      
      // Sort by last message timestamp
      const updatedComplete = Array.from(existingChatsMap.values())
        .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

      // Apply filter to get filtered list
      let filteredList = updatedComplete;
      if (filter === Filters.UNREAD) {
        filteredList = updatedComplete.filter(chat => !chat.read);
      } else if (filter === Filters.FAVORITES) {
        filteredList = updatedComplete.filter(chat => chat.favorite);
      } else if (filter === Filters.GROUPS) {
        filteredList = updatedComplete.filter(chat => chat.group);
      }

      console.log('Updating chats state with', updatedComplete.length, 'threads');
      return {
        ...prev,
        complete: updatedComplete,
        filtered: filteredList,
        isLoading: false,
      };
    });
  }, [filter]);

  // Initialize SSE connection for threads
  const { isConnected: sseConnected } = useSSE(
    {
      onThreadsUpdate: handleThreadsUpdate,
      onError: (error) => {
        console.error("SSE Error:", error);
        reportApiError(error);
      },
      onReconnect: () => {
        console.log("SSE Reconnected for threads");
        reportConnectionRestored();
      },
      onHeartbeat: (timestamp) => {
        console.log("Thread SSE heartbeat:", timestamp);
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


  const updateThreadPreview = useCallback((chatId: string, preview: string, timestamp: number) => {
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
      const sortedComplete = updatedComplete.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

      // Apply current filters to the updated complete list
      const filteredChats = applyFilter(sortedComplete);

      return {
        ...prev,
        complete: sortedComplete,
        filtered: filteredChats,
      };
    });
  }, [applyFilter]);

  const markChatAsRead = useCallback((chatId: string) => {
    setChats((prev) => {
      const updatedComplete = prev.complete.map((chat) => {
        if (chat.id === chatId) {
          return { ...chat, read: true };
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
  }, [applyFilter]);

  type ThreadRecord = {
    id: number;
    name: string;
    last_message_date: string | null;
    last_message_preview: string | null;
    phone_number?: string | null;
    backend_id?: [number, string] | number | null | false;
  };

  const transformThreads = useCallback((threads: ThreadRecord[]): Chat[] => {
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
            : authBackendId ?? null;
      const phoneNumber = thread.phone_number;

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
        lastMessagePreview: preview,
        lastMessageAt: timestamp,
        read: true,
        group: false,
        favorite: false,
        messages,
      };
    });
  }, [authBackendId]);

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
            errorBody?.error ??
            `Failed to fetch threads (${response.status})`;
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
      } catch (error) {
        console.error("Failed to fetch threads", error);
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

  return (
    <ChatsContext.Provider
      value={{ chats, filter, updateFilter, updateThreadPreview, markChatAsRead }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
