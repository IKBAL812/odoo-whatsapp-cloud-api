import { Contact } from "@/app/context/contacts-provider";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import { useProfile } from "@/app/hooks/use-profile";
import Profile from "../profile";
import {
  CaretDownIcon,
  MagnifyingGlassIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import TooltipWrapper from "../tooltip-wrapper";
import { useTranslations } from "@/app/context/translation-provider";

export default function ContactHeader() {
  const {
    profile: { id },
  } = useProfile();
  const { contact, group, threadName } = useCurrentChat();
  const { t } = useTranslations();

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
