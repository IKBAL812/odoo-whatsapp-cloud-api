import dayjs from "dayjs";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Message } from "@/app/context/chats-provider";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import Reaction from "../message/reaction";
import ContactHeader from "./contact-header";
import ChatMessage from "./chat-message";
import AttachmentPicker from "../message/attachment-picker";
import DragDropZone from "../message/drag-drop-zone";
import { useTranslations } from "@/app/context/translation-provider";
import { useContacts } from "@/app/hooks/use-contacts";
import { XCircleIcon, Sparkle } from "@phosphor-icons/react";

export default function CurrentChat() {
  const {
    chatId,
    messages,
    isLoading,
    sendMessage,
    sendAttachment,
    sendReaction,
    isSending,
    replyTo,
    cancelReply,
    startReply,
  } = useCurrentChat();
  const [messageText, setMessageText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isAiImproving, setIsAiImproving] = useState(false);
  const { t } = useTranslations();
  const { contacts } = useContacts();

  useEffect(() => {
    setMessageText("");
    setSendError(null);
  }, [chatId]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom on initial load and new messages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, isLoading]);

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
      // Refocus the input after sending
      setTimeout(() => {
        inputRef.current?.focus();
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
    setSendError(null);

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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to improve text");
      }

      const data = await response.json();
      setMessageText(data.improvedText);
    } catch (error) {
      const err = error as Error;
      setSendError(err.message || t("chatInput.aiImproveError"));
    } finally {
      setIsAiImproving(false);
    }
  };

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
            <form
              onSubmit={handleSubmit}
              className="bg-[rgb(var(--bg-primary))] rounded-full"
            >
              <div className="bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] rounded-full flex items-center gap-2">
                <AttachmentPicker
                  onAttachmentSelect={handleAttachmentSelect}
                  disabled={isSending}
                  externalFile={droppedFile}
                  onExternalFileProcessed={handleDroppedFileProcessed}
                />
                <button
                  type="button"
                  onClick={handleAiImprove}
                  disabled={isAiImproving || isSending || messages.length === 0}
                  className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent-primary))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors p-2 active:scale-95"
                  title={t("chatInput.aiImprove")}
                >
                  <Sparkle
                    className="size-5 md:size-5"
                    weight={isAiImproving ? "fill" : "regular"}
                  />
                </button>
                <input
                  ref={inputRef}
                  className="flex-1 outline-none p-3 px-4 md:p-3 text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))] caret-[rgb(var(--accent-primary))] text-sm md:text-sm bg-transparent"
                  placeholder={t("chatInput.placeholder")}
                  value={messageText}
                  onChange={(event) => {
                    if (sendError) {
                      setSendError(null);
                    }
                    setMessageText(event.target.value);
                  }}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={isSending || messageText.trim().length === 0}
                  className="text-sm font-semibold text-white bg-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--status-success))] active:bg-[rgb(var(--accent-primary)/0.8)] disabled:opacity-60 disabled:cursor-not-allowed transition rounded-full px-5 py-2.5 md:px-4 md:py-2 mr-2"
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
