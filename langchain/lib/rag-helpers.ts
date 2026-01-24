import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import type { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { PineconeMatch } from "./vector-store";
import { searchSimilarDocuments } from "./vector-store";
import { fetchWeatherData, formatWeatherContext, hasDateInMatches } from "./weather-api";
import { getChatHistorySummary } from "./chat-history";

export interface QueryAnalysis {
  intent?: string;
  date?: string | null;
  location?: string;
  needsWeatherAPI?: boolean;
  needsVectorStore?: boolean;
  searchQuery?: string;
}

/**
 * Analyze user query to determine intent and requirements
 */
export async function analyzeQuery(
  query: string,
  model: ChatGoogleGenerativeAI
): Promise<QueryAnalysis> {
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

  const queryAnalysisChain = RunnableSequence.from([queryAnalysisPrompt, model]);

  const analysisResponse = await queryAnalysisChain.invoke({ question: query });
  const analysisContent =
    typeof analysisResponse.content === "string"
      ? analysisResponse.content
      : String(analysisResponse.content || "{}");

  let queryAnalysis: QueryAnalysis = {};

  try {
    const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      queryAnalysis = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Failed to parse query analysis:", error);
  }

  return queryAnalysis;
}

/**
 * Build context from vector store matches and weather API
 */
export async function buildRAGContext(
  searchQuery: string,
  matches: PineconeMatch[],
  queryAnalysis: QueryAnalysis,
  chatHistorySummary?: string
): Promise<string> {
  const contextParts: string[] = [];

  // Add chat history summary if available
  if (chatHistorySummary && chatHistorySummary !== "No previous conversation history.") {
    contextParts.push(`**Previous Conversation Context:**\n${chatHistorySummary}\n`);
  }

  // Add vector store context
  if (matches.length > 0) {
    const vectorContext = matches
      .map((match: PineconeMatch) => {
        const fields = match.fields || {};
        const text =
          fields.chunk_text ||
          fields.text ||
          match.chunk_text ||
          match.text ||
          match.metadata?.chunk_text ||
          match.metadata?.title ||
          "";
        const title = fields.title || match.title || match.metadata?.title || "";
        const date = fields.date || match.date || match.metadata?.date || "";
        const location =
          fields.location || match.location || match.metadata?.location || "";
        const period = fields.period || match.period || match.metadata?.period || "";

        let contextStr = "";
        if (title) contextStr += `**${title}**\n`;
        if (date) contextStr += `Date: ${date}\n`;
        if (location) contextStr += `Location: ${location}\n`;
        if (period) contextStr += `Period: ${period}\n`;
        if (text) contextStr += text;

        return contextStr || JSON.stringify(match);
      })
      .join("\n\n---\n\n");
    contextParts.push(vectorContext);
  }

  // Add weather API data if needed
  const useWeatherAPI = shouldUseWeatherAPI(matches, queryAnalysis);
  if (useWeatherAPI) {
    try {
      const weatherData = await fetchWeatherData(
        undefined,
        undefined,
        queryAnalysis.date || undefined
      );
      const weatherContext = formatWeatherContext(
        weatherData,
        queryAnalysis.date || undefined
      );
      contextParts.push(weatherContext);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      if (matches.length === 0) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        contextParts.push(
          `**Note:** Unable to fetch weather data from API. ${errorMessage}`
        );
      }
    }
  }

  if (contextParts.length === 0) {
    return "No relevant documents found in the knowledge base.";
  }

  return contextParts.join("\n\n---\n\n");
}

/**
 * Determine if weather API should be used
 */
function shouldUseWeatherAPI(
  matches: PineconeMatch[],
  queryAnalysis: QueryAnalysis
): boolean {
  const needsWeatherAPI = queryAnalysis.needsWeatherAPI !== false;

  if (!needsWeatherAPI) {
    return false;
  }

  if (matches.length === 0) {
    return true;
  }

  if (queryAnalysis.date) {
    const hasDateData = hasDateInMatches(matches, queryAnalysis.date);
    return !hasDateData;
  }

  return true;
}

/**
 * Execute RAG chain with context
 */
export async function executeRAGChain(
  question: string,
  context: string,
  model: ChatGoogleGenerativeAI
): Promise<string> {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful assistant that answers questions about Hanoi weather forecasts.

IMPORTANT: Use ALL available information from the context documents below to answer questions. The context includes:
- Previous conversation history (if available)
- Historical weather data from the knowledge base (if available)
- Current and forecast weather data from the weather API (if available)

Context documents:
{context}

Answer the question based on the context above. You MUST use the weather API data if it's provided in the context, even if it's for a different date than what's in the knowledge base. Be specific and cite dates or periods when relevant. If weather API data is present, prioritize using it to answer weather-related questions.`,
    ],
    ["human", "{question}"],
  ]);

  const ragChain = RunnableSequence.from([prompt, model]);

  const response = await ragChain.invoke({ question, context });
  return typeof response.content === "string"
    ? response.content
    : String(response.content || "");
}

/**
 * Process RAG request end-to-end
 */
export async function processRAGRequest(
  userMessage: string,
  model: ChatGoogleGenerativeAI,
  sessionId: string,
  modelName: string
): Promise<{ message: string; source: "RAG" | "RAG+Weather" }> {
  // Analyze query
  const queryAnalysis = await analyzeQuery(userMessage, model);
  console.log("Query analysis:", queryAnalysis);

  // Get chat history summary
  const chatHistorySummary = await getChatHistorySummary(
    userMessage,
    sessionId,
    modelName
  );

  // Search vector store if needed
  const searchQuery = queryAnalysis.searchQuery || userMessage;
  let matches: PineconeMatch[] = [];
  if (queryAnalysis.needsVectorStore !== false) {
    matches = await searchSimilarDocuments(searchQuery, 3);
    console.log("Number of matches found:", matches.length);
  }

  // Build context
  const context = await buildRAGContext(
    searchQuery,
    matches,
    queryAnalysis,
    chatHistorySummary
  );

  // Determine if weather API was used
  const useWeatherAPI = shouldUseWeatherAPI(matches, queryAnalysis);

  // Execute RAG chain
  const message = await executeRAGChain(userMessage, context, model);

  return {
    message,
    source: useWeatherAPI ? "RAG+Weather" : "RAG",
  };
}
