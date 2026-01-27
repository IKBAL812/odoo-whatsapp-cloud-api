import { ArrowsClockwise } from "@phosphor-icons/react";
import { useTranslations } from "@/app/context/translation-provider";
import FormattedText from "./formatted-text";

type SuggestionChipsProps = {
  suggestions: string[];
  isLoading: boolean;
  onSelect: (suggestion: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
};

export default function SuggestionChips({
  suggestions,
  isLoading,
  onSelect,
  onRefresh,
  disabled = false,
}: SuggestionChipsProps) {
  const { t } = useTranslations();

  // Filter out "NO_RESPONSE" suggestions (fallback in case API didn't filter)
  const filteredSuggestions = suggestions.filter((s) => s !== "NO_RESPONSE");

  // Don't render if no suggestions and not loading
  if (!isLoading && filteredSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 mb-2">
      {isLoading ? (
        // Loading skeleton row
        <div
          className="w-full px-3 py-1.5 rounded-lg animate-pulse
            bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))]
            h-8"
        />
      ) : (
        // Suggestion rows
        <>
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(suggestion)}
              disabled={disabled}
              className="w-full px-3 py-1.5 rounded-lg text-left
                bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))]
                hover:bg-[rgb(var(--accent-hover)/var(--accent-hover-opacity))]
                text-[rgb(var(--text-primary))] text-sm
                border border-[rgb(var(--border-primary)/var(--border-primary-opacity))]
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                active:scale-[0.99]"
            >
              <FormattedText text={suggestion} />
            </button>
          ))}
        </>
      )}

      {/* Refresh button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled || isLoading}
        className="self-end p-1.5 rounded-full
          text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]
          hover:text-[rgb(var(--accent-primary))]
          hover:bg-[rgb(var(--accent-hover)/var(--accent-hover-opacity))]
          transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          active:scale-95"
        title={t("chatInput.refreshSuggestions")}
      >
        <ArrowsClockwise
          className={`size-4 ${isLoading ? "animate-spin" : ""}`}
          weight="bold"
        />
      </button>
    </div>
  );
}
