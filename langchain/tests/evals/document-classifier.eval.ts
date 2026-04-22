/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — LangSmith Evaluation Suite
 * ══════════════════════════════════════════════════════════════════
 *
 *  This is NOT a unit test.  Do NOT run with `pnpm test`.
 *  Run it explicitly: `pnpm eval:classifier`
 *
 *  WHAT IT DOES:
 *  Runs real images through the full document-classifier pipeline
 *  (vision LLM → confidence check → field extraction → Pinecone
 *   retrieval → Cohere rerank), then grades each result with
 *  5 evaluator functions and uploads everything to LangSmith.
 *
 *  PREREQUISITES:
 *  • GROQ_API_KEY          — vision model
 *  • PINECONE_API_KEY      — vector retrieval
 *  • COHERE_API_KEY        — reranking
 *  • LANGSMITH_API_KEY     — eval tracking
 *
 *  HOW TO READ RESULTS:
 *  → Open https://smith.langchain.com
 *  → Find the "document-classifier-eval" experiment
 *  → Each row: image URL | predicted category | pass/fail per metric
 *
 *  Run:
 *    LANGSMITH_TRACING=true pnpm eval:classifier
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";

import { classifyDocument } from "@/lib/document-classifier/graph";
import type { ClassifierOutput } from "@/lib/document-classifier/types";
import { EVAL_DATASET, getDatasetStats, type EvalExample } from "@/lib/document-classifier/eval-dataset";

// ─── Types ────────────────────────────────────────────────────────

interface ClassifierRunOutput extends ClassifierOutput {
  /** echo inputs for evaluator convenience */
  _input: {
    id: string;
    expectedCategory: string;
    acceptableCategories: string[];
    expectedMinConfidence: number;
    expectedFields: string[];
    expectHumanReview: boolean;
  };
}

// ─── Runner: classify one image ───────────────────────────────────

