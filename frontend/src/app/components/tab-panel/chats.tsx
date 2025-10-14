import { DotsThreeVerticalIcon, UsersThreeIcon } from "@phosphor-icons/react";
import TooltipWrapper from "../tooltip-wrapper";
import { useChats } from "@/app/hooks/use-chats";
import { Chat, Filters, Message } from "@/app/context/chats-provider";
import Profile from "../profile";
import { useContacts } from "@/app/hooks/use-contacts";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import dayjs from "dayjs";
import { formatTime } from "@/app/utils";
import { useTranslations } from "@/app/context/translation-provider";
import MessageStatusIcon from "../message-status-icon";

export default function Chats({ selectedTab }: { selectedTab: string }) {
  const {
    filter,
    updateFilter,
    search,
    updateSearch,
    chats: { filtered, isLoading },
  } = useChats();
  const { getContact } = useContacts();
  const { loadCurrentChat, contact } = useCurrentChat();
  const { t, locale } = useTranslations();

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

  const renderChat = (chat: Chat) => {
    const currentContact = getContact(
      typeof chat.contactId === "string" ? chat.contactId : ""
    );
    const name =
      typeof chat.contactId === "string"
        ? currentContact?.displayName ?? chat.threadName ?? "Unknown"
        : chat.groupName ?? chat.threadName ?? "Unknown";
    // For non-active chats, prefer lastMessagePreview over messages array
    // since messages array only contains data for the currently active chat
    const isCurrentChat = typeof chat.contactId === "string" && chat.contactId === contact?.id;
    const lastMessage = isCurrentChat && chat.messages.length > 0
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
        onClick={() =>
          loadCurrentChat({
            chatId: chat.id,
            page: 0,
            messages: [],
            contact: null,
            group: null,
            threadName: chat.threadName ?? chat.groupName ?? null,
            phoneNumber: chat.phoneNumber ?? null,
            backendId: chat.backendId ?? null,
          })
        }
        className={`outline-none grid grid-cols-6 w-full gap-4 p-2.5 hover:bg-white/10 rounded-xl cursor-pointer ${
          typeof chat.contactId === "string" && chat.contactId === contact?.id
            ? "bg-white/10"
            : ""
        }`}
      >
        <div className="col-span-1">
          {!chat.group ? (
            <Profile
              size="12"
              url={currentContact?.contactAvatar}
              alt={name}
            />
          ) : (
            <Profile size="12">
              <div className="h-full w-full flex justify-center items-center bg-white/50">
                <UsersThreeIcon className="size-7 text-white" weight="fill" />
              </div>
            </Profile>
          )}
        </div>
        <div className="col-span-3 flex flex-col justify-center items-start w-full">
          <p className="text-white truncate">{name}</p>
          <div className="flex justify-start items-center gap-1 w-full">
            {lastMessage && <MessageStatusIcon message={lastMessage} />}
            <p
              className={`text-sm ${
                chat.read || isSentFromUser
                  ? "text-white/55"
                  : "text-white font-semibold"
              } whitespace-nowrap truncate text-ellipsis overflow-hidden ${
                contact?.typing && lastMessage
                  ? "text-emerald-500 font-medium"
                  : ""
              }`}
            >
              {contact?.typing && lastMessage
                ? getMetaMessage(chat, lastMessage)
                : messagePreview}
            </p>
          </div>
        </div>
        <div className="col-span-2 flex flex-col justify-center items-end">
          {lastMessageTimestamp && (
            <p
              className={`text-xs font-semibold ${
                chat.read || isSentFromUser
                  ? "text-white/55"
                  : "text-emerald-400"
              }`}
            >
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
        <div className="w-full h-full flex justify-center items-center text-white/50">
          {t("chat.loading")}
        </div>
      );
    }

    return filtered.map(renderChat);
  };

  return (
    <section className="w-full h-full min-h-0 flex flex-col gap-3 p-4 relative">
      <section className="w-full flex justify-between items-center">
        <p className="text-white text-2xl font-semibold capitalize">
          {t(`navigation.${selectedTab}`)}
        </p>
        <TooltipWrapper showTooltip={false}>
          <DotsThreeVerticalIcon className="text-white size-6" weight="bold" />
        </TooltipWrapper>
      </section>
      <section className="w-full flex flex-col gap-1">
        <input
          className="rounded-full w-full p-2 px-4 outline-none bg-white/10 hover:ring-[1px] hover:ring-gray-600 focus:ring-2 focus:ring-green-500 ring-0 ring-transparent focus:bg-transparent placeholder-gray-400 focus:placeholder-gray-400 text-white"
          placeholder={t("chatList.searchPlaceholder")}
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
        />
        <div className="flex justify-start items-center text-white gap-2 mt-2">
          {Object.values(Filters).map((f: string) => (
            <button
              key={f}
              className={`${
                f === filter
                  ? "bg-green-700/30 text-green-100 border-green-600/30"
                  : "border-white/20 hover:bg-white/10"
              } text-sm p-1 px-3 border-[1px] rounded-full cursor-pointer capitalize`}
              onClick={() => updateFilter(f)}
            >
              {t(`chat.filters.${f}`)}
            </button>
          ))}
        </div>
      </section>
      <section className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
        {renderChats()}
      </section>
    </section>
  );
}
