import { Contact } from "@/app/context/contacts-provider";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import { useProfile } from "@/app/hooks/use-profile";
import Profile from "../profile";
import {
  UsersThreeIcon,
  ArrowLeftIcon,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { useTranslations } from "@/app/context/translation-provider";
import { useMobileNavigation } from "@/app/context/mobile-navigation-provider";
import { useResponsive } from "@/app/hooks/use-responsive";
import { useState, useEffect } from "react";

export default function ContactHeader() {
  const {
    profile: { id },
  } = useProfile();
  const { contact, group, threadName, partnerId, partnerName } =
    useCurrentChat();
  const { t } = useTranslations();
  const { showChatList } = useMobileNavigation();
  const { isMobile } = useResponsive();
  const [odooBaseUrl, setOdooBaseUrl] = useState<string | null>(null);

  // Fetch Odoo base URL
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.odooBaseUrl) {
          setOdooBaseUrl(data.odooBaseUrl);
        }
      })
      .catch(() => {
        // Failed to fetch Odoo config
      });
  }, []);

  const renderContactStatus = () => {
    if (!contact) {
      return null;
    }
    return (
      <p className="text-xs text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
        {contact?.typing ? t("chat.statusTyping") : t("chat.statusOnline")}
      </p>
    );
  };

  const renderChatOptions = () => {
    // Only show the button if we have partnerId and odooBaseUrl
    if (!partnerId || !odooBaseUrl) {
      return null;
    }

    const partnerUrl = `${odooBaseUrl}/web#id=${partnerId}&model=res.partner&view_type=form`;

    return (
      <a
        href={partnerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 bg-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--status-success))] rounded-lg transition-colors text-white text-sm font-medium shadow-sm"
        title={t("chat.openInOdooTitle")}
      >
        <span>{t("chat.openInOdoo")}</span>
        <ArrowSquareOut className="size-5" weight="bold" />
      </a>
    );
  };

  if (group) {
    const renderGroupContactNames = (): string => {
      return Object.values(group.contacts)
        .map((groupContact?: Contact) =>
          groupContact?.id === id ? t("common.you") : groupContact?.displayName
        )
        .join(", ");
    };

    return (
      <div className="h-auto w-full flex gap-4 justify-between items-center p-3 px-4">
        <div className="flex gap-4 justify-start items-center">
          {isMobile && (
            <button
              onClick={showChatList}
              className="p-2 hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg active:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] transition-colors"
              aria-label="Back to chat list"
            >
              <ArrowLeftIcon
                className="size-6 text-[rgb(var(--text-primary))]"
                weight="bold"
              />
            </button>
          )}
          <Profile size="10">
            <div className="h-full w-full flex justify-center items-center bg-[rgb(var(--bg-secondary)/0.5)]">
              <UsersThreeIcon
                className="size-6 text-[rgb(var(--text-primary))]"
                weight="fill"
              />
            </div>
          </Profile>
          <div className="flex flex-col">
            <p className="text-[rgb(var(--text-primary))]">{group.name}</p>
            <p className="text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] text-xs">
              {renderGroupContactNames()}
            </p>
          </div>
        </div>
        <div>{renderChatOptions()}</div>
      </div>
    );
  }
  return (
    <div className="w-full h-fit bg-[rgb(var(--bg-primary))] z-50">
      <div className="flex gap-4 h-full w-full bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] justify-between items-center p-3 px-4">
        <div className="flex gap-4 justify-start items-center">
          {isMobile && (
            <button
              onClick={showChatList}
              className="p-2 hover:bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg active:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] transition-colors"
              aria-label="Back to chat list"
            >
              <ArrowLeftIcon
                className="size-6 text-[rgb(var(--text-primary))]"
                weight="bold"
              />
            </button>
          )}
          <Profile size="10" url={contact?.contactAvatar} />
          <div className="flex flex-col">
            <p className="text-[rgb(var(--text-primary))]">
              {partnerName ??
                contact?.displayName ??
                threadName ??
                t("chatList.title")}
            </p>
            {renderContactStatus()}
          </div>
        </div>
        <div>{renderChatOptions()}</div>
      </div>
    </div>
  );
}
