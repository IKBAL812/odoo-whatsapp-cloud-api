import { useTab } from "@/app/hooks/use-tab";
import Chats from "./chats";
import { useTranslations } from "@/app/context/translation-provider";

export default function TabPanelSwitcher() {
  const { selectedTab } = useTab();
  const { t } = useTranslations();

  if (selectedTab === "chats") {
    return <Chats selectedTab={selectedTab} />;
  }

  return <div className="text-white">{t("common.comingSoon")}</div>;
}
