import dayjs from "dayjs";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Message } from "@/app/context/chats-provider";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import Reaction from "../message/reaction";
import ContactHeader from "./contact-header";
import ChatMessage from "./chat-message";
import AttachmentPicker from "../message/attachment-picker";
import DragDropZone from "../message/drag-drop-zone";
import SuggestionChips from "../message/suggestion-chips";
import { useTranslations } from "@/app/context/translation-provider";
import { useContacts } from "@/app/hooks/use-contacts";
import {
  XCircleIcon,
  Sparkle,
  TranslateIcon,
  Robot,
} from "@phosphor-icons/react";

export default function CurrentChat() {
  const {
    chatId,
    messages,
    isLoading,
    isPaginationLoading,
    hasMoreMessages,
    sendMessage,
    sendAttachment,
    sendReaction,
    isSending,
    replyTo,
    cancelReply,
    startReply,
    loadPreviousMessages,
  } = useCurrentChat();
  const [messageText, setMessageText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isAiImproving, setIsAiImproving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRagGenerating, setIsRagGenerating] = useState(false);
  const [isTypingAnimation, setIsTypingAnimation] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const lastProcessedIncomingIdRef = useRef<string | null>(null);
  const { t } = useTranslations();
  const { contacts } = useContacts();

  useEffect(() => {
    setMessageText("");
    setSendError(null);
    setSuggestions([]);
    lastProcessedIncomingIdRef.current = null;
  }, [chatId]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLoadingPaginationRef = useRef(false);
  const lastScrollHeightRef = useRef(0);
  const hasScrolledRef = useRef(false);

  // Auto-scroll to bottom on initial load and new messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && !isLoadingPaginationRef.current) {
      container.scrollTop = container.scrollHeight;
      hasScrolledRef.current = true;
    }
  }, [messages.length, isLoading]);

  // Handle scroll event for pagination
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isThrottled = false;

    const handleScroll = () => {
      if (isThrottled || !hasScrolledRef.current) return;

      const scrollTop = container.scrollTop;
      const scrollThreshold = 100; // Trigger when within 100px of top

      if (
        scrollTop <= scrollThreshold &&
        hasMoreMessages &&
        !isPaginationLoading &&
        !isLoading
      ) {
        isThrottled = true;

        // Save current scroll height before loading
        lastScrollHeightRef.current = container.scrollHeight;
        isLoadingPaginationRef.current = true;

        loadPreviousMessages().finally(() => {
          // Reset throttle after a short delay
          setTimeout(() => {
            isThrottled = false;
          }, 500);
        });
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [hasMoreMessages, isPaginationLoading, isLoading, loadPreviousMessages]);

  // Preserve scroll position after pagination loads
  useEffect(() => {
    if (!isPaginationLoading && isLoadingPaginationRef.current) {
      const container = scrollContainerRef.current;
      if (container && lastScrollHeightRef.current > 0) {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - lastScrollHeightRef.current;
        container.scrollTop = scrollDiff;

        isLoadingPaginationRef.current = false;
        lastScrollHeightRef.current = 0;
      }
    }
  }, [isPaginationLoading, messages.length]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // Adjust height when messageText changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [messageText]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = messageText.trim();
    if (trimmed.length === 0) {
      return;
    }

    try {
      await sendMessage(trimmed);
      setMessageText("");
      setSendError(null);
      // Refocus the textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } catch (error) {
      const err = error as Error;
      setSendError(err.message || t("chatInput.sendError"));
    }
  };

  const handleAttachmentSelect = async (file: File, caption: string) => {
    setSendError(null);
    try {
      await sendAttachment(file, caption);
    } catch (error) {
      const err = error as Error;
      setSendError(err.message || "Failed to send attachment");
    }
  };

  const handleFilesDrop = (files: File[]) => {
    // For now, handle only the first file
    // Could be extended to handle multiple files
    if (files.length > 0 && !isSending) {
      setDroppedFile(files[0]);
    }
  };

  const handleDroppedFileProcessed = () => {
    setDroppedFile(null);
  };

  const handleAiImprove = async () => {
    setIsAiImproving(true);
    setIsTypingAnimation(true);
    setSendError(null);
    setMessageText("");

    try {
      const response = await fetch("/api/ai/improve-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.slice(-10), // Last 10 messages
          currentText: messageText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to improve text");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer
          while (true) {
            const lineEnd = buffer.indexOf("\n");
            if (lineEnd === -1) break;

            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.content;
                if (content) {
                  accumulatedText += content;
                  setMessageText(accumulatedText);
                }
              } catch {
                // Ignore invalid JSON
              }
            }
          }
        }
      } finally {
        reader.cancel();
      }
    } catch (error) {
      const err = error as Error;
      setSendError(err.message || t("chatInput.aiImproveError"));
    } finally {
      setIsAiImproving(false);
      setIsTypingAnimation(false);
    }
  };

  const handleTranslate = async () => {
    if (!messageText.trim()) {
      return;
    }

    setIsTranslating(true);
    setIsTypingAnimation(true);
    setSendError(null);
    const originalText = messageText;
    setMessageText("");

    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.slice(-10), // Last 10 messages
          currentText: originalText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to translate text");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer
          while (true) {
            const lineEnd = buffer.indexOf("\n");
            if (lineEnd === -1) break;

            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.content;
                if (content) {
                  accumulatedText += content;
                  setMessageText(accumulatedText);
                }
              } catch {
                // Ignore invalid JSON
              }
            }
          }
        }
      } finally {
        reader.cancel();
      }
    } catch (error) {
      const err = error as Error;
      setSendError(err.message || t("chatInput.translateError"));
      setMessageText(originalText); // Restore original text on error
    } finally {
      setIsTranslating(false);
      setIsTypingAnimation(false);
    }
  };

  const handleRagGenerate = async () => {
    setIsRagGenerating(true);
    setIsTypingAnimation(true);
    setSendError(null);
    setMessageText("");

    try {
      // Get contact name from the current chat
      const currentContact = contacts.find((c) => c.id === chatId);
      const contactName = currentContact?.displayName || "Customer";

      const response = await fetch("/api/ai/rag-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.slice(-10), // Last 10 messages
          contactName: contactName,
          userName: "Support Agent",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate response");
      }

      const data = await response.json();
      if (data.response) {
        setMessageText(data.response);
      }
    } catch (error) {
      const err = error as Error;
      setSendError(err.message || t("chatInput.ragGenerateError"));
    } finally {
      setIsRagGenerating(false);
      setIsTypingAnimation(false);
    }
  };

  // Generate suggestions with 3 different writing styles
  const generateSuggestions = useCallback(async () => {
    if (messages.length === 0) {
      return;
    }

    setIsSuggestionsLoading(true);
    setSuggestions([]);

    const styles = ["Aşırı kısa ve açıklayıcı", "Profesyonel ve teknik"];

    // Get contact name from the current chat
    const currentContact = contacts.find((c) => c.id === chatId);
    const contactName = currentContact?.displayName || "Customer";

    try {
      // Make 3 parallel API calls with different styles
      const promises = styles.map((style) =>
        fetch("/api/ai/rag-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messages.slice(-10),
            contactName: contactName,
            userName: "Support Agent",
            style,
          }),
        })
          .then((r) => r.json())
          .then((data) => data.response || null)
          .catch(() => null)
      );

      const results = await Promise.all(promises);
      const validSuggestions = results.filter(
        (r): r is string => r !== null && r.length > 0
      );
      setSuggestions(validSuggestions);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [messages, contacts, chatId]);

  // Handle suggestion selection - populate textarea
  const handleSuggestionSelect = (suggestion: string) => {
    setMessageText(suggestion);
    textareaRef.current?.focus();
  };

  // Detect new incoming messages and generate suggestions
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    // Find the latest incoming message (from customer, not from user)
    const latestIncoming = [...messages]
      .reverse()
      .find((m) => !m.isSentFromUser);

    if (!latestIncoming?.id) {
      return;
    }

    // Only generate suggestions if this is a new incoming message
    if (latestIncoming.id !== lastProcessedIncomingIdRef.current) {
      lastProcessedIncomingIdRef.current = latestIncoming.id;
      generateSuggestions();
    }
  }, [messages, generateSuggestions]);

  const annotatedMessages = useMemo(() => {
    const items: Array<
      | { type: "label"; day: dayjs.Dayjs; key: string }
      | { type: "message"; message: Message; index: number }
    > = [];
    let lastLabelKey: string | null = null;

    messages.forEach((message, index) => {
      const day = dayjs(message.timestamp).startOf("day");
      const labelKey = day.toISOString();
      if (labelKey !== lastLabelKey) {
        items.push({ type: "label", day, key: labelKey });
        lastLabelKey = labelKey;
      }
      items.push({ type: "message", message, index });
    });

    return items;
  }, [messages]);

  const formatDayLabel = (day: dayjs.Dayjs) => {
    if (day.isSame(dayjs(), "day")) {
      return t("chat.dayToday");
    }
    if (day.isSame(dayjs().subtract(1, "day"), "day")) {
      return t("chat.dayYesterday");
    }
    return day.format("MMMM D, YYYY");
  };

  if (!chatId) {
    return (
      <section className="w-full h-full text-[rgb(var(--text-primary))] flex justify-center items-center">
        {t("app.selectChatPrompt")}
      </section>
    );
  }

  const getMessageSpacing = (
    index: number,
    reactionsCount?: number
  ): string => {
    if (index === messages.length - 1) {
      return "mb-0";
    } else if (reactionsCount && reactionsCount > 0) {
      return "mb-4";
    } else if (
      messages[index].isSentFromUser === messages[index + 1]?.isSentFromUser &&
      messages[index].contactId === messages[index + 1]?.contactId
    ) {
      return "mb-0.5";
    }
    return "mb-4";
  };

  return (
    <section className="w-full h-full flex flex-col">
      <ContactHeader />
      <DragDropZone
        onFilesDrop={handleFilesDrop}
        disabled={isSending || !chatId}
      >
        <div className="relative flex-1 min-h-0 w-full flex flex-col">
          <div className="absolute inset-0 background-custom pointer-events-none"></div>

          <div
            ref={scrollContainerRef}
            className="relative flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar"
          >
            <div className="min-h-full flex flex-col justify-end">
              <div className="p-4 md:p-4 px-3 md:px-4 flex flex-col gap-2">
                {isPaginationLoading && (
                  <div className="w-full flex justify-center items-center py-3">
                    <div className="flex items-center gap-2 text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[rgb(var(--accent-primary))] border-t-transparent"></div>
                      <span className="text-xs">
                        {t("chat.loadingOlderMessages")}
                      </span>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <div className="text-[rgb(var(--text-primary))]">
                    {t("chat.loading")}
                  </div>
                )}
                {annotatedMessages.map((item) => {
                  if (item.type === "label") {
                    return (
                      <div
                        key={`label-${item.key}`}
                        className="w-full flex justify-center items-center"
                      >
                        <div className="rounded-full overflow-hidden bg-[rgb(var(--bg-primary))] z-20 w-fit">
                          <p className="bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] h-full w-full text-xs p-1 px-2">
                            {formatDayLabel(item.day)}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const { message, index } = item;

                  return (
                    <div
                      className={`w-full flex items-center ${
                        message.isSentFromUser ? "justify-end" : "justify-start"
                      }`}
                      key={message.id ?? `message-${index}`}
                    >
                      <div
                        className={`flex justify-between gap-2 items-center ${getMessageSpacing(
                          index,
                          message.reactions?.length
                        )} relative`}
                      >
                        {message.isSentFromUser && (
                          <Reaction
                            isSentFromUser={true}
                            onReply={
                              message.whatsappId
                                ? () => startReply(message)
                                : undefined
                            }
                            onReaction={
                              message.whatsappId
                                ? (emoji) => sendReaction(message, emoji)
                                : undefined
                            }
                          />
                        )}
                        <ChatMessage message={message} />
                        {!message.isSentFromUser && (
                          <Reaction
                            isSentFromUser={false}
                            onReply={
                              message.whatsappId
                                ? () => startReply(message)
                                : undefined
                            }
                            onReaction={
                              message.whatsappId
                                ? (emoji) => sendReaction(message, emoji)
                                : undefined
                            }
                          />
                        )}
                        {message.reactionEmoji && (
                          <div
                            className={`absolute z-20 -bottom-4 ${
                              message.isSentFromUser ? "right-3" : "left-3"
                            }`}
                          >
                            <div className="flex justify-center items-center rounded-xl overflow-hidden bg-black">
                              <p className="text-xs rounded-xl border-[1px] border-white/25 bg-white/20 px-1.5 py-0.5">
                                {message.reactionEmoji}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <section className="w-full z-50 p-4">
            <SuggestionChips
              suggestions={suggestions}
              isLoading={isSuggestionsLoading}
              onSelect={handleSuggestionSelect}
              onRefresh={generateSuggestions}
              disabled={isSending || isTypingAnimation}
            />
            {replyTo && (
              <div className="bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] border-l-2 border-[rgb(var(--accent-primary))] px-3 py-2 rounded-lg mb-2 flex justify-between items-start gap-3">
                <div className="flex flex-col">
                  <p className="text-xs text-[rgb(var(--accent-primary))] font-semibold">
                    {t("chatInput.replyingTo", {
                      name: replyTo.isSentFromUser
                        ? t("common.you")
                        : (contacts.find((c) => c.id === replyTo.contactId)
                            ?.displayName ?? ""),
                    })}
                  </p>
                  <p className="text-xs text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))] max-w-xs truncate">
                    {replyTo.message}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] p-2 active:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg transition-colors"
                  onClick={cancelReply}
                >
                  <XCircleIcon className="size-5 md:size-4" weight="bold" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] rounded-3xl flex items-end gap-2 py-2">
                <AttachmentPicker
                  onAttachmentSelect={handleAttachmentSelect}
                  disabled={isSending}
                  externalFile={droppedFile}
                  onExternalFileProcessed={handleDroppedFileProcessed}
                />
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={
                    isTranslating ||
                    isAiImproving ||
                    isRagGenerating ||
                    isSending ||
                    messageText.trim().length === 0
                  }
                  className={`text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent-primary))] disabled:opacity-40 disabled:cursor-not-allowed transition-all p-2 mb-1 active:scale-95 ${
                    isTranslating
                      ? "animate-pulse text-[rgb(var(--accent-primary))]"
                      : ""
                  }`}
                  title={t("chatInput.translate")}
                >
                  <TranslateIcon
                    className={`size-5 md:size-5 transition-transform ${
                      isTranslating ? "animate-spin" : ""
                    }`}
                    weight={isTranslating ? "fill" : "bold"}
                    style={
                      isTranslating ? { animationDuration: "2s" } : undefined
                    }
                  />
                </button>
                <button
                  type="button"
                  onClick={handleAiImprove}
                  disabled={
                    isAiImproving ||
                    isTranslating ||
                    isRagGenerating ||
                    isSending ||
                    messages.length === 0
                  }
                  className={`text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent-primary))] disabled:opacity-40 disabled:cursor-not-allowed transition-all p-2 mb-1 active:scale-95 ${
                    isAiImproving
                      ? "animate-pulse text-[rgb(var(--accent-primary))]"
                      : ""
                  }`}
                  title={t("chatInput.aiImprove")}
                >
                  <Sparkle
                    className={`size-5 md:size-5 transition-transform ${
                      isAiImproving ? "animate-spin" : ""
                    }`}
                    weight={isAiImproving ? "fill" : "regular"}
                    style={
                      isAiImproving ? { animationDuration: "2s" } : undefined
                    }
                  />
                </button>
                <button
                  type="button"
                  onClick={handleRagGenerate}
                  disabled={
                    isRagGenerating ||
                    isAiImproving ||
                    isTranslating ||
                    isSending ||
                    messages.length === 0
                  }
                  className={`text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent-primary))] disabled:opacity-40 disabled:cursor-not-allowed transition-all p-2 mb-1 active:scale-95 ${
                    isRagGenerating
                      ? "animate-pulse text-[rgb(var(--accent-primary))]"
                      : ""
                  }`}
                  title={t("chatInput.ragGenerate")}
                >
                  <Robot
                    className={`size-5 md:size-5 transition-transform ${
                      isRagGenerating ? "animate-spin" : ""
                    }`}
                    weight={isRagGenerating ? "fill" : "regular"}
                    style={
                      isRagGenerating ? { animationDuration: "2s" } : undefined
                    }
                  />
                </button>
                <textarea
                  ref={textareaRef}
                  className={`flex-1 outline-none p-3 px-4 md:p-3 text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))] caret-[rgb(var(--accent-primary))] text-sm md:text-sm bg-transparent resize-none overflow-y-auto custom-scrollbar min-h-[44px] max-h-[120px] transition-[height] duration-150 ease-out ${
                    isTypingAnimation ? "animate-pulse" : ""
                  }`}
                  placeholder={
                    isTypingAnimation
                      ? t("chatInput.aiImproving")
                      : t("chatInput.placeholder")
                  }
                  value={messageText}
                  onChange={(event) => {
                    if (sendError) {
                      setSendError(null);
                    }
                    setMessageText(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      const form = event.currentTarget.form;
                      if (form && !isSending && messageText.trim().length > 0) {
                        form.requestSubmit();
                      }
                    }
                  }}
                  disabled={isSending || isTypingAnimation}
                  readOnly={isTypingAnimation}
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={isSending || messageText.trim().length === 0}
                  className="text-sm font-semibold text-white bg-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--status-success))] active:bg-[rgb(var(--accent-primary)/0.8)] disabled:opacity-60 disabled:cursor-not-allowed transition rounded-full px-5 py-2.5 md:px-4 mr-2 mb-1"
                >
                  {isSending ? t("chatInput.sending") : t("chatInput.send")}
                </button>
              </div>
            </form>
            {sendError && (
              <p className="text-xs text-[rgb(var(--status-error))] mt-2 px-2">
                {sendError}
              </p>
            )}
          </section>
        </div>
      </DragDropZone>
    </section>
  );
}
