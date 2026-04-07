/**
 * ══════════════════════════════════════════════════════════════════
 *  CUSTOM CHECKPOINT — Control WHAT and WHEN to save
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run: pnpm custom-checkpoint
 *
 *  Two questions answered here:
 *
 *  1. WHAT gets checkpointed?
 *     → Only the fields you put in your Annotation.Root()
 *     → You can EXCLUDE a field by not putting it in state
 *     → You can store EXTRA metadata by adding fields to state
 *
 *  2. WHEN does a checkpoint happen?
 *     → By default: after EVERY node exit (you can't skip this with MemorySaver)
 *     → Custom: extend BaseCheckpointSaver and override put() with your own logic
 *       e.g. "only save after worker nodes, skip router"
 *            "only save if messages > 2"
 *            "only save every 3 steps"
 *
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
} from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// ══════════════════════════════════════════════════════════════════
//  PART A: WHAT gets checkpointed — controlled by your state schema
// ══════════════════════════════════════════════════════════════════
//
//  The checkpointer saves the ENTIRE state object after each node.
//  So "what gets saved" = exactly what fields you define in Annotation.Root().
//
//  Compare three options:
//
//  Option 1 — Save LESS (strip debug/temp fields before storing):
//    Add a `summary` field instead of raw messages → smaller storage
//
//  Option 2 — Save MORE (add metadata alongside messages):
//    Add `turnCount`, `lastAgent`, `sessionId` to track extra info
//
//  Option 3 — Default (messages + routing field):
//    What simple-multi-agent.ts does
//
//  We use Option 2 here to demonstrate storing EXTRA fields.
// ──────────────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  // ── Standard fields ───────────────────────────────────────────
  ...MessagesAnnotation.spec,       // messages[] with append reducer

  next: Annotation<string>({
    reducer: (_prev, val) => val,   // overwrite: latest wins
    default: () => "",
  }),

  // ── EXTRA metadata fields — these WILL be checkpointed ────────
  // Because they are in Annotation.Root(), LangGraph saves them too.
  // Use this for anything you want to persist across turns.

  turnCount: Annotation<number>({
    reducer: (_prev, val) => val,   // overwrite each turn
    default: () => 0,
  }),

  lastAgent: Annotation<string>({
    reducer: (_prev, val) => val,
    default: () => "",
  }),

  // ── EPHEMERAL field example ────────────────────────────────────
  // If you want a field that is NOT persisted, you still have to
  // put it in state (LangGraph doesn't support "transient" fields natively).
  // The workaround: put it in state but reset it every turn.
  // Real answer: just use a local variable inside the node instead.
  debugLog: Annotation<string[]>({
    reducer: (prev, val) => [...prev, ...val],  // append
    default: () => [],
  }),
});

// ══════════════════════════════════════════════════════════════════
//  PART B: WHEN checkpoints happen — custom BaseCheckpointSaver
// ══════════════════════════════════════════════════════════════════
//
//  MemorySaver saves after EVERY node — no built-in filter.
//  To control WHEN, extend BaseCheckpointSaver and add logic to put().
//
//  The 4 methods you must implement:
//    getTuple(config)             → load a single checkpoint by config
//    list(config, options)        → list all checkpoints for a thread
//    put(config, checkpoint, ...)  → SAVE a checkpoint ← control here
//    putWrites(config, writes, taskId) → save pending writes mid-node
// ──────────────────────────────────────────────────────────────────

type StoredCheckpoint = {
  config:     RunnableConfig;
  checkpoint: Checkpoint;
  metadata:   CheckpointMetadata;
  parentConfig?: RunnableConfig;
};

class SelectiveCheckpointSaver extends BaseCheckpointSaver {
  // Internal storage: thread_id → checkpoint_id → data
  private storage = new Map<string, Map<string, StoredCheckpoint>>();

  // ── Control WHEN to skip ──────────────────────────────────────
  // You can inject any rule here. Three examples included.
  private skipRules: {
    skipRouterNode:    boolean;   // don't save after router, only after worker
    skipEveryNthStep:  number;    // 0 = save all, 2 = save every 2nd step
    onlySaveIfMsgs:    number;    // 0 = save all, N = only save when messages >= N
  };

  public saveLog: string[] = [];  // audit trail so we can print what was saved/skipped

  constructor(rules?: Partial<SelectiveCheckpointSaver["skipRules"]>) {
    super();
    this.skipRules = {
      skipRouterNode:   rules?.skipRouterNode   ?? false,
      skipEveryNthStep: rules?.skipEveryNthStep ?? 0,
      onlySaveIfMsgs:   rules?.onlySaveIfMsgs   ?? 0,
    };
  }

  // ── getTuple: load latest OR specific checkpoint ──────────────
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId    = config.configurable?.thread_id as string | undefined;
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;

    if (!threadId) return undefined;

    const threadMap = this.storage.get(threadId);
    if (!threadMap || threadMap.size === 0) return undefined;

    // If specific checkpoint_id requested, return that one
    if (checkpointId) {
      const entry = threadMap.get(checkpointId);
      if (!entry) return undefined;
      return {
        config:       entry.config,
        checkpoint:   entry.checkpoint,
        metadata:     entry.metadata,
        parentConfig: entry.parentConfig,
      };
    }

    // Otherwise return the LATEST (highest step number)
    let latest: StoredCheckpoint | undefined;
    for (const entry of threadMap.values()) {
      if (!latest || (entry.metadata.step ?? 0) > (latest.metadata.step ?? 0)) {
        latest = entry;
      }
    }
    if (!latest) return undefined;
    return {
      config:       latest.config,
      checkpoint:   latest.checkpoint,
      metadata:     latest.metadata,
      parentConfig: latest.parentConfig,
    };
  }

  // ── list: return all checkpoints for a thread (newest first) ──
  async *list(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig }
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return;

    const threadMap = this.storage.get(threadId);
    if (!threadMap) return;

    // Sort by step descending (newest first)
    const sorted = [...threadMap.values()].sort(
      (a, b) => (b.metadata.step ?? 0) - (a.metadata.step ?? 0)
    );

    let count = 0;
    for (const entry of sorted) {
      if (options?.limit && count >= options.limit) break;
      yield {
        config:       entry.config,
        checkpoint:   entry.checkpoint,
        metadata:     entry.metadata,
        parentConfig: entry.parentConfig,
      };
      count++;
    }
  }

  // ── put: SAVE a checkpoint — THIS is where you control WHEN ───
  async put(
    config:     RunnableConfig,
    checkpoint: Checkpoint,
    metadata:   CheckpointMetadata,
    newVersions: Record<string, string | number>
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    const step     = metadata.step ?? 0;
    const source   = metadata.source ?? "";

    // Build a checkpoint_id for this entry
    const checkpointId = checkpoint.id ?? `${threadId}-step-${step}`;

    // ── RULE 1: skip the router node (step 1 = after router) ────
    // step -1 = __start__ entry
    // step  0 = START node
    // step  1 = after router
    // step  2 = after worker
    if (this.skipRules.skipRouterNode && step === 1) {
      this.saveLog.push(`   ⏭  SKIPPED  step=${step}  source=${source}  (router node — rule: skipRouterNode)`);
      // Still return a config — LangGraph needs this to continue
      return { configurable: { thread_id: threadId, checkpoint_id: checkpointId } };
    }

    // ── RULE 2: only save every Nth step ────────────────────────
    if (this.skipRules.skipEveryNthStep > 0 && step % this.skipRules.skipEveryNthStep !== 0) {
      this.saveLog.push(`   ⏭  SKIPPED  step=${step}  source=${source}  (not a multiple of ${this.skipRules.skipEveryNthStep})`);
      return { configurable: { thread_id: threadId, checkpoint_id: checkpointId } };
    }

    // ── RULE 3: only save when message count reaches threshold ───
    const msgCount = (checkpoint.channel_values?.messages as any[])?.length ?? 0;
    if (this.skipRules.onlySaveIfMsgs > 0 && msgCount < this.skipRules.onlySaveIfMsgs) {
      this.saveLog.push(`   ⏭  SKIPPED  step=${step}  msgs=${msgCount}  (below threshold of ${this.skipRules.onlySaveIfMsgs} — rule: onlySaveIfMsgs)`);
      return { configurable: { thread_id: threadId, checkpoint_id: checkpointId } };
    }

    // ── All rules passed — SAVE ──────────────────────────────────
    const entry: StoredCheckpoint = {
      config:       { configurable: { thread_id: threadId, checkpoint_id: checkpointId } },
      checkpoint:   { ...checkpoint, id: checkpointId },
      metadata,
      parentConfig: config.configurable?.checkpoint_id
        ? { configurable: { thread_id: threadId, checkpoint_id: config.configurable.checkpoint_id as string } }
        : undefined,
    };

    if (!this.storage.has(threadId)) {
      this.storage.set(threadId, new Map());
    }
    this.storage.get(threadId)!.set(checkpointId, entry);

    this.saveLog.push(`   ✅ SAVED    step=${step}  msgs=${msgCount}  source=${source}  id=${checkpointId.slice(0, 8)}...`);

    return { configurable: { thread_id: threadId, checkpoint_id: checkpointId } };
  }

  // ── putWrites: store mid-node pending writes ─────────────────
  // Called during streaming when a node produces partial output.
  // For our purposes, we just store them (no filtering needed here).
  async putWrites(
    config:  RunnableConfig,
    writes:  PendingWrite[],
    taskId:  string
  ): Promise<void> {
    // Not needed for our demo — only relevant for streaming/interrupts
  }

  // ── deleteThread: remove all checkpoints for a thread ────────
  // Required by BaseCheckpointSaver interface.
  async deleteThread(threadId: string): Promise<void> {
    this.storage.delete(threadId);
  }

  // ── Helper: how many checkpoints are stored? ─────────────────
  countSaved(threadId: string): number {
    return this.storage.get(threadId)?.size ?? 0;
  }
}

// ══════════════════════════════════════════════════════════════════
//  LLM + ROUTER
// ══════════════════════════════════════════════════════════════════

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY!,
});

const routerSchema = z.object({
  next: z.enum(["weather", "math", "general"]).describe(
    "weather → weather questions, math → calculations, general → everything else"
  ),
});

// ══════════════════════════════════════════════════════════════════
//  NODES — same as simple-multi-agent, but workers also write
//  the EXTRA metadata fields (turnCount, lastAgent, debugLog)
// ══════════════════════════════════════════════════════════════════

async function routerNode(state: typeof AgentState.State) {
  const userText = String(state.messages.at(-1)?.content ?? "");
  const result = await llm.withStructuredOutput(routerSchema).invoke([
    new SystemMessage("Classify: 'weather', 'math', or 'general'."),
    new HumanMessage(userText),
  ]);
  console.log(`   🔀 router → "${result.next}"`);
  return {
    next:     result.next,
    debugLog: [`router picked: ${result.next}`],  // written to state but may be skipped
  };
}

async function makeWorkerNode(agentName: string, systemPrompt: string) {
  return async function workerNode(state: typeof AgentState.State) {
    console.log(`   🤖 ${agentName} answering...`);
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]);
    return {
      messages:  [response],
      turnCount: state.turnCount + 1,   // incremented each time a worker runs
      lastAgent: agentName,
      debugLog:  [`${agentName} responded at turn ${state.turnCount + 1}`],
    };
  };
}

// ══════════════════════════════════════════════════════════════════
//  GRAPH FACTORY — accepts any checkpointer so we can swap rules
// ══════════════════════════════════════════════════════════════════

async function buildGraph(checkpointer: SelectiveCheckpointSaver) {
  const weatherNode = await makeWorkerNode("weather", "You are a weather expert. Be concise.");
  const mathNode    = await makeWorkerNode("math",    "You are a math expert. Show your work.");
  const generalNode = await makeWorkerNode("general", "You are a helpful assistant.");

  return new StateGraph(AgentState)
    .addNode("router",  routerNode)
    .addNode("weather", weatherNode)
    .addNode("math",    mathNode)
    .addNode("general", generalNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", (s) => s.next, {
      weather: "weather",
      math:    "math",
      general: "general",
    })
    .addEdge("weather", END)
    .addEdge("math",    END)
    .addEdge("general", END)
    .compile({ checkpointer });
}

// ══════════════════════════════════════════════════════════════════
//  DEMO RUNNER
// ══════════════════════════════════════════════════════════════════

async function runDemo(
  label:       string,
  rules:       Partial<SelectiveCheckpointSaver["skipRules"]>,
  questions:   { q: string; thread: string }[]
) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  DEMO: ${label}`);
  console.log(`  Rules: ${JSON.stringify(rules)}`);
  console.log(`${"═".repeat(60)}`);

  const checkpointer = new SelectiveCheckpointSaver(rules);
  const graph        = await buildGraph(checkpointer);

  for (const { q, thread } of questions) {
    console.log(`\n  ❓ [${thread}] "${q}"`);
    const result = await graph.invoke(
      { messages: [new HumanMessage(q)] },
      { configurable: { thread_id: thread } }
    );
    const answer = result.messages.at(-1) as AIMessage;
    console.log(`  ✅ turn=${result.turnCount}  lastAgent=${result.lastAgent}`);
    console.log(`     ${String(answer.content).slice(0, 80).replace(/\n/g, " ")}...`);
  }

  // Print the save/skip audit log
  console.log(`\n  📋 CHECKPOINT AUDIT LOG:`);
  for (const line of checkpointer.saveLog) console.log(line);

  // Print storage stats per thread
  const threads = [...new Set(questions.map((q) => q.thread))];
  console.log(`\n  📦 STORED CHECKPOINT COUNTS:`);
  for (const t of threads) {
    console.log(`     thread "${t}" → ${checkpointer.countSaved(t)} checkpoint(s) stored`);
  }
}

// ══════════════════════════════════════════════════════════════════
//  MAIN — three demos showing different WHEN rules
// ══════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  CUSTOM CHECKPOINT — Control WHAT and WHEN to save       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // ── DEMO 1: Save EVERYTHING (baseline — same as MemorySaver) ───
  await runDemo(
    "Save everything (default)",
    {},
    [
      { q: "What is 10 * 10?",            thread: "t1" },
      { q: "What is the result + 5?",     thread: "t1" },  // follow-up on same thread
    ]
  );

  // ── DEMO 2: Skip router node — only save after worker runs ─────
  // Saves 50% fewer checkpoints. Safe because we only need to restore
  // AFTER a complete turn (human+AI), not mid-routing.
  await runDemo(
    "Skip router node (only save after worker)",
    { skipRouterNode: true },
    [
      { q: "What is the capital of France?", thread: "t2" },
      { q: "And what language do they speak?", thread: "t2" },
    ]
  );

  // ── DEMO 3: Only save when messages >= 3 (skip early turns) ────
  // Use case: don't bother storing state until the conversation
  // has enough context to be worth resuming.
  await runDemo(
    "Only save when messages >= 3",
    { onlySaveIfMsgs: 3 },
    [
      { q: "My name is Alice.",              thread: "t3" },  // 1 msg → SKIP
      { q: "I am 30 years old.",             thread: "t3" },  // 2 msgs → SKIP
      { q: "What year was I born?",          thread: "t3" },  // 3 msgs → SAVE
    ]
  );
}

main().catch(console.error);
