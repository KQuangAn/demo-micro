/**
 * ═══════════════════════════════════════════════════════════════════
 *  Multi-Agent Graph Structure Tests
 *
 *  These tests verify the GRAPH STRUCTURE and STATE MANAGEMENT
 *  without calling any real LLMs. They mock the LLM responses
 *  to test the wiring.
 * ═══════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  MemorySaver,
  START,
  END,
} from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

// ─── Test the Annotation/State concept ─────────────────────────────

describe("Concept: Annotation & State", () => {
  it("MessagesAnnotation appends messages (never overwrites)", () => {
    // This tests the REDUCER concept:
    // When a node returns { messages: [newMsg] }, it's APPENDED to existing messages
    const messages: BaseMessage[] = [
      new HumanMessage("hello"),
      new AIMessage("hi"),
    ];
    const newMessage = new HumanMessage("follow up");

    // Simulate what the reducer does
    const merged = [...messages, newMessage];
    expect(merged).toHaveLength(3);
    expect(merged[2].content).toBe("follow up");
  });

  it("custom reducer appends arrays (findings)", () => {
    // Simulate the findings reducer: (prev, next) => [...prev, ...next]
    const reducer = (prev: string[], next: string[]) => [...prev, ...next];

    let state: string[] = [];
    state = reducer(state, ["SSH open on sg-001"]);
    state = reducer(state, ["All ports open on sg-003"]);

    expect(state).toHaveLength(2);
    expect(state[0]).toContain("SSH");
    expect(state[1]).toContain("All ports");
  });

  it("overwrite reducer replaces value (nextAgent)", () => {
    // Simulate: (_prev, next) => next
    const reducer = (_prev: string, next: string) => next;

    let state = "supervisor";
    state = reducer(state, "recon");
    expect(state).toBe("recon");
    state = reducer(state, "security");
    expect(state).toBe("security");
  });
});

// ─── Test StateGraph building ──────────────────────────────────────

describe("Concept: StateGraph Construction", () => {
  const SimpleState = Annotation.Root({
    ...MessagesAnnotation.spec,
    nextAgent: Annotation<string>({
      reducer: (_prev, next) => next,
      default: () => "start",
    }),
    counter: Annotation<number>({
      reducer: (_prev, next) => next,
      default: () => 0,
    }),
  });

  it("can build a simple 2-node graph", () => {
    const nodeA = async (state: typeof SimpleState.State) => ({
      messages: [new AIMessage("from A")],
      nextAgent: "b",
      counter: state.counter + 1,
    });

    const nodeB = async (state: typeof SimpleState.State) => ({
      messages: [new AIMessage("from B")],
      nextAgent: "done",
      counter: state.counter + 1,
    });

    const graph = new StateGraph(SimpleState)
      .addNode("a", nodeA)
      .addNode("b", nodeB)
      .addEdge(START, "a")
      .addEdge("a", "b")
      .addEdge("b", END);

    // compile should not throw
    const compiled = graph.compile();
    expect(compiled).toBeDefined();
  });

  it("can build a graph with conditional edges", () => {
    const router = async (state: typeof SimpleState.State) => ({
      nextAgent: state.counter < 2 ? "worker" : "FINISH",
    });

    const worker = async (state: typeof SimpleState.State) => ({
      messages: [new AIMessage(`iteration ${state.counter}`)],
      counter: state.counter + 1,
    });

    const routeFn = (state: typeof SimpleState.State) =>
      state.nextAgent === "FINISH" ? END : "worker";

    const graph = new StateGraph(SimpleState)
      .addNode("router", router)
      .addNode("worker", worker)
      .addEdge(START, "router")
      .addConditionalEdges("router", routeFn, ["worker", END])
      .addEdge("worker", "router");

    const compiled = graph.compile();
    expect(compiled).toBeDefined();
  });
});

// ─── Test Checkpointer + Thread isolation ──────────────────────────

describe("Concept: Checkpointer & Threads", () => {
  // Minimal graph that just echoes back with a counter
  const CounterState = Annotation.Root({
    ...MessagesAnnotation.spec,
    counter: Annotation<number>({
      reducer: (_prev, next) => next,
      default: () => 0,
    }),
  });

  function buildCounterGraph() {
    const echoNode = async (state: typeof CounterState.State) => ({
      messages: [new AIMessage(`response #${state.counter + 1}`)],
      counter: state.counter + 1,
    });

    return new StateGraph(CounterState)
      .addNode("echo", echoNode)
      .addEdge(START, "echo")
      .addEdge("echo", END);
  }

  it("MemorySaver preserves state across invocations (same thread)", async () => {
    const checkpointer = new MemorySaver();
    const graph = buildCounterGraph().compile({ checkpointer });

    // First call
    const result1 = await graph.invoke(
      { messages: [new HumanMessage("call 1")] },
      { configurable: { thread_id: "thread-A" } }
    );
    expect(result1.counter).toBe(1);

    // Second call on SAME thread — counter should continue from 1
    const result2 = await graph.invoke(
      { messages: [new HumanMessage("call 2")] },
      { configurable: { thread_id: "thread-A" } }
    );
    expect(result2.counter).toBe(2);

    // Messages accumulate across calls
    expect(result2.messages.length).toBeGreaterThanOrEqual(4); // H1, AI1, H2, AI2
  });

  it("different thread_ids are isolated", async () => {
    const checkpointer = new MemorySaver();
    const graph = buildCounterGraph().compile({ checkpointer });

    // Thread A
    const resultA = await graph.invoke(
      { messages: [new HumanMessage("hello A")] },
      { configurable: { thread_id: "thread-A" } }
    );
    expect(resultA.counter).toBe(1);

    // Thread B — completely fresh, no memory of thread A
    const resultB = await graph.invoke(
      { messages: [new HumanMessage("hello B")] },
      { configurable: { thread_id: "thread-B" } }
    );
    expect(resultB.counter).toBe(1); // NOT 2!

    // Thread A messages don't leak into Thread B
    const threadBMessages = resultB.messages.map((m: BaseMessage) => String(m.content));
    expect(threadBMessages).not.toContain("hello A");
  });

  it("without checkpointer, state resets every call", async () => {
    // NO checkpointer — each invoke is independent
    const graph = buildCounterGraph().compile();

    const result1 = await graph.invoke({
      messages: [new HumanMessage("call 1")],
    });
    expect(result1.counter).toBe(1);

    const result2 = await graph.invoke({
      messages: [new HumanMessage("call 2")],
    });
    expect(result2.counter).toBe(1); // resets! no persistence
  });
});

// ─── Test Supervisor routing pattern ───────────────────────────────

describe("Concept: Supervisor Routing", () => {
  const WorkflowState = Annotation.Root({
    ...MessagesAnnotation.spec,
    nextAgent: Annotation<string>({
      reducer: (_prev, next) => next,
      default: () => "",
    }),
    agentsUsed: Annotation<string[]>({
      reducer: (prev, next) => [...prev, ...next],
      default: () => [],
    }),
    step: Annotation<number>({
      reducer: (_prev, next) => next,
      default: () => 0,
    }),
  });

  it("supervisor routes through agents in sequence", async () => {
    // Simulate supervisor that routes: recon → security → FINISH
    const supervisorNode = async (state: typeof WorkflowState.State) => {
      let next: string;
      if (state.step === 0) next = "recon";
      else if (state.step === 1) next = "security";
      else next = "FINISH";

      return {
        nextAgent: next,
        agentsUsed: ["supervisor"],
        step: state.step, // don't increment here
      };
    };

    const reconNode = async (state: typeof WorkflowState.State) => ({
      messages: [new AIMessage("recon data gathered")],
      agentsUsed: ["recon"],
      step: state.step + 1,
    });

    const securityNode = async (state: typeof WorkflowState.State) => ({
      messages: [new AIMessage("security audit done")],
      agentsUsed: ["security"],
      step: state.step + 1,
    });

    const routeFn = (state: typeof WorkflowState.State) =>
      state.nextAgent === "FINISH" ? END : state.nextAgent;

    const graph = new StateGraph(WorkflowState)
      .addNode("supervisor", supervisorNode)
      .addNode("recon", reconNode)
      .addNode("security", securityNode)
      .addEdge(START, "supervisor")
      .addConditionalEdges("supervisor", routeFn, ["recon", "security", END])
      .addEdge("recon", "supervisor")
      .addEdge("security", "supervisor")
      .compile();

    const result = await graph.invoke({
      messages: [new HumanMessage("audit everything")],
    });

    // Verify the correct routing sequence
    expect(result.agentsUsed).toEqual([
      "supervisor", // initial: routes to recon
      "recon",      // does work
      "supervisor", // routes to security
      "security",   // does work
      "supervisor", // routes to FINISH
    ]);

    // Verify both agents produced messages
    const aiMessages = result.messages
      .filter((m: BaseMessage) => m._getType() === "ai")
      .map((m: BaseMessage) => String(m.content));
    expect(aiMessages).toContain("recon data gathered");
    expect(aiMessages).toContain("security audit done");
  });

  it("supervisor can short-circuit to END for simple queries", async () => {
    const supervisorNode = async (_state: typeof WorkflowState.State) => ({
      nextAgent: "FINISH", // immediately done
      agentsUsed: ["supervisor"],
      step: 0,
    });

    const workerNode = async (_state: typeof WorkflowState.State) => ({
      messages: [new AIMessage("should NOT run")],
      agentsUsed: ["worker"],
      step: 1,
    });

    const routeFn = (state: typeof WorkflowState.State) =>
      state.nextAgent === "FINISH" ? END : "worker";

    const graph = new StateGraph(WorkflowState)
      .addNode("supervisor", supervisorNode)
      .addNode("worker", workerNode)
      .addEdge(START, "supervisor")
      .addConditionalEdges("supervisor", routeFn, ["worker", END])
      .addEdge("worker", "supervisor")
      .compile();

    const result = await graph.invoke({
      messages: [new HumanMessage("hi")],
    });

    // Worker should never have run
    expect(result.agentsUsed).toEqual(["supervisor"]);
    expect(result.messages).toHaveLength(1); // only the human message
  });

  it("state accumulates across multiple nodes (reducer proof)", async () => {
    const FindingsState = Annotation.Root({
      ...MessagesAnnotation.spec,
      findings: Annotation<string[]>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
      }),
    });

    const nodeA = async () => ({
      messages: [new AIMessage("a done")],
      findings: ["finding-from-A"],
    });

    const nodeB = async () => ({
      messages: [new AIMessage("b done")],
      findings: ["finding-from-B-1", "finding-from-B-2"],
    });

    const graph = new StateGraph(FindingsState)
      .addNode("a", nodeA)
      .addNode("b", nodeB)
      .addEdge(START, "a")
      .addEdge("a", "b")
      .addEdge("b", END)
      .compile();

    const result = await graph.invoke({
      messages: [new HumanMessage("go")],
    });

    // The reducer APPENDED findings from both nodes
    expect(result.findings).toEqual([
      "finding-from-A",
      "finding-from-B-1",
      "finding-from-B-2",
    ]);
  });
});
