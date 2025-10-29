import { useTab } from "@/app/hooks/use-tab";
import Chats from "./chats";
import { useTranslations } from "@/app/context/translation-provider";
import LanguageSelector from "../language-selector";

export default function TabPanelSwitcher() {
  const { selectedTab } = useTab();
  const { t } = useTranslations();

  if (selectedTab === "chats") {
    return <Chats selectedTab={selectedTab} />;
  }

  if (selectedTab === "profile") {
    return (
      <section className="w-full h-full min-h-0 flex flex-col gap-3 p-4">
        <section className="w-full flex justify-between items-center">
          <p className="text-[rgb(var(--text-primary))] text-2xl font-semibold capitalize">
            {t("navigation.profile")}
          </p>
        </section>
        <section className="w-full flex flex-col gap-4">
          <LanguageSelector />
        </section>
      </section>
    );
  }

  return (
    <div className="text-[rgb(var(--text-primary))]">
      {t("common.comingSoon")}
    </div>
  );
}
