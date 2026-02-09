import { useEffect, useRef, useState } from "react";
import { UsersThreeIcon, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useChats } from "@/app/hooks/use-chats";
import {
  Chat,
  Filters,
  Message,
  MessageSearchResult,
} from "@/app/context/chats-provider";
import Profile from "../profile";
import { useContacts } from "@/app/hooks/use-contacts";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import dayjs from "dayjs";
import { formatTime } from "@/app/utils";
import { useTranslations } from "@/app/context/translation-provider";
import MessageStatusIcon from "../message-status-icon";
import { useMobileNavigation } from "@/app/context/mobile-navigation-provider";
import { useResponsive } from "@/app/hooks/use-responsive";
import BackendSelector from "../backend-selector";
import { useAuth } from "@/app/hooks/use-auth";

export default function Chats({ selectedTab }: { selectedTab: string }) {
  const {
    filter,
    updateFilter,
    chats: { filtered, isLoading, complete },
    hasMoreThreads,
    isLoadingMoreThreads,
    loadMoreThreads,
    markChatAsRead,
    totalUnreadCount,
    searchQuery,
    updateSearchQuery,
    clearSearch,
    messageSearchResults,
    isSearchingMessages,
    hasMoreMessageResults,
    isLoadingMoreMessages,
    loadMoreMessageResults,
  } = useChats();
  const { getContact } = useContacts();
  const { loadCurrentChat, contact, chatId: currentChatId } = useCurrentChat();
  const { t, locale } = useTranslations();
  const { showActiveChat } = useMobileNavigation();
  const { isMobile } = useResponsive();
  const { sessionId } = useAuth();
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const root = scrollContainerRef.current;

    if (!sentinel || !root || !hasMoreThreads || searchQuery.length > 0) {
      return;
    }

    if (isLoadingMoreThreads || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        if (!hasMoreThreads || isLoadingMoreThreads || isLoading) {
          return;
        }

        loadMoreThreads();
      },
      {
        root,
        rootMargin: "400px",
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    hasMoreThreads,
    isLoading,
    isLoadingMoreThreads,
    loadMoreThreads,
    filtered.length,
  ]);

  const getMetaMessage = (chat: Chat, message?: Message): string => {
    if (!message) {
      return chat.lastMessagePreview ?? "";
    }

    if (chat.group) {
      const groupContact = getContact(message.contactId);
      return `${groupContact?.displayName ?? "Unknown"}: ${message.message}`;
    }

    if (contact?.typing && contact.id === message.contactId) {
      return t("chat.typing");
    }

    return message.message;
  };

  const handleMarkAllRead = async () => {
    if (!sessionId) return;

    const unreadChats = complete.filter((chat) => !chat.read);
    if (unreadChats.length === 0) return;

    setIsMarkingAllRead(true);

    // Optimistically update UI
    unreadChats.forEach((chat) => {
      markChatAsRead(chat.id);
    });

    // Single API call to mark all as read
    try {
      await fetch("/api/threads/mark-all-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
      });
    } catch (err) {
      console.error("Failed to mark all chats as read:", err);
    }

    setIsMarkingAllRead(false);
  };

  const renderChat = (chat: Chat) => {
    const currentContact = getContact(
      typeof chat.contactId === "string" ? chat.contactId : ""
    );
    const name =
      typeof chat.contactId === "string"
        ? (chat.partnerName ??
          currentContact?.displayName ??
          chat.threadName ??
          "Unknown")
        : (chat.groupName ?? chat.threadName ?? "Unknown");
    // For non-active chats, prefer lastMessagePreview over messages array
    // since messages array only contains data for the currently active chat
    const isCurrentChat =
      typeof chat.contactId === "string" && chat.contactId === contact?.id;
    const lastMessage =
      isCurrentChat && chat.messages.length > 0
        ? chat.messages[chat.messages.length - 1]
        : undefined;
    const messagePreview = getMetaMessage(chat, lastMessage);
    const lastMessageTimestamp =
      lastMessage?.timestamp ?? chat.lastMessageAt ?? null;
    const formattedDate = lastMessageTimestamp
      ? dayjs(lastMessageTimestamp).isSame(dayjs(), "day")
        ? formatTime(lastMessageTimestamp, locale)
        : t("common.dateFormat", {
            date: dayjs(lastMessageTimestamp).format("MMM D, YYYY"),
          })
      : "";
    const isSentFromUser = lastMessage?.isSentFromUser ?? false;

    return (
      <button
        key={chat.id}
        onClick={() => {
          markChatAsRead(chat.id);
          // Only load chat if it's not already the current chat
          if (chat.id !== currentChatId) {
            loadCurrentChat({
              chatId: chat.id,
              page: 0,
              messages: [],
              contact: null,
              group: null,
              threadName: chat.threadName ?? chat.groupName ?? null,
              phoneNumber: chat.phoneNumber ?? null,
              backendId: chat.backendId ?? null,
              partnerId: chat.partnerId ?? null,
              partnerName: chat.partnerName ?? null,
              partnerAvatar: chat.partnerAvatar ?? null,
            });
          }
          // Navigate to active chat view on mobile
          if (isMobile) {
            showActiveChat();
          }
        }}
        className={`outline-none grid grid-cols-6 w-full gap-4 p-3 md:p-2.5 hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-xl cursor-pointer active:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] transition-colors ${
          chat.id === currentChatId
            ? "bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))]"
            : ""
        }`}
      >
        <div className="col-span-1">
          {!chat.group ? (
            <Profile
              size="12"
              url={
                chat.hasAvatar
                  ? (chat.partnerAvatar ??
                    currentContact?.contactAvatar ??
                    undefined)
                  : undefined
              }
              alt={name}
              seed={chat.partnerId ?? undefined}
            />
          ) : (
            <Profile size="12">
              <div className="h-full w-full flex justify-center items-center bg-[rgb(var(--bg-secondary)/0.5)]">
                <UsersThreeIcon
                  className="size-7 text-[rgb(var(--text-primary))]"
                  weight="fill"
                />
              </div>
            </Profile>
          )}
        </div>
        <div className="col-span-4 flex flex-col justify-center items-start w-full min-w-0">
          <p className="text-[rgb(var(--text-primary))] truncate w-full text-left">
            {name}
          </p>
          <div className="flex justify-start items-center gap-1 w-full min-w-0">
            {lastMessage && <MessageStatusIcon message={lastMessage} />}
            <p
              className={`text-sm ${
                chat.read || isSentFromUser
                  ? "text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]"
                  : "text-[rgb(var(--text-primary))] font-semibold"
              } whitespace-nowrap truncate text-ellipsis overflow-hidden ${
                contact?.typing && lastMessage
                  ? "text-[rgb(var(--accent-primary))] font-medium"
                  : ""
              }`}
            >
              {contact?.typing && lastMessage
                ? getMetaMessage(chat, lastMessage)
                : messagePreview}
            </p>
          </div>
        </div>
        <div className="col-span-1 flex flex-col justify-center items-end gap-1">
          {lastMessageTimestamp && (
            <p
              className={`text-xs font-semibold ${
                chat.read || isSentFromUser
                  ? "text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]"
                  : "text-[rgb(var(--accent-active))]"
              }`}
            >
              {formattedDate}
            </p>
          )}
          {/* Unread badge - only show if count > 0 */}
          {chat.unreadCount != null && chat.unreadCount > 0 && (
            <div className="flex justify-end items-center">
              <span className="bg-[rgb(var(--accent-primary))] text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
              </span>
            </div>
          )}
        </div>
      </button>
    );
  };

  const renderMessageResult = (result: MessageSearchResult) => {
    const name = result.partnerName ?? result.threadName ?? "Unknown";
    const threadId = String(result.threadId);
    const formattedDate = result.messageTimestamp
      ? dayjs(result.messageTimestamp * 1000).isSame(dayjs(), "day")
        ? formatTime(result.messageTimestamp * 1000, locale)
        : t("common.dateFormat", {
            date: dayjs(result.messageTimestamp * 1000).format("MMM D, YYYY"),
          })
      : "";

    return (
      <button
        key={`msg-${result.messageId}`}
        onClick={() => {
          loadCurrentChat({
            chatId: threadId,
            page: 0,
            messages: [],
            contact: null,
            group: null,
            threadName: result.threadName ?? null,
            phoneNumber: result.phoneNumber ?? null,
            backendId: result.backendId ?? null,
            partnerId: result.partnerId ?? null,
            partnerName: result.partnerName ?? null,
            partnerAvatar: null,
            targetMessageId: result.messageId,
          });
          if (isMobile) {
            showActiveChat();
          }
        }}
        className={`outline-none grid grid-cols-6 w-full gap-4 p-3 md:p-2.5 hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-xl cursor-pointer active:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] transition-colors ${
          threadId === currentChatId
            ? "bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))]"
            : ""
        }`}
      >
        <div className="col-span-1">
          <Profile size="12" alt={name} seed={result.partnerId ?? undefined} />
        </div>
        <div className="col-span-4 flex flex-col justify-center items-start w-full min-w-0">
          <p className="text-[rgb(var(--text-primary))] truncate w-full text-left">
            {name}
          </p>
          <p className="text-sm text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] line-clamp-2 break-all text-left">
            {result.messageBody}
          </p>
        </div>
        <div className="col-span-1 flex flex-col justify-center items-end gap-1">
          {formattedDate && (
            <p className="text-xs font-semibold text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
              {formattedDate}
            </p>
          )}
        </div>
      </button>
    );
  };

  const renderChats = () => {
    if (isLoading) {
      return (
        <div className="w-full h-full flex justify-center items-center text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
          {t("chat.loading")}
        </div>
      );
    }

    // When searching, show sectioned results
    if (searchQuery.length > 0) {
      const hasContacts = filtered.length > 0;
      const hasMessages = messageSearchResults.length > 0;

      if (!hasContacts && !hasMessages && !isSearchingMessages) {
        return (
          <div className="w-full h-full flex flex-col justify-center items-center text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] gap-2">
            <p className="text-lg">{t("chat.noResults")}</p>
            <p className="text-sm">{t("chat.noResultsHint")}</p>
          </div>
        );
      }

      return (
        <>
          {hasContacts && (
            <>
              <p className="text-xs font-semibold text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] uppercase tracking-wider px-1 pt-2 pb-1">
                {t("chat.searchSectionContacts")}
              </p>
              {filtered.map(renderChat)}
              {hasMoreThreads && (
                <button
                  onClick={loadMoreThreads}
                  disabled={isLoadingMoreThreads}
                  className="w-full py-2 text-sm text-[rgb(var(--accent-primary))] hover:underline disabled:opacity-50 disabled:cursor-wait"
                >
                  {isLoadingMoreThreads
                    ? t("chat.loading")
                    : t("chat.loadOlderThreads")}
                </button>
              )}
            </>
          )}
          {hasMessages && (
            <>
              <p className="text-xs font-semibold text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] uppercase tracking-wider px-1 pt-2 pb-1">
                {t("chat.searchSectionMessages")}
              </p>
              {messageSearchResults.map(renderMessageResult)}
              {hasMoreMessageResults && (
                <button
                  onClick={loadMoreMessageResults}
                  disabled={isLoadingMoreMessages}
                  className="w-full py-2 text-sm text-[rgb(var(--accent-primary))] hover:underline disabled:opacity-50 disabled:cursor-wait"
                >
                  {isLoadingMoreMessages
                    ? t("chat.loading")
                    : t("chat.loadOlderThreads")}
                </button>
              )}
            </>
          )}

          {isSearchingMessages && !hasMessages && (
            <div className="flex justify-center py-2 text-sm text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
              {t("chat.loading")}
            </div>
          )}
        </>
      );
    }

    return filtered.map(renderChat);
  };

  return (
    <section className="w-full h-full min-h-0 flex flex-col gap-3 relative">
      <section className="w-full flex justify-between items-center px-4 pt-4">
        <p className="text-[rgb(var(--text-primary))] text-2xl font-semibold capitalize">
          {t(`navigation.${selectedTab}`)}
        </p>
      </section>
      <BackendSelector />
      {/* Search Input */}
      <section className="w-full px-4">
        <div className="relative">
          <MagnifyingGlass
            className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]"
            weight="regular"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
            placeholder={t("chat.searchPlaceholder")}
            className="w-full pl-10 pr-10 py-2.5 bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] focus:outline-none focus:border-[rgb(var(--accent-primary))] transition-colors"
          />
          {searchQuery.length > 0 && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-full transition-colors"
            >
              <X
                className="size-4 text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]"
                weight="bold"
              />
            </button>
          )}
        </div>
      </section>
      <section className="w-full flex flex-col gap-1 px-4">
        <div className="flex justify-start items-center text-[rgb(var(--text-primary))] gap-2">
          {[Filters.ALL, Filters.UNREAD].map((f: string) => (
            <button
              key={f}
              className={`${
                f === filter
                  ? "bg-[rgb(var(--accent-primary)/0.3)] text-[rgb(var(--text-primary))] border-[rgb(var(--accent-primary)/0.3)]"
                  : "border-[rgb(var(--border-primary)/var(--border-primary-opacity))] hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))]"
              } text-sm p-2 px-4 md:p-1 md:px-3 border-[1px] rounded-full cursor-pointer capitalize active:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] transition-colors`}
              onClick={() => updateFilter(f)}
            >
              {t(`chat.filters.${f}`)}
            </button>
          ))}
          {/* Read All Button */}
          {totalUnreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isMarkingAllRead}
              className={`text-sm p-2 px-4 md:p-1 md:px-3 border-[1px] rounded-full cursor-pointer transition-colors capitalize border-[rgb(var(--border-primary)/var(--border-primary-opacity))] hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] active:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] text-[rgb(var(--text-primary))] ${
                isMarkingAllRead ? "opacity-50 cursor-wait" : ""
              }`}
            >
              {isMarkingAllRead ? t("chat.loading") : t("chat.filters.readAll")}
            </button>
          )}
        </div>
      </section>
      <section
        ref={scrollContainerRef}
        className="w-full flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-1 px-4 pb-4"
      >
        {renderChats()}
        {hasMoreThreads && searchQuery.length === 0 && (
          <div
            ref={loadMoreRef}
            className="flex justify-center py-2 text-sm text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]"
          >
            {isLoadingMoreThreads ? t("chat.loadingOlderThreads") : ""}
          </div>
        )}
      </section>
    </section>
  );
}
