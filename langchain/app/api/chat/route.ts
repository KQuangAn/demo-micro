import { NextRequest, NextResponse } from "next/server";
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { ToolRunnableConfig } from "@langchain/core/tools";
import type { PineconeMatch } from "@/lib/vector-store";
import {
  hasDateInMatches,
  fetchWeatherData,
  formatWeatherContext
} from "@/lib/weather-api";
import { getModel } from "@/lib/model-cache";

// Zod schemas for type safety
const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  model: z.string().optional(),
  useRAG: z.boolean().optional(),
});

// PineconeMatch is imported from vector-store.ts

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

// Weather tool example
const getWeather = tool(
  (input: { city: string }, config: ToolRunnableConfig) => `It's  ${input.city}! 
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedRequest = ChatRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      const errorResponse: ErrorResponse = {
        error: `Invalid request: ${parsedRequest.error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { messages, model: modelName, useRAG } = parsedRequest.data;

    // Use provided model or default to gemini-1.5-pro
    const selectedModel = modelName || "gemini-1.5-pro";

    // Get or create cached model instance (reuses existing instances)
    const model = getModel(selectedModel, 0.7);

    const lastUserMessage = messages
      .filter((msg: Message) => msg.role === "user")
      .pop()?.content || "";


    // If RAG is enabled, use RAG chain with Pinecone integrated embedding
    if (useRAG) {
      const { searchSimilarDocuments } = await import("@/lib/vector-store");
      const { ChatPromptTemplate } = await import("@langchain/core/prompts");
      const { RunnableSequence } = await import("@langchain/core/runnables");

      // Step 1: Analyze query intent using LLM to understand what the user wants
      const queryAnalysisPrompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `Analyze the user's query and extract key information. Respond with a JSON object containing:
          - "intent": What the user is asking about (e.g., "weather_forecast", "weather_current", "general_question")
          - "date": The date mentioned in the query (YYYY-MM-DD format or null)
          - "location": The location mentioned (or "Hanoi" if not specified)
          - "needsWeatherAPI": boolean - whether weather API data is needed
          - "needsVectorStore": boolean - whether to search the knowledge base
          - "searchQuery": A refined search query for the vector store

          Example response format:
          {{
            "intent": "weather_forecast",
            "date": "2025-12-27",
            "location": "Hanoi",
            "needsWeatherAPI": true,
            "needsVectorStore": true,
            "searchQuery": "weather forecast December 27 2025"
          }}

          Respond ONLY with valid JSON, no additional text.`,
        ],
        ["human", "User query: {question}"],
      ]);

      const queryAnalysisChain = RunnableSequence.from([
        queryAnalysisPrompt,
        model,
      ]);

      // Analyze the query first
      const analysisResponse = await queryAnalysisChain.invoke({ question: lastUserMessage });
      const analysisContent = typeof analysisResponse.content === 'string'
        ? analysisResponse.content
        : String(analysisResponse.content || '{}');

      let queryAnalysis: {
        intent?: string;
        date?: string | null;
        location?: string;
        needsWeatherAPI?: boolean;
        needsVectorStore?: boolean;
        searchQuery?: string;
      } = {};

      try {
        // Try to parse JSON from the response
        const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          queryAnalysis = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.error('Failed to parse query analysis:', error);
      }

      // Use analysis results (LLM handles all extraction)
      const queryDate = queryAnalysis.date || null;
      const searchQuery = queryAnalysis.searchQuery || lastUserMessage;
      const needsWeatherAPI = queryAnalysis.needsWeatherAPI !== false; // Default to true
      const needsVectorStore = queryAnalysis.needsVectorStore !== false; // Default to true

      console.log('Query analysis:', queryAnalysis);
      console.log('Extracted date:', queryDate);
      console.log('Search query:', searchQuery);
      console.log('Needs Weather API:', needsWeatherAPI);
      console.log('Needs Vector Store:', needsVectorStore);

      // Search vector store if needed
      let matches: PineconeMatch[] = [];
      if (needsVectorStore) {
        matches = await searchSimilarDocuments(searchQuery, 3);
        console.log('Number of matches found:', matches.length);
      }

      // Determine if we need weather API based on analysis
      let useWeatherAPI = false;
      if (needsWeatherAPI) {
        if (matches.length === 0) {
          // No documents found - always use weather API
          console.log('No matches found in vector store, using Weather API');
          useWeatherAPI = true;
        } else if (queryDate) {
          // Check if the queried date exists in the matches
          const hasDateData = hasDateInMatches(matches, queryDate);
          if (!hasDateData) {
            console.log(`Query date ${queryDate} not found in vector store, using Weather API as fallback`);
            useWeatherAPI = true;
          } else {
            console.log(`Query date ${queryDate} found in vector store, using vector store data only`);
          }
        } else {
          // If we have matches but no specific date query, still include weather API
          console.log('Matches found, including Weather API for current weather data');
          useWeatherAPI = true;
        }
      }

      // Step 2: Main RAG chain with context gathering
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `You are a helpful assistant that answers questions about Hanoi weather forecasts.

IMPORTANT: Use ALL available information from the context documents below to answer questions. The context includes:
- Historical weather data from the knowledge base (if available)
- Current and forecast weather data from the weather API (if available)

Context documents:
{context}

Answer the question based on the context above. You MUST use the weather API data if it's provided in the context, even if it's for a different date than what's in the knowledge base. Be specific and cite dates or periods when relevant. If weather API data is present, prioritize using it to answer weather-related questions.`,
        ],
        ["human", "{question}"],
      ]);

      const ragChain = RunnableSequence.from([
        {
          context: async () => {
            // Debug logging
            console.log('Search query:', lastUserMessage);
            console.log('Number of matches found:', matches.length);
            if (matches.length > 0) {
              console.log('First match structure:', JSON.stringify(matches[0], null, 2));
            }

            // Build context from vector store matches
            const contextParts: string[] = [];
            
            // if have relevant documents, add them to the context
            if (matches.length > 0) {
              const vectorContext = matches
                .map((match: PineconeMatch) => {
                  // Pinecone searchRecords returns fields in match.fields object
                  const fields = match.fields || {};
                  const text = fields.chunk_text || fields.text || match.chunk_text || match.text || match.metadata?.chunk_text || match.metadata?.title || "";
                  const title = fields.title || match.title || match.metadata?.title || "";
                  const date = fields.date || match.date || match.metadata?.date || "";
                  const location = fields.location || match.location || match.metadata?.location || "";
                  const period = fields.period || match.period || match.metadata?.period || "";

                  // Build context string
                  let contextStr = "";
                  if (title) contextStr += `**${title}**\n`;
                  if (date) contextStr += `Date: ${date}\n`;
                  if (location) contextStr += `Location: ${location}\n`;
                  if (period) contextStr += `Period: ${period}\n`;
                  if (text) contextStr += text;

                  return contextStr || JSON.stringify(match); // Fallback to full match if no fields found
                })
                .join("\n\n---\n\n");
              contextParts.push(vectorContext);
            }

            // Add weather API data if needed
            if (useWeatherAPI) {
              try {
                console.log('Fetching weather data for date:', queryDate);
                const weatherData = await fetchWeatherData(undefined, undefined, queryDate || undefined);
                const weatherContext = formatWeatherContext(weatherData, queryDate || undefined);
                contextParts.push(weatherContext);
                console.log('Weather data:', weatherContext);
              } catch (error) {
                console.error('Error fetching weather data:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                // Only add error message if we have no vector store data
                // If we have vector store data, silently skip weather API
                if (matches.length === 0) {
                  contextParts.push(`**Note:** Unable to fetch weather data from API. ${errorMessage}`);
                } else {
                  // We have vector store data, so just log the error but don't add it to context
                  console.log('Weather API unavailable, but using vector store data instead');
                }
              }
            }

            if (contextParts.length === 0) {
              return "No relevant documents found in the knowledge base.";
            }

            return contextParts.join("\n\n---\n\n");
          },
          question: () => lastUserMessage,
        },
        prompt,
        model,
      ]);

      const response = await ragChain.invoke({ question: lastUserMessage });
      const responseContent = typeof response.content === 'string'
        ? response.content
        : String(response.content || '');

      const chatResponse: ChatResponse = {
        message: responseContent,
        source: useWeatherAPI ? "RAG+Weather" : "RAG",
      };
      return NextResponse.json(chatResponse);
    }

    // Create agent with the model and tools
    const agent = createAgent({
      model,
      tools: [getWeather],
    });

    // Invoke the agent
    const response = await agent.invoke({
      messages,
    });

    // Extract the last message content from the response
    const lastMessage = response.messages?.[response.messages.length - 1];
    let content: string;

    if (typeof lastMessage === 'string') {
      content = lastMessage;
    } else if (lastMessage && typeof lastMessage === 'object' && 'content' in lastMessage) {
      content = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : String(lastMessage.content || '');
    } else {
      content = JSON.stringify(response);
    }

    const chatResponse: ChatResponse = {
      message: content,
      source: "Agent",
    };
    return NextResponse.json(chatResponse);
  } catch (error: unknown) {
    console.error("Error calling agent:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get response from agent";
    const errorResponse: ErrorResponse = { error: errorMessage };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

