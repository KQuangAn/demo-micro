/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — LangGraph Definition
 * ══════════════════════════════════════════════════════════════════
 *
 *  GRAPH STRUCTURE:
 *
 *  START
 *    │
 *    ▼
 *  [validate]
 *    │
 *    ├── error ──────────────────────────► [flagForReview] ──► END
 *    │
 *    ▼
 *  [classify]
 *    │
 *    ▼
 *  [checkConfidence]
 *    │
 *    ├── high confidence (≥0.7) ────────► [extractFields]
 *    │                                        │
 *    │                                        ▼
 *    │                                   [retrieveContext]
 *    │                                    (Pinecone RAG)
 *    │                                        │
 *    │                                        ▼
 *    │                                   [rerank] ──────────► END
 *    │                                    (Cohere rerank-v3.5)
 *    │
 *    ├── medium (≥0.4, retries left) ──► [classify] (loop)
 *    │
 *    └── low (< 0.4 or max retries) ──► [flagForReview] ──► END
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { GraphState } from "./state";
import {
  validateNode,
  classifyNode,
  checkConfidenceNode,
  extractFieldsNode,
  retrieveContextNode,
  rerankNode,
  flagForReviewNode,
  confidenceRouter,
} from "./nodes";
import type { DocumentInput, ClassifierOutput } from "./types";

// ─── Build the graph ───────────────────────────────────────────────

function buildGraph() {
  const workflow = new StateGraph(GraphState)

    // ── Add nodes ─────────────────────────────────────────────
    .addNode("validate", validateNode)
    .addNode("classify", classifyNode)
    .addNode("checkConfidence", checkConfidenceNode)
    .addNode("extractFields", extractFieldsNode)
    .addNode("retrieveContext", retrieveContextNode)
    .addNode("rerank", rerankNode)
    .addNode("flagForReview", flagForReviewNode)

    // ── Add edges ─────────────────────────────────────────────
    // START → validate
    .addEdge(START, "validate")

    // validate → classify (if valid) or flagForReview (if error)
    .addConditionalEdges("validate", (state) => {
      return state.status === "error" ? "flagForReview" : "classify";
    })

    // classify → checkConfidence
    .addEdge("classify", "checkConfidence")

    // checkConfidence → conditional routing (the core decision)
    .addConditionalEdges("checkConfidence", confidenceRouter)

    // Terminal nodes → END
    .addEdge("extractFields", "retrieveContext")
    .addEdge("retrieveContext", "rerank")
    .addEdge("rerank", END)
    .addEdge("flagForReview", END);

  return workflow;
}

// ─── Compile with checkpointer ─────────────────────────────────────

export function createClassifierGraph(options?: { checkpointer?: boolean }) {
  const workflow = buildGraph();

  if (options?.checkpointer) {
    const checkpointer = new MemorySaver();
    return workflow.compile({ checkpointer });
  }

  return workflow.compile();
}

// ─── High-level API ────────────────────────────────────────────────

export async function classifyDocument(
  input: DocumentInput,
  options?: { threadId?: string }
): Promise<ClassifierOutput> {
  const graph = createClassifierGraph({ checkpointer: !!options?.threadId });

  const config = options?.threadId
    ? { configurable: { thread_id: options.threadId } }
    : undefined;

  const result = await graph.invoke(
    {
      imageData: input.image,
      mimeType: input.mimeType,
      filename: input.filename || "",
    },
    config
  );

  return {
    classification: result.classification!,
    needsHumanReview: result.needsHumanReview,
    reviewReason: result.reviewReason || undefined,
    processingTimeMs: Date.now() - result.startTime,
    relevantDocuments:
      result.relevantDocuments && result.relevantDocuments.length > 0
        ? result.relevantDocuments
        : undefined,
  };
}

export { buildGraph };
