import Profile from "./profile";
import TooltipWrapper from "./tooltip-wrapper";
import { useTab } from "../hooks/use-tab";
import TabIcon from "./tab-icon";
import { useProfile } from "../hooks/use-profile";
import { GithubLogoIcon, SignOutIcon } from "@phosphor-icons/react";
import { useAuth } from "../hooks/use-auth";
import { useTranslations } from "../context/translation-provider";
import { useResponsive } from "../hooks/use-responsive";

export default function TabIcons() {
  const {
    profile: { avatarUrl },
  } = useProfile();
  const { selectedTab, selectTab, topTabs } = useTab();
  const { logout } = useAuth();
  const { t } = useTranslations();
  const { isMobile } = useResponsive();

  // Mobile: Bottom navigation bar
  if (isMobile) {
    return (
      <section className="w-full bg-black/95 border-t-[1px] border-gray-300/20 safe-area-bottom">
        <nav className="flex justify-around items-center px-2 py-3">
          {topTabs.map((tab: string) => (
            <button
              key={tab}
              onClick={() => selectTab(tab)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${
                selectedTab === tab ? "text-emerald-400" : "text-white/70"
              }`}
              aria-label={t(`navigation.${tab}`)}
            >
              <TabIcon tab={tab} />
              <span className="text-xs capitalize">{t(`navigation.${tab}`)}</span>
            </button>
          ))}
          <button
            onClick={() => selectTab("profile")}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${
              selectedTab === "profile" ? "text-emerald-400" : "text-white/70"
            }`}
            aria-label={t("navigation.profile")}
          >
            <Profile url={avatarUrl} size="6" />
            <span className="text-xs capitalize">{t("navigation.profile")}</span>
          </button>
        </nav>
      </section>
    );
  }

  // Desktop/Tablet: Sidebar navigation
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
          tab={t("navigation.profile")}
          onClick={() => selectTab("profile")}
        >
          <Profile url={avatarUrl} />
        </TooltipWrapper>
      </section>
    </section>
  );
}
