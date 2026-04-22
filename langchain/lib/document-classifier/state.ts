/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — Graph State
 * ══════════════════════════════════════════════════════════════════
 *
 *  LangGraph state = the shared memory that flows between nodes.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │                     GraphState                              │
 *  │                                                             │
 *  │  messages[]        ← LLM conversation history               │
 *  │  imageData         ← base64 image + mime type               │
 *  │  classification    ← result from the classifier node        │
 *  │  needsHumanReview  ← set by confidence checker              │
 *  │  reviewReason      ← why human review is needed             │
 *  │  retryCount        ← how many times we've retried           │
 *  │  status            ← current stage of the pipeline          │
 *  └─────────────────────────────────────────────────────────────┘
 */

import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { ClassificationResult, RetrievedDocument } from "./types";

export const GraphState = Annotation.Root({
  // Built-in messages array with auto-append reducer
  ...MessagesAnnotation.spec,

  // ── Image input ─────────────────────────────────────────────
  imageData: Annotation<string>({
    reducer: (_prev, val) => val,
    default: () => "",
  }),
  mimeType: Annotation<string>({
    reducer: (_prev, val) => val,
    default: () => "image/png",
  }),
  filename: Annotation<string>({
    reducer: (_prev, val) => val,
    default: () => "",
  }),

  // ── Classification result ───────────────────────────────────
  classification: Annotation<ClassificationResult | null>({
    reducer: (_prev, val) => val,
    default: () => null,
  }),

  // ── Review routing ──────────────────────────────────────────
  needsHumanReview: Annotation<boolean>({
    reducer: (_prev, val) => val,
    default: () => false,
  }),
  reviewReason: Annotation<string>({
    reducer: (_prev, val) => val,
    default: () => "",
  }),

  // ── Pipeline control ────────────────────────────────────────
  retryCount: Annotation<number>({
    reducer: (_prev, val) => val,
    default: () => 0,
  }),
  status: Annotation<"pending" | "classified" | "review" | "done" | "error">({
    reducer: (_prev, val) => val,
    default: () => "pending",
  }),

  // ── Timing ──────────────────────────────────────────────────
  startTime: Annotation<number>({
    reducer: (_prev, val) => val,
    default: () => Date.now(),
  }),

  // ── Pinecone retrieved documents ────────────────────────────
  relevantDocuments: Annotation<RetrievedDocument[]>({
    reducer: (_prev: RetrievedDocument[], val: RetrievedDocument[]) => val,
    default: () => [],
  }),
});

export type GraphStateType = typeof GraphState.State;
