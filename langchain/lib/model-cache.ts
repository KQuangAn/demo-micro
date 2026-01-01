import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Model cache to reuse instances across requests
interface ModelConfig {
  model: string;
  temperature: number;
  apiKey: string;
}

type ModelCacheKey = string;

// Cache to store model instances
const modelCache = new Map<ModelCacheKey, ChatGoogleGenerativeAI>();

/**
 * Generate a cache key from model configuration
 */
function getCacheKey(config: ModelConfig): ModelCacheKey {
  return `${config.model}:${config.temperature}:${config.apiKey}`;
}

/**
 * Get or create a ChatGoogleGenerativeAI model instance
 * Reuses existing instances from cache to improve efficiency
 */
export function getModel(
  modelName: string = "gemini-1.5-pro",
  temperature: number = 0.7,
  apiKey?: string
): ChatGoogleGenerativeAI {
  const finalApiKey = apiKey || process.env.GOOGLE_API_KEY;
  
  if (!finalApiKey) {
    throw new Error("GOOGLE_API_KEY is not set in environment variables");
  }

  const config: ModelConfig = {
    model: modelName,
    temperature,
    apiKey: finalApiKey,
  };

  const cacheKey = getCacheKey(config);

  // Return cached model if it exists
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  // Create new model instance and cache it
  const model = new ChatGoogleGenerativeAI({
    model: modelName,
    temperature,
    apiKey: finalApiKey,
  });

  modelCache.set(cacheKey, model);
  
  // Optional: Limit cache size to prevent memory issues
  // For now, we'll keep all models cached as they're lightweight
  // If needed, we can implement LRU eviction here

  return model;
}

/**
 * Clear the model cache (useful for testing or memory management)
 */
export function clearModelCache(): void {
  modelCache.clear();
}

/**
 * Get cache size (useful for monitoring)
 */
export function getCacheSize(): number {
  return modelCache.size;
}
