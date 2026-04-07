/**
 * ══════════════════════════════════════════════════════════════════
 *  POST /api/ec2/react — ReAct Agent endpoint (with memory)
 * ══════════════════════════════════════════════════════════════════
 *
 *  Multi-step reasoning agent with conversation memory.
 *  Persists state via checkpointer keyed by threadId.
 *  Slower but handles complex multi-step questions.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { getModel } from "@/lib/model-cache";
import { runReactAgent, getThreadHistory } from "@/lib/ec2/react-agent";

const RequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  model: z.string().optional(),
  threadId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { message, model: modelName, threadId } = parsed.data;
    const model = getModel(modelName || "llama-3.1-8b-instant", 0.3);

    const resolvedThreadId =
      threadId || `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const startTime = Date.now();
    const { response, steps } = await runReactAgent(
      message,
      model,
      resolvedThreadId
    );
    const duration = Date.now() - startTime;

    return NextResponse.json({
      message: response,
      agent: "react",
      threadId: resolvedThreadId,
      reasoningSteps: steps,
      durationMs: duration,
    });
  } catch (error) {
    console.error("ReAct agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/* ─── GET /api/ec2/react?threadId=xxx — get conversation history ── */

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json(
      { error: "threadId query parameter required" },
      { status: 400 }
    );
  }

  const history = await getThreadHistory(threadId);
  return NextResponse.json({ threadId, history });
}
