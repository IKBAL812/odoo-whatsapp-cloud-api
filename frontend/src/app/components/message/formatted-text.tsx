import { formatMessage } from "@/app/utils/format-message";

type FormattedTextProps = {
  text: string;
};

/**
 * Renders text with WhatsApp-style formatting.
 * Supports: *bold*, _italic_, ~strikethrough~, `monospace`, [text](url), and newlines.
 */
export default function FormattedText({ text }: FormattedTextProps) {
  if (!text) return null;

  return <>{formatMessage(text)}</>;
}
