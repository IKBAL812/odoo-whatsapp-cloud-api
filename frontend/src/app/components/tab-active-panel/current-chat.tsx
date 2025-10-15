import dayjs from "dayjs";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Message } from "@/app/context/chats-provider";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import Reaction from "../message/reaction";
import ContactHeader from "./contact-header";
import ChatMessage from "./chat-message";
import MessageReactions from "./message-reactions";
import AttachmentPicker from "../message/attachment-picker";
import DragDropZone from "../message/drag-drop-zone";
import { useTranslations } from "@/app/context/translation-provider";
import { useContacts } from "@/app/hooks/use-contacts";
import { XCircleIcon } from "@phosphor-icons/react";

export default function CurrentChat() {
  const {
    chatId,
    messages,
    isLoading,
    sendMessage,
    sendAttachment,
    isSending,
    replyTo,
    cancelReply,
    startReply,
  } = useCurrentChat();
  const [messageText, setMessageText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const { t } = useTranslations();
  const { contacts } = useContacts();

  useEffect(() => {
    setMessageText("");
    setSendError(null);
  }, [chatId]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      <section className="w-full h-full text-white flex justify-center items-center">
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
      <DragDropZone onFilesDrop={handleFilesDrop} disabled={isSending || !chatId}>
        <div className="relative flex-1 min-h-0 w-full flex flex-col">
          <div className="absolute inset-0 background-custom pointer-events-none"></div>

          <div
            ref={scrollContainerRef}
            className="relative flex-1 min-h-0 w-full overflow-y-auto"
          >
            <div className="min-h-full flex flex-col justify-end">
            <div className="p-4 md:p-4 px-3 md:px-4 flex flex-col gap-2">
              {isLoading && <div className="text-white">{t("chat.loading")}</div>}
              {annotatedMessages.map((item) => {
                if (item.type === "label") {
                  return (
                    <div
                      key={`label-${item.key}`}
                      className="w-full flex justify-center items-center"
                    >
                      <div className="rounded-full overflow-hidden bg-black z-20 w-fit">
                        <p className="bg-white/20 text-white/55 h-full w-full text-xs p-1 px-2">
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
                  />
                )}
                      {message.reactions?.length && (
                        <MessageReactions
                          reactions={message.reactions}
                          isSentFromUser={message.isSentFromUser}
                        />
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
            <div className="bg-white/5 border-l-2 border-emerald-500 px-3 py-2 rounded-lg mb-2 flex justify-between items-start gap-3">
              <div className="flex flex-col">
                <p className="text-xs text-emerald-200 font-semibold">
                  {t("chatInput.replyingTo", {
                    name: replyTo.isSentFromUser
                      ? t("common.you")
                      : contacts.find((c) => c.id === replyTo.contactId)
                          ?.displayName ?? "",
                  })}
                </p>
                <p className="text-xs text-white/70 max-w-xs truncate">
                  {replyTo.message}
                </p>
              </div>
              <button
                type="button"
                className="text-white/60 hover:text-white p-2 active:bg-white/10 rounded-lg transition-colors"
                onClick={cancelReply}
              >
                <XCircleIcon className="size-5 md:size-4" weight="bold" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="bg-black rounded-full">
            <div className="bg-white/15 rounded-full flex items-center gap-2">
              <AttachmentPicker
                onAttachmentSelect={handleAttachmentSelect}
                disabled={isSending}
                externalFile={droppedFile}
                onExternalFileProcessed={handleDroppedFileProcessed}
              />
              <input
                ref={inputRef}
                className="flex-1 outline-none p-3 px-4 md:p-3 text-white placeholder-white/60 caret-green-400 text-sm md:text-sm bg-transparent"
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
                className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition rounded-full px-5 py-2.5 md:px-4 md:py-2 mr-2"
              >
                {isSending ? t("chatInput.sending") : t("chatInput.send")}
              </button>
            </div>
          </form>
          {sendError && (
            <p className="text-xs text-red-400 mt-2 px-2">{sendError}</p>
          )}
        </section>
        </div>
      </DragDropZone>
    </section>
  );
}
