import { createAgent, tool } from "langchain";
import type { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ToolRunnableConfig } from "@langchain/core/tools";
import * as z from "zod";
import { getChatHistorySummary } from "./chat-history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

// Weather tool example
const getWeather = tool(
  (
    input: { city: string },
    config: ToolRunnableConfig
  ) => `It's  ${input.city}! 
  ${JSON.stringify(config.context)}
  ${JSON.stringify(config.toolCall)}`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
);

/**
 * Enhance messages with chat history summary
 */
export async function enhanceMessagesWithHistory(
  messages: Array<{ role: string; content: string }>,
  currentQuery: string,
  sessionId: string,
  modelName: string,
  model: ChatGoogleGenerativeAI
): Promise<Array<{ role: string; content: string }>> {
  // Get chat history summary
  const chatHistorySummary = await getChatHistorySummary(
    currentQuery,
    sessionId,
    modelName
  );

  // If no history, return original messages
  if (
    !chatHistorySummary ||
    chatHistorySummary === "No previous conversation history."
  ) {
    return messages;
  }

  // Create enhanced messages with history context
  const enhancedMessages = [...messages];

  // Add system message with history summary at the beginning
  // Check if there's already a system message
  const hasSystemMessage = enhancedMessages.some(
    (msg) => msg.role === "system"
  );

  if (!hasSystemMessage) {
    enhancedMessages.unshift({
      role: "system",
      content: `Previous conversation context:\n${chatHistorySummary}\n\nUse this context to provide more relevant and contextual responses.`,
    });
  } else {
    // Prepend to existing system message
    const systemIndex = enhancedMessages.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemIndex !== -1) {
      enhancedMessages[systemIndex].content = `Previous conversation context:\n${chatHistorySummary}\n\n${enhancedMessages[systemIndex].content}`;
    }
  }

  return enhancedMessages;
}

/**
 * Process agent request end-to-end
 */
export async function processAgentRequest(
  messages: Array<{ role: string; content: string }>,
  model: ChatGoogleGenerativeAI,
  sessionId: string,
  modelName: string
): Promise<string> {
  // Get the last user message for history context
  const lastUserMessage =
    messages
      .filter((msg) => msg.role === "user")
      .pop()?.content || "";

  // Enhance messages with chat history
  const enhancedMessages = await enhanceMessagesWithHistory(
    messages,
    lastUserMessage,
    sessionId,
    modelName,
    model
  );

  // Create agent with the model and tools
  const agent = createAgent({
    model,
    tools: [getWeather],
  });

  // Invoke the agent
  const response = await agent.invoke({
    messages: enhancedMessages,
  });

  // Extract the last message content from the response
  const lastMessage = response.messages?.[response.messages.length - 1];
  let content: string;

  if (typeof lastMessage === "string") {
    content = lastMessage;
  } else if (
    lastMessage &&
    typeof lastMessage === "object" &&
    "content" in lastMessage
  ) {
    content =
      typeof lastMessage.content === "string"
        ? String(lastMessage.content || "")
        : String(lastMessage.content || "");
  } else {
    content = JSON.stringify(response);
  }

  return content;
}
