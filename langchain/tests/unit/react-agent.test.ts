/**
 * ══════════════════════════════════════════════════════════════════
 *  Unit Tests: react-agent.ts + LangSmith Observability
 * ══════════════════════════════════════════════════════════════════
 *
 *  STRATEGY: Mock the LangGraph agent entirely.
 *  We are NOT testing LangChain internals — we test OUR code:
 *    • Does runReactAgent extract the response correctly?
 *    • Does it count tool-call steps correctly?
 *    • Does getThreadHistory parse checkpoints correctly?
 *    • Does it handle edge cases (empty messages, errors)?
 *
 *  LangSmith observability is tested by verifying:
 *    • Tracing env vars are respected
 *    • Feedback submission works when enabled
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock LangGraph before importing react-agent ──────────────────
//
// vi.mock() is HOISTED to the top of the file by Vitest at compile time,
// meaning it runs BEFORE any variable declarations (const/let).
// vi.hoisted() is the escape hatch — code inside it ALSO runs at hoist time,
// so variables declared there are available inside vi.mock() factories.

const { mockAgentInvoke, mockCheckpointerGet } = vi.hoisted(() => ({
  mockAgentInvoke: vi.fn(),
  mockCheckpointerGet: vi.fn(),
}));

vi.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: vi.fn(() => ({
    invoke: mockAgentInvoke,
  })),
}));

// react-agent.ts also imports createAgent from "langchain" — mock both
vi.mock("langchain", () => ({
  createAgent: vi.fn(() => ({ invoke: mockAgentInvoke })),
}));

vi.mock("@langchain/langgraph", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MemorySaver: vi.fn().mockImplementation(function (this: any) {
    this.get = mockCheckpointerGet;
  }),
}));

vi.mock("@/lib/ec2/sg-sync", () => ({
  ensureSynced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ec2/tools", () => ({
  ec2Tools: [],
}));

import { runReactAgent, getThreadHistory } from "@/lib/ec2/react-agent";

// ─── Message factory helpers ───────────────────────────────────────
// Mirror how LangChain message objects look

function makeAIMessage(content: string) {
  return {
    _getType: () => "ai",
    content,
  };
}

function makeHumanMessage(content: string) {
  return {
    _getType: () => "human",
    content,
  };
}

function makeToolMessage(content: string) {
  return {
    _getType: () => "tool",
    content,
  };
}

// ─── Tests: runReactAgent ─────────────────────────────────────────

describe("runReactAgent", () => {
  // Create a minimal mock model — we never call it in unit tests
  const mockModel = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts the last AI message as the response", async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [
        makeHumanMessage("what is port 22?"),
        makeToolMessage("list_security_groups result"),
        makeAIMessage("Port 22 is SSH. Here are your groups..."),
      ],
    });

    const { response, steps } = await runReactAgent("what is port 22?", mockModel, "thread-1");

    expect(response).toBe("Port 22 is SSH. Here are your groups...");
  });

  it("counts tool messages as reasoning steps", async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [
        makeHumanMessage("audit my infrastructure"),
        makeToolMessage("list groups result"),  // step 1
        makeToolMessage("analyze all result"),  // step 2
        makeAIMessage("Here is the full audit report..."),
      ],
    });

    const { steps } = await runReactAgent("audit", mockModel, "thread-1");

    expect(steps).toBe(2);
  });

  it("returns 0 steps when the agent answers directly (no tool calls)", async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [
        makeHumanMessage("hello"),
        makeAIMessage("Hi! How can I help you with EC2 security?"),
      ],
    });

    const { steps } = await runReactAgent("hello", mockModel, "thread-2");

    expect(steps).toBe(0);
  });

  it("returns fallback message when no AI message found in response", async () => {
    // Edge case: agent returns only tool messages (shouldn't happen but handle gracefully)
    mockAgentInvoke.mockResolvedValue({
      messages: [
        makeToolMessage("some tool result"),
      ],
    });

    const { response } = await runReactAgent("test", mockModel, "thread-3");

    expect(response).toContain("wasn't able to generate");
  });

  it("skips empty AI message content and finds last non-empty one", async () => {
    // Sometimes the model returns intermediate AI messages with no content
    mockAgentInvoke.mockResolvedValue({
      messages: [
        makeHumanMessage("list groups"),
        { _getType: () => "ai", content: "" },   // empty — skip
        makeToolMessage("tool result"),
        makeAIMessage("Here are your security groups."), // use this one
      ],
    });

    const { response } = await runReactAgent("list groups", mockModel, "thread-4");

    expect(response).toBe("Here are your security groups.");
  });

  it("passes the correct threadId to the agent configurable", async () => {
    mockAgentInvoke.mockResolvedValue({
      messages: [makeAIMessage("response")],
    });

    await runReactAgent("test message", mockModel, "my-custom-thread-id");

    expect(mockAgentInvoke).toHaveBeenCalledWith(
      { messages: [{ role: "user", content: "test message" }] },
      { configurable: { thread_id: "my-custom-thread-id" } }
    );
  });
});

// ─── Tests: getThreadHistory ──────────────────────────────────────

describe("getThreadHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted message history from checkpoint", async () => {
    mockCheckpointerGet.mockResolvedValue({
      channel_values: {
        messages: [
          makeHumanMessage("list my security groups"),
          makeAIMessage("You have 3 security groups."),
          makeHumanMessage("which ones have SSH open?"),
          makeAIMessage("sg-web001 has SSH open on port 22."),
        ],
      },
    });

    const history = await getThreadHistory("thread-abc");

    expect(history).toHaveLength(4);
    expect(history[0]).toBe("human: list my security groups");
    expect(history[1]).toBe("ai: You have 3 security groups.");
  });

  it("filters out tool messages from history (not user-facing)", async () => {
    mockCheckpointerGet.mockResolvedValue({
      channel_values: {
        messages: [
          makeHumanMessage("audit"),
          makeToolMessage("internal tool result"), // should be filtered
          makeAIMessage("Audit complete."),
        ],
      },
    });

    const history = await getThreadHistory("thread-xyz");

    // Only human + ai messages — tool messages are internal
    expect(history).toHaveLength(2);
    expect(history.every((m) => !m.startsWith("tool:"))).toBe(true);
  });

  it("returns empty array when checkpoint has no messages", async () => {
    mockCheckpointerGet.mockResolvedValue({
      channel_values: {}, // no messages key
    });

    const history = await getThreadHistory("empty-thread");

    expect(history).toEqual([]);
  });

  it("returns empty array when checkpoint is null (new thread)", async () => {
    mockCheckpointerGet.mockResolvedValue(null);

    const history = await getThreadHistory("new-thread");

    expect(history).toEqual([]);
  });

  it("returns empty array when checkpointer throws", async () => {
    // Network errors, missing checkpoint storage, etc. — fail gracefully
    mockCheckpointerGet.mockRejectedValue(new Error("checkpointer unavailable"));

    const history = await getThreadHistory("broken-thread");

    expect(history).toEqual([]);
  });
});

// ─── Tests: LangSmith observability integration ───────────────────
// These tests verify the tracing environment is configured correctly
// They do NOT call LangSmith — they just verify setup logic

describe("LangSmith observability setup", () => {
  it("tracing is disabled during unit tests (from setup.ts)", () => {
    // Verify our test setup correctly disables tracing
    expect(process.env.LANGCHAIN_TRACING_V2).toBe("false");
  });

  it("isTracingEnabled returns false when env var is false", async () => {
    const { isTracingEnabled } = await import("@/lib/observability/langsmith");
    expect(isTracingEnabled()).toBe(false);
  });

  it("isTracingEnabled returns true when env var is 'true'", async () => {
    const originalValue = process.env.LANGCHAIN_TRACING_V2;

    process.env.LANGCHAIN_TRACING_V2 = "true";
    // Force module to re-evaluate the env var
    const { isTracingEnabled } = await import("@/lib/observability/langsmith");
    expect(isTracingEnabled()).toBe(true);

    // Restore
    process.env.LANGCHAIN_TRACING_V2 = originalValue;
  });

  it("runWithManualTrace executes the function when tracing disabled", async () => {
    const { runWithManualTrace } = await import("@/lib/observability/langsmith");
    const mockFn = vi.fn().mockResolvedValue("result");

    const result = await runWithManualTrace("test-trace", ["tag1"], mockFn);

    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe("result");
  });

  it("runWithManualTrace propagates errors from the wrapped function", async () => {
    const { runWithManualTrace } = await import("@/lib/observability/langsmith");
    const failingFn = vi.fn().mockRejectedValue(new Error("something went wrong"));

    await expect(
      runWithManualTrace("error-trace", [], failingFn)
    ).rejects.toThrow("something went wrong");
  });

  it("submitFeedback is a no-op when tracing is disabled", async () => {
    const { submitFeedback } = await import("@/lib/observability/langsmith");

    // Should not throw even without valid API key / runId
    await expect(
      submitFeedback("fake-run-id", "thumbs_up", 1, "Great answer!")
    ).resolves.toBeUndefined();
  });
});
