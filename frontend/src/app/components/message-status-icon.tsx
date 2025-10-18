import {
  CheckIcon,
  ChecksIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Message } from "../context/chats-provider";
import { useProfile } from "../hooks/use-profile";

export default function MessageStatusIcon({
  message,
  isInMessage,
}: {
  message: Message;
  isInMessage?: boolean;
}) {
  const {
    profile: { blueTickEnabled },
  } = useProfile();
  const size = isInMessage ? "size-4" : "size-5";

  if (!message.isSentFromUser) {
    return null;
  } else {
    if (message.read) {
      if (blueTickEnabled) {
        return (
          <ChecksIcon className={`${size} text-[rgb(var(--status-info))]`} />
        );
      }
      return (
        <ChecksIcon
          className={`${size} text-[rgb(var(--text-message-time)/var(--text-message-time-opacity))]`}
        />
      );
    } else if (message.delivered) {
      return (
        <ChecksIcon
          className={`${size} text-[rgb(var(--text-message-time)/var(--text-message-time-opacity))]`}
        />
      );
    } else if (message.sent) {
      return (
        <CheckIcon className="size-4 text-[rgb(var(--text-message-time)/var(--text-message-time-opacity))]" />
      );
    }
    return (
      <WarningCircleIcon
        className={`${size} text-[rgb(var(--text-message-time)/var(--text-message-time-opacity))]`}
      />
    );
  }
}
