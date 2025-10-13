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
import { Chat, Message } from "./chats-provider";
import { useChats } from "../hooks/use-chats";
import { useContacts } from "../hooks/use-contacts";
import { Contact } from "./contacts-provider";
import { getTimestamp } from "../utils";
import { useAuth } from "../hooks/use-auth";

export type CurrentChatContacts = {
  [contactId: string]: Contact | undefined;
};

export type CurrentChatContactsGroup = {
  name: string;
  avatar: string;
  contacts: CurrentChatContacts;
};

export type CurrentChatData = {
  chatId: string | null;
  contact: Contact | null;
  messages: Message[];
  group: CurrentChatContactsGroup | null;
  page: number;
  isLoading: boolean;
  threadName: string | null;
  phoneNumber: string | null;
  backendId: number | null;
  isSending: boolean;
};

export type CurrentChat = CurrentChatData & {
  loadCurrentChat: (chat: Partial<CurrentChatData>) => void;
  sendMessage: (content: string) => Promise<void>;
};

export const CurrentChatContext = createContext<undefined | CurrentChat>(
  undefined
);

const POLL_INTERVAL_MS = 10000;

type OdooMessageRecord = {
  id: number;
  create_date: string;
  body: string | null;
  status: string | null;
  message_id: string | null;
  direction: "incoming" | "outgoing" | string;
  attachment_id: false | [number, string] | null;
  create_uid: [number, string];
};

const extractDigits = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
};

export const buildMessageNotificationKey = (message: Message) =>
  message.id ?? `${message.contactId}-${message.timestamp}-${message.message}`;

export const findUnnotifiedIncomingMessages = (
  messages: Message[],
  notified: Set<string>
) => {
  const next = new Set(notified);
  const incoming: Message[] = [];

  messages.forEach((message) => {
    const key = buildMessageNotificationKey(message);
    if (!next.has(key)) {
      next.add(key);
      if (!message.isSentFromUser) {
        incoming.push(message);
      }
    }
  });

  return { incoming, next };
};

export const shouldPlayNotificationAudio = (
  visibility: DocumentVisibilityState | undefined
) => visibility !== "visible";

