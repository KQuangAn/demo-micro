/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — Evaluation Dataset
 * ══════════════════════════════════════════════════════════════════
 *
 *  Golden dataset for evaluating the document classifier agent.
 *
 *  Each example provides:
 *    • imageUrl / imageDescription — the test input
 *    • expectedCategory           — ground truth label
 *    • expectedMinConfidence      — the model should be at least this confident
 *    • expectedFields             — key fields we expect to be extracted
 *    • difficulty                 — easy | medium | hard
 *    • notes                     — why this example is in the dataset
 *
 *  DESIGN PRINCIPLES:
 *  1. Cover every category (cv, invoice, report, etc.)
 *  2. Include "unknown" for non-document images
 *  3. Include edge cases (low quality, ambiguous docs)
 *  4. Use publicly available images that won't expire
 *  5. Each example tests a different aspect of the pipeline
 *
 *  Run:  pnpm eval:classifier
 *
 * ══════════════════════════════════════════════════════════════════
 */

import type { DocumentCategory } from "./types";

// ─── Eval example type ─────────────────────────────────────────────

export interface EvalExample {
  /** Unique ID for this test case */
  id: string;

  /** Public URL to the test image */
  imageUrl: string;

  /** Filename hint (passed to the classifier) */
  filename: string;

  /** MIME type */
  mimeType: string;

  /** Human description of what the image shows */
  imageDescription: string;

  // ── Ground truth ────────────────────────────────────────────
  /** The correct document category */
  expectedCategory: DocumentCategory;

  /** Acceptable alternative categories (partial credit) */
  acceptableCategories?: DocumentCategory[];

  /** Minimum confidence the model should produce */
  expectedMinConfidence: number;

  /** Key fields we expect to find (subset match) */
  expectedFields?: string[];

  /** Should the model flag this for human review? */
  expectHumanReview: boolean;

  // ── Metadata ────────────────────────────────────────────────
  /** Difficulty level */
  difficulty: "easy" | "medium" | "hard";

  /** Why this example is in the dataset */
  notes: string;
}

// ══════════════════════════════════════════════════════════════════
//  THE GOLDEN DATASET
// ══════════════════════════════════════════════════════════════════

