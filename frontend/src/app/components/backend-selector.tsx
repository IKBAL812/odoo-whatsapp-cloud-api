"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/app/hooks/use-auth";
import { useChats } from "@/app/hooks/use-chats";
import { useTranslations } from "@/app/context/translation-provider";
import { CaretDown, Check } from "@phosphor-icons/react";

export default function BackendSelector() {
  const { backendIds, backendNames } = useAuth();
  const { selectedBackendId, setSelectedBackendId } = useChats();
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSelect = (backendId: number | null) => {
    setSelectedBackendId(backendId);
    setIsOpen(false);
  };

  const getDisplayName = () => {
    if (selectedBackendId === null) {
      return t("chat.backendSelector.allBackends");
    }
    return backendNames[selectedBackendId] ?? `Backend ${selectedBackendId}`;
  };

  // Only show selector if user has more than 1 backend
  if (backendIds.length <= 1) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-2 px-4" ref={dropdownRef}>
      <label className="text-xs text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] font-medium uppercase">
        {t("chat.backendSelector.selectBackend")}
      </label>

      <div className="relative">
        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2.5 bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] rounded-lg text-[rgb(var(--text-primary))] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-primary)/0.5)] focus:border-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--accent-hover)/var(--accent-hover-opacity))] transition-all cursor-pointer flex items-center justify-between"
        >
          <span>{getDisplayName()}</span>
          <CaretDown
            className={`size-4 text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            weight="bold"
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar backdrop-blur-sm">
            {/* All Backends Option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2.5 text-left text-sm text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--accent-hover)/var(--accent-hover-opacity))] transition-colors flex items-center justify-between"
            >
              <span>{t("chat.backendSelector.allBackends")}</span>
              {selectedBackendId === null && (
                <Check
                  className="size-4 text-[rgb(var(--accent-primary))]"
                  weight="bold"
                />
              )}
            </button>

            {/* Individual Backend Options */}
            {backendIds.map((backendId) => {
              const displayName =
                backendNames[backendId] ?? `Backend ${backendId}`;
              const isSelected = selectedBackendId === backendId;

              return (
                <button
                  key={backendId}
                  type="button"
                  onClick={() => handleSelect(backendId)}
                  className="w-full px-3 py-2.5 text-left text-sm text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--accent-hover)/var(--accent-hover-opacity))] transition-colors flex items-center justify-between"
                >
                  <span>{displayName}</span>
                  {isSelected && (
                    <Check
                      className="size-4 text-[rgb(var(--accent-primary))]"
                      weight="bold"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
