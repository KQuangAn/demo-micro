/**
 * ══════════════════════════════════════════════════════════════════
 *  Document Classifier — CLI Runner
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run:  pnpm classify-doc
 *
 *  Demonstrates:
 *    1. Classifying a document from a URL (public image)
 *    2. Classifying a document from a local file (base64)
 *    3. Full LangSmith tracing (check your LangSmith dashboard)
 *
 *  Graph trace appears at:
 *    https://smith.langchain.com → project "document-classifier"
 *
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { classifyDocument } from "./graph";
import type { DocumentInput } from "./types";

// ─── Env validation ────────────────────────────────────────────────
function checkEnv() {
  const required = ["GROQ_API_KEY", "PINECONE_API_KEY", "COHERE_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌ Missing env vars: ${missing.join(", ")}`);
    console.error("   Set them in langchain/.env");
    process.exit(1);
  }

  // LangSmith tracing config
  if (process.env.LANGCHAIN_TRACING_V2 === "true") {
    // Override project name for this agent
    process.env.LANGSMITH_PROJECT = "document-classifier";
    console.log("🔍 LangSmith tracing enabled → project: document-classifier");
  } else {
    console.log("ℹ️  LangSmith tracing disabled (set LANGCHAIN_TRACING_V2=true to enable)");
  }
}

// ─── Demo: classify from URL ───────────────────────────────────────
async function classifyFromUrl(url: string, filename: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Classifying: ${filename}`);
  console.log(`  Source: URL`);
  console.log(`${"═".repeat(60)}`);

  const input: DocumentInput = {
    image: url,
    mimeType: "image/jpeg",
    filename,
  };

  const result = await classifyDocument(input);

  printResult(result);
  return result;
}

// ─── Demo: classify from local file ────────────────────────────────
async function classifyFromFile(filePath: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Classifying: ${path.basename(filePath)}`);
  console.log(`  Source: local file`);
  console.log(`${"═".repeat(60)}`);

  if (!existsSync(filePath)) {
    console.error(`  ❌ File not found: ${filePath}`);
    return null;
  }

  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };

  const input: DocumentInput = {
    image: base64,
    mimeType: mimeMap[ext] || "image/png",
    filename: path.basename(filePath),
  };

  const result = await classifyDocument(input);
  printResult(result);
  return result;
}

// ─── Print result ──────────────────────────────────────────────────
function printResult(result: Awaited<ReturnType<typeof classifyDocument>>) {
  const c = result.classification;
  console.log(`\n  ┌────────────────────────────────────────────────┐`);
  console.log(`  │  RESULT                                        │`);
  console.log(`  ├────────────────────────────────────────────────┤`);
  console.log(`  │  Category:    ${c.category.padEnd(33)}│`);
  console.log(`  │  Confidence:  ${(c.confidence * 100).toFixed(1).padStart(5)}%${"".padEnd(27)}│`);
  console.log(`  │  Reasoning:   ${c.reasoning.slice(0, 33).padEnd(33)}│`);
  if (c.extracted_fields && Object.keys(c.extracted_fields).length > 0) {
    console.log(`  │  Fields:                                       │`);
    for (const [key, val] of Object.entries(c.extracted_fields)) {
      const line = `    ${key}: ${val}`;
      console.log(`  │  ${line.slice(0, 46).padEnd(46)}│`);
    }
  }
  console.log(`  │  Human review: ${result.needsHumanReview ? "YES ⚠️" : "No ✅"}${"".padEnd(result.needsHumanReview ? 24 : 26)}│`);
  if (result.reviewReason) {
    console.log(`  │  Reason: ${result.reviewReason.slice(0, 38).padEnd(38)}│`);
  }
  console.log(`  │  Time:        ${String(result.processingTimeMs).padStart(5)} ms${"".padEnd(24)}│`);
  console.log(`  └────────────────────────────────────────────────┘`);

  // ── Pinecone + Cohere reranked documents ─────────────────────
  if (result.relevantDocuments && result.relevantDocuments.length > 0) {
    console.log(`\n  📚 Relevant documents (Pinecone → Cohere reranked, top ${result.relevantDocuments.length}):`);
    console.log(`  ${"─".repeat(56)}`);
    for (const [i, doc] of result.relevantDocuments.entries()) {
      const score = (doc.score * 100).toFixed(1);
      const title = doc.metadata.title || doc.id;
      const preview = doc.text.replace(/\n/g, " ").slice(0, 70);
      console.log(`  ${i + 1}. [${score}% relevance] ${title}`);
      if (doc.metadata.date) console.log(`     📅 ${doc.metadata.date}`);
      if (doc.metadata.location) console.log(`     📍 ${doc.metadata.location}`);
      console.log(`     ${preview}...`);
      console.log();
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  DOCUMENT CLASSIFIER — LangGraph Agent                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  checkEnv();

  // Check if user provided a local file path as argument
  const argFile = process.argv[2];
  if (argFile) {
    const absPath = path.resolve(argFile);
    await classifyFromFile(absPath);
    return;
  }

  // Demo: classify sample document images from URLs
  // Using public sample document images
  const samples = [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/0/0c/GoldenGateBridge-001.jpg",
      filename: "golden-gate-bridge.jpg",
      expected: "unknown", // Not a document — tests "unknown" category
    },
    {
      url: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
      filename: "document-table.jpg",
      expected: "report", // A structured document with tables
    },
  ];

  console.log(`\n  Running ${samples.length} demo classifications...\n`);

  for (const sample of samples) {
    const result = await classifyFromUrl(sample.url, sample.filename);
    if (result) {
      const match = result.classification.category === sample.expected;
      console.log(
        `  Expected: ${sample.expected}  Got: ${result.classification.category}  ${match ? "✅" : "⚠️"}`
      );
    }
  }

  console.log(`\n  ✅ Done. Check LangSmith dashboard for full traces.`);
  console.log(`  🔗 https://smith.langchain.com\n`);
}

main().catch(console.error);
