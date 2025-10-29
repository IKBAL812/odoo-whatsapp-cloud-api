import { useTab } from "@/app/hooks/use-tab";
import { GearSixIcon } from "@phosphor-icons/react";
import CurrentChat from "./current-chat";
import { useTranslations } from "@/app/context/translation-provider";

export default function TabActivePanel() {
  const { selectedTab } = useTab();
  const { t } = useTranslations();

  if (selectedTab === "chats") {
    return (
      <section className="col-span-6 md:col-span-16 h-full min-h-0 w-full bg-[rgb(var(--bg-primary)/0.9)]">
        <CurrentChat />
      </section>
    );
  }

  return (
    <section className="col-span-16 h-full min-h-0 w-full bg-[rgb(var(--bg-primary)/0.9)] flex flex-col justify-center items-center gap-4 px-6">
      <GearSixIcon className="size-10 text-[rgb(var(--text-secondary))]" />
      <p className="text-[rgb(var(--text-primary))] text-3xl capitalize">
        {t(`navigation.${selectedTab}`)}
      </p>
    </section>
  );
}
