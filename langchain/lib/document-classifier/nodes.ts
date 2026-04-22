/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — Graph Nodes
 * ══════════════════════════════════════════════════════════════════
 *
 *  Each node is a plain async function:  (state) => Partial<state>
 *
 *  LangSmith tracing is AUTOMATIC — LangGraph sends traces for
 *  every node, LLM call, and edge when these env vars are set:
 *    LANGCHAIN_TRACING_V2=true
 *    LANGCHAIN_API_KEY=lsv2_...
 *    LANGSMITH_PROJECT="document-classifier"
 *
 *  No manual traceable() wrappers needed.
 *
 *  GRAPH FLOW:
 *
 *  START
 *    │
 *    ▼
 *  [validate]     ← check image is valid
 *    │
 *    ▼
 *  [classify]     ← vision LLM analyzes image → structured output
 *    │
 *    ▼
 *  [checkConfidence] ← confidence >= 0.7? → done : retry or human review
 *    │
 *    ├── high confidence ──► [extractFields] ──► [retrieveContext] ──► [rerank] ──► END
 *    ├── medium (retry)  ──► [classify] (loop back, max 2 retries)
 *    └── low confidence  ──► [flagForReview] ──► END
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Pinecone } from "@pinecone-database/pinecone";
import { CohereClient } from "cohere-ai";
import type { GraphStateType } from "./state";
import {
  ClassificationResultSchema,
  DOCUMENT_CATEGORIES,
} from "./types";
import type { RetrievedDocument } from "./types";

// ─── Helper: fetch URL image as base64 data URL ─────────────────────
async function imageToDataUrl(
  imageData: string,
  mimeType: string
): Promise<string> {
  // Already a data URL or base64
  if (imageData.startsWith("data:")) return imageData;

  // It's a URL — download and convert to base64
  if (imageData.startsWith("http")) {
    const res = await fetch(imageData);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    // Strip extra params from content-type (e.g. "image/jpeg; qs=0.8" → "image/jpeg")
    const rawCt = res.headers.get("content-type") || mimeType;
    const contentType = rawCt.split(";")[0].trim();
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  // Raw base64 string
  return `data:${mimeType};base64,${imageData}`;
}

// ─── LLM setup ─────────────────────────────────────────────────────
// Groq for vision (multimodal) — llama-4-scout supports image input
function getVisionModel() {
  return new ChatGroq({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    temperature: 0,
    apiKey: process.env.GROQ_API_KEY,
  });
}

// ─── System prompt ──────────────────────────────────────────────────
const CLASSIFICATION_PROMPT = `You are an expert document classifier. Analyze the provided document image and classify it.

CATEGORIES:
${DOCUMENT_CATEGORIES.map((c) => `- ${c}`).join("\n")}

RULES:
1. Examine visual layout, text content, logos, tables, formatting
2. A "cv" has personal info, education, work experience sections
3. An "invoice" has line items, totals, invoice numbers, billing info
4. A "meeting-note" has attendees, agenda items, action items, dates
5. A "contract" has legal language, parties, signatures, terms
6. A "receipt" has purchase items, payment method, store info
7. A "letter" has salutation, body paragraphs, closing, signature
8. A "report" has structured sections, data analysis, conclusions
9. A "form" has fillable fields, checkboxes, structured input areas
10. A "presentation" has slide-like layout, bullet points, titles
11. Use "unknown" ONLY if genuinely unclassifiable

Return a JSON object with:
- category: one of the categories above
- confidence: 0.0 to 1.0
- reasoning: brief explanation (1-2 sentences)
- extracted_fields: key-value pairs of important data you can read

RESPOND WITH ONLY THE JSON OBJECT, NO MARKDOWN FENCES.`;

// ══════════════════════════════════════════════════════════════════
//  NODE 1: validate
// ══════════════════════════════════════════════════════════════════

export async function validateNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  if (!state.imageData) {
    return {
      status: "error",
      reviewReason: "No image data provided",
      needsHumanReview: true,
    };
  }

  const validMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!validMimeTypes.includes(state.mimeType)) {
    return {
      status: "error",
      reviewReason: `Unsupported image type: ${state.mimeType}. Supported: ${validMimeTypes.join(", ")}`,
      needsHumanReview: true,
    };
  }

  return {
    status: "pending",
    startTime: Date.now(),
  };
}

// ══════════════════════════════════════════════════════════════════
//  NODE 2: classify — send image to vision LLM
// ══════════════════════════════════════════════════════════════════

