import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Chat, Message } from "./chats-provider";
import { useChats } from "../hooks/use-chats";
import { useContacts } from "../hooks/use-contacts";
import { Contact } from "./contacts-provider";
import { useAuth } from "../hooks/use-auth";
import { useSSE } from "../hooks/use-sse";
import { useConnection } from "./connection-provider";

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
  replyTo: Message | null;
};

export type CurrentChat = CurrentChatData & {
  loadCurrentChat: (chat: Partial<CurrentChatData>) => void;
  sendMessage: (content: string) => Promise<void>;
  sendAttachment: (file: File, caption?: string) => Promise<void>;
  startReply: (message: Message) => void;
  cancelReply: () => void;
};

export const CurrentChatContext = createContext<undefined | CurrentChat>(
  undefined
);

type OdooMessageRecord = {
  id: number;
  create_date: string;
  body: string | null | false;
  status: string | null;
  message_id: string | null;
  direction: "incoming" | "outgoing" | string;
  attachment_id: false | [number, string] | null;
  create_uid: [number, string];
  replied_message_id?: false | [number, string] | null;
  timestamp: number;
  attachment?: {
    id: number;
    name: string;
    mimetype: string;
    url: string;
    file_size: number;
  };
};

type MessageWithReplyReference = Message & {
  replyMessageId?: string | null;
};