export default function CurrentChatProvider({ children }: PropsWithChildren) {
  const [currentChat, setCurrentChat] = useState<CurrentChatData>({
    chatId: null,
    contact: null,
    messages: [],
    group: null,
    page: 0,
    isLoading: false,
    threadName: null,
    phoneNumber: null,
    backendId: null,
    isSending: false,
  });
  const latestMessageTimestampRef = useRef<number | null>(null);
  const latestMessageIdRef = useRef<number | null>(null);
  const notifiedMessagesRef = useRef<Set<string>>(new Set());
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const initialNotificationRef = useRef(true);

  const {
    chats: { complete },
  } = useChats();
  const { contacts } = useContacts();
  const { sessionId, backendId: authBackendId, backendUserId } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    notificationAudioRef.current = new Audio("/notification.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const chatId = currentChat.chatId;

  const fetchMessages = useCallback(
    async ({
      replace = false,
      lastId,
      signal,
    }: {
      replace?: boolean;
      lastId?: number | null;
      signal?: AbortSignal;
    } = {}) => {
      if (!chatId || !sessionId) {
        return;
      }

      const searchParams = new URLSearchParams({
        threadId: chatId,
        limit: "30",
      });

      const effectiveLastId =
        typeof lastId === "number"
          ? lastId
          : replace
            ? null
            : latestMessageIdRef.current;

      if (!replace && (effectiveLastId === null || typeof effectiveLastId === "undefined")) {
        return;
      }

      if (typeof effectiveLastId === "number") {
        searchParams.set("lastId", String(effectiveLastId));
      }

      if (replace) {
        setCurrentChat((prev) =>
          prev.chatId === chatId ? { ...prev, isLoading: true } : prev
        );
      }

      try {
        const response = await fetch(`/api/messages?${searchParams.toString()}`, {
          headers: {
            "x-session-id": sessionId,
          },
          signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message =
            errorBody?.error ??
            `Failed to fetch messages (${response.status})`;
          throw new Error(message);
        }

        const data = await response.json();
        const records: OdooMessageRecord[] = Array.isArray(data?.messages)
          ? data.messages
          : [];

        const mappedMessages: Message[] = records.map((record) => {
          const timestamp = record.create_date
            ? dayjs(record.create_date).valueOf()
            : Date.now();
          const direction = record.direction ?? "incoming";
          const status = (record.status ?? "").toLowerCase();
          const messageText =
            record.body ??
            (record.attachment_id ? "Attachment received" : "");

          const deliveredStatuses = ["delivered", "read"];
          const sentStatuses = ["sent", ...deliveredStatuses];
          const userIdValue =
            Array.isArray(record.create_uid) && record.create_uid.length > 0
              ? record.create_uid[0]
              : null;
          return {
            id: record.id.toString(),
            contactId: chatId,
            message: messageText,
            timestamp,
            isSentFromUser: direction === "outgoing",
            sent: sentStatuses.includes(status),
            delivered: deliveredStatuses.includes(status),
            read: status === "read",
            userId: userIdValue ?? null,
          };
        });

        let nextLatestTimestamp: number | null | undefined;
        let nextLatestMessageId: number | null | undefined;

        setCurrentChat((prev) => {
          if (prev.chatId !== chatId) {
            return prev;
          }

          const isInitialLoad = replace || prev.messages.length === 0;
          const existingIds = new Set(
            prev.messages
              .map((message) => message.id)
              .filter((id): id is string => Boolean(id))
          );

          const incomingMessages = isInitialLoad
            ? mappedMessages
            : mappedMessages.filter(
              (message) =>
                !message.id || !existingIds.has(message.id)
            );

          if (!isInitialLoad && incomingMessages.length === 0) {
            nextLatestTimestamp =
              latestMessageTimestampRef.current ?? null;
            nextLatestMessageId = latestMessageIdRef.current ?? null;
            return { ...prev, isLoading: false };
          }

          const mergedMessages = isInitialLoad
            ? incomingMessages
            : [...prev.messages, ...incomingMessages];

          mergedMessages.sort((a, b) => a.timestamp - b.timestamp);

          nextLatestTimestamp =
            mergedMessages.length > 0
              ? mergedMessages[mergedMessages.length - 1].timestamp
              : null;

          const mergedNumericIds = mergedMessages
            .map((message) => Number.parseInt(message.id ?? "", 10))
            .filter((id) => !Number.isNaN(id));
          nextLatestMessageId =
            mergedNumericIds.length > 0 ? Math.max(...mergedNumericIds) : null;

          return {
            ...prev,
            messages: mergedMessages,
            isLoading: false,
          };
        });

        if (typeof nextLatestTimestamp !== "undefined") {
          latestMessageTimestampRef.current = nextLatestTimestamp;
        }
        if (typeof nextLatestMessageId !== "undefined") {
          latestMessageIdRef.current =
            nextLatestMessageId === null ? null : nextLatestMessageId;
        }
      } catch (error) {
        if (
          (signal && signal.aborted) ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.error("Failed to fetch messages", error);
        if (replace) {
          setCurrentChat((prev) =>
            prev.chatId === chatId
              ? { ...prev, messages: [], isLoading: false }
              : prev
          );
          latestMessageTimestampRef.current = null;
          latestMessageIdRef.current = null;
        } else {
          setCurrentChat((prev) =>
            prev.chatId === chatId ? { ...prev, isLoading: false } : prev
          );
        }
      }
    },
    [chatId, sessionId]
  );

  useEffect(() => {
    if (!chatId || !sessionId) {
      setCurrentChat((prev) => ({
        ...prev,
        messages: [],
        isLoading: false,
        isSending: false,
        phoneNumber: null,
        backendId: null,
      }));
      latestMessageTimestampRef.current = null;
      latestMessageIdRef.current = null;
      notifiedMessagesRef.current.clear();
      initialNotificationRef.current = true;
      return;
    }

    const abortController = new AbortController();
    fetchMessages({ replace: true, signal: abortController.signal });

    return () => {
      abortController.abort();
    };
  }, [chatId, sessionId, fetchMessages]);

  useEffect(() => {
    if (!chatId || !sessionId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const latestId = latestMessageIdRef.current;
      if (latestId === null || typeof latestId === "undefined") {
        fetchMessages({ replace: true });
        return;
      }
      fetchMessages({ lastId: latestId });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [chatId, sessionId, fetchMessages]);

  useEffect(() => {
    const chat = complete.find((chat: Chat) => chat.id === currentChat.chatId);
    if (chat) {
      if (typeof chat.contactId == "string") {
        const contactId = chat.contactId;
        const contact = contacts.find(
          (contact: Contact) => contact.id === contactId
        );
        setCurrentChat((prev) => ({
          ...prev,
          contact: contact ?? null,
          group: null,
          threadName: chat.threadName ?? prev.threadName,
          phoneNumber:
            chat.phoneNumber ??
            prev.phoneNumber ??
            extractDigits(chat.threadName) ??
            extractDigits(contact?.displayName),
          backendId:
            typeof chat.backendId === "number"
              ? chat.backendId
              : prev.backendId,
        }));
      } else {
        const groupContacts: CurrentChatContacts = {};
        chat.contactId.forEach((groupContact: string) => {
          groupContacts[groupContact] = contacts.find(
            (contact: Contact) => contact.id === groupContact
          );
        });
        setCurrentChat((prev) => ({
          ...prev,
          contact: null,
          group: {
            name: chat.groupName ?? "",
            avatar: chat.groupAvatar ?? "",
            contacts: groupContacts,
          },
          threadName: chat.groupName ?? chat.threadName ?? prev.threadName,
          phoneNumber:
            chat.phoneNumber ??
            prev.phoneNumber ??
            extractDigits(chat.threadName),
          backendId:
            typeof chat.backendId === "number"
              ? chat.backendId
              : prev.backendId,
        }));
      }
    }
  }, [complete, contacts, currentChat.chatId]);

  const loadCurrentChat = (chat: Partial<CurrentChatData>) => {
    setCurrentChat((prev) => ({
      ...prev,
      ...chat,
      isSending: false,
    }));
    latestMessageTimestampRef.current = null;
    latestMessageIdRef.current = null;
    notifiedMessagesRef.current.clear();
    initialNotificationRef.current = true;
  };

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        return;
      }
      if (!sessionId) {
        throw new Error("You are not authenticated");
      }
      const activeChatId = currentChat.chatId;
      if (!activeChatId) {
        throw new Error("No conversation selected");
      }
      const numericThreadId = Number(activeChatId);
      if (Number.isNaN(numericThreadId)) {
        throw new Error("Invalid conversation identifier");
      }

      const fallbackPhone =
        currentChat.phoneNumber ??
        extractDigits(currentChat.threadName) ??
        extractDigits(currentChat.contact?.displayName);

      if (!fallbackPhone) {
        throw new Error("Unable to determine the recipient phone number");
      }

      const backendId = currentChat.backendId ?? authBackendId ?? undefined;
      const optimisticId = `local-${Date.now()}`;
      const timestamp = getTimestamp();

      setCurrentChat((prev) => {
        if (prev.chatId !== activeChatId) {
          return prev;
        }
        return {
          ...prev,
          phoneNumber: prev.phoneNumber ?? fallbackPhone,
          messages: [
            ...prev.messages,
            {
              id: optimisticId,
              contactId: activeChatId,
              message: trimmed,
              timestamp,
              isSentFromUser: true,
              sent: false,
              delivered: false,
              read: false,
              userId: backendUserId ?? null,
            },
          ],
          isSending: true,
        };
      });

      latestMessageTimestampRef.current =
        latestMessageTimestampRef.current === null
          ? timestamp
          : Math.max(latestMessageTimestampRef.current, timestamp);

      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId,
          },
          body: JSON.stringify({
            threadId: numericThreadId,
            phoneNumber: fallbackPhone,
            message: trimmed,
            backendId,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : "Failed to send the message";
          throw new Error(message);
        }

        const result = data?.result ?? {};
        const messageId =
          typeof result?.message_id === "number"
            ? result.message_id
            : undefined;
        const status =
          typeof result?.status === "string"
            ? result.status.toLowerCase()
            : undefined;
        const deliveredStatuses = ["delivered", "read"];
        const readStatuses = ["read"];

        setCurrentChat((prev) => {
          if (prev.chatId !== activeChatId) {
            return prev;
          }
          return {
            ...prev,
            messages: prev.messages.map((message) => {
              if (message.id !== optimisticId) {
                return message;
              }
              return {
                ...message,
                id: messageId ? messageId.toString() : message.id,
                sent: true,
                delivered: status
                  ? deliveredStatuses.includes(status)
                  : true,
                read: status ? readStatuses.includes(status) : false,
                error: undefined,
              };
            }),
            isSending: false,
            phoneNumber: prev.phoneNumber ?? fallbackPhone,
          };
        });

        if (typeof messageId === "number") {
          latestMessageIdRef.current =
            latestMessageIdRef.current === null
              ? messageId
              : Math.max(latestMessageIdRef.current, messageId);
        } else {
          void fetchMessages({ replace: true }).catch(() => undefined);
        }
      } catch (error) {
        const err = error as Error;
        setCurrentChat((prev) => {
          if (prev.chatId !== activeChatId) {
            return prev;
          }
          return {
            ...prev,
            messages: prev.messages.map((message) => {
              if (message.id !== optimisticId) {
                return message;
              }
              return {
                ...message,
                sent: false,
                delivered: false,
                read: false,
                error: err.message || "Failed to send the message",
              };
            }),
            isSending: false,
          };
        });
        throw err;
      }
    },
    [sessionId, currentChat, backendUserId, authBackendId, fetchMessages]
  );

  useEffect(() => {
    const activeChatId = currentChat.chatId;
    if (!activeChatId) {
      return;
    }

    const { incoming, next } = findUnnotifiedIncomingMessages(
      currentChat.messages,
      notifiedMessagesRef.current
    );
    notifiedMessagesRef.current = next;

    if (initialNotificationRef.current) {
      initialNotificationRef.current = false;
      return;
    }

    if (incoming.length === 0) {
      return;
    }

    const audio = notificationAudioRef.current;
    const visibilityState =
      typeof document !== "undefined" ? document.visibilityState : undefined;
    if (shouldPlayNotificationAudio(visibilityState) && audio) {
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        incoming.forEach((message) => {
          const contact = contacts.find((c) => c.id === message.contactId);
          const title =
            contact?.displayName ?? currentChat.threadName ?? "New message";
          new Notification(title, {
            body: message.message,
          });
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => undefined);
      }
    }
  }, [currentChat.chatId, currentChat.messages, currentChat.threadName, contacts]);

  return (
    <CurrentChatContext.Provider
      value={{ ...currentChat, loadCurrentChat, sendMessage }}
    >
      {children}
    </CurrentChatContext.Provider>
  );
}
