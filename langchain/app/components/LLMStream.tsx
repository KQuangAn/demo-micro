"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  /** true while tokens are still arriving */
  streaming?: boolean;
  /** ms taken to complete */
  elapsed?: number;
  /** total tokens received */
  tokenCount?: number;
}

const MODELS = [
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (fast)" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (smart)" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8×7B" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Parse a raw SSE line like "data: {...}" and return the payload string.
 * Returns null for empty / comment lines.
 */
function parseSseLine(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  return line.slice("data:".length).trim();
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LLMStreamPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref — lets us cancel mid-stream
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isStreaming) return;

    setError(null);
    setInput("");
    setIsStreaming(true);

    // Add user message immediately
    const userMsg: Message = { id: uid(), role: "user", content: prompt };
    // Add empty assistant placeholder that we'll fill token-by-token
    const assistantId = uid();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);

    // Create AbortController so the "Stop" button can cancel
    const ac = new AbortController();
    abortRef.current = ac;
    const startTime = Date.now();
    let tokenCount = 0;

    try {
      /**
       * fetch() with the AbortSignal.
       * We POST the prompt to our SSE route and read the response body
       * as a stream using the WHATWG Streams API (response.body.getReader()).
       *
       * WHY NOT EventSource?
       *   EventSource is GET-only and can't send a body.
       *   We use fetch() + ReadableStream instead — same SSE protocol.
       */
      const res = await fetch("/api/llm-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      /**
       * Read the SSE stream chunk-by-chunk.
       *
       * res.body is a WHATWG ReadableStream<Uint8Array>.
       * We:
       *   1. Get a reader
       *   2. Decode each Uint8Array chunk into a string
       *   3. Split on "\n" to get individual SSE lines
       *   4. Parse "data: ..." lines
       *   5. Update the assistant message in React state per token
       *
       * leftover — accumulates partial lines across network chunks
       * (a single fetch chunk may contain part of a line)
       */

      console.log(res, typeof res);
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(value,'chunk');
        // Decode this network chunk (stream:true keeps multi-byte chars safe)
        buffer += decoder.decode(value, { stream: true });

        // Split on newline — last element may be an incomplete line
        const lines = buffer.split("\n");
        console.log(lines, "lines");
        // Keep the last (possibly partial) line in the buffer for next iteration
        // Everything before it is a complete line we can process now
        buffer = lines.pop() ?? "";
        console.log(buffer, "buffer poped");

        for (const line of lines) {
          // Skip blank lines and SSE comment lines (":...")
          if (!line.startsWith("data:")) continue;

          const payload = line.slice("data:".length).trim();

          if (payload === "[DONE]") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      streaming: false,
                      elapsed: Date.now() - startTime,
                      tokenCount,
                    }
                  : m,
              ),
            );
            return; // ← exit the whole while loop cleanly
          }

          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              tokenCount++;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.token }
                    : m,
                ),
              );
            }
          } catch {
            // Incomplete JSON or non-data line — skip silently
          }
        }
      }
      reader.releaseLock();
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === "AbortError") {
        // User clicked Stop — mark message as cancelled
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: m.content + "\n\n_[cancelled by user]_",
                  elapsed: Date.now() - startTime,
                  tokenCount,
                }
              : m,
          ),
        );
      } else {
        setError(e.message);
        // Remove empty placeholder if nothing was received
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === "")),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, model, isStreaming]);

  // ── Stop handler ───────────────────────────────────────────────────────────

  const stopStream = () => {
    abortRef.current?.abort("user cancelled");
  };

  // ── Keyboard submit ────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold">
            ⚡
          </div>
          <div>
            <h1 className="text-lg font-semibold">LLM Stream Demo</h1>
            <p className="text-xs text-gray-400">
              Real-time token streaming via SSE
            </p>
          </div>
        </div>

        {/* Model picker */}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={isStreaming}
          className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
            <div className="text-5xl">💬</div>
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm text-center max-w-sm">
              Tokens stream back in real-time using{" "}
              <code className="bg-gray-800 px-1 rounded text-indigo-400">
                Server-Sent Events
              </code>{" "}
              — watch them appear one by one.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Error banner */}
        {error && (
          <div className="mx-auto max-w-2xl bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input bar ── */}
      <footer className="border-t border-gray-800 bg-gray-900 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
            placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 max-h-40 overflow-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />

          {isStreaming ? (
            <button
              onClick={stopStream}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-sm bg-white" />
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Send ↵
            </button>
          )}
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          Powered by Groq · Streaming via{" "}
          <span className="text-gray-500">fetch() + ReadableStream + SSE</span>
        </p>
      </footer>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`flex gap-3 max-w-3xl mx-auto ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
          isUser ? "bg-indigo-600" : "bg-gray-700"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-1 min-w-0">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-gray-800 text-gray-100 rounded-tl-sm"
          }`}
        >
          {msg.content}

          {/* Blinking cursor while streaming */}
          {msg.streaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-indigo-400 align-middle animate-pulse rounded-sm" />
          )}

          {/* Empty state while waiting for first token */}
          {msg.streaming && msg.content === "" && (
            <span className="text-gray-500 italic text-xs">Thinking…</span>
          )}
        </div>

        {/* Stats row (shown after stream completes) */}
        {!msg.streaming && msg.elapsed !== undefined && (
          <div className="flex gap-3 text-xs text-gray-600 px-1">
            <span>⏱ {(msg.elapsed / 1000).toFixed(2)}s</span>
            {msg.tokenCount !== undefined && (
              <span>🔤 {msg.tokenCount} chunks</span>
            )}
            {msg.elapsed > 0 && msg.tokenCount !== undefined && (
              <span>
                ⚡ {((msg.tokenCount / msg.elapsed) * 1000).toFixed(1)} chunks/s
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
