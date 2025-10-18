import Profile from "./profile";
import TooltipWrapper from "./tooltip-wrapper";
import { useTab } from "../hooks/use-tab";
import TabIcon from "./tab-icon";
import { useProfile } from "../hooks/use-profile";
import {
  GithubLogoIcon,
  SignOutIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useAuth } from "../hooks/use-auth";
import { useTranslations } from "../context/translation-provider";
import { useResponsive } from "../hooks/use-responsive";
import { useTheme } from "../hooks/use-theme";

export default function TabIcons() {
  const {
    profile: { avatarUrl, id },
  } = useProfile();
  const { selectedTab, selectTab, topTabs } = useTab();
  const { logout } = useAuth();
  const { t } = useTranslations();
  const { isMobile } = useResponsive();
  const { theme, toggleTheme } = useTheme();

  // Mobile: Bottom navigation bar
  if (isMobile) {
    return (
      <section className="w-full bg-[rgb(var(--bg-mobile-nav)/var(--bg-mobile-nav-opacity))] border-t-[1px] border-[rgb(var(--border-primary)/var(--border-primary-opacity))] safe-area-bottom">
        <nav className="flex justify-around items-center px-2 py-3">
          {topTabs.map((tab: string) => (
            <button
              key={tab}
              onClick={() => selectTab(tab)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${
                selectedTab === tab
                  ? "text-[rgb(var(--accent-active))]"
                  : "text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]"
              }`}
              aria-label={t(`navigation.${tab}`)}
            >
              <TabIcon tab={tab} />
              <span className="text-xs capitalize">
                {t(`navigation.${tab}`)}
              </span>
            </button>
          ))}
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]"
            aria-label={t(
              theme === "dark"
                ? "navigation.lightTheme"
                : "navigation.darkTheme"
            )}
          >
            {theme === "dark" ? (
              <SunIcon className="size-6" weight="bold" />
            ) : (
              <MoonIcon className="size-6" weight="bold" />
            )}
            <span className="text-xs capitalize">
              {
                t(
                  theme === "dark"
                    ? "navigation.lightTheme"
                    : "navigation.darkTheme"
                ).split(" ")[0]
              }
            </span>
          </button>
          <button
            onClick={() => selectTab("profile")}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${
              selectedTab === "profile"
                ? "text-[rgb(var(--accent-active))]"
                : "text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]"
            }`}
            aria-label={t("navigation.profile")}
          >
            <Profile url={avatarUrl} size="6" seed={id ? parseInt(id, 10) : undefined} />
            <span className="text-xs capitalize">
              {t("navigation.profile")}
            </span>
          </button>
        </nav>
      </section>
    );
  }

  // Desktop/Tablet: Sidebar navigation
  return (
    <section className="flex flex-col justify-between items-center w-full h-full min-h-0 bg-[rgb(var(--bg-sidebar)/var(--bg-sidebar-opacity))] border-r-[1px] border-[rgb(var(--border-primary)/var(--border-primary-opacity))]">
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
        <hr className="px-4 w-full border-[1px] border-[rgb(var(--border-secondary)/var(--border-secondary-opacity))]" />
        <TooltipWrapper
          tab={t(
            theme === "dark" ? "navigation.lightTheme" : "navigation.darkTheme"
          )}
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <SunIcon
              className="size-5 text-[rgb(var(--text-primary))]"
              weight="bold"
            />
          ) : (
            <MoonIcon
              className="size-5 text-[rgb(var(--text-primary))]"
              weight="bold"
            />
          )}
        </TooltipWrapper>
        <TooltipWrapper tab={t("navigation.github")}>
          <a
            href="https://github.com/altinkaya-opensource/odoo-whatsapp-cloud-api"
            target="_blank"
            className="bg-[rgb(var(--bg-secondary))] p-1 rounded-full"
          >
            <GithubLogoIcon className="size-5" weight="fill" />
          </a>
        </TooltipWrapper>
        <TooltipWrapper tab={t("navigation.logout")} onClick={logout}>
          <SignOutIcon
            className="size-5 text-[rgb(var(--text-primary))]"
            weight="bold"
          />
        </TooltipWrapper>
        <TooltipWrapper
          tab={t("navigation.profile")}
          onClick={() => selectTab("profile")}
        >
          <Profile url={avatarUrl} seed={id ? parseInt(id, 10) : undefined} />
        </TooltipWrapper>
      </section>
    </section>
  );
}
