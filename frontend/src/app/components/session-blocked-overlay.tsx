"use client";

import { useTranslations } from "@/app/context/translation-provider";
import { ComputerTower } from "@phosphor-icons/react";

export default function SessionBlockedOverlay() {
  const { t } = useTranslations();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      <div className="flex max-w-md flex-col items-center gap-6 px-8 text-center">
        {/* Icon */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
          <ComputerTower size={48} weight="fill" className="text-white/70" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-white">
          {t("sessionSync.blocked.title")}
        </h1>

        {/* Message */}
        <p className="text-base leading-relaxed text-white/70">
          {t("sessionSync.blocked.message")}
        </p>

        {/* Footer hint */}
        <p className="text-sm text-white/50">
          {t("sessionSync.blocked.footer")}
        </p>
      </div>
    </div>
  );
}