export async function classifyNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const model = getVisionModel();

  const filenameHint = state.filename
    ? `\nThe filename is: "${state.filename}" — use this as additional context.`
    : "";

  try {
    const dataUrl = await imageToDataUrl(state.imageData, state.mimeType);

    const response = await model.invoke([
      new SystemMessage(CLASSIFICATION_PROMPT + filenameHint),
      new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
          {
            type: "text",
            text: "Classify this document. Return ONLY the JSON object.",
          },
        ],
      }),
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : (response.content as any[]).map((c: any) => c.text || "").join("");

    const cleaned = text
      .replace(/```json?\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const classification = ClassificationResultSchema.parse(parsed);

    return {
      classification,
      messages: [response],
      status: "classified",
    };
  } catch (error: any) {
    console.error("  ❌ Classification error:", error.message);
    return {
      classification: {
        category: "unknown",
        confidence: 0,
        reasoning: `Classification failed: ${error.message}`,
      },
      status: "error",
      retryCount: state.retryCount + 1,
    };
  }
}

// ══════════════════════════════════════════════════════════════════
//  NODE 3: checkConfidence — route by score
// ══════════════════════════════════════════════════════════════════

export async function checkConfidenceNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const { classification, retryCount } = state;

  if (!classification) {
    return {
      needsHumanReview: true,
      reviewReason: "No classification result available",
      status: "review",
    };
  }

  if (classification.confidence >= 0.7) {
    return { status: "classified" };
  }

  if (classification.confidence >= 0.4 && retryCount < 2) {
    return { retryCount: retryCount + 1, status: "pending" };
  }

  return {
    needsHumanReview: true,
    reviewReason:
      classification.confidence < 0.4
        ? `Low confidence (${classification.confidence}): ${classification.reasoning}`
        : `Still uncertain after ${retryCount} retries (confidence: ${classification.confidence})`,
    status: "review",
  };
}

// ══════════════════════════════════════════════════════════════════
//  NODE 4: extractFields — finalize
// ══════════════════════════════════════════════════════════════════

export async function extractFieldsNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  return { status: "done" };
}

// ══════════════════════════════════════════════════════════════════
//  NODE 5: retrieveContext — query Pinecone for relevant documents
// ══════════════════════════════════════════════════════════════════
//
//  After classification, we build a search query from the result
//  (category + reasoning + extracted fields) and retrieve the top-K
//  most similar documents from the Pinecone "rag" index.
//
//  Pinecone uses integrated embedding (llama-text-embed-v2) so we
//  send plain text — no external embedding API needed.
//
// ══════════════════════════════════════════════════════════════════

const PINECONE_INDEX_NAME = "rag";
const PINECONE_NAMESPACE = "__default__";
const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

let _pinecone: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!_pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not set — cannot query Pinecone");
    }
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return _pinecone;
}

/**
 * Build a natural-language search query from the classification result
 * so Pinecone's integrated embedding can find semantically similar docs.
 */
function buildSearchQuery(state: GraphStateType): string {
  const { classification, filename } = state;
  if (!classification) return filename || "document";

  const parts: string[] = [];

  // Category gives strong semantic signal
  parts.push(`Document type: ${classification.category}`);

  // Reasoning contains the LLM's description of what it saw
  if (classification.reasoning) {
    parts.push(classification.reasoning);
  }

  // Extracted fields add concrete keywords (flatten values)
  if (classification.extracted_fields) {
    const fieldStr = Object.entries(classification.extracted_fields)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
    if (fieldStr) parts.push(fieldStr);
  }

  if (filename) parts.push(`Filename: ${filename}`);

  return parts.join(". ");
}

export async function retrieveContextNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  try {
    const pc = getPineconeClient();
    const index = pc.index(PINECONE_INDEX_NAME);
    const namespace = index.namespace(PINECONE_NAMESPACE);

    const query = buildSearchQuery(state);
    console.log(`  🔍 Pinecone query: "${query.slice(0, 80)}..."`);

    const fieldsToReturn = [
      TEXT_FIELD,
      "title",
      "date",
      "location",
      "period",
      ...(TEXT_FIELD !== "text" ? ["text"] : []),
      ...(TEXT_FIELD !== "chunk_text" ? ["chunk_text"] : []),
    ];

    const response = await namespace.searchRecords({
      query: {
        topK: 5,
        inputs: { [TEXT_FIELD]: query },
      },
      fields: fieldsToReturn,
    });

    // Parse hits → RetrievedDocument[]
    const hits = (response as any)?.result?.hits ?? [];

    const relevantDocuments: RetrievedDocument[] = hits.map((hit: any) => {
      const fields = hit.fields ?? hit;
      const text =
        fields[TEXT_FIELD] ||
        fields.chunk_text ||
        fields.text ||
        "";

      // Collect all non-text fields as metadata
      const metadata: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k !== TEXT_FIELD && k !== "chunk_text" && k !== "text" && v) {
          metadata[k] = String(v);
        }
      }

      return {
        id: hit._id ?? "",
        score: hit._score ?? 0,
        text: String(text),
        metadata,
      };
    });

    console.log(`  📄 Retrieved ${relevantDocuments.length} relevant documents from Pinecone`);
    if (relevantDocuments.length > 0) {
      for (const doc of relevantDocuments.slice(0, 3)) {
        console.log(`     • [${(doc.score * 100).toFixed(1)}%] ${doc.text.slice(0, 60)}...`);
      }
    }

    return { relevantDocuments, status: "done" };
  } catch (error: any) {
    console.warn(`  ⚠️  Pinecone retrieval failed: ${error.message}`);
    // Non-fatal — classification still succeeded, just no context
    return { relevantDocuments: [], status: "done" };
  }
}

// ══════════════════════════════════════════════════════════════════
//  NODE 6: rerankDocuments — Cohere Rerank API
// ══════════════════════════════════════════════════════════════════
//
//  Takes the raw Pinecone results (ranked by vector similarity)
//  and re-scores them with Cohere's cross-encoder rerank model.
//
//  WHY?  Vector similarity (bi-encoder) is fast but approximate.
//  A cross-encoder like Cohere Rerank reads the query AND each
//  document together, producing a much more accurate relevance
//  score — especially when the query is complex or multi-faceted.
//
//  Pipeline:  Pinecone (fast recall, top-K) → Cohere (precise re-rank)
//
// ══════════════════════════════════════════════════════════════════

let _cohere: CohereClient | null = null;

function getCohereClient(): CohereClient {
  if (!_cohere) {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey || apiKey === "your_cohere_api_key_here") {
      throw new Error(
        "COHERE_API_KEY is not set — cannot rerank. " +
          "Get a free key at https://dashboard.cohere.com/api-keys"
      );
    }
    _cohere = new CohereClient({ token: apiKey });
  }
  return _cohere;
}

export async function rerankNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const { relevantDocuments, classification } = state;

  // Nothing to rerank
  if (!relevantDocuments || relevantDocuments.length === 0) {
    console.log("  ⏭️  No documents to rerank — skipping");
    return {};
  }

  // Build the rerank query (same logic as the Pinecone search query)
  const query = buildSearchQuery(state);

  try {
    const cohere = getCohereClient();

    // Prepare documents for Cohere — each needs a text string
    const documents = relevantDocuments.map((doc: RetrievedDocument) => doc.text);

    console.log(`  🔄 Cohere reranking ${documents.length} documents...`);
    console.log(`     Query: "${query.slice(0, 70)}..."`);

    const response = await cohere.v2.rerank({
      model: "rerank-v3.5",
      query,
      documents,
      topN: Math.min(relevantDocuments.length, 5),
    });

    // Map Cohere results back to our RetrievedDocument format
    // Cohere returns { index, relevanceScore } — we merge with original docs
    const reranked: RetrievedDocument[] = response.results.map((r) => {
      const original = relevantDocuments[r.index];
      return {
        ...original,
        score: r.relevanceScore, // Replace Pinecone's vector score with Cohere's relevance score
      };
    });

    // Sort by new relevance score descending (Cohere already does this, but be explicit)
    reranked.sort((a, b) => b.score - a.score);

    console.log(`  ✅ Reranked — top result: [${(reranked[0].score * 100).toFixed(1)}%] ${reranked[0].text.slice(0, 50)}...`);

    // Log before/after comparison
    console.log(`  📊 Rerank comparison:`);
    for (let i = 0; i < Math.min(3, reranked.length); i++) {
      const doc = reranked[i];
      const originalIdx = relevantDocuments.findIndex((d: RetrievedDocument) => d.id === doc.id);
      const originalScore = relevantDocuments[originalIdx]?.score ?? 0;
      const title = doc.metadata.title || doc.id;
      console.log(
        `     ${i + 1}. ${title.slice(0, 35)} — ` +
          `vector: ${(originalScore * 100).toFixed(1)}% → rerank: ${(doc.score * 100).toFixed(1)}%` +
          (originalIdx !== i ? ` (was #${originalIdx + 1})` : "")
      );
    }

    return { relevantDocuments: reranked };
  } catch (error: any) {
    console.warn(`  ⚠️  Cohere rerank failed: ${error.message}`);
    // Non-fatal — keep the original Pinecone ordering
    return {};
  }
}

// ══════════════════════════════════════════════════════════════════
//  NODE 7: flagForReview
// ══════════════════════════════════════════════════════════════════

export async function flagForReviewNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log(`  ⚠️  Flagged for human review: ${state.reviewReason}`);
  return { needsHumanReview: true, status: "review" };
}

// ══════════════════════════════════════════════════════════════════
//  ROUTING FUNCTION — conditional edge after checkConfidence
// ══════════════════════════════════════════════════════════════════

export function confidenceRouter(state: GraphStateType): string {
  if (state.status === "error") return "flagForReview";
  if (state.status === "review") return "flagForReview";
  if (state.status === "pending") return "classify"; // retry
  return "extractFields";
}
