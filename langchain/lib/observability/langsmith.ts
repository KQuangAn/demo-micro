/**
 * ══════════════════════════════════════════════════════════════════
 *  LangSmith Observability Setup
 * ══════════════════════════════════════════════════════════════════
 *
 *  LangSmith traces EVERY call: LLM inputs/outputs, tool calls,
 *  latency, token usage, errors — all in a visual trace tree.
 *
 *  HOW IT WORKS:
 *  LangChain automatically reads these env vars and sends traces
 *  to LangSmith WITHOUT any code changes to your agent/tools.
 *
 *  Required env vars (.env.local):
 *    LANGCHAIN_TRACING_V2=true
 *    LANGCHAIN_API_KEY=ls__xxxx
 *    LANGCHAIN_PROJECT=my-project-name   (optional, defaults to "default")
 *    LANGCHAIN_ENDPOINT=https://api.smith.langchain.com  (optional)
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";

// ─── LangSmith client (singleton) ─────────────────────────────────
// Reads LANGCHAIN_API_KEY from env automatically
let _client: Client | null = null;

export function getLangSmithClient(): Client {
  if (!_client) {
    _client = new Client({
      apiKey: process.env.LANGCHAIN_API_KEY,
      // Optional: custom endpoint for self-hosted LangSmith
      // apiUrl: process.env.LANGCHAIN_ENDPOINT,
    });
  }
  return _client;
}

// ─── Check if tracing is enabled ──────────────────────────────────
export function isTracingEnabled(): boolean {
  return process.env.LANGCHAIN_TRACING_V2 === "true";
}

/**
 * ─── traceable wrapper ─────────────────────────────────────────────
 *
 * Use `traceable` to manually wrap ANY function you want to trace.
 * Useful for non-LangChain code (pure functions, DB calls, etc.)
 *
 * Without traceable: function runs, no visibility
 * With traceable:    function appears as a named span in LangSmith UI
 *
 * Example usage:
 *   const result = await traceableExample("hello");
 *   → Shows up in LangSmith as "my-custom-function" with input/output
 */
export const traceableExample = traceable(
  async (input: string): Promise<string> => {
    // This function's input and output are automatically captured
    return `Processed: ${input}`;
  },
  {
    name: "my-custom-function", // Name shown in LangSmith UI
    run_type: "chain",          // Type: "llm" | "chain" | "tool" | "retriever"
    tags: ["example", "demo"],  // Filter by tags in LangSmith
    metadata: { version: "1.0" }, // Extra metadata attached to the trace
  }
);

/**
 * ─── wrapOpenAI ────────────────────────────────────────────────────
 *
 * If you use the raw OpenAI client (not LangChain wrappers),
 * wrap it to get automatic tracing.
 *
 * NOTE: This project uses Google Gemini via LangChain, so this is
 * shown for reference only. LangChain models trace automatically.
 *
 * Example:
 *   import OpenAI from "openai";
 *   const openai = wrapOpenAI(new OpenAI());  ← wrapped = traced
 *   const openai = new OpenAI();              ← not wrapped = blind
 */
export { wrapOpenAI };

/**
 * ─── createRunTree ─────────────────────────────────────────────────
 *
 * For advanced manual tracing — create parent/child spans yourself.
 * Use this when you need full control over the trace structure.
 *
 * Example: manually trace a multi-step pipeline
 */
export async function runWithManualTrace<T>(
  name: string,
  tags: string[],
  fn: () => Promise<T>
): Promise<T> {
  if (!isTracingEnabled()) {
    // Skip tracing overhead when disabled (e.g., in unit tests)
    return fn();
  }

  // Use traceable for manual tracing — it handles run lifecycle automatically
  const traced = traceable(fn, {
    name,
    run_type: "chain",
    tags,
    metadata: { started_at: new Date().toISOString() },
  });

  return traced();
}

/**
 * ─── Feedback API ──────────────────────────────────────────────────
 *
 * After a run, you can submit human feedback (thumbs up/down, scores).
 * This is how you build evaluation datasets in LangSmith.
 *
 * Usage: call this after a successful agent response
 *   await submitFeedback(runId, "thumbs_up", 1, "Great answer!")
 */
export async function submitFeedback(
  runId: string,
  key: "thumbs_up" | "thumbs_down" | "correctness" | "helpfulness",
  score: number, // 0 or 1 for thumbs, 0.0–1.0 for scored metrics
  comment?: string
): Promise<void> {
  if (!isTracingEnabled()) return;

  const client = getLangSmithClient();
  await client.createFeedback(runId, key, {
    score,
    comment,
  });
}
