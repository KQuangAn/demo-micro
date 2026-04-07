/**
 * ══════════════════════════════════════════════════════════════════
 *  SIMPLE MULTI-AGENT WORKFLOW — Learn by Reading
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run: pnpm simple-multi-agent
 *
 *  GRAPH STRUCTURE:
 *
 *  START
 *    │
 *    ▼
 *  [router]  ← reads user message, decides who handles it
 *    │
 *    ├──► [weather_agent]  → handles weather questions
 *    │
 *    ├──► [math_agent]     → handles math questions
 *    │
 *    └──► [general_agent]  → handles everything else
 *              │
 *              ▼
 *             END
 *
 *  That's it. One router, three workers, done.
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, Annotation, MessagesAnnotation, MemorySaver, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
//  STEP 1: Define the shared state
//
//  Every node reads from AND writes to this state object.
//  We only need two fields:
//    - messages  → the conversation (built-in, auto-appended)
//    - next      → which agent the router picks
//
//  WITH CHECKPOINTER: after every node returns, LangGraph calls:
//    checkpointer.put(thread_id, currentState)
//
//  Checkpoint timeline for a single question:
//
//    invoke() called
//       │
//       ▼
//    [router runs]
//       │
//       ├──► CHECKPOINT #1 saved ← { next: "math", messages: [H] }
//       │
//    [math worker runs]
//       │
//       └──► CHECKPOINT #2 saved ← { next: "math", messages: [H, AI] }
//
//  Next invoke() with SAME thread_id resumes from CHECKPOINT #2.
//  The agent "remembers" the full conversation.
// ──────────────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,          // gives us `messages` with append reducer
  next: Annotation<string>({
    reducer: (_prev, val) => val,      // always overwrite — latest value wins
    default: () => "",
  }),
});

// ──────────────────────────────────────────────────────────────────
//  STEP 2: Create the LLM
// ──────────────────────────────────────────────────────────────────

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY!,
});

// ──────────────────────────────────────────────────────────────────
//  STEP 3: Define the ROUTER node
//
//  The router:
//  1. Reads the last user message
//  2. Uses structured output to pick an agent
//  3. Writes { next: "weather" | "math" | "general" } to state
//  4. Does NOT write any message — it just sets routing
// ──────────────────────────────────────────────────────────────────

const routerSchema = z.object({
  next: z.enum(["weather", "math", "general"]).describe(
    "weather → weather questions, math → calculations, general → everything else"
  ),
});

async function routerNode(state: typeof AgentState.State) {
  const lastMessage = state.messages.at(-1);
  const userText = lastMessage ? String(lastMessage.content) : "";

  console.log(`\n🔀 ROUTER reading: "${userText}"`);

  const result = await llm
    .withStructuredOutput(routerSchema)
    .invoke([
      new SystemMessage(
        "You are a router. Classify the user question: " +
        "'weather' for weather questions, " +
        "'math' for calculations or numbers, " +
        "'general' for everything else."
      ),
      new HumanMessage(userText),
    ]);

  console.log(`   → routes to: "${result.next}"`);
  console.log(`   💾 CHECKPOINT #1 will save: { next: "${result.next}", messages: [HumanMessage] }`);

  // Only write `next` — no messages
  return { next: result.next };
}

// ──────────────────────────────────────────────────────────────────
//  STEP 4: Define the WORKER nodes
//
//  Each worker:
//  1. Reads the messages from state
//  2. Answers the question
//  3. Appends ONE new AIMessage to state
// ──────────────────────────────────────────────────────────────────

async function weatherNode(state: typeof AgentState.State) {
  console.log("\n🌤  WEATHER AGENT answering...");

  const response = await llm.invoke([
    new SystemMessage(
      "You are a weather expert. Answer weather questions clearly and concisely."
    ),
    ...state.messages,
  ]);

  // Return only the new message — reducer will APPEND it
  return { messages: [response] };
}

async function mathNode(state: typeof AgentState.State) {
  console.log("\n🔢 MATH AGENT answering...");

  const response = await llm.invoke([
    new SystemMessage(
      "You are a math expert. Solve calculations step by step. Show your work."
    ),
    ...state.messages,
  ]);

  return { messages: [response] };
}

async function generalNode(state: typeof AgentState.State) {
  console.log("\n💬 GENERAL AGENT answering...");

  const response = await llm.invoke([
    new SystemMessage(
      "You are a helpful assistant. Answer the question clearly."
    ),
    ...state.messages,
  ]);

  return { messages: [response] };
}

// ──────────────────────────────────────────────────────────────────
//  STEP 5: Build the graph
//
//  .addNode()            — register a node by name
//  .addEdge()            — fixed connection A → B
//  .addConditionalEdges() — dynamic connection based on state
//  .compile()            — seal the graph so it can be invoked
// ──────────────────────────────────────────────────────────────────

// Declare OUTSIDE the graph chain so inspectCheckpointer() can use it
const checkpointer = new MemorySaver();

const graph = new StateGraph(AgentState)
  // Register nodes
  .addNode("router",  routerNode)
  .addNode("weather", weatherNode)
  .addNode("math",    mathNode)
  .addNode("general", generalNode)

  // Entry point: always start at router
  .addEdge(START, "router")

  // Dynamic routing: read state.next to decide which worker runs
  .addConditionalEdges(
    "router",                                // from this node...
    (state) => state.next,                   // ...read this field...
    {                                        // ...map values to node names
      weather: "weather",
      math:    "math",
      general: "general",
    }
  )

  // All workers go to END when done
  .addEdge("weather", END)
  .addEdge("math",    END)
  .addEdge("general", END)

  // ── Attach the checkpointer ───────────────────────────────────
  // MemorySaver = in-memory JS Map. Perfect for learning.
  // Production alternatives:
  //   PostgresSaver  → persists across restarts, multi-process safe
  //   RedisSaver     → fast, works in distributed systems
  //
  // We pull checkpointer OUT so inspectCheckpointer() can read it.
  // With checkpointer attached, LangGraph automatically saves state
  // AFTER every node exit — no extra code needed in nodes.
  .compile({ checkpointer });

// ──────────────────────────────────────────────────────────────────
//  STEP 6: Run it
//
//  thread_id is the key concept:
//  • Same thread_id  → LangGraph loads the last checkpoint and APPENDS
//                      to the existing messages array. Agent "remembers".
//  • New thread_id   → LangGraph starts fresh. Complete isolation.
//
//  invoke() accepts a second argument: { configurable: { thread_id } }
//  LangGraph reads it internally — you never touch the checkpointer directly.
// ──────────────────────────────────────────────────────────────────

async function ask(question: string, threadId: string = "default") {
  console.log("\n" + "─".repeat(50));
  console.log(`❓ [thread: ${threadId}] "${question}"`);

  const result = await graph.invoke(
    { messages: [new HumanMessage(question)] },
    { configurable: { thread_id: threadId } }   // ← ties this call to a thread
  );

  // The last message is the worker's response
  const answer = result.messages.at(-1) as AIMessage;
  console.log(`✅ Answer:   ${String(answer.content)}`);
  console.log(`   💾 CHECKPOINT #2 saved: messages array now has ${result.messages.length} item(s) for thread "${threadId}"`);
}

// ──────────────────────────────────────────────────────────────────
//  STEP 7: Inspect the checkpointer directly
//
//  graph.getState()        → latest snapshot for a thread
//  graph.getStateHistory() → ALL snapshots for a thread (newest first)
//
//  This lets you SEE what MemorySaver actually stores.
// ──────────────────────────────────────────────────────────────────

async function inspectCheckpointer(threadId: string, label: string) {
  console.log(`\n${"▼".repeat(52)}`);
  console.log(`📦 CHECKPOINTER CONTENTS — ${label}`);
  console.log(`   thread_id: "${threadId}"`);

  // getState() returns the LATEST checkpoint for this thread
  const state = await graph.getState({
    configurable: { thread_id: threadId },
  });

  const msgCount = state?.values?.messages?.length ?? 0;

  if (!state || msgCount === 0) {
    console.log("   ❌ No checkpoint found — thread has never been used");
    console.log(`${"▲".repeat(52)}`);
    return;
  }

  // ── Latest checkpoint ────────────────────────────────────────────
  console.log("\n   ┌─── LATEST CHECKPOINT ──────────────────────────────┐");
  console.log(`   │  checkpoint_id : ${String(state.config.configurable?.checkpoint_id ?? "").slice(0, 12)}...`);
  console.log(`   │  step          : ${state.metadata?.step}  (nodes run so far)`);
  console.log(`   │  next_nodes    : [${state.next.join(", ") || "—"}]  ([] = graph finished)`);
  console.log(`   │  state.next    : "${state.values.next}"`);
  console.log(`   │  messages count: ${msgCount}`);
  console.log("   │");
  console.log("   │  messages (full conversation stored):");

  for (const [i, msg] of (state.values.messages as any[]).entries()) {
    const role    = msg._getType();                                     // "human" | "ai"
    const preview = String(msg.content).slice(0, 55).replace(/\n/g, " ");
    const suffix  = String(msg.content).length > 55 ? "…" : "";
    console.log(`   │    [${i}] ${role.padEnd(6)} → "${preview}${suffix}"`);
  }
  console.log("   └────────────────────────────────────────────────────┘");

  // ── Full history ─────────────────────────────────────────────────
  // LangGraph saves a snapshot after EVERY node exit, not just at the end.
  // So 1 invoke() = 3 snapshots: entry + after-router + after-worker
  console.log("\n   ┌─── ALL SNAPSHOTS FOR THIS THREAD (newest first) ───┐");

  const snapshots: (typeof state)[] = [];
  for await (const snap of graph.getStateHistory({
    configurable: { thread_id: threadId },
  })) {
    snapshots.push(snap);
  }

  console.log(`   │  Total snapshots: ${snapshots.length}  (= ${snapshots.length / 3 | 0} invoke() call(s) × 3 nodes each)`);
  console.log("   │");

  for (const [i, snap] of snapshots.entries()) {
    const msgs  = snap.values?.messages?.length ?? 0;
    const step  = snap.metadata?.step ?? "?";
    const next  = snap.next?.join(", ") || "END";
    const id    = String(snap.config.configurable?.checkpoint_id ?? "").slice(0, 8);
    console.log(`   │  [${i}] step=${String(step).padEnd(2)}  msgs=${msgs}  next=[${next.padEnd(7)}]  id=${id}...`);
  }
  console.log("   └────────────────────────────────────────────────────┘");
  console.log(`${"▲".repeat(52)}`);
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║  CHECKPOINTER DEEP DIVE                               ║");
  console.log("║  Watch the storage change after every invoke()        ║");
  console.log("╚═══════════════════════════════════════════════════════╝");

  // ── PROOF 1: Before any call — checkpointer is empty ────────────
  console.log("\n\n══ PROOF 1: inspect BEFORE any call ══");
  await inspectCheckpointer("thread-budget", "BEFORE any call");

  // ── PROOF 2: After first call — 2 messages stored ───────────────
  console.log("\n\n══ PROOF 2: First call on thread-budget ══");
  await ask("My monthly salary is $5000.", "thread-budget");
  await inspectCheckpointer("thread-budget", "AFTER call #1");

  // ── PROOF 3: Second call on SAME thread — 4 messages now ────────
  // LangGraph loaded checkpoint from call #1 first,
  // so the worker sees [H1, AI1, H2] and returns AI2.
  // Result: [H1, AI1, H2, AI2] — full memory.
  console.log("\n\n══ PROOF 3: Second call — SAME thread ══");
  await ask("I spend 30% on rent. How much is left?", "thread-budget");
  await inspectCheckpointer("thread-budget", "AFTER call #2 — 4 messages, 6 snapshots");

  // ── PROOF 4: Different thread — completely isolated ──────────────
  // thread-budget is NOT touched by this call.
  console.log("\n\n══ PROOF 4: Different thread — isolation proof ══");
  await ask("What is 1337 * 42?", "thread-math-1");

  console.log("\n   → thread-budget (should still have 4 msgs, unchanged):");
  await inspectCheckpointer("thread-budget", "thread-budget unchanged");

  console.log("\n   → thread-math-1 (fresh, only 2 msgs):");
  await inspectCheckpointer("thread-math-1", "thread-math-1 isolated");

  // ── PROOF 5: invoke() WITHOUT thread_id ─────────────────────────
  // LangGraph REQUIRES thread_id when a checkpointer is attached.
  // Omitting it throws — nothing is saved, even though MemorySaver is there.
  console.log("\n\n══ PROOF 5: invoke() WITHOUT thread_id ══");
  try {
    await graph.invoke({ messages: [new HumanMessage("Will this be saved?")] });
    console.log("   (no error — inspect empty string thread)");
    await inspectCheckpointer("", "no thread_id");
  } catch (err) {
    console.log(`\n   ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    console.log("   ↑ Proof: thread_id is REQUIRED when checkpointer is attached.");
    console.log("   ↑ Without it, LangGraph cannot load OR save any state.");
  }
}

main().catch(console.error);
