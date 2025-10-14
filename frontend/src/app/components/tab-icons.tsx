import Profile from "./profile";
import TooltipWrapper from "./tooltip-wrapper";
import { useTab } from "../hooks/use-tab";
import TabIcon from "./tab-icon";
import { useProfile } from "../hooks/use-profile";
import { GithubLogoIcon, SignOutIcon } from "@phosphor-icons/react";
import { useAuth } from "../hooks/use-auth";
import { useTranslations } from "../context/translation-provider";

export default function TabIcons() {
  const {
    profile: { avatarUrl },
  } = useProfile();
  const { selectedTab, selectTab, topTabs } = useTab();
  const { logout } = useAuth();
  const { t } = useTranslations();

  return (
    <section className="flex flex-col justify-between items-center w-full h-full min-h-0 bg-black/85 border-r-[1px] border-gray-300/20">
      <section className="flex flex-col justify-between items-center gap-2 py-4">
        {topTabs.map((tab: string) => (
          <TooltipWrapper
            key={tab}
            selected={selectedTab === tab}
            onClick={() => selectTab(tab)}
            tab={t(`navigation.${tab}`)}
          >
            <TabIcon tab={tab} />
          </TooltipWrapper>
        ))}
      </section>
      <section className="flex flex-col justify-between items-center gap-2 py-4">
        <hr className="px-4 w-full border-[1px] border-gray-500/65" />
        <TooltipWrapper tab={t("navigation.github")}>
          <a
            href="https://github.com/altinkaya-opensource/odoo-whatsapp-cloud-api"
            target="_blank"
            className="bg-gray-200 p-1 rounded-full"
          >
            <GithubLogoIcon className="size-5" weight="fill" />
          </a>
        </TooltipWrapper>
        <TooltipWrapper tab={t("navigation.logout")} onClick={logout}>
          <SignOutIcon className="size-5 text-white" weight="bold" />
        </TooltipWrapper>
        <TooltipWrapper
          selected={selectedTab === "settings"}
          onClick={() => selectTab("settings")}
          tab={t("navigation.settings")}
        >
          <TabIcon tab="settings" />
        </TooltipWrapper>
        <TooltipWrapper
          tab={t("navigation.profile")}
          onClick={() => selectTab("profile")}
        >
          <Profile url={avatarUrl} />
        </TooltipWrapper>
      </section>
    </section>
  );
}
