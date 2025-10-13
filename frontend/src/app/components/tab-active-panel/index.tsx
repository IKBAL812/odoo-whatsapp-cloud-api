import { useTab } from "@/app/hooks/use-tab";
import { GearSixIcon } from "@phosphor-icons/react";
import CurrentChat from "./current-chat";
import { useTranslations } from "@/app/context/translation-provider";
import LanguageSelector from "../language-selector";

export default function TabActivePanel() {
  const { selectedTab } = useTab();
  const { t } = useTranslations();

  if (selectedTab === "chats") {
    return (
      <section className="col-span-6 md:col-span-16 h-full min-h-0 w-full bg-black/90">
        <CurrentChat />
      </section>
    );
  }

  return (
    <section className="col-span-16 h-full min-h-0 w-full bg-black/90 flex flex-col justify-center items-center gap-4 px-6">
      <GearSixIcon className="size-10 text-gray-400" />
      <p className="text-white text-3xl capitalize">
        {t(`navigation.${selectedTab}`)}
      </p>
      <LanguageSelector />
    </section>
  );
}
