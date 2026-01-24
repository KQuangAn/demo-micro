import { getPineconeIndex } from "./vector-store";
import { getModel } from "./model-cache";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

// Chat history namespace in Pinecone
const CHAT_HISTORY_NAMESPACE = "chat_history";
const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

/**
 * Get the chat history namespace
 */
async function getChatHistoryNamespace() {
  const index = await getPineconeIndex();
  return index.namespace(CHAT_HISTORY_NAMESPACE);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sessionId?: string;
}

/**
 * Store a chat message in the vector database
 */
export async function storeChatMessage(
  message: ChatMessage,
  sessionId: string = "default"
): Promise<void> {
  try {
    const chatNamespace = await getChatHistoryNamespace();

    // Create a unique ID for the message
    const messageId = `${sessionId}_${message.timestamp}_${Date.now()}`;

    // Prepare the text content for embedding
    const messageText = `${message.role}: ${message.content}`;

    // Store in Pinecone with metadata
    // Use the text field for auto-embedding
    // For integrated records, metadata fields are flat on the object
    await chatNamespace.upsertRecords([
      {
        id: messageId,
        [TEXT_FIELD]: messageText, // Text field for auto-embedding
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        sessionId: sessionId,
      },
    ]);

    console.log(`Stored chat message: ${messageId}`);
  } catch (error) {
    console.error("Error storing chat message:", error);
    // Don't throw - chat history storage failure shouldn't break the chat
  }
}

/**
 * Store multiple chat messages in batch
 */
export async function storeChatMessages(
  messages: ChatMessage[],
  sessionId: string = "default"
): Promise<void> {
  try {
    const chatNamespace = await getChatHistoryNamespace();

    const records = messages.map((message, index) => {
      const messageId = `${sessionId}_${message.timestamp}_${index}`;
      const messageText = `${message.role}: ${message.content}`;

      return {
        id: messageId,
        [TEXT_FIELD]: messageText, // Text field for auto-embedding
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        sessionId: sessionId,
      };
    });

    await chatNamespace.upsertRecords(records);
    console.log(`Stored ${messages.length} chat messages`);
  } catch (error) {
    console.error("Error storing chat messages:", error);
  }
}

/**
 * Retrieve recent chat messages from vector database
 * Returns messages sorted by timestamp (newest first)
 */
export async function retrieveRecentMessages(
  sessionId: string = "default",
  limit: number = 10
): Promise<ChatMessage[]> {
  try {
    const chatNamespace = await getChatHistoryNamespace();

    // Search for messages by session ID using metadata filter
    // Use a generic query to get all messages, then filter by sessionId
    const response = await chatNamespace.searchRecords({
      query: {
        topK: limit * 2, // Get more to filter by session
        filter: {
          sessionId: { $eq: sessionId },
        },
        inputs: {
          [TEXT_FIELD]: "chat message", // Generic query to retrieve messages
        },
      },
      fields: ["role", "content", "timestamp", "sessionId"],
    });

    // Extract messages from response
    // For integrated records, fields are returned in hit.fields
    const messages: ChatMessage[] = [];
    if (response.result?.hits) {
      for (const hit of response.result.hits) {
        const fields = (hit.fields || {}) as Record<string, unknown>;
        if (
          fields.sessionId === sessionId &&
          typeof fields.content === "string"
        ) {
          messages.push({
            role: ((fields.role as "user" | "assistant") || "user") as
              | "user"
              | "assistant",
            content: fields.content,
            timestamp:
              (typeof fields.timestamp === "number"
                ? fields.timestamp
                : Date.now()) as number,
            sessionId: (fields.sessionId as string) || sessionId,
          });
        }
      }
    }

    // Sort by timestamp (newest first) and limit
    messages.sort((a, b) => b.timestamp - a.timestamp);
    return messages.slice(0, limit);
  } catch (error) {
    console.error("Error retrieving chat messages:", error);
    return [];
  }
}

/**
 * Alternative: Retrieve messages by querying with a text search
 * This finds messages semantically similar to the current query
 */
export async function retrieveRelevantMessages(
  query: string,
  sessionId: string = "default",
  limit: number = 10
): Promise<ChatMessage[]> {
  try {
    const chatNamespace = await getChatHistoryNamespace();

    const response = await chatNamespace.searchRecords({
      query: {
        topK: limit * 2,
        filter: {
          sessionId: { $eq: sessionId },
        },
        inputs: {
          [TEXT_FIELD]: query,
        },
      },
      fields: ["role", "content", "timestamp", "sessionId"],
    });

    const messages: ChatMessage[] = [];
    if (response.result?.hits) {
      for (const hit of response.result.hits) {
        const fields = (hit.fields || {}) as Record<string, unknown>;
        if (
          fields.sessionId === sessionId &&
          typeof fields.content === "string"
        ) {
          messages.push({
            role: ((fields.role as "user" | "assistant") || "user") as
              | "user"
              | "assistant",
            content: fields.content,
            timestamp:
              (typeof fields.timestamp === "number"
                ? fields.timestamp
                : Date.now()) as number,
            sessionId: (fields.sessionId as string) || sessionId,
          });
        }
      }
    }

    // Sort by timestamp (newest first) and limit
    messages.sort((a, b) => b.timestamp - a.timestamp);
    return messages.slice(0, limit);
  } catch (error) {
    console.error("Error retrieving relevant messages:", error);
    return [];
  }
}

/**
 * Summarize recent chat messages using LLM
 * Returns a concise summary of the conversation context
 */
export async function summarizeChatHistory(
  messages: ChatMessage[],
  modelName: string = "gemini-1.5-pro"
): Promise<string> {
  if (messages.length === 0) {
    return "No previous conversation history.";
  }

  try {
    const model = getModel(modelName, 0.7);

    // Format messages for summarization
    const conversationText = messages
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");

    const summarizePrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant that summarizes conversation history. 
        Create a concise summary of the key points, topics, and context from the conversation.
        Focus on information that would be useful for continuing the conversation.
        Keep the summary brief (2-3 sentences maximum).`,
      ],
      ["human", "Summarize this conversation:\n\n{conversation}"],
    ]);

    const summarizeChain = RunnableSequence.from([
      summarizePrompt,
      model,
    ]);

    const response = await summarizeChain.invoke({
      conversation: conversationText,
    });

    const summary =
      typeof response.content === "string"
        ? response.content
        : String(response.content || "");

    return summary || "No summary available.";
  } catch (error) {
    console.error("Error summarizing chat history:", error);
    // Fallback: return a simple formatted version
    return messages
      .slice(-5)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }
}

/**
 * Get chat history summary for LLM context
 * Retrieves recent messages and summarizes them
 */
export async function getChatHistorySummary(
  currentQuery: string,
  sessionId: string = "default",
  modelName: string = "gemini-1.5-pro"
): Promise<string> {
  try {
    // Try to get relevant messages first, then fall back to recent messages
    let messages = await retrieveRelevantMessages(currentQuery, sessionId, 10);
    
    if (messages.length < 5) {
      // If not enough relevant messages, get recent ones
      const recentMessages = await retrieveRecentMessages(sessionId, 10);
      messages = recentMessages;
    }

    if (messages.length === 0) {
      return "No previous conversation history.";
    }

    return await summarizeChatHistory(messages, modelName);
  } catch (error) {
    console.error("Error getting chat history summary:", error);
    return "No previous conversation history available.";
  }
}

/**
 * Generate a session ID from request (can be enhanced with user auth)
 */
export function generateSessionId(req: Request): string {
  // For now, use a simple approach
  // In production, you'd use user authentication or session management
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  return `session_${ip}_${Date.now()}`;
}