export const EVAL_DATASET: EvalExample[] = [
  // ────────────────────────────────────────────────────────────
  //  1. UNKNOWN — non-document photo
  // ────────────────────────────────────────────────────────────
  {
    id: "unknown-photo-landscape",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/0/0c/GoldenGateBridge-001.jpg",
    filename: "golden-gate-bridge.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Photo of the Golden Gate Bridge — clearly not a document",
    expectedCategory: "unknown",
    expectedMinConfidence: 0.0,
    expectHumanReview: true,
    difficulty: "easy",
    notes: "Non-document image should be classified as unknown with low confidence",
  },

  // ────────────────────────────────────────────────────────────
  //  2. REPORT — structured document with tables
  // ────────────────────────────────────────────────────────────
  {
    id: "report-table-document",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "accessibility-report.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "W3C document showing a structured table with data analysis",
    expectedCategory: "report",
    acceptableCategories: ["form"],
    expectedMinConfidence: 0.7,
    expectedFields: ["Disability Categories", "Participants"],
    expectHumanReview: false,
    difficulty: "easy",
    notes: "Clear structured document with tables — should classify as report",
  },

  // ────────────────────────────────────────────────────────────
  //  3. FORM — structured input with checkboxes
  // ────────────────────────────────────────────────────────────
  {
    id: "form-checkbox-input",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/checkbox-702.jpg",
    filename: "survey-form.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Document with checkboxes and fillable fields — typical form layout",
    expectedCategory: "form",
    acceptableCategories: ["report"],
    expectedMinConfidence: 0.6,
    expectHumanReview: false,
    difficulty: "medium",
    notes: "Checkbox form — tests form vs report distinction",
  },

  // ────────────────────────────────────────────────────────────
  //  4. REPORT — another structured document
  // ────────────────────────────────────────────────────────────
  {
    id: "report-paragraph-document",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "quarterly-financial-report.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Same W3C doc but with a financial-report filename hint",
    expectedCategory: "report",
    expectedMinConfidence: 0.7,
    expectHumanReview: false,
    difficulty: "easy",
    notes: "Tests that filename hint reinforces classification",
  },

  // ────────────────────────────────────────────────────────────
  //  5. UNKNOWN — abstract art / non-document
  // ────────────────────────────────────────────────────────────
  {
    id: "unknown-abstract-image",
    imageUrl: "https://picsum.photos/id/24/600/400",
    filename: "random-photo.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Random photograph from picsum — not a document at all",
    expectedCategory: "unknown",
    expectedMinConfidence: 0.0,
    expectHumanReview: true,
    difficulty: "easy",
    notes: "Random photo should be caught as non-document",
  },

  // ────────────────────────────────────────────────────────────
  //  6. PRESENTATION — slide-like layout
  // ────────────────────────────────────────────────────────────
  {
    id: "presentation-slide",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "Q4-2024-presentation-slides.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Document with a presentation-style filename — tests filename hint weight",
    expectedCategory: "report",
    acceptableCategories: ["presentation"],
    expectedMinConfidence: 0.5,
    expectHumanReview: false,
    difficulty: "hard",
    notes:
      "Filename says presentation but content is a table — tests model vs filename conflict",
  },

  // ────────────────────────────────────────────────────────────
  //  7. LETTER — formal letter layout
  // ────────────────────────────────────────────────────────────
  {
    id: "letter-formal",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/link-purpose-702.jpg",
    filename: "cover-letter.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Document page with paragraphs — could be a letter or report",
    expectedCategory: "letter",
    acceptableCategories: ["report", "unknown"],
    expectedMinConfidence: 0.4,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "Ambiguous document — tests model reasoning under uncertainty",
  },

  // ────────────────────────────────────────────────────────────
  //  8. FORM — list structure
  // ────────────────────────────────────────────────────────────
  {
    id: "form-list-structure",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "employee-onboarding-form.pdf.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Structured document with form-style filename",
    expectedCategory: "form",
    acceptableCategories: ["report"],
    expectedMinConfidence: 0.5,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "Filename says form but content is tabular — tests conflict resolution",
  },

  // ────────────────────────────────────────────────────────────
  //  9. CV — resume filename
  // ────────────────────────────────────────────────────────────
  {
    id: "cv-resume-filename",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/link-purpose-702.jpg",
    filename: "john-doe-resume-2024.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Document page — filename strongly hints at CV/resume",
    expectedCategory: "cv",
    acceptableCategories: ["letter", "report", "unknown"],
    expectedMinConfidence: 0.4,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "Filename is the strongest signal — tests filename-driven classification",
  },

  // ────────────────────────────────────────────────────────────
  //  10. INVOICE — invoice filename
  // ────────────────────────────────────────────────────────────
  {
    id: "invoice-filename-hint",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "INV-2024-00891.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Table document with invoice-style filename (INV-YYYY-NNNNN)",
    expectedCategory: "invoice",
    acceptableCategories: ["report", "form"],
    expectedMinConfidence: 0.5,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "Invoice number in filename — tests numeric pattern recognition",
  },

  // ────────────────────────────────────────────────────────────
  //  11. CONTRACT — legal document filename
  // ────────────────────────────────────────────────────────────
  {
    id: "contract-legal-filename",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/link-purpose-702.jpg",
    filename: "NDA-confidentiality-agreement-signed.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Text document with a legal-document filename",
    expectedCategory: "contract",
    acceptableCategories: ["letter", "report", "unknown"],
    expectedMinConfidence: 0.4,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "NDA keyword in filename — tests legal-term recognition",
  },

  // ────────────────────────────────────────────────────────────
  //  12. RECEIPT — small receipt document
  // ────────────────────────────────────────────────────────────
  {
    id: "receipt-purchase",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "walmart-receipt-2024-03-15.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Table document with receipt-style filename",
    expectedCategory: "receipt",
    acceptableCategories: ["invoice", "report", "form"],
    expectedMinConfidence: 0.4,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "Receipt keyword + store name in filename",
  },

  // ────────────────────────────────────────────────────────────
  //  13. MEETING-NOTE — meeting minutes filename
  // ────────────────────────────────────────────────────────────
  {
    id: "meeting-note-minutes",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "team-standup-meeting-notes-2024-04.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Structured document with meeting-notes filename",
    expectedCategory: "meeting-note",
    acceptableCategories: ["report", "form"],
    expectedMinConfidence: 0.4,
    expectHumanReview: false,
    difficulty: "hard",
    notes: "Meeting-notes keyword in filename — tests category inference from name",
  },

  // ────────────────────────────────────────────────────────────
  //  14. UNKNOWN — corrupted / tiny image
  // ────────────────────────────────────────────────────────────
  {
    id: "unknown-tiny-image",
    imageUrl: "https://picsum.photos/id/0/50/50",
    filename: "thumbnail.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Extremely small 50x50 image — too small to classify meaningfully",
    expectedCategory: "unknown",
    expectedMinConfidence: 0.0,
    expectHumanReview: true,
    difficulty: "medium",
    notes: "Tiny image tests graceful degradation — should flag for review",
  },

  // ────────────────────────────────────────────────────────────
  //  15. REPORT — document with headings
  // ────────────────────────────────────────────────────────────
  {
    id: "report-headings",
    imageUrl:
      "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
    filename: "annual-report-2024.jpg",
    mimeType: "image/jpeg",
    imageDescription:
      "Clear report with tables + report filename = strong signal",
    expectedCategory: "report",
    expectedMinConfidence: 0.8,
    expectHumanReview: false,
    difficulty: "easy",
    notes: "Both content and filename agree — tests high-confidence path",
  },
];

// ─── Dataset statistics ────────────────────────────────────────────

export function getDatasetStats() {
  const byCategory = new Map<string, number>();
  const byDifficulty = new Map<string, number>();

  for (const ex of EVAL_DATASET) {
    byCategory.set(ex.expectedCategory, (byCategory.get(ex.expectedCategory) ?? 0) + 1);
    byDifficulty.set(ex.difficulty, (byDifficulty.get(ex.difficulty) ?? 0) + 1);
  }

  return {
    total: EVAL_DATASET.length,
    byCategory: Object.fromEntries(byCategory),
    byDifficulty: Object.fromEntries(byDifficulty),
    categoriesCovered: [...byCategory.keys()],
  };
}