async function classifyAndCapture(
  example: EvalExample
): Promise<ClassifierRunOutput> {
  const result = await classifyDocument({
    image: example.imageUrl,
    mimeType: example.mimeType,
    filename: example.filename,
  });

  return {
    ...result,
    _input: {
      id: example.id,
      expectedCategory: example.expectedCategory,
      acceptableCategories: example.acceptableCategories ?? [],
      expectedMinConfidence: example.expectedMinConfidence,
      expectedFields: example.expectedFields ?? [],
      expectHumanReview: example.expectHumanReview,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
//  EVALUATORS
//
//  Each evaluator returns { key, score (0|1), comment }.
//  LangSmith aggregates these into experiment-level metrics.
// ══════════════════════════════════════════════════════════════════

/**
 * 1. CATEGORY ACCURACY
 *    - score 1  → exact category match
 *    - score 0.5 → matched an acceptable alternative
 *    - score 0  → wrong category
 */
function evaluateCategoryAccuracy({
  run,
}: {
  run: { outputs: ClassifierRunOutput };
}) {
  const { classification, _input } = run.outputs;
  const predicted = classification.category;
  const expected = _input.expectedCategory;
  const acceptable = _input.acceptableCategories;

  if (predicted === expected) {
    return {
      key: "category_accuracy",
      score: 1,
      comment: `Exact match: "${predicted}" ✅`,
    };
  }

  if (acceptable.includes(predicted)) {
    return {
      key: "category_accuracy",
      score: 0.5,
      comment: `Acceptable: predicted "${predicted}", expected "${expected}" (alt: ${acceptable.join(", ")}) ⚠️`,
    };
  }

  return {
    key: "category_accuracy",
    score: 0,
    comment: `Wrong: predicted "${predicted}", expected "${expected}" ❌`,
  };
}

/**
 * 2. CONFIDENCE CALIBRATION
 *    Checks: confidence ≥ expectedMinConfidence
 */
function evaluateConfidenceCalibration({
  run,
}: {
  run: { outputs: ClassifierRunOutput };
}) {
  const { classification, _input } = run.outputs;
  const actual = classification.confidence;
  const minExpected = _input.expectedMinConfidence;

  const passed = actual >= minExpected;

  return {
    key: "confidence_calibration",
    score: passed ? 1 : 0,
    comment: passed
      ? `Confidence ${actual.toFixed(2)} ≥ ${minExpected} ✅`
      : `Confidence ${actual.toFixed(2)} < ${minExpected} — under-confident ❌`,
  };
}

/**
 * 3. FIELD EXTRACTION
 *    If expectedFields is non-empty, checks that extracted_fields
 *    contains at least one of them (case-insensitive key match).
 */
function evaluateFieldExtraction({
  run,
}: {
  run: { outputs: ClassifierRunOutput };
}) {
  const { classification, _input } = run.outputs;
  const expectedFields = _input.expectedFields;

  // No fields expected → auto-pass
  if (expectedFields.length === 0) {
    return {
      key: "field_extraction",
      score: 1,
      comment: "No fields expected — skipped ✅",
    };
  }

  const extractedKeys = Object.keys(classification.extracted_fields ?? {}).map(
    (k) => k.toLowerCase()
  );

  const matched = expectedFields.filter((f) =>
    extractedKeys.some((ek) => ek.includes(f.toLowerCase()) || f.toLowerCase().includes(ek))
  );

  const ratio = matched.length / expectedFields.length;
  const passed = ratio > 0;

  return {
    key: "field_extraction",
    score: passed ? 1 : 0,
    comment: passed
      ? `Extracted ${matched.length}/${expectedFields.length} expected fields: [${matched.join(", ")}] ✅`
      : `Missing all expected fields: [${expectedFields.join(", ")}]. Got keys: [${extractedKeys.join(", ")}] ❌`,
  };
}

/**
 * 4. HUMAN REVIEW ROUTING
 *    Checks that needsHumanReview matches expectHumanReview.
 */
function evaluateHumanReviewRouting({
  run,
}: {
  run: { outputs: ClassifierRunOutput };
}) {
  const { needsHumanReview, _input } = run.outputs;
  const expected = _input.expectHumanReview;
  const passed = needsHumanReview === expected;

  return {
    key: "human_review_routing",
    score: passed ? 1 : 0,
    comment: passed
      ? `Review flag correct: ${needsHumanReview} ✅`
      : `Review flag wrong: got ${needsHumanReview}, expected ${expected} ❌`,
  };
}

/**
 * 5. RETRIEVAL & RERANKING
 *    Checks that the pipeline produced relevant documents
 *    (only for successfully classified docs, not unknowns).
 */
function evaluateRetrievalPipeline({
  run,
}: {
  run: { outputs: ClassifierRunOutput };
}) {
  const { relevantDocuments, needsHumanReview, classification } = run.outputs;

  // If flagged for review or unknown, retrieval may not fire — auto-pass
  if (needsHumanReview || classification.category === "unknown") {
    return {
      key: "retrieval_pipeline",
      score: 1,
      comment: "Skipped — flagged for review or unknown category ✅",
    };
  }

  const docs = relevantDocuments ?? [];
  const hasDocuments = docs.length > 0;
  const hasRerankedScores = docs.some((d) => d.score > 0 && d.score <= 1);

  if (hasDocuments && hasRerankedScores) {
    return {
      key: "retrieval_pipeline",
      score: 1,
      comment: `Retrieved ${docs.length} docs with reranked scores ✅`,
    };
  }

  if (hasDocuments) {
    return {
      key: "retrieval_pipeline",
      score: 0.5,
      comment: `Retrieved ${docs.length} docs but reranking scores look off ⚠️`,
    };
  }

  return {
    key: "retrieval_pipeline",
    score: 0,
    comment: `No documents retrieved — pipeline may have failed ❌`,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  REASONING QUALITY — bonus evaluator
//  Checks that the model provided meaningful reasoning
// ═══════════════════════════════════════════════════════════════════

function evaluateReasoningQuality({
  run,
}: {
  run: { outputs: ClassifierRunOutput };
}) {
  const reasoning = run.outputs.classification.reasoning ?? "";
  const wordCount = reasoning.split(/\s+/).filter(Boolean).length;
  const passed = wordCount >= 5;

  return {
    key: "reasoning_quality",
    score: passed ? 1 : 0,
    comment: passed
      ? `Reasoning has ${wordCount} words ✅`
      : `Reasoning too short (${wordCount} words): "${reasoning}" ❌`,
  };
}

// ─── Main: orchestrate the evaluation ─────────────────────────────

async function runDocumentClassifierEval() {
  const stats = getDatasetStats();
  console.log("🔬 Starting Document Classifier Evaluation");
  console.log("═".repeat(60));
  console.log(`   Dataset size:      ${stats.total} examples`);
  console.log(`   Categories:        ${stats.categoriesCovered.join(", ")}`);
  console.log(`   By difficulty:     ${JSON.stringify(stats.byDifficulty)}`);
  console.log(`   By category:       ${JSON.stringify(stats.byCategory)}`);
  console.log("");
  console.log("   ⚡ This will make real API calls (Groq + Pinecone + Cohere)");
  console.log("   ⏱  Estimated time: 2–5 minutes\n");

  // ── Step 1: Create/update dataset in LangSmith ──────────────────

  const client = new Client();
  const datasetName = "document-classifier-eval";

  let dataset;
  try {
    dataset = await client.readDataset({ datasetName });
    console.log(`📂 Using existing dataset: "${datasetName}"`);
  } catch {
    dataset = await client.createDataset(datasetName, {
      description:
        "Golden dataset for document classifier — covers all 10 categories + edge cases",
    });

    await client.createExamples({
      inputs: EVAL_DATASET.map((d) => ({
        id: d.id,
        imageUrl: d.imageUrl,
        filename: d.filename,
        mimeType: d.mimeType,
        imageDescription: d.imageDescription,
        difficulty: d.difficulty,
      })),
      outputs: EVAL_DATASET.map((d) => ({
        expectedCategory: d.expectedCategory,
        acceptableCategories: d.acceptableCategories ?? [],
        expectedMinConfidence: d.expectedMinConfidence,
        expectedFields: d.expectedFields ?? [],
        expectHumanReview: d.expectHumanReview,
      })),
      datasetId: dataset.id,
    });
    console.log(
      `📂 Created dataset "${datasetName}" with ${EVAL_DATASET.length} examples`
    );
  }

  // ── Step 2: Run evaluation ──────────────────────────────────────

  console.log("\n🚀 Running evaluation...\n");

  const results = await evaluate(
    // Target function: receives LangSmith example inputs, returns classifier output
    async (input: Record<string, string>) => {
      // Find the matching example from our dataset for full metadata
      const example = EVAL_DATASET.find((d) => d.id === input.id);
      if (!example) {
        throw new Error(`Unknown example ID: ${input.id}`);
      }
      return classifyAndCapture(example);
    },
    {
      data: datasetName,
      evaluators: [
        evaluateCategoryAccuracy as any,
        evaluateConfidenceCalibration as any,
        evaluateFieldExtraction as any,
        evaluateHumanReviewRouting as any,
        evaluateRetrievalPipeline as any,
        evaluateReasoningQuality as any,
      ],
      experimentPrefix: "document-classifier-eval",
      maxConcurrency: 2, // throttle to avoid API rate limits
      metadata: {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        provider: "groq",
        retrieval: "pinecone",
        reranker: "cohere-rerank-v3.5",
        date: new Date().toISOString(),
      },
    }
  );

  // ── Step 3: Print detailed results ──────────────────────────────

  console.log("\n📊 Evaluation Results");
  console.log("═".repeat(60));

  const metrics: Record<string, { passed: number; total: number }> = {};
  let totalExamples = 0;
  let fullyPassed = 0;

  for await (const result of results) {
    totalExamples++;
    const evalResults = result.evaluationResults?.results ?? [];
    const allPassed = evalResults.every((r) => Number(r.score ?? 0) >= 1);
    if (allPassed) fullyPassed++;

    // Aggregate per-metric
    for (const r of evalResults) {
      if (!metrics[r.key]) metrics[r.key] = { passed: 0, total: 0 };
      metrics[r.key].total++;
      if (Number(r.score ?? 0) >= 1) metrics[r.key].passed++;
    }

    // Per-example output
    const icon = allPassed ? "✅" : "❌";
    const id = String(result.run?.inputs?.id ?? "?").padEnd(30);
    console.log(`\n${icon} ${id}`);
    for (const r of evalResults) {
      const scoreIcon = Number(r.score ?? 0) >= 1 ? "✅" : Number(r.score ?? 0) >= 0.5 ? "⚠️" : "❌";
      console.log(`   ${scoreIcon} ${r.key}: ${r.score} — ${r.comment}`);
    }
  }

  // ── Step 4: Summary table ───────────────────────────────────────

  console.log("\n" + "═".repeat(60));
  console.log("📈 METRIC SUMMARY");
  console.log("─".repeat(60));

  for (const [key, { passed, total }] of Object.entries(metrics)) {
    const pct = ((passed / total) * 100).toFixed(0);
    const bar = "█".repeat(Math.round((passed / total) * 20)).padEnd(20, "░");
    console.log(`   ${key.padEnd(25)} ${bar} ${passed}/${total} (${pct}%)`);
  }

  console.log("─".repeat(60));
  console.log(
    `\n🏁 Overall: ${fullyPassed}/${totalExamples} examples fully passed (${((fullyPassed / totalExamples) * 100).toFixed(0)}%)`
  );
  console.log("\n📈 View full traces at: https://smith.langchain.com");
  console.log(
    `   Project: ${process.env.LANGSMITH_PROJECT ?? process.env.LANGCHAIN_PROJECT ?? "default"}`
  );
  console.log(`   Experiment: document-classifier-eval`);
}

// ─── Entry point ──────────────────────────────────────────────────

runDocumentClassifierEval().catch((err) => {
  console.error("❌ Evaluation failed:", err);
  process.exit(1);
});
