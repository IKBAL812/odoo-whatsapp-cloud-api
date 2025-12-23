import { NextRequest, NextResponse } from "next/server";
import {
  isAIEnabled,
  isRagEnabled,
  getRagChatUrl,
} from "@/app/lib/ai/openai-client";
import { ragSuggestionCache } from "@/app/lib/rag-suggestion-cache";
import { Message } from "@/app/context/chats-provider";

// Predefined suggestion styles
const DEFAULT_STYLES = ["Aşırı kısa ve açıklayıcı", "Profesyonel ve teknik"];

type RagSuggestionsRequest = {
  threadId: string;
  lastMessageId: string;
  messages: Message[];
  contactName?: string;
  userName?: string;
  styles?: string[];
  forceRefresh?: boolean;
};

type RagApiResponse = {
  response: string;
};

/**
 * GET /api/ai/rag-suggestions?threadId=X&lastMessageId=Y
 * Returns cached suggestions if available
 */
export async function GET(request: NextRequest) {
  try {
    // Check if AI/RAG features are enabled
    if (!isAIEnabled() || !isRagEnabled()) {
      return NextResponse.json(
        { error: "AI/RAG feature is not enabled" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    const lastMessageId = searchParams.get("lastMessageId");

    if (!threadId || !lastMessageId) {
      return NextResponse.json(
        { error: "threadId and lastMessageId are required" },
        { status: 400 }
      );
    }

    // Check cache
    const cached = ragSuggestionCache.get(threadId, lastMessageId);

    if (cached && cached.length > 0) {
      // Cache hit
      return NextResponse.json({
        suggestions: cached,
        cached: true,
        cacheKey: `${threadId}:${lastMessageId}`,
      });
    }

    // Cache miss
    return NextResponse.json({
      suggestions: [],
      cached: false,
      cacheKey: `${threadId}:${lastMessageId}`,
    });
  } catch (error) {
    console.error("RAG suggestions GET error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to get suggestions: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/rag-suggestions
 * Generates new suggestions and caches them
 */
export async function POST(request: NextRequest) {
  try {
    // Check if AI/RAG features are enabled
    if (!isAIEnabled() || !isRagEnabled()) {
      return NextResponse.json(
        { error: "AI/RAG feature is not enabled" },
        { status: 403 }
      );
    }

    // Parse request body
    const body: RagSuggestionsRequest = await request.json();
    const {
      threadId,
      lastMessageId,
      messages,
      contactName,
      userName,
      styles = DEFAULT_STYLES,
      forceRefresh = false,
    } = body;

    // Validate required fields
    if (!threadId || !lastMessageId) {
      return NextResponse.json(
        { error: "threadId and lastMessageId are required" },
        { status: 400 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No conversation context available" },
        { status: 400 }
      );
    }

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = ragSuggestionCache.get(threadId, lastMessageId);
      if (cached && cached.length >= styles.length) {
        // Cache hit with sufficient suggestions
        return NextResponse.json({
          suggestions: cached,
          cached: true,
          cacheKey: `${threadId}:${lastMessageId}`,
        });
      }
    } else {
      // Force refresh - invalidate existing cache
      ragSuggestionCache.invalidate(threadId, lastMessageId);
    }

    // Format messages for RAG endpoint
    const formattedMessages = messages
      .map((msg) => {
        if (msg.isSentFromUser) {
          const senderName = userName || "Support Agent";
          return `${senderName}(customer support): ${msg.message}`;
        } else {
          const customerName = contactName || "Customer";
          return `${customerName}: ${msg.message}`;
        }
      })
      .join("\n");

    const ragUrl = getRagChatUrl();
    if (!ragUrl) {
      return NextResponse.json(
        { error: "RAG URL is not configured" },
        { status: 500 }
      );
    }

    // Generate suggestions for all styles in parallel
    const promises = styles.map(async (style) => {
      try {
        const response = await fetch(ragUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: formattedMessages,
            style,
          }),
        });

        if (!response.ok) {
          console.error(`RAG API error for style "${style}":`, response.status);
          return null;
        }

        const data: RagApiResponse = await response.json();
        return data.response || null;
      } catch (error) {
        console.error(`RAG generation failed for style "${style}":`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const suggestions = results.filter(
      (r): r is string => r !== null && r.length > 0
    );

    // Cache the results
    if (suggestions.length > 0) {
      ragSuggestionCache.set(threadId, lastMessageId, suggestions);
    }

    return NextResponse.json({
      suggestions,
      cached: false,
      cacheKey: `${threadId}:${lastMessageId}`,
    });
  } catch (error) {
    console.error("RAG suggestions POST error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to generate suggestions: ${errorMessage}` },
      { status: 500 }
    );
  }
}
