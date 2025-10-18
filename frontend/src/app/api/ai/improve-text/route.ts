import { NextRequest, NextResponse } from "next/server";
import {
  createOpenAIClient,
  isAIEnabled,
  getOpenAIModel,
} from "@/app/lib/ai/openai-client";
import { Message } from "@/app/context/chats-provider";

type ImproveTextRequest = {
  messages: Message[];
  currentText: string;
  systemPrompt?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Check if AI feature is enabled
    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: "AI feature is not enabled" },
        { status: 403 }
      );
    }

    // Parse request body
    const body: ImproveTextRequest = await request.json();
    const { messages, currentText, systemPrompt } = body;

    // Validate that there are messages to work with
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No conversation context available" },
        { status: 400 }
      );
    }

    // Create OpenAI client
    const openai = createOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI client configuration is missing" },
        { status: 500 }
      );
    }

    // Prepare conversation context (last 10 messages)
    const last10Messages = messages.slice(-10);
    const conversationContext = last10Messages
      .map((msg) => {
        const sender = msg.isSentFromUser ? "User" : "Contact";
        return `${sender}: ${msg.message}`;
      })
      .join("\n");

    // Determine if we're improving existing text or generating a new message
    const hasCurrentText = currentText && currentText.trim().length > 0;

    // Default system prompt if not provided
    const defaultSystemPrompt = hasCurrentText
      ? `You are a helpful assistant that improves text messages for clarity, grammar, and professionalism while maintaining the original intent and tone. The user will provide you with:
1. Recent conversation context (last 10 messages)
2. A draft message they want to improve

Your task is to:
- Fix any grammar, spelling, or punctuation errors
- Improve clarity and readability
- Maintain the original tone and intent
- Keep the message as simple and short as possible
- Keep the message concise and natural
- Return ONLY the improved message text, nothing else`
      : `You are a helpful assistant that generates contextual message replies based on conversation history. The user will provide you with recent conversation context (last 10 messages).

Your task is to:
- Analyze the conversation flow and context
- Generate a natural, appropriate response that continues the conversation
- Match the tone and style of the user's previous messages
- Keep the message concise and conversational
- Return ONLY the generated message text, nothing else`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // Prepare user prompt
    const userPrompt = hasCurrentText
      ? `Here is the recent conversation context:

${conversationContext}

Please improve the following message:
${currentText}`
      : `Here is the recent conversation context:

${conversationContext}

Please generate an appropriate response message based on this conversation.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        {
          role: "system",
          content: finalSystemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const improvedText = completion.choices[0]?.message?.content?.trim();

    if (!improvedText) {
      return NextResponse.json(
        { error: "Failed to generate improved text" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      improvedText,
      usage: completion.usage,
    });
  } catch (error) {
    console.error("AI improve text error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to improve text: ${errorMessage}` },
      { status: 500 }
    );
  }
}