const toReplyMetadata = (
  message: Message
): NonNullable<Message["replyTo"]> | null => {
  if (!message.whatsappId) {
    return null;
  }
  return {
    messageId: message.whatsappId,
    message: message.message,
    contactId: message.contactId,
    senderIsUser: message.isSentFromUser,
  };
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
    replyTo: null,
  });
  const latestMessageTimestampRef = useRef<number | null>(null);
  const latestMessageIdRef = useRef<number | null>(null);
  const notifiedMessagesRef = useRef<Set<string>>(new Set());
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const initialNotificationRef = useRef(true);

  const {
    chats: { complete },
    updateThreadPreview,
  } = useChats();
  const { contacts } = useContacts();
  const { sessionId, backendId: authBackendId, backendUserId } = useAuth();
  const { reportApiError, reportConnectionRestored } = useConnection();

  const chatId = currentChat.chatId;
  const pendingPreviewUpdateRef = useRef<{ threadId: string; message: string; timestamp: number } | null>(null);

  // SSE message handler for real-time message updates
  const handleMessagesUpdate = useCallback((messages: unknown[], threadId: string) => {
    if (threadId !== chatId) {
      return; // Ignore messages for other chats
    }

    const odooMessages = (messages as OdooMessageRecord[]).reverse(); // Backend returns newest first, reverse for chat display
    const rawMessages: MessageWithReplyReference[] = odooMessages.map((record) => {
      const timestamp = record.timestamp * 1000; // Convert seconds to milliseconds
      const direction = record.direction ?? "incoming";
      const status = (record.status ?? "").toLowerCase();
      const messageText = record.body || "";

      const deliveredStatuses = ["delivered", "read"];
      const sentStatuses = ["sent", ...deliveredStatuses];
      const userIdValue =
        Array.isArray(record.create_uid) && record.create_uid.length > 0
          ? record.create_uid[0]
          : null;
      const whatsappId =
        typeof record.message_id === "string" ? record.message_id : null;
      const replyTuple = Array.isArray(record.replied_message_id)
        ? record.replied_message_id
        : null;
      const replyMessageId = replyTuple?.[0] ? String(replyTuple[0]) : null;

      return {
        id: record.id.toString(),
        contactId: threadId,
        message: messageText,
        timestamp,
        isSentFromUser: direction === "outgoing",
        sent: sentStatuses.includes(status),
        delivered: deliveredStatuses.includes(status),
        read: status === "read",
        userId: userIdValue ?? null,
        whatsappId,
        replyMessageId,
        attachment: record.attachment,
      };
    });

    // Process messages similar to fetchMessages
    setCurrentChat((prev) => {
      if (prev.chatId !== threadId) {
        return prev;
      }

      const repliesById = new Map<string, NonNullable<Message["replyTo"]>>();

      // Build reply metadata map
      [...prev.messages, ...rawMessages].forEach((message) => {
        if (message.id) {
          const meta = toReplyMetadata(message);
          if (meta) {
            repliesById.set(message.id, meta);
          }
        }
      });

      const mappedMessages: Message[] = rawMessages.map((message) => {
        const { replyMessageId, ...rest } = message;
        const baseMessage = rest as Message;

        if (!replyMessageId) {
          return baseMessage;
        }

        const replyMetadata = repliesById.get(replyMessageId);
        if (!replyMetadata) {
          return baseMessage;
        }

        return {
          ...baseMessage,
          replyTo: replyMetadata,
        };
      });

      // Handle message updates: merge new messages with existing ones
      const existingMessagesMap = new Map(prev.messages.map(m => [m.id, m]));
      const updatedMessagesMap = new Map(existingMessagesMap);
      
      let hasNewMessages = false;
      
      mappedMessages.forEach(newMessage => {
        if (newMessage.id && existingMessagesMap.has(newMessage.id)) {
          // Update existing message (e.g., status changes)
          updatedMessagesMap.set(newMessage.id, {
            ...existingMessagesMap.get(newMessage.id)!,
            ...newMessage,
            // Preserve optimistic properties if this is an update to an optimistic message
            sent: newMessage.sent || existingMessagesMap.get(newMessage.id)!.sent,
            delivered: newMessage.delivered || existingMessagesMap.get(newMessage.id)!.delivered,
          });
        } else if (newMessage.id && !existingMessagesMap.has(newMessage.id)) {
          // Add new message
          updatedMessagesMap.set(newMessage.id, newMessage);
          hasNewMessages = true;
        }
      });

      if (!hasNewMessages) {
        return prev;
      }

      const updatedMessages = Array.from(updatedMessagesMap.values())
        .sort((a, b) => a.timestamp - b.timestamp); // Still need sorting when merging SSE messages

      // Store the preview update to be executed in useEffect
      if (updatedMessages.length > 0) {
        const latestMessage = updatedMessages[updatedMessages.length - 1];
        pendingPreviewUpdateRef.current = {
          threadId,
          message: latestMessage.message,
          timestamp: latestMessage.timestamp
        };
      }

      return {
        ...prev,
        messages: updatedMessages,
      };
    });
  }, [chatId]);

  // Initialize SSE for current chat messages
  useSSE(
    {
      onMessagesUpdate: handleMessagesUpdate,
      onError: (error) => {
        console.error("SSE Error:", error);
        reportApiError(error);
      },
      onReconnect: () => {
        console.log("SSE Reconnected for messages");
        reportConnectionRestored();
      },
    },
    {
      threadId: chatId,
      enabled: !!sessionId && !!chatId,
    }
  );

  // Handle pending preview updates outside of render
  useEffect(() => {
    if (pendingPreviewUpdateRef.current) {
      const { threadId, message, timestamp } = pendingPreviewUpdateRef.current;
      updateThreadPreview(threadId, message, timestamp);
      pendingPreviewUpdateRef.current = null;
    }
  }, [currentChat.messages, updateThreadPreview]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    notificationAudioRef.current = new Audio("/notification.mp3");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

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
          reportApiError({ status: response.status, message });
          throw new Error(message);
        }

        const data = await response.json();
        reportConnectionRestored(); // Connection is good
        const records: OdooMessageRecord[] = Array.isArray(data?.messages)
          ? data.messages.reverse() // Backend returns newest first, reverse for chat display
          : [];

        const rawMessages: MessageWithReplyReference[] = records.map((record) => {
          const timestamp = record.timestamp * 1000; // Convert seconds to milliseconds
          const direction = record.direction ?? "incoming";
          const status = (record.status ?? "").toLowerCase();
          const messageText = record.body || "";

          const deliveredStatuses = ["delivered", "read"];
          const sentStatuses = ["sent", ...deliveredStatuses];
          const userIdValue =
            Array.isArray(record.create_uid) && record.create_uid.length > 0
              ? record.create_uid[0]
              : null;
          const whatsappId =
            typeof record.message_id === "string" ? record.message_id : null;
          const replyTuple = Array.isArray(record.replied_message_id)
            ? record.replied_message_id
            : null;
          const replyMessageId = replyTuple?.[0]
            ? String(replyTuple[0])
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
            whatsappId,
            replyMessageId,
            attachment: record.attachment,
          };
        });

        let nextLatestTimestamp: number | null | undefined;
        let nextLatestMessageId: number | null | undefined;

        setCurrentChat((prev) => {
          if (prev.chatId !== chatId) {
            return prev;
          }

          const repliesById = new Map<
            string,
            NonNullable<Message["replyTo"]>
          >();

          prev.messages.forEach((message) => {
            if (message.id) {
              const meta = toReplyMetadata(message);
              if (meta) {
                repliesById.set(message.id, meta);
              }
            }
          });

          rawMessages.forEach((message) => {
            if (message.id) {
              const meta = toReplyMetadata(message);
              if (meta) {
                repliesById.set(message.id, meta);
              }
            }
          });

          const mappedMessages: Message[] = rawMessages.map((message) => {
            const { replyMessageId, ...rest } = message;
            const baseMessage = rest as Message;

            if (!replyMessageId) {
              return baseMessage;
            }

            const replyMetadata = repliesById.get(replyMessageId);
            if (!replyMetadata) {
              return baseMessage;
            }

            return {
              ...baseMessage,
              replyTo: replyMetadata,
            };
          });

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

          // No need to sort - backend provides messages in correct order

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
        reportApiError(error);
        if (replace) {
          setCurrentChat((prev) =>
            prev.chatId === chatId
              ? { ...prev, messages: [], isLoading: false, replyTo: null }
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
    [chatId, sessionId, reportApiError, reportConnectionRestored]
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
        replyTo: null,
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

  // Polling disabled - using SSE instead

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
      replyTo: null,
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
      const timestamp = Math.floor(Date.now()); // Use millisecond precision timestamp
      const replyTarget = currentChat.replyTo;
      const replyMetadata =
        replyTarget && replyTarget.contactId === activeChatId
          ? toReplyMetadata(replyTarget)
          : null;

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
              whatsappId: null,
              replyTo: replyMetadata ?? undefined,
            },
          ],
          isSending: true,
          replyTo: null,
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
            replyToMessageId: replyMetadata?.messageId ?? undefined,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : "Failed to send the message";
          reportApiError({ status: response.status, message });
          throw new Error(message);
        }

        const result = data?.result ?? {};
        reportConnectionRestored(); // Connection is good
        const messageId =
          typeof result?.message_id === "number"
            ? result.message_id
            : undefined;
        const whatsappId =
          typeof result?.whatsapp_message_id === "string"
            ? result.whatsapp_message_id
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
                whatsappId: whatsappId ?? message.whatsappId,
                sent: true,
                delivered: status
                  ? deliveredStatuses.includes(status)
                  : true,
                read: status ? readStatuses.includes(status) : false,
                error: undefined,
                // Keep the optimistic timestamp for consistent ordering
                timestamp: message.timestamp,
                // Preserve replyTo metadata
                replyTo: message.replyTo,
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

        // Update thread preview with the sent message
        updateThreadPreview(activeChatId, trimmed, timestamp);
      } catch (error) {
        const err = error as Error;
        reportApiError(error);
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
    [sessionId, currentChat, backendUserId, authBackendId, fetchMessages, updateThreadPreview, reportApiError, reportConnectionRestored]
  );

  const sendAttachment = useCallback(
    async (file: File, caption?: string) => {
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
      if (!backendId) {
        throw new Error("Unable to determine backend ID");
      }

      const optimisticId = `local-${Date.now()}`;
      const timestamp = Math.floor(Date.now());

      // Create optimistic attachment preview
      const optimisticAttachment = {
        id: 0,
        name: file.name,
        mimetype: file.type,
        url: URL.createObjectURL(file),
        file_size: file.size,
      };

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
              message: caption || "",
              timestamp,
              isSentFromUser: true,
              sent: false,
              delivered: false,
              read: false,
              userId: backendUserId ?? null,
              whatsappId: null,
              attachment: optimisticAttachment,
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
        // Step 1: Upload attachment to Odoo
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/attachments/upload", {
          method: "POST",
          headers: {
            "x-session-id": sessionId,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to upload attachment");
        }

        const uploadData = await uploadResponse.json();
        const attachmentId = uploadData.attachmentId;

        if (!attachmentId) {
          throw new Error("No attachment ID returned from upload");
        }

        // Step 2: Send message with attachment using send_image_message
        // Determine the method based on file type
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const isAudio = file.type.startsWith("audio/");
        const method = isImage
          ? "send_image_message"
          : isVideo
            ? "send_video_message"
            : isAudio
              ? "send_audio_message"
              : "send_document_message";

        const response = await fetch("/api/messages/send-attachment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId,
          },
          body: JSON.stringify({
            threadId: numericThreadId,
            phoneNumber: fallbackPhone,
            backendId,
            attachmentId,
            caption: caption || undefined,
            method,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : "Failed to send the attachment";
          reportApiError({ status: response.status, message });
          throw new Error(message);
        }

        const result = data?.result ?? {};
        reportConnectionRestored();
        const messageId =
          typeof result?.message_id === "number"
            ? result.message_id
            : undefined;

        // Clean up the optimistic object URL
        setCurrentChat((prev) => {
          const optimisticMessage = prev.messages.find(m => m.id === optimisticId);
          if (optimisticMessage?.attachment?.url) {
            URL.revokeObjectURL(optimisticMessage.attachment.url);
          }
          return prev;
        });

        // Always refetch messages to get the real attachment URL from backend
        if (typeof messageId === "number") {
          latestMessageIdRef.current =
            latestMessageIdRef.current === null
              ? messageId
              : Math.max(latestMessageIdRef.current, messageId);

          // Fetch messages to get the complete attachment data
          await fetchMessages({ replace: true });
        } else {
          void fetchMessages({ replace: true }).catch(() => undefined);
        }

        setCurrentChat((prev) => {
          if (prev.chatId !== activeChatId) {
            return prev;
          }
          return {
            ...prev,
            isSending: false,
          };
        });

        // Update thread preview with the caption or attachment indicator
        const previewText = caption || `📎 ${file.name}`;
        updateThreadPreview(activeChatId, previewText, timestamp);
      } catch (error) {
        const err = error as Error;
        reportApiError(error);
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
              // Clean up object URL on error
              if (message.attachment?.url) {
                URL.revokeObjectURL(message.attachment.url);
              }
              return {
                ...message,
                sent: false,
                delivered: false,
                read: false,
                error: err.message || "Failed to send the attachment",
              };
            }),
            isSending: false,
          };
        });
        throw err;
      }
    },
    [
      sessionId,
      currentChat,
      backendUserId,
      authBackendId,
      fetchMessages,
      updateThreadPreview,
      reportApiError,
      reportConnectionRestored,
    ]
  );

  const startReply = useCallback((message: Message) => {
    if (!message.whatsappId) {
      return;
    }
    setCurrentChat((prev) => {
      if (prev.chatId !== message.contactId) {
        return prev;
      }
      return {
        ...prev,
        replyTo: message,
      };
    });
  }, []);

  const cancelReply = useCallback(() => {
    setCurrentChat((prev) => ({
      ...prev,
      replyTo: null,
    }));
  }, []);

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
      value={{
        ...currentChat,
        loadCurrentChat,
        sendMessage,
        sendAttachment,
        startReply,
        cancelReply,
      }}
    >
      {children}
    </CurrentChatContext.Provider>
  );
}
