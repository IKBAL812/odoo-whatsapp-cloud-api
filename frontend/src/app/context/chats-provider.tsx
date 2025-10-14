import dayjs from "dayjs";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../hooks/use-auth";
import { useContacts } from "../hooks/use-contacts";
import { useSSE } from "../hooks/use-sse";

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
      search: string;
      updateSearch: (query: string) => void;
      chats: Chats;
    }
>(undefined);

export default function ChatsProvider({ children }: PropsWithChildren) {
  const [filter, setFilter] = useState<Filters>(Filters.ALL);
  const [search, setSearch] = useState<string>("");
  const [chats, setChats] = useState<Chats>({
    complete: [],
    filtered: [],
    isLoading: false,
  });
  const { sessionId, backendId: authBackendId } = useAuth();
  const { contacts: contactEntries } = useContacts();
  const isFetchingRef = useRef(false);

  
  // SSE callbacks for real-time thread updates
  const handleThreadsUpdate = useCallback((threads: unknown[]) => {
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
      const newChats: Chat[] = odooThreads.map((thread) => ({
        id: thread.id.toString(),
        contactId: thread.phone_number || "",
        threadName: thread.name || undefined,
        phoneNumber: thread.phone_number || null,
        backendId: thread.backend_id || null,
        lastMessagePreview: thread.last_message_preview || "",
        lastMessageAt: thread.last_message_date ? dayjs(thread.last_message_date).valueOf() : Date.now(),
        groupName: undefined,
        groupAvatar: undefined,
        read: false,
        favorite: false,
        group: false,
        messages: [],
      }));

      // Merge with existing chats, avoiding duplicates
      const existingIds = new Set(prev.complete.map(chat => chat.id));
      const uniqueNewChats = newChats.filter(chat => !existingIds.has(chat.id));
      
      const updatedComplete = [...prev.complete, ...uniqueNewChats]
        .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

      return {
        ...prev,
        complete: updatedComplete,
        isLoading: false,
      };
    });
  }, []);

  // Initialize SSE connection for threads
  const { isConnected: sseConnected } = useSSE(
    {
      onThreadsUpdate: handleThreadsUpdate,
      onError: (error) => {
        console.error("SSE Error:", error);
      },
      onReconnect: () => {
        console.log("SSE Reconnected");
      },
    },
    {
      enabled: !!sessionId,
    }
  );
  const searchRef = useRef(search);

  const contactNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    contactEntries.forEach((contact) => {
      map.set(contact.id, contact.displayName.toLowerCase());
    });
    return map;
  }, [contactEntries]);

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

  const applySearch = useCallback(
    (completeChats: Chat[], query: string) => {
      const normalized = query.trim().toLowerCase();
      if (normalized.length === 0) {
        return completeChats;
      }
      return completeChats.filter((chat) => {
        const nameMatch = chat.threadName
          ?.toLowerCase()
          .includes(normalized);
        const previewValue = chat.lastMessagePreview || "";
        const previewMatch = previewValue
          .toLowerCase()
          .includes(normalized);
        const phoneMatch = chat.phoneNumber?.includes(query.trim());

        let contactNameMatch = false;
        if (typeof chat.contactId === "string") {
          const contactName = contactNameLookup.get(chat.contactId);
          contactNameMatch = contactName ? contactName.includes(normalized) : false;
        } else if (Array.isArray(chat.contactId)) {
          contactNameMatch = chat.contactId.some((id) => {
            const contactName = contactNameLookup.get(id);
            return contactName ? contactName.includes(normalized) : false;
          });
        }

        return Boolean(
          nameMatch || previewMatch || phoneMatch || contactNameMatch
        );
      });
    },
    [contactNameLookup]
  );

  const updateFilter = (filter: string) => {
    setFilter(filter as Filters);
  };

  const updateSearch = (query: string) => {
    setSearch(query);
  };

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
        ? dayjs(thread.last_message_date).valueOf()
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
        const filteredChats = applySearch(
          applyFilter(mappedChats),
          searchRef.current
        );

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
    [sessionId, transformThreads, applyFilter, applySearch]
  );

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

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
      const filtered = applySearch(applyFilter(prev.complete), search);
      return {
        ...prev,
        filtered,
      };
    });
  }, [filter, search, applyFilter, applySearch]);

  return (
    <ChatsContext.Provider
      value={{ chats, filter, search, updateFilter, updateSearch }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
