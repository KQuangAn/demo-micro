import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { getModel } from "@/lib/model-cache";
import { processRAGRequest } from "@/lib/rag-helpers";
import { processAgentRequest } from "@/lib/agent-helpers";
import {
  storeChatMessage,
  generateSessionId,
  type ChatMessage,
} from "@/lib/chat-history";

// Zod schemas for type safety
const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  model: z.string().optional(),
  sessionId: z.string().optional(),
});

const ChatResponseSchema = z.object({
  message: z.string(),
  source: z.enum(["RAG", "Agent", "RAG+Weather"]),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

// TypeScript types inferred from Zod schemas
type Message = z.infer<typeof MessageSchema>;
type ChatResponse = z.infer<typeof ChatResponseSchema>;
type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Validate and parse the incoming request
 */
function validateRequest(body: unknown): {
  success: true;
  data: z.infer<typeof ChatRequestSchema>;
} | { success: false; error: ErrorResponse } {
  const parsedRequest = ChatRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return {
      success: false,
      error: {
        error: `Invalid request: ${parsedRequest.error.issues
          .map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ")}`,
      },
    };
  }

  return { success: true, data: parsedRequest.data };
}

/**
 * Extract the last user message from messages array
 */
function getLastUserMessage(messages: Message[]): string {
  return (
    messages.filter((msg: Message) => msg.role === "user").pop()?.content || ""
  );
}

/**
 * Store chat messages in vector database
 * Only stores the last user message and assistant response to avoid duplicates
 */
async function storeMessages(
  messages: Message[],
  assistantResponse: string,
  sessionId: string
): Promise<void> {
  try {
    // Get the last user message
    const lastUserMessage = messages
      .filter((msg) => msg.role === "user")
      .pop();

    if (!lastUserMessage) {
      return; // No user message to store
    }

    // Store last user message
    await storeChatMessage(
      {
        role: "user",
        content: lastUserMessage.content,
        timestamp: Date.now() - 1000, // Slightly earlier timestamp
        sessionId,
      },
      sessionId
    );

    // Store assistant response
    await storeChatMessage(
      {
        role: "assistant",
        content: assistantResponse,
        timestamp: Date.now(),
        sessionId,
      },
      sessionId
    );
  } catch (error) {
    console.error("Error storing chat messages:", error);
    // Don't throw - storage failure shouldn't break the chat
  }
}

/**
 * Handle RAG mode request
 */
async function handleRAGRequest(
  userMessage: string,
  model: ReturnType<typeof getModel>,
  sessionId: string,
  modelName: string
): Promise<ChatResponse> {
  const result = await processRAGRequest(userMessage, model, sessionId, modelName);
  return {
    message: result.message,
    source: result.source,
  };
}
/**
 * Main POST handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateRequest(body);

    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    const { messages, model: modelName, sessionId: providedSessionId } =
      validation.data;

    // Generate or use provided session ID
    const sessionId = providedSessionId || generateSessionId(req);

    // Use provided model or default to gemini-1.5-pro
    const selectedModel = modelName || "gemini-1.5-pro";

    // Get or create cached model instance (reuses existing instances)
    const model = getModel(selectedModel, 0.7);

    const lastUserMessage = getLastUserMessage(messages);

    // Process request based on mode


    const chatResponse = await handleRAGRequest(
      lastUserMessage,
      model,
      sessionId,
      selectedModel
    );
    // Store messages in vector database
    storeMessages(messages, chatResponse.message, sessionId).catch((error) => {
      console.error("Failed to store messages:", error);
    });

    return NextResponse.json(chatResponse);
  } catch (error: unknown) {
    console.error("Error processing chat request:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to process chat request";
    const errorResponse: ErrorResponse = { error: errorMessage };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

