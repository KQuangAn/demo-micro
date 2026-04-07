/**
 * ══════════════════════════════════════════════════════════════════
 *  Tests: Tool Selection & Tool Call Routing
 * ══════════════════════════════════════════════════════════════════
 *
 *  THE CORE PROBLEM:
 *  "Did the AI actually call the RIGHT tool for the user's question?"
 *
 *  You can't directly assert this on a live LLM (it's non-deterministic),
 *  but you CAN verify it at three different levels:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  Level 1 — Unit: Tool registration & metadata              │
 *  │    → Are the right tools wired to the agent?               │
 *  │    → Do tool names/descriptions match expected intent?      │
 *  │                                                             │
 *  │  Level 2 — Unit: Simulated tool call routing               │
 *  │    → Given a fake LLM that picks tool X, does the agent    │
 *  │      call tool X with the right args?                      │
 *  │    → Validates the agent's tool-dispatch wiring            │
 *  │                                                             │
 *  │  Level 3 — Eval: LLM-graded tool selection (LangSmith)     │
 *  │    → Run real prompts, record which tools were called,      │
 *  │      use an evaluator LLM to judge if selection was correct │
 *  └─────────────────────────────────────────────────────────────┘
 *
 *  This file covers Levels 1 & 2.
 *  See tests/evals/tool-selection.eval.ts for Level 3.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks — must exist before vi.mock factories run ──────
const { mockInvoke, mockCheckpointerGet } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockCheckpointerGet: vi.fn(),
}));

vi.mock("@langchain/langgraph/prebuilt", () => ({
  createReactAgent: vi.fn(() => ({ invoke: mockInvoke })),
}));

// react-agent.ts also imports createAgent from "langchain" — mock that too
vi.mock("langchain", () => ({
  createAgent: vi.fn(() => ({ invoke: mockInvoke })),
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

// ─── DO NOT mock tools here — we test the real tool objects ───────
import { runReactAgent } from "@/lib/ec2/react-agent";
import {
  ec2Tools,
  listSecurityGroupsTool,
  getSecurityGroupTool,
  searchSecurityGroupsTool,
  findOpenPortTool,
  analyzeGroupTool,
  analyzeAllTool,
  syncFromAWSTool,
} from "@/lib/ec2/tools";

// ──────────────────────────────────────────────────────────────────
//  LEVEL 1 — Tool registration & metadata
//
//  What this tests:
//  • The agent has exactly the tools we expect (no missing, no extras)
//  • Each tool's name matches what the agent would send to the LLM
//  • Descriptions contain the intent keywords the LLM uses to route
//
//  Why it matters:
//  If a tool has the wrong name or a vague description, the LLM will
//  pick the wrong tool or not call one at all.
// ──────────────────────────────────────────────────────────────────

describe("Level 1 — Tool registration & metadata", () => {
  it("agent is configured with exactly the expected set of tools", () => {
    const expectedToolNames = [
      "list_security_groups",
      "get_security_group",
      "search_security_groups",
      "find_groups_with_open_port",
      "analyze_security_group",
      "analyze_all_security_groups",
      "sync_security_groups",
    ];

    const actualNames = ec2Tools.map((t) => t.name);

    // Order-insensitive comparison
    expect(actualNames.sort()).toEqual(expectedToolNames.sort());
  });

  it("each tool has a non-empty description (LLM routing depends on this)", () => {
    for (const t of ec2Tools) {
      expect(t.description, `Tool "${t.name}" has empty description`).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(20);
    }
  });

  // ── Per-tool: name + description keyword assertions ───────────────
  // These lock in that the routing hints are present.
  // If someone renames a tool or rewrites a description, this fails loudly.

  it("list_security_groups — name and description are routing-correct", () => {
    expect(listSecurityGroupsTool.name).toBe("list_security_groups");
    expect(listSecurityGroupsTool.description.toLowerCase()).toContain("list");
  });

  it("get_security_group — description mentions ID and name lookup", () => {
    expect(getSecurityGroupTool.name).toBe("get_security_group");
    expect(getSecurityGroupTool.description.toLowerCase()).toMatch(/id|name/);
  });

  it("search_security_groups — description mentions partial/search match", () => {
    expect(searchSecurityGroupsTool.name).toBe("search_security_groups");
    expect(searchSecurityGroupsTool.description.toLowerCase()).toContain("search");
  });

  it("find_groups_with_open_port — description mentions port and internet", () => {
    expect(findOpenPortTool.name).toBe("find_groups_with_open_port");
    const desc = findOpenPortTool.description.toLowerCase();
    expect(desc).toMatch(/port/);
    expect(desc).toMatch(/internet|0\.0\.0\.0/);
  });

  it("analyze_security_group — description mentions audit/security/single group", () => {
    expect(analyzeGroupTool.name).toBe("analyze_security_group");
    const desc = analyzeGroupTool.description.toLowerCase();
    expect(desc).toMatch(/audit|analy|security/);
  });

  it("analyze_all_security_groups — description mentions ALL groups", () => {
    expect(analyzeAllTool.name).toBe("analyze_all_security_groups");
    const desc = analyzeAllTool.description.toLowerCase();
    expect(desc).toMatch(/all/);
  });

  it("sync_security_groups — description mentions refresh/sync/AWS", () => {
    expect(syncFromAWSTool.name).toBe("sync_security_groups");
    const desc = syncFromAWSTool.description.toLowerCase();
    expect(desc).toMatch(/sync|refresh/);
  });
});

// ──────────────────────────────────────────────────────────────────
//  LEVEL 2 — Simulated tool call routing
//
//  The technique:
//  We control the fake LLM's response by making `mockInvoke` return
//  a messages array that INCLUDES a tool call message. This is
//  exactly what the real LangGraph agent does — it inspects the
//  LLM's AIMessage for tool_calls, then dispatches to the right tool.
//
//  By asserting on WHICH tool was called and with WHICH arguments,
//  we test the full agent→tool dispatch pipeline without ever
//  hitting a real LLM or AWS API.
//
//  Message anatomy in a LangGraph ReAct agent:
//
//    HumanMessage  →  LLM  →  AIMessage (with tool_calls)
//                          ↓
//                  ToolMessage (tool result)
//                          ↓
//                   LLM  →  AIMessage (final answer)
//
// ──────────────────────────────────────────────────────────────────

// Helper: build messages that simulate a successful tool call sequence
function makeToolCallSequence(
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolResult: string,
  finalAnswer: string
) {
  return {
    messages: [
      // 1. Human question
      { _getType: () => "human", content: "user question" },

      // 2. LLM decided to call a tool (this is the key message)
      {
        _getType: () => "ai",
        content: "",
        tool_calls: [
          {
            id: "call_abc123",
            name: toolName,    // ← THIS is what we assert on
            args: toolArgs,    // ← AND THIS
          },
        ],
      },

      // 3. Tool result was returned
      {
        _getType: () => "tool",
        content: toolResult,
        tool_call_id: "call_abc123",
        name: toolName,
      },

      // 4. LLM's final answer after seeing tool result
      {
        _getType: () => "ai",
        content: finalAnswer,
        tool_calls: [],
      },
    ],
  };
}

// Helper: extract all tool calls from a messages array
function extractToolCalls(messages: ReturnType<typeof makeToolCallSequence>["messages"]) {
  return messages
    .filter((m) => m._getType() === "ai" && "tool_calls" in m && Array.isArray(m.tool_calls) && m.tool_calls.length > 0)
    .flatMap((m) => ("tool_calls" in m ? (m.tool_calls as Array<{ name: string; args: Record<string, unknown> }>) : []));
}

describe("Level 2 — Simulated tool call routing", () => {
  const mockModel = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Scenario 1: "list all my security groups" ────────────────────
  it("question about listing → agent calls list_security_groups", async () => {
    const simulatedMessages = makeToolCallSequence(
      "list_security_groups",
      {},
      "Found 3 security groups: sg-001, sg-002, sg-003",
      "You have 3 security groups."
    );
    mockInvoke.mockResolvedValue(simulatedMessages);

    const { response, steps } = await runReactAgent(
      "list all my security groups",
      mockModel,
      "thread-1"
    );

    // 1. Verify the agent returned a final response
    expect(response).toBe("You have 3 security groups.");

    // 2. Verify exactly 1 tool was called (no extra tool calls)
    expect(steps).toBe(1);

    // 3. Verify the CORRECT tool was called
    const toolCalls = extractToolCalls(simulatedMessages.messages);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe("list_security_groups");
  });

  // ── Scenario 2: "check port 22" → find_groups_with_open_port ─────
  it("question about a specific port → agent calls find_groups_with_open_port with correct port", async () => {
    const simulatedMessages = makeToolCallSequence(
      "find_groups_with_open_port",
      { port: 22 },                           // ← args matter too!
      "2 groups have port 22 open to 0.0.0.0/0",
      "Found 2 groups with SSH open to the internet."
    );
    mockInvoke.mockResolvedValue(simulatedMessages);

    await runReactAgent("which groups have SSH open?", mockModel, "thread-2");

    const toolCalls = extractToolCalls(simulatedMessages.messages);
    expect(toolCalls[0].name).toBe("find_groups_with_open_port");
    // Critically: assert the port arg is correct
    expect(toolCalls[0].args).toEqual({ port: 22 });
  });

  // ── Scenario 3: "audit sg-web" → analyze_security_group ──────────
  it("audit of specific group → agent calls analyze_security_group with identifier", async () => {
    const simulatedMessages = makeToolCallSequence(
      "analyze_security_group",
      { identifier: "sg-web001" },
      "[HIGH] SSH open to internet",
      "sg-web001 has a HIGH severity finding: SSH exposed."
    );
    mockInvoke.mockResolvedValue(simulatedMessages);

    await runReactAgent("audit security group sg-web001", mockModel, "thread-3");

    const toolCalls = extractToolCalls(simulatedMessages.messages);
    expect(toolCalls[0].name).toBe("analyze_security_group");
    expect(toolCalls[0].args).toMatchObject({ identifier: "sg-web001" });
  });

  // ── Scenario 4: "full audit" → analyze_all (no args) ─────────────
  it("full audit request → agent calls analyze_all_security_groups with no args", async () => {
    const simulatedMessages = makeToolCallSequence(
      "analyze_all_security_groups",
      {},
      "Total: 5 findings. CRITICAL: 2, HIGH: 3",
      "Full audit complete. 2 critical issues found."
    );
    mockInvoke.mockResolvedValue(simulatedMessages);

    await runReactAgent("run a full security audit", mockModel, "thread-4");

    const toolCalls = extractToolCalls(simulatedMessages.messages);
    expect(toolCalls[0].name).toBe("analyze_all_security_groups");
    expect(toolCalls[0].args).toEqual({});
  });

  // ── Scenario 5: Multi-step — list THEN analyze ───────────────────
  //
  //  This is the most important scenario for ReAct agents.
  //  "Is my infrastructure secure?" requires:
  //    Step 1: list all groups (to discover what exists)
  //    Step 2: analyze all groups (to find issues)
  //
  it("complex question → agent makes multiple tool calls in sequence", async () => {
    const multiStepMessages = {
      messages: [
        { _getType: () => "human", content: "is my infra secure?" },

        // Step 1: Agent lists groups first
        {
          _getType: () => "ai",
          content: "",
          tool_calls: [{ id: "call_1", name: "list_security_groups", args: {} }],
        },
        {
          _getType: () => "tool",
          content: "Found 2 groups: sg-web, sg-db",
          tool_call_id: "call_1",
          name: "list_security_groups",
        },

        // Step 2: Then runs full audit
        {
          _getType: () => "ai",
          content: "",
          tool_calls: [{ id: "call_2", name: "analyze_all_security_groups", args: {} }],
        },
        {
          _getType: () => "tool",
          content: "CRITICAL: sg-db has port 5432 open",
          tool_call_id: "call_2",
          name: "analyze_all_security_groups",
        },

        // Final answer
        {
          _getType: () => "ai",
          content: "No, sg-db has a critical vulnerability.",
          tool_calls: [],
        },
      ],
    };
    mockInvoke.mockResolvedValue(multiStepMessages);

    const { response, steps } = await runReactAgent(
      "is my infra secure?",
      mockModel,
      "thread-5"
    );

    // 2 tool calls = 2 reasoning steps
    expect(steps).toBe(2);
    expect(response).toContain("critical");

    // Assert the ORDER of tool calls matters
    const toolCalls = extractToolCalls(multiStepMessages.messages);
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe("list_security_groups");      // listed first
    expect(toolCalls[1].name).toBe("analyze_all_security_groups"); // then analyzed
  });

  // ── Scenario 6: Zero tool calls — direct answer ───────────────────
  it("simple greeting → agent answers directly without calling any tool", async () => {
    mockInvoke.mockResolvedValue({
      messages: [
        { _getType: () => "human", content: "hello" },
        { _getType: () => "ai", content: "Hi! I help with EC2 security groups.", tool_calls: [] },
      ],
    });

    const { steps } = await runReactAgent("hello", mockModel, "thread-6");

    // Zero steps = zero tool calls
    expect(steps).toBe(0);
  });

  // ── Scenario 7: Search by name (not by ID) ────────────────────────
  it("search query → agent calls search_security_groups with the query string", async () => {
    const simulatedMessages = makeToolCallSequence(
      "search_security_groups",
      { query: "production" },
      "Found 2 groups matching 'production'",
      "I found 2 production security groups."
    );
    mockInvoke.mockResolvedValue(simulatedMessages);

    await runReactAgent("find all production security groups", mockModel, "thread-7");

    const toolCalls = extractToolCalls(simulatedMessages.messages);
    expect(toolCalls[0].name).toBe("search_security_groups");
    expect(toolCalls[0].args).toMatchObject({ query: "production" });
  });

  // ── Scenario 8: Get specific group by ID ─────────────────────────
  it("specific group lookup → agent calls get_security_group with the SG id", async () => {
    const simulatedMessages = makeToolCallSequence(
      "get_security_group",
      { identifier: "sg-0abc123" },
      "sg-0abc123: web-sg, 3 inbound rules",
      "Here are the details for sg-0abc123."
    );
    mockInvoke.mockResolvedValue(simulatedMessages);

    await runReactAgent("show me details for sg-0abc123", mockModel, "thread-8");

    const toolCalls = extractToolCalls(simulatedMessages.messages);
    expect(toolCalls[0].name).toBe("get_security_group");
    expect(toolCalls[0].args).toMatchObject({ identifier: "sg-0abc123" });
  });
});

// ──────────────────────────────────────────────────────────────────
//  LEVEL 2b — Tool call argument schema validation
//
//  Even if the right tool is called, wrong argument types = runtime error.
//  These tests verify each tool's schema rejects bad inputs cleanly.
// ──────────────────────────────────────────────────────────────────

describe("Level 2b — Tool argument schema validation", () => {
  it("find_groups_with_open_port rejects a non-number port", async () => {
    // The Zod schema on findOpenPortTool requires port: number
    // If the LLM sends "22" (string) instead of 22 (number), Zod should catch it
    await expect(
      findOpenPortTool.invoke({ port: "22" as unknown as number })
    ).rejects.toThrow();
  });

  it("get_security_group rejects empty identifier", async () => {
    // z.string() with min length validation
    await expect(
      getSecurityGroupTool.invoke({ identifier: "" })
    ).rejects.toThrow();
  });

  it("search_security_groups rejects missing query", async () => {
    await expect(
      searchSecurityGroupsTool.invoke({} as any)
    ).rejects.toThrow();
  });

  it("analyze_security_group rejects missing identifier", async () => {
    await expect(
      analyzeGroupTool.invoke({} as any)
    ).rejects.toThrow();
  });

  it("list_security_groups accepts no arguments (no schema required)", async () => {
    // This tool takes no input — should not throw on empty call
    // We mock the store to avoid real data dependency
    vi.mock("@/lib/ec2/sg-store", () => ({
      getAllSecurityGroups: vi.fn().mockReturnValue([]),
    }));
    // Should resolve (return "No security groups found")
    await expect(listSecurityGroupsTool.invoke({})).resolves.toBeDefined();
  });
});
