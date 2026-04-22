import { NextRequest } from "next/server";
import { getModel } from "@/lib/model-cache";

export const runtime = "nodejs"; // need Node runtime for LangChain + streams

/**
 * POST /api/llm-stream
 *
 * Body: { prompt: string, model?: string }
 *
 * Returns a streaming text/event-stream (SSE) response.
 *
 * Flow:
 *   1. Parse + validate request
 *   2. Call model.stream() → AsyncGenerator<AIMessageChunk>
 *   3. Wrap in a ReadableStream, convert each chunk → SSE "data:" line
 *   4. Send [DONE] sentinel at the end
 *
 * Why SSE (Server-Sent Events) over raw text/plain?
 *   • SSE is a browser-native protocol — EventSource / ReadableStream both support it
 *   • Each event is "data: <payload>\n\n" so the client can parse structured JSON
 *   • The [DONE] sentinel tells the client the stream is finished (same as OpenAI)
 *   • Works through all HTTP/1.1 proxies without extra config
 */
export async function POST(req: NextRequest) {
  let prompt: string;
  let modelName: string;

  try {
    const body = await req.json();
    prompt = (body.prompt as string)?.trim();
    modelName = (body.model as string) || "llama-3.1-8b-instant";

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get the abort signal from the request (fires when client disconnects)
  const { signal } = req;

  const model = getModel(modelName, 0.7);

  /**
   * Build a WHATWG ReadableStream that wraps the LangChain AsyncGenerator.
   *
   * ReadableStream constructor takes a "source" object with:
   *   start(controller)  — called once immediately, we use it to kick off async work
   *   cancel()           — called when the consumer cancels (e.g. client closes tab)
   *
   * controller.enqueue(chunk) — pushes a Uint8Array chunk to the browser
   * controller.close()        — signals end-of-stream
   * controller.error(err)     — signals error, closes stream
   */
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper: send one SSE event
      function send(data: string) {
        // SSE format: "data: <payload>\n\n"
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      try {
        const llmStream = await model.stream(prompt);

        for await (const chunk of llmStream) {
          // Check if client disconnected mid-stream
          if (signal.aborted) break;

          // Extract text from AIMessageChunk
          let text = "";
          if (typeof chunk.content === "string") {
            text = chunk.content;
          } else if (Array.isArray(chunk.content)) {
            text = chunk.content
              .map((c) =>
                typeof c === "string" ? c : (c as { text?: string }).text ?? ""
              )
              .join("");
          }

          if (text) {
            // Send as JSON so the client can parse structured data
            send(JSON.stringify({ token: text }));
          }
        }

        // SSE done sentinel (mirrors OpenAI streaming protocol)
        send("[DONE]");
      } catch (err: unknown) {
        const e = err as Error;
        if (e.name === "AbortError" || signal.aborted) {
          // Client disconnected — close silently
          send("[DONE]");
        } else {
          send(JSON.stringify({ error: e.message }));
        }
      } finally {
        controller.close();
      }
    },

    cancel() {
      // Called when the browser closes the connection
      // LangChain stream will be garbage-collected; for-await loop exits on next tick
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Allow CORS if needed
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
