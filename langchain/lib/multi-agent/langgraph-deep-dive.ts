/**
 * ══════════════════════════════════════════════════════════════════
 *  LANGGRAPH DEEP DIVE
 *  Topics covered (run each section independently):
 *
 *  1. MIDDLEWARE  — wrap every node with before/after hooks
 *  2. INTERRUPT   — pause graph mid-execution, resume later
 *  3. HITL        — Human-in-the-Loop: human approves before continue
 *  4. STATE MERGE — how reducers handle concurrent updates
 *  5. TIME TRAVEL — roll back to any past checkpoint
 *  6. STREAMING   — stream tokens and state updates in real time
 *
 *  Run: pnpm langgraph-deep-dive
 *
 *  Each section prints its own banner so you can follow along.
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import * as readline from "readline";
import { ChatGroq } from "@langchain/groq";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  MemorySaver,
  START,
  END,
  interrupt,        // ← used for HITL / pause
  Command,          // ← used to resume after interrupt
} from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
//  SHARED UTILITIES
// ──────────────────────────────────────────────────────────────────

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY!,
});

function banner(n: number, title: string) {
  const line = "═".repeat(58);
  console.log(`\n\n╔${line}╗`);
  console.log(`║  SECTION ${n}: ${title.padEnd(line.length - 12)}║`);
  console.log(`╚${line}╝`);
}

function separator(label: string) {
  console.log(`\n${"─".repeat(20)} ${label} ${"─".repeat(20)}`);
}

// ══════════════════════════════════════════════════════════════════
//  SECTION 1: MIDDLEWARE
//
//  LangGraph has no built-in "middleware" keyword.
//  The pattern: wrap each node function in a higher-order function
//  that runs logic BEFORE and AFTER the real node.
//
//  Use cases:
//  • Logging / tracing every node
//  • Timing how long each node takes
//  • Validating state before a node runs
//  • Catching and retrying errors from a node
// ══════════════════════════════════════════════════════════════════

// ── The middleware wrapper ────────────────────────────────────────
// Takes ANY node function and returns a wrapped version that:
//   1. Logs entry + current state summary
//   2. Times the execution
//   3. Logs the returned patch + duration
//   4. Can catch errors and decide to retry or rethrow

type NodeFn<S> = (state: S, config?: RunnableConfig) => Promise<Partial<S>>;

function withMiddleware<S extends Record<string, unknown>>(
  name: string,
  nodeFn: NodeFn<S>,
  options?: {
    validate?: (state: S) => string | null;  // return error string to block, null to pass
    onError?:  "rethrow" | "skip";           // what to do if node throws
  }
): NodeFn<S> {
  return async (state: S, config?: RunnableConfig): Promise<Partial<S>> => {
    const start = Date.now();

    // ── BEFORE hook ──────────────────────────────────────────────
    const msgCount = (state as any).messages?.length ?? 0;
    console.log(`  [MW] ▶ entering "${name}"  msgs=${msgCount}`);

    // Run optional validation
    if (options?.validate) {
      const err = options.validate(state);
      if (err) {
        console.log(`  [MW] ✗ validation blocked "${name}": ${err}`);
        return {} as Partial<S>;   // return empty patch — node is skipped
      }
    }

    // ── RUN the real node ─────────────────────────────────────────
    let result: Partial<S>;
    try {
      result = await nodeFn(state, config);
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`  [MW] ✗ "${name}" threw after ${ms}ms: ${err}`);
      if (options?.onError === "skip") return {} as Partial<S>;
      throw err;
    }

    // ── AFTER hook ───────────────────────────────────────────────
    const ms       = Date.now() - start;
    const newMsgs  = (result as any).messages?.length ?? 0;
    const keys     = Object.keys(result).join(", ");
    console.log(`  [MW] ✔ "${name}" done in ${ms}ms  patch keys=[${keys}]  +${newMsgs} msg(s)`);

    return result;
  };
}

async function runSection1_Middleware() {
  banner(1, "MIDDLEWARE — wrap every node with before/after hooks");

  // ── State ─────────────────────────────────────────────────────
  const S1 = Annotation.Root({
    ...MessagesAnnotation.spec,
    next: Annotation<string>({ reducer: (_, v) => v, default: () => "" }),
  });

  // ── Raw node functions ────────────────────────────────────────
  const routerSchema = z.object({
    next: z.enum(["math", "general"]),
  });

  async function rawRouter(state: typeof S1.State) {
    const text = String(state.messages.at(-1)?.content ?? "");
    const r = await llm.withStructuredOutput(routerSchema).invoke([
      new SystemMessage("Classify: 'math' for calculations, 'general' for everything else."),
      new HumanMessage(text),
    ]);
    return { next: r.next };
  }

  async function rawWorker(state: typeof S1.State) {
    const resp = await llm.invoke([
      new SystemMessage("You are a helpful assistant."),
      ...state.messages,
    ]);
    return { messages: [resp] };
  }

  // ── Wrap each node in middleware ──────────────────────────────
  const routerNode = withMiddleware("router", rawRouter, {
    validate: (s) =>
      s.messages.length === 0 ? "no messages in state" : null,
  });

  const mathNode    = withMiddleware("math",    rawWorker);
  const generalNode = withMiddleware("general", rawWorker);

  const graph = new StateGraph(S1)
    .addNode("router",  routerNode)
    .addNode("math",    mathNode)
    .addNode("general", generalNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", (s) => s.next, { math: "math", general: "general" })
    .addEdge("math",    END)
    .addEdge("general", END)
    .compile({ checkpointer: new MemorySaver() });

  separator("invoking with middleware");
  const result = await graph.invoke(
    { messages: [new HumanMessage("What is 99 * 7?")] },
    { configurable: { thread_id: "mw-thread-1" } }
  );
  const answer = result.messages.at(-1) as AIMessage;
  console.log(`\n  ✅ Final answer: ${String(answer.content).slice(0, 100)}`);
}

// ══════════════════════════════════════════════════════════════════
//  SECTION 2: INTERRUPT (pause + resume)
//
//  interrupt() pauses the graph at the EXACT line it's called.
//  The graph state is checkpointed at that point.
//  You call graph.invoke() again with the SAME thread_id + a Command
//  to resume from where it stopped.
//
//  Key facts:
//  • interrupt() can appear ANYWHERE inside a node — mid-function
//  • The value passed to interrupt() is visible to the caller
//  • To resume: graph.invoke(new Command({ resume: yourValue }), config)
//  • The node re-runs from the TOP, but interrupt() returns the resume value
//    instead of pausing again
// ══════════════════════════════════════════════════════════════════

async function runSection2_Interrupt() {
  banner(2, "INTERRUPT — pause graph mid-node, resume with a value");

  const S2 = Annotation.Root({
    ...MessagesAnnotation.spec,
    // Store what the interrupt returned so we can inspect it
    interruptValue: Annotation<string>({ reducer: (_, v) => v, default: () => "" }),
    stage: Annotation<string>({ reducer: (_, v) => v, default: () => "" }),
  });

  // ── Node that PAUSES in the middle ───────────────────────────
  async function nodeWithInterrupt(state: typeof S2.State) {
    console.log("  [node] step 1 — doing work before pause...");

    // ── interrupt() PAUSES HERE ──────────────────────────────
    // The graph is frozen. Checkpoint is saved.
    // The caller receives: { __interrupt__: [{ value: "need input", ... }] }
    const userInput = interrupt("need_input: what number should I multiply by?");
    // ↑ execution stops here on first call
    // ↑ on resume call, execution CONTINUES here with userInput = the resumed value

    console.log(`  [node] step 2 — resumed with value: "${userInput}"`);

    const multiplier = parseInt(String(userInput), 10) || 2;
    const resp = await llm.invoke([
      new SystemMessage(`You are a math assistant. Multiply the number in the user message by ${multiplier}.`),
      ...state.messages,
    ]);

    return {
      messages: [resp],
      interruptValue: String(userInput),
      stage: "completed",
    };
  }

  const checkpointer = new MemorySaver();
  const graph = new StateGraph(S2)
    .addNode("worker", nodeWithInterrupt)
    .addEdge(START, "worker")
    .addEdge("worker", END)
    .compile({ checkpointer });

  const config = { configurable: { thread_id: "interrupt-thread-1" } };

  // ── CALL 1: graph pauses at interrupt() ──────────────────────
  separator("Call 1 — will pause at interrupt()");
  const call1 = await graph.invoke(
    { messages: [new HumanMessage("My number is 50.")] },
    config
  );

  // When interrupted, the return value has __interrupt__ key
  const interrupted = (call1 as any).__interrupt__;
  if (interrupted) {
    console.log(`\n  ⏸  Graph PAUSED. interrupt value:`);
    console.log(`     "${interrupted[0]?.value}"`);
    console.log(`  (In a real app, you'd show this to the user and wait for their input)`);
  }

  // ── CALL 2: resume by passing a Command ──────────────────────
  // Command({ resume: value }) tells LangGraph:
  // "go back to the node that called interrupt(), and return this value from it"
  separator("Call 2 — resume with value '7'");
  const call2 = await graph.invoke(
    new Command({ resume: "7" }),   // ← resume value: multiply by 7
    config                           // ← SAME thread_id
  );

  const answer = call2.messages?.at(-1) as AIMessage | undefined;
  if (answer) {
    console.log(`\n  ✅ Resumed answer: ${String(answer.content).slice(0, 120)}`);
  }
  console.log(`  interruptValue stored in state: "${call2.interruptValue}"`);
  console.log(`  stage: "${call2.stage}"`);
}

// ══════════════════════════════════════════════════════════════════
//  SECTION 3: HUMAN-IN-THE-LOOP (HITL)
//
//  HITL = a specific use of interrupt() where a human must review
//  and APPROVE or REJECT something before the graph continues.
//
//  Common patterns:
//  A) Approve/reject a tool call before it executes
//  B) Approve/reject an LLM response before it's sent to the user
//  C) Human provides missing information the agent needs
//
//  We implement pattern B: LLM drafts a response → human approves
//  or edits it → THEN it goes into state.
// ══════════════════════════════════════════════════════════════════

// Simulate human terminal input (in a real app this is a UI form)
async function promptHuman(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runSection3_HITL() {
  banner(3, "HITL — Human approves LLM draft before it enters state");

  const S3 = Annotation.Root({
    ...MessagesAnnotation.spec,
    draft:    Annotation<string>({ reducer: (_, v) => v, default: () => "" }),
    approved: Annotation<boolean>({ reducer: (_, v) => v, default: () => false }),
    finalMsg: Annotation<string>({ reducer: (_, v) => v, default: () => "" }),
  });

  // ── Node 1: LLM drafts a response ────────────────────────────
  async function draftNode(state: typeof S3.State) {
    console.log("  [draft] LLM generating response draft...");
    const resp = await llm.invoke([
      new SystemMessage("You are a customer support agent. Draft a helpful response."),
      ...state.messages,
    ]);
    const draft = String(resp.content);
    console.log(`\n  📝 LLM DRAFT:\n  "${draft.slice(0, 150)}..."`);
    return { draft };
  }

  // ── Node 2: PAUSE and ask human to review ────────────────────
  async function humanReviewNode(state: typeof S3.State) {
    console.log("\n  [review] Pausing for human review...");

    // interrupt() pauses here and exposes the draft to the caller
    const decision = interrupt({
      type:    "human_review",
      draft:   state.draft,
      message: "Type 'approve', 'reject', or type a replacement message:",
    });

    // When resumed, decision = whatever the human typed / sent
    const input = String(decision).trim().toLowerCase();

    if (input === "approve") {
      console.log("  [review] Human APPROVED the draft.");
      return { approved: true, finalMsg: state.draft };
    } else if (input === "reject") {
      console.log("  [review] Human REJECTED the draft.");
      return { approved: false, finalMsg: "[message rejected by human reviewer]" };
    } else {
      // Human sent their own replacement
      console.log(`  [review] Human replaced draft with: "${input.slice(0, 60)}"`);
      return { approved: true, finalMsg: input };
    }
  }

  // ── Node 3: Commit the approved message ──────────────────────
  async function commitNode(state: typeof S3.State) {
    const msg = state.finalMsg || "[nothing approved]";
    console.log(`\n  [commit] Writing to messages: "${msg.slice(0, 80)}"`);
    return {
      messages: [new AIMessage(msg)],
    };
  }

  const checkpointer = new MemorySaver();
  const graph = new StateGraph(S3)
    .addNode("draft",  draftNode)
    .addNode("review", humanReviewNode)
    .addNode("commit", commitNode)
    .addEdge(START,    "draft")
    .addEdge("draft",  "review")
    .addEdge("review", "commit")
    .addEdge("commit", END)
    .compile({ checkpointer });

  const config = { configurable: { thread_id: "hitl-thread-1" } };

  // ── CALL 1: runs draft + pauses at review ────────────────────
  separator("Call 1 — graph drafts and pauses for review");
  const call1 = await graph.invoke(
    { messages: [new HumanMessage("I bought a laptop 3 days ago and it won't turn on.")] },
    config
  );

  const interrupted = (call1 as any).__interrupt__;
  if (interrupted) {
    const payload = interrupted[0]?.value;
    console.log(`\n  ⏸  Paused for human review.`);
    console.log(`  Interrupt payload: ${JSON.stringify(payload, null, 2)}`);
  }

  // ── CALL 2: human resumes with a decision ────────────────────
  // In a real app: read from a POST /api/resume endpoint.
  // Here: we simulate "approve" without blocking on terminal input.
  separator("Call 2 — human resumes with 'approve'");
  console.log("  (simulating human typing 'approve')");

  const call2 = await graph.invoke(
    new Command({ resume: "approve" }),
    config
  );

  console.log(`\n  ✅ Committed message: "${call2.finalMsg?.slice(0, 100)}"`);
  console.log(`  approved: ${call2.approved}`);
  console.log(`  messages in state: ${call2.messages?.length}`);
}

// ══════════════════════════════════════════════════════════════════
//  SECTION 4: STATE DEEP DIVE
//
//  Three concepts explained with live output:
//
//  A) Reducer racing — two nodes update the SAME field
//     LangGraph runs them in sequence; last one wins (for overwrite)
//     or both contribute (for append reducer)
//
//  B) Partial updates — a node only returns what IT changed.
//     Fields it doesn't touch are preserved from the last checkpoint.
//
//  C) Default values — what state looks like at step 0 (before any node)
// ══════════════════════════════════════════════════════════════════

async function runSection4_State() {
  banner(4, "STATE DEEP DIVE — reducers, partial updates, defaults");

  // ── State with multiple reducer types ────────────────────────
  const S4 = Annotation.Root({
    // APPEND reducer — each node ADDS to this list
    log: Annotation<string[]>({
      reducer: (prev, val) => [...prev, ...val],
      default: () => [],
    }),

    // OVERWRITE reducer — latest value wins
    status: Annotation<string>({
      reducer: (_, v) => v,
      default: () => "idle",
    }),

    // COUNTER reducer — each update ADDS to the running total
    score: Annotation<number>({
      reducer: (prev, val) => prev + val,
      default: () => 0,
    }),

    // Messages — standard append
    ...MessagesAnnotation.spec,
  });

  // ── Nodes that each update only SOME fields ──────────────────
  async function nodeA(state: typeof S4.State) {
    console.log(`  [nodeA] score before: ${state.score}, status: "${state.status}"`);
    // Returns ONLY score and log — does NOT touch status or messages
    return {
      score:  10,         // adds 10 to score (reducer: prev + val)
      log:    ["nodeA ran"],
      status: "running",
    };
  }

  async function nodeB(state: typeof S4.State) {
    console.log(`  [nodeB] score before: ${state.score}, status: "${state.status}"`);
    // Returns ONLY score and status — does NOT touch log or messages
    return {
      score:  25,         // adds 25 to score
      log:    ["nodeB ran"],
      status: "done",
    };
  }

  async function nodeC(state: typeof S4.State) {
    console.log(`  [nodeC] score before: ${state.score}, status: "${state.status}"`);
    const resp = await llm.invoke([
      new SystemMessage("Say: 'Final score noted.' Nothing else."),
    ]);
    return {
      messages: [resp],
      log:      ["nodeC ran"],
      score:    5,        // adds 5 more
    };
  }

  const graph = new StateGraph(S4)
    .addNode("A", nodeA)
    .addNode("B", nodeB)
    .addNode("C", nodeC)
    .addEdge(START, "A")
    .addEdge("A",   "B")
    .addEdge("B",   "C")
    .addEdge("C",   END)
    .compile({ checkpointer: new MemorySaver() });

  separator("Running A → B → C");
  const result = await graph.invoke(
    { messages: [new HumanMessage("start")] },
    { configurable: { thread_id: "state-thread-1" } }
  );

  console.log("\n  ── Final state after A → B → C ──");
  console.log(`  score  : ${result.score}   (10 + 25 + 5 = 40 expected)`);
  console.log(`  status : "${result.status}"  (last writer = nodeB = "done")`);
  console.log(`  log    : ${JSON.stringify(result.log)}  (all three appended)`);
  console.log(`  messages: ${result.messages.length} total`);

  // ── B) Show state at EACH step via getStateHistory ────────────
  separator("State at every checkpoint (via getStateHistory)");

  const checkpointer2 = new MemorySaver();
  const graph2 = new StateGraph(S4)
    .addNode("A", nodeA)
    .addNode("B", nodeB)
    .addNode("C", nodeC)
    .addEdge(START, "A")
    .addEdge("A", "B")
    .addEdge("B", "C")
    .addEdge("C", END)
    .compile({ checkpointer: checkpointer2 });

  await graph2.invoke(
    { messages: [new HumanMessage("start")] },
    { configurable: { thread_id: "state-history-1" } }
  );

  const snaps: any[] = [];
  for await (const snap of graph2.getStateHistory({
    configurable: { thread_id: "state-history-1" },
  })) {
    snaps.push(snap);
  }

  // Print newest → oldest
  for (const [i, snap] of snaps.entries()) {
    const s = snap.values;
    console.log(
      `  snap[${i}] step=${snap.metadata?.step}  ` +
      `score=${s.score ?? 0}  status="${s.status ?? "idle"}"  ` +
      `log=${JSON.stringify(s.log ?? [])}  next=[${snap.next?.join(",") || "END"}]`
    );
  }
}

// ══════════════════════════════════════════════════════════════════
//  SECTION 5: TIME TRAVEL
//
//  Because every checkpoint is stored with a unique checkpoint_id,
//  you can RE-INVOKE the graph FROM any past checkpoint.
//
//  This lets you:
//  • Branch the conversation at any point ("what if I had said X?")
//  • Retry from a specific step after a failure
//  • Debug by replaying from a known good state
//
//  How:
//    1. Get history via graph.getStateHistory(config)
//    2. Pick the checkpoint you want to go back to
//    3. Pass its config to graph.invoke() — LangGraph restores that state
// ══════════════════════════════════════════════════════════════════

async function runSection5_TimeTravel() {
  banner(5, "TIME TRAVEL — branch from any past checkpoint");

  const S5 = Annotation.Root({
    ...MessagesAnnotation.spec,
    turnCount: Annotation<number>({ reducer: (_, v) => v, default: () => 0 }),
  });

  async function workerNode(state: typeof S5.State) {
    const resp = await llm.invoke([
      new SystemMessage("You are a helpful assistant. Be very brief (1 sentence)."),
      ...state.messages,
    ]);
    return {
      messages:  [resp],
      turnCount: state.turnCount + 1,
    };
  }

  const checkpointer = new MemorySaver();
  const graph = new StateGraph(S5)
    .addNode("worker", workerNode)
    .addEdge(START, "worker")
    .addEdge("worker", END)
    .compile({ checkpointer });

  const config = { configurable: { thread_id: "timetravel-1" } };

  // ── Build up a conversation history ──────────────────────────
  separator("Building conversation: 3 turns on same thread");
  await graph.invoke({ messages: [new HumanMessage("My name is Alice.")] },       config);
  await graph.invoke({ messages: [new HumanMessage("I live in Hanoi.")] },        config);
  await graph.invoke({ messages: [new HumanMessage("What do you know about me?")] }, config);

  const finalState = await graph.getState(config);
  console.log(`  After 3 turns: ${finalState.values.messages.length} messages in state`);

  // ── List all checkpoints ──────────────────────────────────────
  separator("All checkpoints (newest first)");
  const history: any[] = [];
  for await (const snap of graph.getStateHistory(config)) {
    history.push(snap);
  }

  for (const [i, snap] of history.entries()) {
    const msgs  = snap.values.messages?.length ?? 0;
    const step  = snap.metadata?.step;
    const id    = String(snap.config.configurable?.checkpoint_id ?? "").slice(0, 12);
    const turns = snap.values.turnCount ?? 0;
    console.log(`  [${i}] step=${String(step).padEnd(2)}  msgs=${msgs}  turns=${turns}  id=${id}...`);
  }

  // ── Time travel: go back to after turn 1 ─────────────────────
  // Find the checkpoint where turnCount === 1 (just after first worker ran)
  const afterTurn1 = history.find((s) => s.values.turnCount === 1);

  if (afterTurn1) {
    separator("Time-travelling back to after turn 1 (Alice intro only)");
    console.log(`  Branching from checkpoint: step=${afterTurn1.metadata?.step}  msgs=${afterTurn1.values.messages?.length}`);

    // Pass afterTurn1.config as the config — LangGraph restores THAT state
    const branchResult = await graph.invoke(
      { messages: [new HumanMessage("What country do I live in?")] },
      afterTurn1.config   // ← this is the time-travel key
    );

    // The branch only knows about "Alice" — NOT "Hanoi" (that was turns 2+)
    const branchAnswer = branchResult.messages?.at(-1) as AIMessage;
    console.log(`\n  Branch answer (should NOT know about Hanoi):`);
    console.log(`  "${String(branchAnswer.content).slice(0, 150)}"`);
    console.log(`\n  Branch turnCount: ${branchResult.turnCount}  (was 1, now 2)`);
  }
}

// ══════════════════════════════════════════════════════════════════
//  SECTION 6: STREAMING
//
//  graph.stream() instead of graph.invoke():
//  • Yields events as they happen, not after the whole graph finishes
//  • Two stream modes:
//      "values"  → full state snapshot after every node
//      "updates" → only the PATCH returned by each node
//
//  graph.streamEvents() (v2):
//  • Finer granularity: token-level streaming from the LLM
//  • Yields { event, name, data } for every LangChain event
// ══════════════════════════════════════════════════════════════════

async function runSection6_Streaming() {
  banner(6, "STREAMING — stream state updates and LLM tokens");

  const S6 = Annotation.Root({
    ...MessagesAnnotation.spec,
    next: Annotation<string>({ reducer: (_, v) => v, default: () => "" }),
  });

  const routerSchema = z.object({
    next: z.enum(["math", "general"]),
  });

  async function routerNode(state: typeof S6.State) {
    const text = String(state.messages.at(-1)?.content ?? "");
    const r = await llm.withStructuredOutput(routerSchema).invoke([
      new SystemMessage("Classify: 'math' or 'general'."),
      new HumanMessage(text),
    ]);
    return { next: r.next };
  }

  async function workerNode(state: typeof S6.State) {
    const resp = await llm.invoke([
      new SystemMessage("You are a helpful assistant. Be concise (2 sentences max)."),
      ...state.messages,
    ]);
    return { messages: [resp] };
  }

  const graph = new StateGraph(S6)
    .addNode("router", routerNode)
    .addNode("math",   workerNode)
    .addNode("general", workerNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", (s) => s.next, { math: "math", general: "general" })
    .addEdge("math",    END)
    .addEdge("general", END)
    .compile({ checkpointer: new MemorySaver() });

  // ── MODE A: stream("updates") — patch per node ───────────────
  separator('stream("updates") — shows only what each node CHANGED');
  const configA = { configurable: { thread_id: "stream-a-1" } };

  for await (const chunk of await graph.stream(
    { messages: [new HumanMessage("What is 12 * 12?")] },
    { ...configA, streamMode: "updates" }
  )) {
    // chunk = { nodeName: { ...patch } }
    for (const [nodeName, patch] of Object.entries(chunk as Record<string, any>)) {
      const msgs    = patch.messages?.length ?? 0;
      const hasNext = patch.next ? ` → routes to "${patch.next}"` : "";
      console.log(`  [update] ${nodeName}${hasNext}  +${msgs} msg(s)`);
      if (msgs > 0) {
        const content = String((patch.messages as BaseMessage[])[0]?.content ?? "").slice(0, 80);
        console.log(`           "${content}..."`);
      }
    }
  }

  // ── MODE B: stream("values") — full state after every node ───
  separator('stream("values") — shows FULL state snapshot after each node');
  const configB = { configurable: { thread_id: "stream-b-1" } };

  for await (const snapshot of await graph.stream(
    { messages: [new HumanMessage("What is the capital of Japan?")] },
    { ...configB, streamMode: "values" }
  )) {
    // snapshot = full state object
    const snap = snapshot as typeof S6.State;
    console.log(
      `  [values] msgs=${snap.messages?.length ?? 0}  ` +
      `next="${snap.next ?? ""}"  ` +
      `last=${snap.messages?.at(-1)?._getType() ?? "none"}`
    );
  }

  // ── MODE C: streamEvents — token-level streaming ─────────────
  separator("streamEvents — individual LLM tokens as they arrive");
  const configC = { configurable: { thread_id: "stream-c-1" } };

  process.stdout.write("  [tokens] ");
  let tokenCount = 0;

  for await (const event of graph.streamEvents(
    { messages: [new HumanMessage("Say 'Hello from LangGraph' and nothing else.")] },
    { ...configC, version: "v2" }
  )) {
    // Filter for LLM token events only
    if (
      event.event === "on_chat_model_stream" &&
      event.data?.chunk?.content
    ) {
      process.stdout.write(String(event.data.chunk.content));
      tokenCount++;
    }
  }
  console.log(`\n  (${tokenCount} token chunks received)`);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN — run all sections in order
// ══════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  LANGGRAPH DEEP DIVE                                     ║");
  console.log("║  1.Middleware  2.Interrupt  3.HITL  4.State              ║");
  console.log("║  5.TimeTravel  6.Streaming                               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await runSection1_Middleware();
  await runSection2_Interrupt();
  await runSection3_HITL();
  await runSection4_State();
  await runSection5_TimeTravel();
  await runSection6_Streaming();

  console.log("\n\n✅ All sections complete.");
}

main().catch(console.error);
