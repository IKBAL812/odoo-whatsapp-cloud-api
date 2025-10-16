import { Contact } from "@/app/context/contacts-provider";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import { useProfile } from "@/app/hooks/use-profile";
import Profile from "../profile";
import {
  UsersThreeIcon,
  ArrowLeftIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "@/app/context/translation-provider";
import { useMobileNavigation } from "@/app/context/mobile-navigation-provider";
import { useResponsive } from "@/app/hooks/use-responsive";

export default function ContactHeader() {
  const {
    profile: { id },
  } = useProfile();
  const { contact, group, threadName } = useCurrentChat();
  const { t } = useTranslations();
  const { showChatList } = useMobileNavigation();
  const { isMobile } = useResponsive();

  const renderContactStatus = () => {
    if (!contact) {
      return null;
    }
    return (
      <p className="text-xs text-white/50">
        {contact?.typing ? t("chat.statusTyping") : t("chat.statusOnline")}
      </p>
    );
  };

  const renderChatOptions = () => {
    return null;
  };

  if (group) {
    const renderGroupContactNames = (): string => {
      return Object.values(group.contacts)
        .map((groupContact?: Contact) =>
          groupContact?.id === id
            ? t("common.you")
            : groupContact?.displayName
        )
        .join(", ");
    };

    return (
      <div className="h-auto w-full flex gap-4 justify-between items-center p-3 px-4">
        <div className="flex gap-4 justify-start items-center">
          {isMobile && (
            <button
              onClick={showChatList}
              className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors"
              aria-label="Back to chat list"
            >
              <ArrowLeftIcon className="size-6 text-white" weight="bold" />
            </button>
          )}
          <Profile size="10">
            <div className="h-full w-full flex justify-center items-center bg-white/50">
              <UsersThreeIcon className="size-6 text-white" weight="fill" />
            </div>
          </Profile>
          <div className="flex flex-col">
            <p className="text-white">{group.name}</p>
            <p className="text-white/50 text-xs">{renderGroupContactNames()}</p>
          </div>
        </div>
        <div>{renderChatOptions()}</div>
      </div>
    );
  }
  return (
    <div className="w-full h-fit bg-black z-50">
      <div className="flex gap-4 h-full w-full bg-white/10 justify-between items-center p-3 px-4">
        <div className="flex gap-4 justify-start items-center">
          {isMobile && (
            <button
              onClick={showChatList}
              className="p-2 hover:bg-white/10 rounded-lg active:bg-white/20 transition-colors"
              aria-label="Back to chat list"
            >
              <ArrowLeftIcon className="size-6 text-white" weight="bold" />
            </button>
          )}
          <Profile size="10" url={contact?.contactAvatar} />
          <div className="flex flex-col">
            <p className="text-white">
              {contact?.displayName ?? threadName ?? t("chatList.title")}
            </p>
            {renderContactStatus()}
          </div>
        </div>
        <div>{renderChatOptions()}</div>
      </div>
    </div>
  );
}
