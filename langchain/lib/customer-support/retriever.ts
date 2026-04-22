/**
 * ══════════════════════════════════════════════════════════════════
 *  Customer Support — Retriever (Pinecone + Cohere Rerank)
 * ══════════════════════════════════════════════════════════════════
 *
 *  Two-stage retrieval:
 *    1. Pinecone searchRecords  → fast recall (top-20, vector search)
 *    2. Cohere rerank-v3.5      → precise re-scoring (top-5, cross-encoder)
 *
 *  Pinecone uses integrated embedding — no external embedding API.
 *  Cohere's cross-encoder reads query + document together for much
 *  better relevance than bi-encoder similarity alone.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { CohereClient } from "cohere-ai";

// ─── Config ────────────────────────────────────────────────────────

const INDEX_NAME = "rag";
const NAMESPACE = "customer-support";
const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";
const PINECONE_TOP_K = 20; // broad recall from Pinecone
const RERANK_TOP_N = 5;    // narrow precision from Cohere

// ─── Types ─────────────────────────────────────────────────────────

export interface RetrievedArticle {
  id: string;
  title: string;
  category: string;
  text: string;
  score: number;          // Cohere relevance score (or Pinecone score if rerank skipped)
  vectorScore: number;    // Original Pinecone vector score
}

// ─── Singletons ────────────────────────────────────────────────────

let _pinecone: Pinecone | null = null;
let _cohere: CohereClient | null = null;

function getPinecone(): Pinecone {
  if (!_pinecone) {
    if (!process.env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY not set");
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return _pinecone;
}

function getCohere(): CohereClient | null {
  if (!_cohere) {
    const key = process.env.COHERE_API_KEY;
    if (!key || key.startsWith("your_")) return null; // gracefully skip
    _cohere = new CohereClient({ token: key });
  }
  return _cohere;
}

// ─── Stage 1: Pinecone vector search ───────────────────────────────

async function pineconeSearch(query: string): Promise<RetrievedArticle[]> {
  const pc = getPinecone();
  const ns = pc.index(INDEX_NAME).namespace(NAMESPACE);

  const fieldsToReturn = [TEXT_FIELD, "title", "category", "tags"];
  if (TEXT_FIELD !== "text") fieldsToReturn.push("text");
  if (TEXT_FIELD !== "chunk_text") fieldsToReturn.push("chunk_text");

  const response = await ns.searchRecords({
    query: {
      topK: PINECONE_TOP_K,
      inputs: { [TEXT_FIELD]: query },
    },
    fields: fieldsToReturn,
  });

  const hits = (response as any)?.result?.hits ?? [];

  return hits.map((hit: any) => {
    const f = hit.fields ?? hit;
    return {
      id: hit._id ?? "",
      title: f.title ?? "",
      category: f.category ?? "",
      text: f[TEXT_FIELD] || f.chunk_text || f.text || "",
      score: hit._score ?? 0,
      vectorScore: hit._score ?? 0,
    };
  });
}

// ─── Stage 2: Cohere rerank ────────────────────────────────────────

async function cohereRerank(
  query: string,
  docs: RetrievedArticle[]
): Promise<RetrievedArticle[]> {
  const cohere = getCohere();
  if (!cohere || docs.length === 0) return docs.slice(0, RERANK_TOP_N);

  const response = await cohere.v2.rerank({
    model: "rerank-v3.5",
    query,
    documents: docs.map((d) => d.text),
    topN: Math.min(docs.length, RERANK_TOP_N),
  });

  return response.results.map((r) => ({
    ...docs[r.index],
    score: r.relevanceScore,
  }));
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Retrieve the most relevant knowledge base articles for a customer query.
 * Uses Pinecone for initial recall, then Cohere to rerank for precision.
 */
export async function retrieveArticles(
  query: string,
  options?: { topN?: number }
): Promise<RetrievedArticle[]> {
  const topN = options?.topN ?? RERANK_TOP_N;

  // Stage 1: broad vector search
  const candidates = await pineconeSearch(query);
  if (candidates.length === 0) return [];

  // Stage 2: precise reranking
  const reranked = await cohereRerank(query, candidates);

  return reranked.slice(0, topN);
}

/**
 * Format retrieved articles into a context string for the LLM prompt.
 */
export function formatContext(articles: RetrievedArticle[]): string {
  if (articles.length === 0) return "No relevant articles found in the knowledge base.";

  return articles
    .map(
      (a, i) =>
        `[Source ${i + 1}: ${a.title} (${a.category}) — relevance: ${(a.score * 100).toFixed(1)}%]\n${a.text}`
    )
    .join("\n\n---\n\n");
}
