import OpenAI from "openai";

/**
 * Creates and returns an OpenAI client instance with configuration from environment variables
 */
export function createOpenAIClient(): OpenAI | null {
  const baseURL = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseURL || !apiKey) {
    console.warn(
      "OpenAI configuration missing: OPENAI_BASE_URL or OPENAI_API_KEY not set"
    );
    return null;
  }

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

/**
 * Checks if AI chat improvement feature is enabled
 */
export function isAIEnabled(): boolean {
  return process.env.AI_CHAT_ENABLED === "true";
}

/**
 * Gets the configured OpenAI model name
 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "openai/gpt-4o";
}

/**
 * Gets the configured RAG-supported chat URL
 */
export function getRagChatUrl(): string | null {
  return process.env.RAG_SUPPORTED_CHAT_URL || null;
}

/**
 * Checks if RAG-based AI response generation is enabled
 */
export function isRagEnabled(): boolean {
  const url = getRagChatUrl();
  return !!url && url.trim().length > 0;
}
