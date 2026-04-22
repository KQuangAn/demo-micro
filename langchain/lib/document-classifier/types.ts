/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — Types
 * ══════════════════════════════════════════════════════════════════
 */

import { z } from "zod";

// ─── Supported document categories ─────────────────────────────────
export const DOCUMENT_CATEGORIES = [
  "cv",
  "invoice",
  "meeting-note",
  "contract",
  "receipt",
  "letter",
  "report",
  "form",
  "presentation",
  "unknown",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// ─── Zod schema for structured LLM output ─────────────────────────
export const ClassificationResultSchema = z.object({
  category: z
    .enum(DOCUMENT_CATEGORIES)
    .describe("The document type category"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score between 0 and 1"),
  reasoning: z
    .string()
    .describe("Brief explanation of why this category was chosen"),
  extracted_fields: z
    .record(z.string(), z.any())
    .optional()
    .describe("Key fields extracted from the document (e.g. name, date, total)"),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ─── Pinecone match (from vector store) ────────────────────────────
export interface RetrievedDocument {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, string>;
}

// ─── Input to the classifier ───────────────────────────────────────
export interface DocumentInput {
  /** Base64-encoded image data or a URL */
  image: string;
  /** MIME type: "image/png", "image/jpeg", "image/webp", etc. */
  mimeType: string;
  /** Optional filename for context */
  filename?: string;
}

// ─── Final output ──────────────────────────────────────────────────
export interface ClassifierOutput {
  classification: ClassificationResult;
  needsHumanReview: boolean;
  reviewReason?: string;
  processingTimeMs: number;
  relevantDocuments?: RetrievedDocument[];
}
