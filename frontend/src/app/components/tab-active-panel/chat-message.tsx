import { Message } from "@/app/context/chats-provider";
import MessageStatusIcon from "../message-status-icon";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import Profile from "../profile";
import { useContacts } from "@/app/hooks/use-contacts";
import { formatTime } from "@/app/utils";
import { useAuth } from "@/app/hooks/use-auth";
import { useTranslations } from "@/app/context/translation-provider";
import AttachmentDisplay from "../message/attachment";

const getRandomContactColor = (): string => {
  const colors = [
    "text-pink-400",
    "text-sky-300",
    "text-teal-300",
    "text-amber-300",
    "text-green-300",
  ];
  const max = Math.floor(colors.length - 1);
  const min = Math.ceil(0);
  const random = Math.floor(Math.random() * (max - min + 1)) + min;
  return colors[random];
};

type ChatMessageProps = {
  message: Message;
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const { getContact } = useContacts();
  const { group } = useCurrentChat();
  const { backendUsersById, backendUserId } = useAuth();
  const { t, locale } = useTranslations();

  const senderUser = message.isSentFromUser
    ? backendUsersById[message.userId ?? backendUserId ?? -1]
    : undefined;
  const outgoingAvatar = senderUser?.imageUrl ?? null;

  const renderReplyPreview = () => {
    if (!message.replyTo) {
      return null;
    }
    const name = message.replyTo.senderIsUser
      ? t("common.you")
      : getContact(message.replyTo.contactId)?.displayName ?? t("common.you");
    return (
      <div className="bg-black/40 border-l-2 border-emerald-500 px-2 py-1 rounded text-white/70 text-xs w-full mb-1">
        <p className="font-semibold truncate">{name}</p>
        <p className="truncate">{message.replyTo.message}</p>
      </div>
    );
  };

  if (group) {
    const contact = getContact(message.contactId);
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2 w-max">
          {!message.isSentFromUser && (
            <Profile url={contact?.contactAvatar} alt={contact?.displayName} />
          )}
          <div className="group rounded-lg overflow-hidden bg-black z-20 relative">
            <div
              className={`flex flex-col justify-center items-start px-2 p-1.5 gap-1 ${
                message.isSentFromUser ? "bg-emerald-900" : "bg-white/20"
              }`}
            >
              {!message.isSentFromUser && (
                <p className={`text-xs font-semibold ${getRandomContactColor()}`}>
                  {contact?.displayName ?? message.contactId}
                </p>
              )}
              {renderReplyPreview()}
              {message.attachment && (
                <div className="mb-2">
                  <AttachmentDisplay
                    attachment={message.attachment}
                    messageId={message.id}
                  />
                </div>
              )}
              {message.message && (
                <div className="flex justify-between items-end gap-2">
                  <p className="text-white text-sm">{message.message}</p>
                  <p className="text-white/80 text-xs">
                    {formatTime(message.timestamp, locale)}
                  </p>
                  {message.isSentFromUser && (
                    <MessageStatusIcon message={message} isInMessage />
                  )}
                </div>
              )}
              {!message.message && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white/80 text-xs">
                    {formatTime(message.timestamp, locale)}
                  </p>
                  {message.isSentFromUser && (
                    <MessageStatusIcon message={message} isInMessage />
                  )}
                </div>
              )}
            </div>
          </div>
          {message.isSentFromUser && outgoingAvatar && (
            <Profile url={outgoingAvatar ?? undefined} />
          )}
        </div>
        {message.error && (
          <p
            className={`text-xs text-red-400 px-2 ${
              message.isSentFromUser ? "text-right self-end" : "text-left"
            }`}
          >
            {message.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex ${
          message.isSentFromUser ? "justify-end" : "justify-start"
        } items-end gap-2`}
      >
        <div className="group rounded-lg bg-black z-10 overflow-hidden w-max relative">
          <div
            className={`flex flex-col justify-between items-end px-2 p-1.5 gap-2 ${
              message.isSentFromUser ? "bg-emerald-900" : "bg-white/20"
            }`}
          >
            {renderReplyPreview()}
            {message.attachment && (
              <div className="mb-2">
                <AttachmentDisplay
                  attachment={message.attachment}
                  messageId={message.id}
                />
              </div>
            )}
            {message.message && (
              <div className="flex items-end gap-2">
                <p className="text-white text-sm max-w-xs break-words">
                  {message.message}
                </p>
                <p className="text-white/80 text-xs">
                  {formatTime(message.timestamp, locale)}
                </p>
                {message.isSentFromUser && (
                  <MessageStatusIcon message={message} isInMessage />
                )}
              </div>
            )}
            {!message.message && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-white/80 text-xs">
                  {formatTime(message.timestamp, locale)}
                </p>
                {message.isSentFromUser && (
                  <MessageStatusIcon message={message} isInMessage />
                )}
              </div>
            )}
          </div>
        </div>
        {message.isSentFromUser && outgoingAvatar && (
          <Profile url={outgoingAvatar ?? undefined} />
        )}
      </div>
      {message.error && (
        <p
          className={`text-xs text-red-400 px-2 ${
            message.isSentFromUser ? "text-right self-end" : "text-left"
          }`}
        >
          {message.error}
        </p>
      )}
    </div>
  );
}
