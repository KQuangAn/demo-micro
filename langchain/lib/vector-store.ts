import { Pinecone, Index } from "@pinecone-database/pinecone";
import * as z from "zod";

// Zod schemas for Pinecone response types
const PineconeMatchFieldsSchema = z.object({
  chunk_text: z.string().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  period: z.string().optional(),
});

const PineconeMatchSchema = z.object({
  _id: z.string().optional(),
  _score: z.number().optional(),
  fields: PineconeMatchFieldsSchema.optional(),
  // Legacy structure support
  chunk_text: z.string().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  period: z.string().optional(),
  metadata: PineconeMatchFieldsSchema.optional(),
});

const PineconeSearchResponseSchema = z.object({
  result: z.object({
    hits: z.array(PineconeMatchSchema),
  }).optional(),
  usage: z.object({
    readUnits: z.number().optional(),
    embedTotalTokens: z.number().optional(),
  }).optional(),
});

// TypeScript types inferred from Zod schemas
export type PineconeMatch = z.infer<typeof PineconeMatchSchema>;
export type PineconeMatchFields = z.infer<typeof PineconeMatchFieldsSchema>;
export type PineconeSearchResponse = z.infer<typeof PineconeSearchResponseSchema>;

let pineconeIndex: Index | null = null;
let pineconeNamespace: ReturnType<Index['namespace']> | null = null;
const PINECONE_INDEX_NAME = "rag";
const PINECONE_NAMESPACE = "__default__";
// Field name for text - must match your index's field_map configuration
// Default to "text" - can be overridden via PINECONE_TEXT_FIELD env var
const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

/**
 * Initialize the Pinecone index and namespace
 * The index must be configured with integrated embedding enabled
 * No embedding model specification needed - index configuration handles it
 */
export async function initializePineconeIndex(): Promise<Index> {
  if (pineconeIndex) {
    return pineconeIndex;
  }

  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set in environment variables");
  }

  // Initialize Pinecone client
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  // Get the index by name
  // If you need to specify a host, use: pinecone.index(PINECONE_INDEX_NAME, "INDEX_HOST")
  pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);

  return pineconeIndex;
}

/**
 * Get the Pinecone namespace (initialize if needed)
 */
export async function getPineconeNamespace() {
  if (!pineconeNamespace) {
    const index = await initializePineconeIndex();
    pineconeNamespace = index.namespace(PINECONE_NAMESPACE);
  }
  return pineconeNamespace;
}

/**
 * Get the Pinecone index (initialize if needed)
 */
export async function getPineconeIndex() {
  return initializePineconeIndex();
}

/**
 * Search for similar documents using Pinecone's searchRecords
 * Query text is automatically converted to vectors - no embedding model needed
 * @returns Array of PineconeMatch objects
 */
export async function searchSimilarDocuments(
  queryText: string,
  topK: number = 3
): Promise<PineconeMatch[]> {
  const namespace = await getPineconeNamespace();

  // Query using text - automatically converted to vectors by Pinecone
  // searchRecords is called on the namespace
  // Build fields array with TEXT_FIELD and metadata fields (avoid duplicates)
  const fieldsToReturn = [
    TEXT_FIELD,
    'title',
    'date',
    'location',
    'period',
    // Include common alternatives for compatibility
    ...(TEXT_FIELD !== 'text' ? ['text'] : []),
    ...(TEXT_FIELD !== 'chunk_text' ? ['chunk_text'] : []),
  ];

  const response = await namespace.searchRecords({
    query: {
      topK,
      inputs: {
        [TEXT_FIELD]: queryText, // Use the same field name as configured in index
      },
    },
    fields: fieldsToReturn,
  });

  // Validate and parse response with Zod
  const parsedResponse = PineconeSearchResponseSchema.safeParse(response);
  
  if (!parsedResponse.success) {
    console.warn('Pinecone searchRecords returned unexpected structure:', JSON.stringify(response, null, 2));
    console.warn('Validation errors:', parsedResponse.error.issues);
    return [];
  }

  // Pinecone searchRecords returns: { result: { hits: [...] }, usage: {...} }
  // Each hit has: { _id, _score, fields: { ... } }
  if (parsedResponse.data.result?.hits) {
    return parsedResponse.data.result.hits;
  }
  
  // Log for debugging if no results found
  console.warn('Pinecone searchRecords returned no hits in result');
  return [];
}
