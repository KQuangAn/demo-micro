/**
 * ══════════════════════════════════════════════════════════════════
 *  POST /api/ec2/simple — Simple Agent endpoint
 * ══════════════════════════════════════════════════════════════════
 *
 *  Single-pass agent. No memory between requests.
 *  Faster, cheaper, but no follow-up context.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { getModel } from "@/lib/model-cache";
import { runSimpleAgent } from "@/lib/ec2/simple-agent";

const RequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  model: z.string().optional(),
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

    const { message, model: modelName } = parsed.data;
    const model = getModel(modelName || "llama-3.1-8b-instant", 0.3);

    const startTime = Date.now();
    const response = await runSimpleAgent(message, model);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      message: response,
      agent: "simple",
      durationMs: duration,
    });
  } catch (error) {
    console.error("Simple agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
